import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';

const root = resolve(import.meta.dirname, '..');
const wrangler = join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const wranglerConfig = join(root, 'dist', 'english_os', 'wrangler.json');
const migrationFiles = readdirSync(join(root, 'migrations'), { withFileTypes: true })
	.filter((entry) => entry.isFile() && /^\d{4}_.+\.sql$/u.test(entry.name))
	.map((entry) => entry.name)
	.sort((left, right) => left.localeCompare(right, 'en', { numeric: true }));
assert.equal(migrationFiles[0], '0001_initial.sql', 'the migration chain must start at 0001');
assert.equal(
	migrationFiles.at(-1),
	'0013_language_neutral_session_support.sql',
	'the migration chain must end at language-neutral session support',
);
const stageAssessmentMigrationSql = readFileSync(
	join(root, 'migrations', '0009_stage_assessments.sql'),
	'utf8',
);
assert.doesNotMatch(
	stageAssessmentMigrationSql,
	/\b(?:DROP|CREATE)\s+TRIGGER\s+assessment_mutation_write_guard\b/u,
	'0009 must preserve the existing assessment guard instead of dropping and recreating it in one remote D1 migration batch',
);
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/u;
const temporaryRoot = mkdtempSync(join(tmpdir(), 'english-os-d1-'));
const freshPersistence = join(temporaryRoot, 'fresh');
const legacyPersistence = join(temporaryRoot, 'legacy');
mkdirSync(freshPersistence, { recursive: true });
mkdirSync(legacyPersistence, { recursive: true });

function runWrangler(args, options = {}) {
	const result = spawnSync(process.execPath, [wrangler, ...args], {
		cwd: root,
		encoding: 'utf8',
		windowsHide: true,
		...options,
	});
	if (result.status !== 0) {
		throw new Error(
			`wrangler ${args.join(' ')} failed\n${result.error?.message ?? ''}\n${result.stdout ?? ''}\n${result.stderr ?? ''}`,
		);
	}
	return result.stdout ?? '';
}

function d1Args(persistence, extra) {
	return ['--config', wranglerConfig, 'd1', ...extra, '--local', '--persist-to', persistence];
}

function executeFile(persistence, file) {
	runWrangler(d1Args(persistence, ['execute', 'english-os-local', '--yes', '--file', file]));
}

function executeSql(persistence, sql) {
	return runWrangler(
		d1Args(persistence, ['execute', 'english-os-local', '--yes', '--json', '--command', sql]),
	);
}

function queryRows(persistence, sql) {
	const raw = executeSql(persistence, sql).trim();
	const parsed = JSON.parse(raw);
	return parsed.flatMap((entry) => entry.results ?? []);
}

async function availablePort() {
	return new Promise((resolvePort, reject) => {
		const server = net.createServer();
		server.unref();
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			assert.ok(address && typeof address === 'object');
			const port = address.port;
			server.close(() => resolvePort(port));
		});
	});
}

async function startWorker(persistence) {
	const port = await availablePort();
	let output = '';
	const child = spawn(
		process.execPath,
		[
			wrangler,
			'--config',
			wranglerConfig,
			'dev',
			'--local',
			'--persist-to',
			persistence,
			'--ip',
			'127.0.0.1',
			'--port',
			String(port),
			'--var',
			'ALLOW_LOCAL_AUTH:true',
			'--show-interactive-dev-session=false',
			'--log-level=error',
		],
		{
			cwd: root,
			detached: process.platform === 'win32',
			stdio: ['ignore', 'pipe', 'pipe'],
			windowsHide: true,
		},
	);
	child.stdout.on('data', (chunk) => (output += String(chunk)));
	child.stderr.on('data', (chunk) => (output += String(chunk)));
	const baseUrl = `http://127.0.0.1:${port}`;
	for (let attempt = 0; attempt < 120; attempt += 1) {
		if (child.exitCode !== null) throw new Error(`wrangler dev stopped early\n${output}`);
		try {
			const response = await fetch(`${baseUrl}/api/v1/health`);
			if (response.ok) return { baseUrl, child, output: () => output };
		} catch {
			// The listener is not ready yet.
		}
		await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
	}
	await stopWorker(child);
	throw new Error(`wrangler dev did not become ready\n${output}`);
}

async function stopWorker(child) {
	if (child.exitCode !== null) return;
	if (process.platform === 'win32') {
		spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
			encoding: 'utf8',
			windowsHide: true,
		});
	} else {
		try {
			process.kill(-child.pid, 'SIGTERM');
		} catch {
			child.kill('SIGTERM');
		}
	}
	await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
}

function dateIn(timeZone, instant = new Date()) {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).formatToParts(instant);
	const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
	return `${value.year}-${value.month}-${value.day}`;
}

function addDays(date, days) {
	const value = new Date(`${date}T12:00:00.000Z`);
	value.setUTCDate(value.getUTCDate() + days);
	return value.toISOString().slice(0, 10);
}

function hash(value) {
	return createHash('sha256').update(value).digest('hex');
}

async function api(baseUrl, path, { user, method = 'GET', body } = {}) {
	let response;
	for (let attempt = 0; attempt < 3; attempt += 1) {
		try {
			response = await fetch(`${baseUrl}${path}`, {
				method,
				headers: {
					accept: 'application/json',
					...(body === undefined ? {} : { 'content-type': 'application/json' }),
					...(user ? { 'x-english-os-local-user': user } : {}),
				},
				body: body === undefined ? undefined : JSON.stringify(body),
			});
			break;
		} catch (error) {
			if (attempt === 2) throw error;
			await new Promise((resolveDelay) => setTimeout(resolveDelay, 150));
		}
	}
	assert.ok(response, 'local Worker must return a response');
	const text = await response.text();
	return { status: response.status, body: text ? JSON.parse(text) : null };
}

function profileMutation({ operationId, baseVersion, startDate, timeZone, updatedAt }) {
	return {
		operationId,
		schemaVersion: 1,
		deviceId: '22222222-2222-4222-8222-222222222222',
		entityType: 'profile-settings',
		entityId: 'current',
		operationType: 'upsert',
		payload: {
			profile: {
				id: 'current',
				onboarded: true,
				learnerName: 'Local D1 Regression',
				goal: 'Verify real D1 behavior',
				timeZone,
				startDate,
				currentDay: 1,
				streak: 0,
				updatedAt,
			},
			settings: {
				id: 'current',
				dailyMinutes: 20,
				syncEnabled: true,
				reduceMotion: false,
				updatedAt,
			},
		},
		baseVersion,
		createdAt: updatedAt,
	};
}

function sessionPayload({
	sessionId,
	sessionType,
	occurredAt,
	summaryJa,
	curriculumDay = 1,
	mistakeCount = 0,
	mistakeOriginal = 'I go yesterday.',
	mistakeCorrection = 'I went yesterday.',
}) {
	const mistake = {
		category: 'grammar_tense',
		learnerSaid: mistakeOriginal,
		suggested: mistakeCorrection,
		explanationJa: '過去形を使います。',
		severity: 'medium',
	};
	return {
		schemaVersion: '1.0',
		sessionId,
		sessionType,
		curriculumDay,
		occurredAt,
		durationMinutes: sessionType === 'core' ? 10 : 5,
		boost: sessionType === 'core' ? null : { duration: 5, mode: 'speaking_sprint' },
		summaryJa,
		evaluation: {
			taskCompletion: 4,
			grammar: 4,
			vocabulary: 4,
			fluency: 4,
			interaction: 4,
			commentJa: 'ローカルD1の回帰テストです。',
		},
		mistakes: Array.from({ length: mistakeCount }, () => ({ ...mistake })),
		newVocabulary:
			sessionType === 'core'
				? [
						{ text: ' Ｈｅｌｌｏ ', meaningJa: 'こんにちは', example: 'Hello, Sam.' },
						{ text: 'hello', meaningJa: 'こんにちは', example: 'Hello again.' },
					]
				: [],
		newPhrases: [],
		previewGrammar: [],
		reviewCards: mistakeCount
			? [
					{ front: 'I go yesterday.', back: 'I went yesterday.', sourceMistakeIndex: 0 },
					{ front: 'Past form?', back: 'went', sourceMistakeIndex: mistakeCount - 1 },
				]
			: [],
	};
}

function englishSessionPayload(input) {
	const legacy = sessionPayload(input);
	const { summaryJa: _summaryJa, evaluation, ...common } = legacy;
	const { commentJa: _commentJa, ...scores } = evaluation;
	return {
		...common,
		schemaVersion: '1.1',
		supportLanguage: 'en',
		summary: input.summaryJa,
		evaluation: { ...scores, comment: 'Local D1 English regression.' },
		mistakes: legacy.mistakes.map(({ explanationJa: _explanationJa, ...item }) => ({
			...item,
			explanation: 'Use the simple past for a finished time.',
		})),
		newVocabulary: legacy.newVocabulary.map(({ meaningJa: _meaningJa, ...item }) => ({
			...item,
			meaning: 'a common greeting',
		})),
		newPhrases: legacy.newPhrases.map(({ meaningJa: _meaningJa, ...item }) => ({
			...item,
			meaning: 'a useful conversational expression',
		})),
		previewGrammar: legacy.previewGrammar.map(({ noteJa: _noteJa, ...item }) => ({
			...item,
			note: 'Preview note.',
		})),
	};
}

async function verifyFreshDatabase() {
	runWrangler(d1Args(freshPersistence, ['migrations', 'apply', 'english-os-local']));
	const migrationHistoryBeforeReapply = queryRows(
		freshPersistence,
		'SELECT name FROM d1_migrations ORDER BY id',
	);
	assert.deepEqual(
		migrationHistoryBeforeReapply.map((row) => row.name),
		migrationFiles,
		'the fresh database must record every numbered migration exactly once',
	);
	runWrangler(d1Args(freshPersistence, ['migrations', 'apply', 'english-os-local']));
	const migrationHistoryAfterReapply = queryRows(
		freshPersistence,
		'SELECT name FROM d1_migrations ORDER BY id',
	);
	assert.deepEqual(
		migrationHistoryAfterReapply,
		migrationHistoryBeforeReapply,
		'reapplying through Wrangler must be a no-op with stable migration history',
	);
	assert.deepEqual(
		queryRows(
			freshPersistence,
			`SELECT curriculum_id, content_version, active_total_days FROM curriculum_catalog`,
		),
		[
			{
				curriculum_id: 'english-os-core',
				content_version: 'b2-challenge-365-v1',
				active_total_days: 365,
			},
		],
	);
	const curriculumSchema = queryRows(
		freshPersistence,
		`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'curriculum_days'`,
	);
	assert.match(curriculumSchema[0].sql, /day_number BETWEEN 1 AND 540/u);
	const assessmentSchema = queryRows(
		freshPersistence,
		`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'assessments'`,
	);
	assert.match(assessmentSchema[0].sql, /'baseline', 'weekly', 'stage'/u);
	assert.deepEqual(queryRows(freshPersistence, 'PRAGMA foreign_key_check'), []);
	executeFile(freshPersistence, './db/seed.sql');
	assert.deepEqual(
		queryRows(
			freshPersistence,
			`SELECT COUNT(*) AS count, MIN(day_number) AS first_day, MAX(day_number) AS last_day
			 FROM curriculum_days`,
		),
		[{ count: 365, first_day: 1, last_day: 365 }],
	);
	executeSql(
		freshPersistence,
		`INSERT INTO curriculum_days (day_number, phase, title, grammar_topic_key, scenario)
		 VALUES (366, 7, 'Capacity Day 366', 'capacity-366', 'capacity'),
		        (540, 6, 'Capacity Day 540', 'capacity-540', 'capacity');
		 DELETE FROM curriculum_days WHERE day_number IN (366, 540);`,
	);
	assert.throws(
		() =>
			executeSql(
				freshPersistence,
				`INSERT INTO daily_progress (
					learner_id, study_date, curriculum_day, review_completed, grammar_completed,
					core_voice_imported, core_completed, version, updated_at
				 ) VALUES (
					'local-learner', '2025-12-31', 1, 0, 0, 1, 0, 1, '2025-12-31T00:00:00.000Z'
				 )`,
			),
		/daily_progress_insert_invariant/u,
		'direct inserts cannot claim a Core Voice import without a Core session',
	);
	executeSql(
		freshPersistence,
		`INSERT INTO session_imports (
			id, learner_id, external_session_id, idempotency_key, source_text_hash, kind,
			study_date, occurred_at, curriculum_day, boost_duration_minutes, boost_mode,
			summary_ja, duration_minutes, task_completion_score, grammar_score,
			vocabulary_score, fluency_score, interaction_score, evaluation_comment_ja,
			contract_version, imported_at
		 ) VALUES (
			'guard-session', 'local-learner', 'guard-external-session', 'guard-operation',
			'${'a'.repeat(64)}', 'core', '2025-12-30', '2025-12-30T00:00:00.000Z', 1,
			NULL, NULL, 'guard', 10, 4, 4, 4, 4, 4, 'guard', 1,
			'2025-12-30T00:00:00.000Z'
		 )`,
	);
	assert.throws(
		() =>
			executeSql(
				freshPersistence,
				`INSERT INTO daily_progress (
					learner_id, study_date, curriculum_day, review_completed, grammar_completed,
					core_voice_imported, core_completed, version, updated_at
				 ) VALUES (
					'local-learner', '2025-12-30', 1, 1, 1, 1, 0, 1,
					'2025-12-30T00:00:00.000Z'
				 )`,
			),
		/daily_progress_insert_invariant/u,
		'direct inserts must store the exact derived Core completion value',
	);
	executeSql(
		freshPersistence,
		`INSERT INTO daily_progress (
			learner_id, study_date, curriculum_day, review_completed, grammar_completed,
			core_voice_imported, core_completed, version, updated_at
		 ) VALUES (
			'local-learner', '2025-12-30', 1, 1, 1, 1, 1, 1,
			'2025-12-30T00:00:00.000Z'
		 )`,
	);
	assert.throws(
		() =>
			executeSql(
				freshPersistence,
				`UPDATE daily_progress SET curriculum_day = 2
				 WHERE learner_id = 'local-learner' AND study_date = '2025-12-30'`,
			),
		/daily_progress_update_invariant/u,
		'updates cannot detach Core Voice completion from its matching Core session',
	);
	assert.throws(
		() =>
			executeSql(
				freshPersistence,
				`UPDATE daily_progress SET grammar_completed = 0
				 WHERE learner_id = 'local-learner' AND study_date = '2025-12-30'`,
			),
		/daily_progress_update_invariant/u,
		'updates must preserve the exact derived Core completion value',
	);
	const today = dateIn('Asia/Tokyo');
	const boundaryUser = 'active-boundary-day-365';
	const boundaryAccessSubject = hash(boundaryUser);
	const boundaryLearnerId = `learner-${boundaryAccessSubject.slice(0, 32)}`;
	executeSql(
		freshPersistence,
		`INSERT INTO learners (
		   id, access_subject, timezone, start_date, created_at, updated_at
		 ) VALUES (
		   '${boundaryLearnerId}', '${boundaryAccessSubject}', 'Asia/Tokyo', '2020-01-01',
		   '2020-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z'
		 );
		 WITH RECURSIVE days(day_number) AS (
		   SELECT 1 UNION ALL SELECT day_number + 1 FROM days WHERE day_number < 364
		 )
		 INSERT INTO session_imports (
		   id, learner_id, external_session_id, idempotency_key, source_text_hash, kind,
		   study_date, occurred_at, curriculum_day, boost_duration_minutes, boost_mode,
		   summary_ja, duration_minutes, task_completion_score, grammar_score,
		   vocabulary_score, fluency_score, interaction_score, evaluation_comment_ja,
		   contract_version, imported_at
		 )
		 SELECT
		   'boundary-session-' || day_number, '${boundaryLearnerId}',
		   'boundary-external-' || day_number, 'boundary-operation-' || day_number,
		   printf('%064d', day_number + 1000), 'core',
		   date('2020-01-01', printf('+%d days', day_number - 1)),
		   date('2020-01-01', printf('+%d days', day_number - 1)) || 'T00:00:00.000Z',
		   day_number, NULL, NULL, 'Day 365 boundary fixture', 10, 4, 4, 4, 4, 4,
		   'Day 365 boundary fixture', 1,
		   date('2020-01-01', printf('+%d days', day_number - 1)) || 'T00:00:00.000Z'
		 FROM days;
		 WITH RECURSIVE days(day_number) AS (
		   SELECT 1 UNION ALL SELECT day_number + 1 FROM days WHERE day_number < 364
		 )
		 INSERT INTO daily_progress (
		   learner_id, study_date, curriculum_day, review_completed, grammar_completed,
		   core_voice_imported, core_completed, version, updated_at
		 )
		 SELECT
		   '${boundaryLearnerId}',
		   date('2020-01-01', printf('+%d days', day_number - 1)), day_number,
		   1, 1, 1, 1, 1,
		   date('2020-01-01', printf('+%d days', day_number - 1)) || 'T00:00:00.000Z'
		 FROM days;`,
	);
	let worker = await startWorker(freshPersistence);
	try {
		const now = new Date().toISOString();
		const occurredAt = `${today}T09:00:00+09:00`;
		const user = 'fresh-d1-regression';
		const boundaryPayload = englishSessionPayload({
			sessionId: '90909090-9090-4090-8090-909090909090',
			sessionType: 'core',
			occurredAt,
			summaryJa: 'ACTIVE boundary Day 365',
			curriculumDay: 365,
		});
		const boundaryImport = await api(worker.baseUrl, '/api/v1/session-imports', {
			user: boundaryUser,
			method: 'POST',
			body: {
				payload: boundaryPayload,
				studyDate: today,
				idempotencyKey: '90909090-9090-4090-8090-909090909091',
				sourceTextHash: hash(JSON.stringify(boundaryPayload)),
				reviewedCardIds: [],
				expectedVersion: 0,
			},
		});
		assert.equal(boundaryImport.status, 201, JSON.stringify(boundaryImport.body));
		assert.deepEqual(
			queryRows(
				freshPersistence,
				`SELECT imports.curriculum_day, progress.curriculum_day AS progress_day,
				        imports.support_language, imports.summary_ja, imports.summary_text,
				        mirror.version AS mirror_version
				 FROM session_imports AS imports
				 JOIN learners AS learner ON learner.id = imports.learner_id
				 JOIN daily_progress AS progress
				   ON progress.learner_id = learner.id AND progress.study_date = '${today}'
				 JOIN sync_entities AS mirror
				   ON mirror.learner_id = learner.id
				  AND mirror.entity_type = 'session'
				  AND mirror.entity_id = imports.external_session_id
				 WHERE learner.access_subject = '${hash(boundaryUser)}'
				   AND imports.curriculum_day = 365
				   AND imports.external_session_id = '${boundaryPayload.sessionId}'`,
			),
			[
				{
					curriculum_day: 365,
					progress_day: 365,
					support_language: 'en',
					summary_ja: null,
					summary_text: 'ACTIVE boundary Day 365',
					mirror_version: 1,
				},
			],
			'ACTIVE boundary Day 365 must commit physical and sync records',
		);
		for (const [curriculumDay, sessionId, operationId] of [
			[366, '91919191-9191-4191-8191-919191919191', '92929292-9292-4292-8292-929292929292'],
			[540, '94949494-9494-4494-8494-949494949494', '95959595-9595-4595-8595-959595959595'],
		]) {
			const unavailablePayload = sessionPayload({
				sessionId,
				sessionType: 'core',
				occurredAt,
				summaryJa: `ACTIVE外Day ${curriculumDay}`,
				curriculumDay,
			});
			const rejected = await api(worker.baseUrl, '/api/v1/session-imports', {
				user,
				method: 'POST',
				body: {
					payload: unavailablePayload,
					studyDate: today,
					idempotencyKey: operationId,
					sourceTextHash: hash(JSON.stringify(unavailablePayload)),
					reviewedCardIds: [],
					expectedVersion: 0,
				},
			});
			assert.equal(rejected.status, 422, JSON.stringify(rejected.body));
			assert.equal(rejected.body.error.code, 'curriculum_day_unavailable');
			assert.equal(rejected.body.error.activeTotalDays, 365);
		}
		const rejectedLearnerId = `learner-${hash(user).slice(0, 32)}`;
		assert.deepEqual(
			queryRows(
				freshPersistence,
				`SELECT
				   (SELECT COUNT(*) FROM session_imports WHERE learner_id = '${rejectedLearnerId}') AS sessions,
				   (SELECT COUNT(*) FROM daily_progress WHERE learner_id = '${rejectedLearnerId}') AS progress,
				   (SELECT COUNT(*) FROM sync_entities WHERE learner_id = '${rejectedLearnerId}') AS mirrors,
				   (SELECT COUNT(*) FROM change_log WHERE learner_id = '${rejectedLearnerId}') AS changes,
				   (SELECT COUNT(*) FROM processed_mutations WHERE learner_id = '${rejectedLearnerId}') AS processed`,
			),
			[{ sessions: 0, progress: 0, mirrors: 0, changes: 0, processed: 0 }],
			'ACTIVE-bound rejection must leave no physical or synchronization side effect',
		);

		// ALLOW_LOCAL_AUTH intentionally supplies a local-only fallback identity when
		// the header is absent. Production fail-closed behavior is covered by app.test.ts.
		assert.equal((await api(worker.baseUrl, `/api/v1/today?date=${today}`)).status, 200);
		assert.equal(
			(
				await api(worker.baseUrl, '/api/v1/sync/mutations', {
					user,
					method: 'POST',
					body: profileMutation({
						operationId: '11111111-1111-4111-8111-111111111111',
						baseVersion: 0,
						startDate: today,
						timeZone: 'Asia/Tokyo',
						updatedAt: now,
					}),
				})
			).status,
			201,
		);

		const previewPayload = sessionPayload({
			sessionId: '33333333-3333-4333-8333-333333333333',
			sessionType: 'core',
			occurredAt,
			summaryJa: 'Core D1 regression',
			mistakeCount: 2,
		});
		const previewRequest = {
			payload: previewPayload,
			studyDate: today,
			idempotencyKey: '44444444-4444-4444-8444-444444444444',
			sourceTextHash: hash(JSON.stringify(previewPayload)),
			reviewedCardIds: [],
		};
		const preview = await api(worker.baseUrl, '/api/v1/session-imports/preview', {
			user,
			method: 'POST',
			body: previewRequest,
		});
		assert.equal(preview.status, 200);
		assert.equal(preview.body.data.countsIncoming.words, 1);

		const firstProgress = await api(worker.baseUrl, `/api/v1/daily-progress/${today}`, {
			user,
			method: 'PATCH',
			body: {
				curriculumDay: 1,
				reviewCompleted: true,
				expectedVersion: 0,
				clientMutationId: '55555555-5555-4555-8555-555555555555',
				updatedAt: now,
			},
		});
		assert.equal(firstProgress.status, 200);
		assert.equal(firstProgress.body.data.version, 1);
		const secondProgress = await api(worker.baseUrl, `/api/v1/daily-progress/${today}`, {
			user,
			method: 'PATCH',
			body: {
				curriculumDay: 1,
				grammarCompleted: true,
				expectedVersion: 1,
				clientMutationId: '66666666-6666-4666-8666-666666666666',
				updatedAt: now,
			},
		});
		assert.equal(secondProgress.status, 200);
		assert.equal(secondProgress.body.data.version, 2);

		const staleOperation = '77777777-7777-4777-8777-777777777777';
		const stale = await api(worker.baseUrl, `/api/v1/daily-progress/${today}`, {
			user,
			method: 'PATCH',
			body: {
				curriculumDay: 1,
				grammarCompleted: true,
				expectedVersion: 1,
				clientMutationId: staleOperation,
				updatedAt: now,
			},
		});
		assert.equal(stale.status, 409);
		const changesAfterConflict = await api(
			worker.baseUrl,
			'/api/v1/sync/changes?cursor=0&limit=500',
			{
				user,
			},
		);
		assert.equal(changesAfterConflict.status, 200);
		assert.ok(
			changesAfterConflict.body.data.changes.every(
				(change) => change.operationId !== staleOperation,
			),
			'conflicted D1 batch must not leave a change-log acknowledgement',
		);

		const coreImport = await api(worker.baseUrl, '/api/v1/session-imports', {
			user,
			method: 'POST',
			body: previewRequest,
		});
		assert.equal(coreImport.status, 201);
		assert.equal(coreImport.body.data.coreProgress.coreCompleted, true);

		const changedZone = await api(worker.baseUrl, '/api/v1/sync/mutations', {
			user,
			method: 'POST',
			body: profileMutation({
				operationId: '88888888-8888-4888-8888-888888888888',
				baseVersion: 1,
				startDate: today,
				timeZone: 'America/Los_Angeles',
				updatedAt: new Date().toISOString(),
			}),
		});
		assert.equal(changedZone.status, 201);
		const replayAfterZoneChange = await api(worker.baseUrl, '/api/v1/session-imports', {
			user,
			method: 'POST',
			body: previewRequest,
		});
		assert.equal(replayAfterZoneChange.status, 200);
		assert.equal(replayAfterZoneChange.body.data.replayed, true);

		const boostPayload = sessionPayload({
			sessionId: '99999999-9999-4999-8999-999999999999',
			sessionType: 'boost',
			occurredAt: `${today}T12:00:00-07:00`,
			summaryJa: 'Boost D1 regression',
			mistakeCount: 1,
			mistakeOriginal: 'She go every day.',
			mistakeCorrection: 'She goes every day.',
		});
		boostPayload.mistakes.push({
			category: 'grammar_tense',
			learnerSaid: 'I go yesterday.',
			suggested: 'I went yesterday.',
			explanationJa: '過去形を使います。',
			severity: 'medium',
		});
		const boostRequest = {
			payload: boostPayload,
			studyDate: today,
			idempotencyKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
			sourceTextHash: hash(JSON.stringify(boostPayload)),
			reviewedCardIds: [],
		};
		const boostPreview = await api(worker.baseUrl, '/api/v1/session-imports/preview', {
			user,
			method: 'POST',
			body: boostRequest,
		});
		assert.equal(boostPreview.status, 200, JSON.stringify(boostPreview.body));
		assert.equal(boostPreview.body.data.duplicate, null, JSON.stringify(boostPreview.body));
		const boostImport = await api(worker.baseUrl, '/api/v1/session-imports', {
			user,
			method: 'POST',
			body: boostRequest,
		});
		if (boostImport.status !== 201) {
			await stopWorker(worker.child);
			const rows = queryRows(
				freshPersistence,
				`SELECT 'session' AS kind, external_session_id AS id, idempotency_key AS detail
				 FROM session_imports
				 UNION ALL
				 SELECT 'mistake', id, canonical_identity FROM mistakes
				 UNION ALL
				 SELECT 'card', id, source_type || ':' || source_id FROM review_cards
				 UNION ALL
				 SELECT 'sync', entity_type || ':' || entity_id, last_mutation_id FROM sync_entities`,
			);
			assert.equal(
				boostImport.status,
				201,
				JSON.stringify({ body: boostImport.body, rows, worker: worker.output() }),
			);
		}

		const bootstrap = await api(worker.baseUrl, '/api/v1/sync/bootstrap', { user });
		assert.equal(bootstrap.status, 200, JSON.stringify(bootstrap.body));
		assert.equal(bootstrap.body.data.activeTotalDays, 365);
		const entities = bootstrap.body.data.entities;
		const mistakes = entities.filter(
			(entity) => entity.entityType === 'mistake' && entity.operation === 'upsert',
		);
		assert.equal(mistakes.length, 2);
		assert.equal(
			mistakes.find((entity) => entity.payload?.original === 'I go yesterday.')?.payload
				.repetitions,
			3,
		);
		const sharedMistake = mistakes.find((entity) => entity.payload?.original === 'I go yesterday.');
		assert.ok(sharedMistake, 'the Core and Boost fixtures must share one semantic mistake');
		const completedGrammar = entities.find(
			(entity) =>
				entity.entityType === 'grammar-progress' && entity.payload?.status === 'completed',
		);
		assert.equal(completedGrammar.entityId, 'completed:d1-grammar');
		const mistakeCards = entities.filter(
			(entity) => entity.entityType === 'review-card' && entity.payload?.sourceType === 'mistake',
		);
		assert.equal(mistakeCards.length, 2);
		for (const entity of entities.filter(
			(entity) => entity.entityType === 'review-card' && entity.operation === 'upsert',
		)) {
			assert.match(entity.payload.dueAt, TIMESTAMP_PATTERN);
		}
		const persistedReviewCardMirrors = queryRows(
			freshPersistence,
			`SELECT json_extract(payload_json, '$.dueAt') AS due_at
			 FROM sync_entities WHERE entity_type = 'review-card' AND operation = 'upsert'`,
		);
		assert.ok(persistedReviewCardMirrors.length > 0);
		for (const mirror of persistedReviewCardMirrors) {
			assert.match(mirror.due_at, TIMESTAMP_PATTERN);
		}
		const boostMistake = entities.find(
			(entity) =>
				entity.entityType === 'mistake' && entity.payload?.original === 'She go every day.',
		);
		assert.ok(boostMistake, 'the Boost fixture must create a session-owned mistake');
		const boostMistakeCard = entities.find(
			(entity) =>
				entity.entityType === 'review-card' && entity.payload?.sourceId === boostMistake.entityId,
		);
		assert.ok(boostMistakeCard, 'the Boost fixture must create a mistake review card');
		const coreMistakeIds = new Set([sharedMistake.entityId]);
		const coreOwnedEntityKeys = new Set(
			entities
				.filter(
					(entity) =>
						(entity.entityType === 'session' && entity.entityId === previewPayload.sessionId) ||
						(entity.entityType === 'mistake' && coreMistakeIds.has(entity.entityId)) ||
						(entity.entityType === 'learning-item' &&
							entity.entityId.startsWith(`${previewPayload.sessionId}:`)) ||
						(entity.entityType === 'acquisition-event' &&
							entity.payload?.sourceSessionId === previewPayload.sessionId) ||
						(entity.entityType === 'review-card' &&
							(coreMistakeIds.has(entity.payload?.sourceId) ||
								String(entity.payload?.sourceId).startsWith(`${previewPayload.sessionId}:`))),
				)
				.map((entity) => `${entity.entityType}:${entity.entityId}`),
		);

		const card = mistakeCards[0].payload;
		const reviewOperation = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
		const reviewRequest = {
			operationId: reviewOperation,
			eventId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
			cardId: card.id,
			grade: 'good',
			occurredAt: `${today}T12:30:00-07:00`,
			studyDate: today,
			curriculumDay: 1,
			expectedVersion: card.version,
		};
		const review = await api(worker.baseUrl, '/api/v1/review-events', {
			user,
			method: 'POST',
			body: reviewRequest,
		});
		assert.equal(review.status, 201, JSON.stringify(review.body));
		const reviewReplay = await api(worker.baseUrl, '/api/v1/review-events', {
			user,
			method: 'POST',
			body: reviewRequest,
		});
		assert.equal(reviewReplay.status, 200);
		assert.equal(reviewReplay.body.data.replayed, true);

		const assessment = await api(worker.baseUrl, '/api/v1/assessments/baseline', {
			user,
			method: 'PUT',
			body: {
				operationId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
				assessment: {
					id: 'baseline:current',
					type: 'baseline',
					completedAt: now,
					payload: {
						confidence: 3,
						taskCompletion: 4,
						grammar: 4,
						vocabulary: 4,
						fluency: 3,
						interaction: 4,
						strengths: ['応答'],
						priorities: ['流暢さ'],
					},
				},
				expectedVersion: 0,
			},
		});
		assert.equal(assessment.status, 201);

		const stageAttemptId = '19191919-1919-4919-8919-191919191919';
		const stageOperationId = '20202020-2020-4020-8020-202020202020';
		const stageAssessmentPayload = {
			schemaVersion: '1.0',
			assessmentId: 'english-os-stage-assessment-foundation-v1',
			attemptId: stageAttemptId,
			assessmentType: 'stage',
			stageId: 'english-os-core-stage-foundation-a1-a2',
			curriculumRange: { startDay: 1, endDay: 90 },
			completedAt: now,
			result: 'provisional',
			scores: { grammar: 4, vocabulary: 4, speaking: 3, interaction: 4 },
			strengths: ['会話を継続できた'],
			reinforcementTargets: ['過去形'],
			evidence: [{ skill: 'grammar', note: '過去形を使えた。' }],
			nextTargets: ['理由を詳しく述べる'],
		};
		const stageRequest = {
			operationId: stageOperationId,
			assessment: {
				id: stageAttemptId,
				type: 'stage',
				completedAt: now,
				payload: stageAssessmentPayload,
			},
			expectedVersion: 0,
		};
		const stageAssessment = await api(worker.baseUrl, '/api/v1/assessments/stage', {
			user,
			method: 'PUT',
			body: stageRequest,
		});
		assert.equal(stageAssessment.status, 201, JSON.stringify(stageAssessment.body));
		assert.equal(stageAssessment.body.data.assessmentId, stageAssessmentPayload.assessmentId);
		assert.equal(stageAssessment.body.data.attemptId, stageAttemptId);
		assert.equal(stageAssessment.body.data.version, 1);
		const stageReplay = await api(worker.baseUrl, '/api/v1/assessments/stage', {
			user,
			method: 'PUT',
			body: stageRequest,
		});
		assert.equal(stageReplay.status, 200);
		assert.equal(stageReplay.body.data.replayed, true);
		const staleStageOperation = '21212121-2121-4121-8121-212121212121';
		const staleStage = await api(worker.baseUrl, '/api/v1/assessments/stage', {
			user,
			method: 'PUT',
			body: { ...stageRequest, operationId: staleStageOperation },
		});
		assert.equal(staleStage.status, 409);
		assert.equal(staleStage.body.error.code, 'assessment_version_conflict');
		const independentAttemptId = '31313131-3131-4131-8131-313131313131';
		const independentOperationId = '32323232-3232-4232-8232-323232323232';
		const independentAssessmentPayload = {
			schemaVersion: '1.0',
			assessmentId: 'english-os-stage-assessment-independent-v1',
			attemptId: independentAttemptId,
			assessmentType: 'stage',
			stageId: 'english-os-core-stage-independent-a2-b1-entry',
			curriculumRange: { startDay: 91, endDay: 180 },
			completedAt: now,
			result: 'reinforcement-recommended',
			scores: {
				grammar: 4,
				vocabulary: 4,
				speaking: 3,
				interaction: 4,
				listening: 3,
				fluency: 3,
			},
			strengths: ['理由と例を加えられた'],
			reinforcementTargets: ['自然速度の聞き返し'],
			evidence: [{ skill: 'interaction', note: '言い換えで会話を修復した。' }],
			nextTargets: ['8分会話を安定させる'],
		};
		const independentAssessment = await api(worker.baseUrl, '/api/v1/assessments/stage', {
			user,
			method: 'PUT',
			body: {
				operationId: independentOperationId,
				assessment: {
					id: independentAttemptId,
					type: 'stage',
					completedAt: now,
					payload: independentAssessmentPayload,
				},
				expectedVersion: 0,
			},
		});
		assert.equal(independentAssessment.status, 201, JSON.stringify(independentAssessment.body));
		assert.equal(independentAssessment.body.data.version, 1);
		const fluencyAttemptId = '41414141-4141-4141-8141-414141414141';
		const fluencyOperationId = '42424242-4242-4242-8242-424242424242';
		const fluencyAssessmentPayload = {
			schemaVersion: '1.0',
			assessmentId: 'english-os-stage-assessment-fluency-v1',
			attemptId: fluencyAttemptId,
			assessmentType: 'stage',
			stageId: 'english-os-core-stage-fluency-b1-b1-plus',
			curriculumRange: { startDay: 181, endDay: 270 },
			completedAt: now,
			result: 'provisional',
			scores: {
				speaking: 4,
				interaction: 4,
				fluency: 3,
				grammar: 4,
				vocabulary: 4,
				listening: 3,
			},
			strengths: ['要点をまとめて言い換えられた'],
			reinforcementTargets: ['自然速度のdetail理解'],
			evidence: [{ skill: 'fluency', note: '長い発話を修復しながら継続した。' }],
			nextTargets: ['clarificationを早める'],
		};
		const fluencyAssessment = await api(worker.baseUrl, '/api/v1/assessments/stage', {
			user,
			method: 'PUT',
			body: {
				operationId: fluencyOperationId,
				assessment: {
					id: fluencyAttemptId,
					type: 'stage',
					completedAt: now,
					payload: fluencyAssessmentPayload,
				},
				expectedVersion: 0,
			},
		});
		assert.equal(fluencyAssessment.status, 201, JSON.stringify(fluencyAssessment.body));
		assert.equal(fluencyAssessment.body.data.version, 1);
		const graduationAttemptId = '46464646-4646-4646-8646-464646464646';
		const graduationOperationId = '47474747-4747-4747-8747-474747474747';
		const graduationAssessmentPayload = {
			schemaVersion: '1.0',
			assessmentId: 'english-os-stage-assessment-graduation-v1',
			attemptId: graduationAttemptId,
			assessmentType: 'stage',
			stageId: 'english-os-core-stage-b2-challenge-b1-plus-b2',
			curriculumRange: { startDay: 271, endDay: 365 },
			completedAt: now,
			result: 'pass',
			cefrEstimate: 'B2-entry',
			scores: {
				speaking: 4,
				interaction: 4,
				fluency: 4,
				grammar: 4,
				vocabulary: 4,
				listening: 3,
			},
			strengths: ['根拠と反対意見を統合できた'],
			reinforcementTargets: ['自然速度での暗示理解'],
			evidence: [{ skill: 'interaction', note: '反論を要約して応答した。' }],
			nextTargets: ['推測の確度を調整する'],
		};
		const graduationAssessment = await api(worker.baseUrl, '/api/v1/assessments/stage', {
			user,
			method: 'PUT',
			body: {
				operationId: graduationOperationId,
				assessment: {
					id: graduationAttemptId,
					type: 'stage',
					completedAt: now,
					payload: graduationAssessmentPayload,
				},
				expectedVersion: 0,
			},
		});
		assert.equal(graduationAssessment.status, 201, JSON.stringify(graduationAssessment.body));
		assert.equal(graduationAssessment.body.data.version, 1);
		await stopWorker(worker.child);
		assert.deepEqual(
			queryRows(
				freshPersistence,
				`SELECT type, completed_at, payload_json, version, last_mutation_id
				 FROM assessments WHERE id = '${stageAttemptId}'`,
			),
			[
				{
					type: 'stage',
					completed_at: now,
					payload_json: JSON.stringify(stageAssessmentPayload),
					version: 1,
					last_mutation_id: stageOperationId,
				},
			],
		);
		const stageMirror = queryRows(
			freshPersistence,
			`SELECT operation, payload_json, version, last_mutation_id
			 FROM sync_entities
			 WHERE entity_type = 'assessment' AND entity_id = '${stageAttemptId}'`,
		);
		assert.deepEqual(
			queryRows(
				freshPersistence,
				`SELECT type, version, last_mutation_id FROM assessments
				 WHERE id = '${independentAttemptId}'`,
			),
			[{ type: 'stage', version: 1, last_mutation_id: independentOperationId }],
		);
		assert.deepEqual(
			queryRows(
				freshPersistence,
				`SELECT type, version, last_mutation_id FROM assessments
				 WHERE id = '${graduationAttemptId}'`,
			),
			[{ type: 'stage', version: 1, last_mutation_id: graduationOperationId }],
		);
		assert.deepEqual(
			queryRows(
				freshPersistence,
				`SELECT type, version, last_mutation_id FROM assessments
				 WHERE id = '${fluencyAttemptId}'`,
			),
			[{ type: 'stage', version: 1, last_mutation_id: fluencyOperationId }],
		);
		assert.equal(stageMirror[0].operation, 'upsert');
		assert.equal(stageMirror[0].version, 1);
		assert.equal(stageMirror[0].last_mutation_id, stageOperationId);
		assert.deepEqual(JSON.parse(stageMirror[0].payload_json), stageRequest.assessment);
		assert.deepEqual(
			queryRows(
				freshPersistence,
				`SELECT
				   (SELECT COUNT(*) FROM processed_mutations
				    WHERE mutation_id = '${stageOperationId}') AS processed,
				   (SELECT COUNT(*) FROM change_log
				    WHERE operation_id = '${stageOperationId}'
				      AND entity_type = 'sync:assessment' AND entity_id = '${stageAttemptId}') AS changes`,
			),
			[{ processed: 1, changes: 1 }],
		);
		assert.deepEqual(
			queryRows(
				freshPersistence,
				`SELECT COUNT(*) AS count FROM processed_mutations
				 WHERE mutation_id = '${staleStageOperation}'`,
			),
			[{ count: 0 }],
		);
		assert.deepEqual(
			queryRows(
				freshPersistence,
				`SELECT COUNT(*) AS count FROM change_log
				 WHERE operation_id = '${staleStageOperation}'`,
			),
			[{ count: 0 }],
		);
		worker = await startWorker(freshPersistence);

		const deleted = await api(worker.baseUrl, '/api/v1/sync/deletions', {
			user,
			method: 'POST',
			body: {
				operationId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
				schemaVersion: 1,
				deviceId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
				entityType: 'session',
				entityId: boostPayload.sessionId,
				expectedVersion: 1,
				createdAt: new Date().toISOString(),
			},
		});
		assert.equal(deleted.status, 201, JSON.stringify(deleted.body));
		const afterDelete = await api(worker.baseUrl, '/api/v1/sync/bootstrap', { user });
		const tombstone = afterDelete.body.data.entities.find(
			(entity) => entity.entityType === 'session' && entity.entityId === boostPayload.sessionId,
		);
		assert.equal(tombstone.operation, 'delete');
		assert.equal(tombstone.payload, null);
		const boostMistakeTombstone = afterDelete.body.data.entities.find(
			(entity) => entity.entityType === 'mistake' && entity.entityId === boostMistake.entityId,
		);
		const boostCardTombstone = afterDelete.body.data.entities.find(
			(entity) =>
				entity.entityType === 'review-card' && entity.entityId === boostMistakeCard.entityId,
		);
		assert.equal(boostMistakeTombstone.operation, 'delete');
		assert.equal(boostMistakeTombstone.payload, null);
		assert.equal(boostCardTombstone.operation, 'delete');
		assert.equal(boostCardTombstone.payload, null);
		const sharedMistakeAfterBoostDelete = afterDelete.body.data.entities.find(
			(entity) => entity.entityType === 'mistake' && entity.entityId === sharedMistake.entityId,
		);
		assert.equal(sharedMistakeAfterBoostDelete.operation, 'upsert');
		assert.equal(sharedMistakeAfterBoostDelete.payload.repetitions, 3);
		assert.equal(sharedMistakeAfterBoostDelete.payload.sessionId, previewPayload.sessionId);
		assert.equal(tombstone.operationId, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
		for (const entity of [boostMistakeTombstone, boostCardTombstone]) {
			assert.match(entity.operationId, UUID_V4_PATTERN);
			assert.notEqual(entity.operationId, tombstone.operationId);
		}
		assert.notEqual(boostMistakeTombstone.operationId, boostCardTombstone.operationId);

		const repeatPayload = sessionPayload({
			sessionId: 'abababab-abab-4bab-8bab-abababababab',
			sessionType: 'boost',
			occurredAt: `${today}T13:00:00-07:00`,
			summaryJa: 'Shared mistake version regression',
			mistakeCount: 1,
		});
		const repeatImport = await api(worker.baseUrl, '/api/v1/session-imports', {
			user,
			method: 'POST',
			body: {
				payload: repeatPayload,
				studyDate: today,
				idempotencyKey: 'acacacac-acac-4cac-8cac-acacacacacac',
				sourceTextHash: hash(JSON.stringify(repeatPayload)),
				reviewedCardIds: [],
			},
		});
		assert.equal(repeatImport.status, 201, JSON.stringify(repeatImport.body));
		const afterRepeatImport = await api(worker.baseUrl, '/api/v1/sync/bootstrap', { user });
		const sharedMistakeAfterRepeat = afterRepeatImport.body.data.entities.find(
			(entity) => entity.entityType === 'mistake' && entity.entityId === sharedMistake.entityId,
		);
		assert.equal(sharedMistakeAfterRepeat.payload.repetitions, 4);
		assert.ok(sharedMistakeAfterRepeat.version > sharedMistakeAfterBoostDelete.version);
		const staleSharedDelete = await api(worker.baseUrl, '/api/v1/sync/deletions', {
			user,
			method: 'POST',
			body: {
				operationId: 'adadadad-adad-4dad-8dad-adadadadadad',
				schemaVersion: 1,
				deviceId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
				entityType: 'mistake',
				entityId: sharedMistake.entityId,
				expectedVersion: sharedMistakeAfterBoostDelete.version,
				createdAt: new Date().toISOString(),
			},
		});
		assert.equal(staleSharedDelete.status, 409, JSON.stringify(staleSharedDelete.body));
		const repeatDeleted = await api(worker.baseUrl, '/api/v1/sync/deletions', {
			user,
			method: 'POST',
			body: {
				operationId: 'aeaeaeae-aeae-4eae-8eae-aeaeaeaeaeae',
				schemaVersion: 1,
				deviceId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
				entityType: 'session',
				entityId: repeatPayload.sessionId,
				expectedVersion: 1,
				createdAt: new Date().toISOString(),
			},
		});
		assert.equal(repeatDeleted.status, 201, JSON.stringify(repeatDeleted.body));
		const afterRepeatDelete = await api(worker.baseUrl, '/api/v1/sync/bootstrap', { user });
		const sharedMistakeAfterRepeatDelete = afterRepeatDelete.body.data.entities.find(
			(entity) => entity.entityType === 'mistake' && entity.entityId === sharedMistake.entityId,
		);
		assert.equal(sharedMistakeAfterRepeatDelete.operation, 'upsert');
		assert.equal(sharedMistakeAfterRepeatDelete.payload.repetitions, 4);
		assert.equal(sharedMistakeAfterRepeatDelete.payload.sessionId, previewPayload.sessionId);
		assert.ok(sharedMistakeAfterRepeatDelete.version > sharedMistakeAfterRepeat.version);
		await stopWorker(worker.child);
		const deletedDomainRows = queryRows(
			freshPersistence,
			`SELECT
			   (SELECT COUNT(*) FROM session_imports WHERE external_session_id IN ('${boostPayload.sessionId}', '${repeatPayload.sessionId}')) AS sessions,
			   (SELECT COUNT(*) FROM mistakes WHERE id = '${boostMistake.entityId}') AS mistakes,
			   (SELECT COUNT(*) FROM review_cards WHERE id = '${boostMistakeCard.entityId}') AS cards,
			   (SELECT COUNT(*) FROM mistakes WHERE id = '${sharedMistake.entityId}') AS shared_mistakes`,
		);
		assert.deepEqual(deletedDomainRows, [
			{ sessions: 0, mistakes: 0, cards: 0, shared_mistakes: 1 },
		]);
		worker = await startWorker(freshPersistence);

		const concurrentUser = 'concurrent-first-mistake-regression';
		const concurrentProfile = await api(worker.baseUrl, '/api/v1/sync/mutations', {
			user: concurrentUser,
			method: 'POST',
			body: profileMutation({
				operationId: randomUUID(),
				baseVersion: 0,
				startDate: today,
				timeZone: 'Asia/Tokyo',
				updatedAt: now,
			}),
		});
		assert.equal(concurrentProfile.status, 201);
		for (const [expectedVersion, field] of [
			[0, 'reviewCompleted'],
			[1, 'grammarCompleted'],
		]) {
			const progress = await api(worker.baseUrl, `/api/v1/daily-progress/${today}`, {
				user: concurrentUser,
				method: 'PATCH',
				body: {
					curriculumDay: 1,
					[field]: true,
					expectedVersion,
					clientMutationId: randomUUID(),
					updatedAt: now,
				},
			});
			assert.equal(progress.status, 200);
		}
		const concurrentPayloads = [
			sessionPayload({
				sessionId: '12345678-1234-4234-8234-1234567890ab',
				sessionType: 'core',
				occurredAt: `${today}T10:00:00+09:00`,
				summaryJa: 'Concurrent Core A',
				mistakeCount: 1,
			}),
			sessionPayload({
				sessionId: 'abcdefab-cdef-4abc-8def-abcdefabcdef',
				sessionType: 'core',
				occurredAt: `${today}T11:00:00+09:00`,
				summaryJa: 'Concurrent Core B',
				mistakeCount: 1,
			}),
		];
		const concurrentImports = await Promise.all(
			concurrentPayloads.map((payload) =>
				api(worker.baseUrl, '/api/v1/session-imports', {
					user: concurrentUser,
					method: 'POST',
					body: {
						payload,
						studyDate: today,
						idempotencyKey: randomUUID(),
						sourceTextHash: hash(JSON.stringify(payload)),
						reviewedCardIds: [],
					},
				}),
			),
		);
		assert.deepEqual(
			concurrentImports.map((result) => result.status),
			[201, 201],
			JSON.stringify(concurrentImports.map((result) => result.body)),
		);
		const concurrentBootstrap = await api(worker.baseUrl, '/api/v1/sync/bootstrap', {
			user: concurrentUser,
		});
		const concurrentMistakes = concurrentBootstrap.body.data.entities.filter(
			(entity) => entity.entityType === 'mistake' && entity.operation === 'upsert',
		);
		if (concurrentMistakes.length !== 1) {
			await stopWorker(worker.child);
			const rows = queryRows(
				freshPersistence,
				`SELECT 'mistake' AS kind, id, canonical_identity AS detail FROM mistakes
				 UNION ALL SELECT 'sync', entity_type || ':' || entity_id, payload_json
				 FROM sync_entities WHERE entity_type IN ('mistake', 'review-card')`,
			);
			assert.equal(
				concurrentMistakes.length,
				1,
				JSON.stringify({ bootstrap: concurrentBootstrap.body, rows }),
			);
		}
		assert.equal(concurrentMistakes[0].payload.repetitions, 2);
		assert.equal(
			concurrentBootstrap.body.data.entities.filter(
				(entity) => entity.entityType === 'review-card' && entity.payload?.sourceType === 'mistake',
			).length,
			1,
		);
		const concurrentProgress = concurrentBootstrap.body.data.entities.find(
			(entity) =>
				entity.entityType === 'daily-progress' &&
				entity.entityId === `study:${today}:curriculum:1` &&
				entity.operation === 'upsert',
		);
		assert.ok(concurrentProgress, 'concurrent imports must leave a daily-progress sync mirror');
		assert.equal(concurrentProgress.version, concurrentProgress.payload.version);
		const progressAfterConcurrentImports = await api(
			worker.baseUrl,
			`/api/v1/daily-progress/${today}`,
			{
				user: concurrentUser,
				method: 'PATCH',
				body: {
					curriculumDay: 1,
					reviewCompleted: true,
					expectedVersion: concurrentProgress.version,
					clientMutationId: randomUUID(),
					updatedAt: new Date().toISOString(),
				},
			},
		);
		assert.equal(
			progressAfterConcurrentImports.status,
			200,
			JSON.stringify(progressAfterConcurrentImports.body),
		);
		assert.equal(
			progressAfterConcurrentImports.body.data.version,
			concurrentProgress.version + 1,
			'the mirrored version must equal the physical row version after concurrent imports',
		);

		const futureUser = 'future-start-regression';
		const futureStart = addDays(today, 1);
		const futureProfile = await api(worker.baseUrl, '/api/v1/sync/mutations', {
			user: futureUser,
			method: 'POST',
			body: profileMutation({
				operationId: randomUUID(),
				baseVersion: 0,
				startDate: futureStart,
				timeZone: 'Asia/Tokyo',
				updatedAt: now,
			}),
		});
		assert.equal(futureProfile.status, 201);
		const beforeStart = await api(worker.baseUrl, `/api/v1/daily-progress/${today}`, {
			user: futureUser,
			method: 'PATCH',
			body: {
				curriculumDay: 1,
				reviewCompleted: true,
				expectedVersion: 0,
				clientMutationId: randomUUID(),
				updatedAt: now,
			},
		});
		assert.equal(beforeStart.status, 422);
		assert.equal(beforeStart.body.error.code, 'curriculum_not_started');

		const restoreUser = 'daily-progress-restore-version-regression';
		const restoreEntityId = `study:${today}:curriculum:1`;
		const restoreProfile = await api(worker.baseUrl, '/api/v1/sync/mutations', {
			user: restoreUser,
			method: 'POST',
			body: profileMutation({
				operationId: randomUUID(),
				baseVersion: 0,
				startDate: today,
				timeZone: 'Asia/Tokyo',
				updatedAt: now,
			}),
		});
		assert.equal(restoreProfile.status, 201, JSON.stringify(restoreProfile.body));
		const patchRestoredProgress = (expectedVersion, operationId, sourceVersion) =>
			api(worker.baseUrl, `/api/v1/daily-progress/${today}`, {
				user: restoreUser,
				method: 'PATCH',
				body: {
					curriculumDay: 1,
					reviewCompleted: true,
					expectedVersion,
					...(sourceVersion === undefined ? {} : { sourceVersion }),
					clientMutationId: operationId,
					updatedAt: now,
				},
			});
		const deleteRestoredProgress = (expectedVersion) =>
			api(worker.baseUrl, '/api/v1/sync/deletions', {
				user: restoreUser,
				method: 'POST',
				body: {
					operationId: randomUUID(),
					schemaVersion: 1,
					deviceId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
					entityType: 'daily-progress',
					entityId: restoreEntityId,
					expectedVersion,
					createdAt: now,
				},
			});

		const initialRestoreProgress = await patchRestoredProgress(0, randomUUID());
		assert.equal(initialRestoreProgress.status, 200, JSON.stringify(initialRestoreProgress.body));
		assert.equal(initialRestoreProgress.body.data.version, 1);
		let restoreVersion = 1;
		for (let cycle = 0; cycle < 2; cycle += 1) {
			const deletedProgress = await deleteRestoredProgress(restoreVersion);
			assert.equal(deletedProgress.status, 201, JSON.stringify(deletedProgress.body));
			assert.equal(deletedProgress.body.data.version, restoreVersion + 1);
			const restoredProgress = await patchRestoredProgress(
				deletedProgress.body.data.version,
				randomUUID(),
				1,
			);
			assert.equal(restoredProgress.status, 200, JSON.stringify(restoredProgress.body));
			assert.equal(restoredProgress.body.data.version, deletedProgress.body.data.version + 1);
			restoreVersion = restoredProgress.body.data.version;
		}
		const productionShapeDelete = await deleteRestoredProgress(restoreVersion);
		assert.equal(productionShapeDelete.status, 201, JSON.stringify(productionShapeDelete.body));
		assert.equal(productionShapeDelete.body.data.version, 6);
		const progressRestoreOperation = randomUUID();
		const productionShapeRequest = {
			curriculumDay: 1,
			reviewCompleted: true,
			expectedVersion: 6,
			sourceVersion: 1,
			clientMutationId: progressRestoreOperation,
			updatedAt: now,
		};
		const productionShapeRestore = await api(worker.baseUrl, `/api/v1/daily-progress/${today}`, {
			user: restoreUser,
			method: 'PATCH',
			body: productionShapeRequest,
		});
		assert.equal(productionShapeRestore.status, 200, JSON.stringify(productionShapeRestore.body));
		assert.equal(productionShapeRestore.body.data.version, 7);
		const responseLossRetry = await api(worker.baseUrl, `/api/v1/daily-progress/${today}`, {
			user: restoreUser,
			method: 'PATCH',
			body: productionShapeRequest,
		});
		assert.equal(responseLossRetry.status, 200, JSON.stringify(responseLossRetry.body));
		assert.equal(responseLossRetry.body.data.replayed, true);
		assert.equal(responseLossRetry.body.data.version, 7);
		const replayMismatch = await api(worker.baseUrl, `/api/v1/daily-progress/${today}`, {
			user: restoreUser,
			method: 'PATCH',
			body: { ...productionShapeRequest, sourceVersion: 2 },
		});
		assert.equal(replayMismatch.status, 409, JSON.stringify(replayMismatch.body));
		assert.equal(replayMismatch.body.error.code, 'mutation_replay_mismatch');

		const afterProductionShapeRestore = await api(worker.baseUrl, '/api/v1/sync/bootstrap', {
			user: restoreUser,
		});
		const restoredMirror = afterProductionShapeRestore.body.data.entities.find(
			(entity) => entity.entityType === 'daily-progress' && entity.entityId === restoreEntityId,
		);
		assert.equal(restoredMirror.operation, 'upsert');
		assert.equal(restoredMirror.version, 7);
		assert.equal(restoredMirror.payload.version, 7);
		const staleProgressRestoreOperation = randomUUID();
		const staleAfterRestore = await patchRestoredProgress(6, staleProgressRestoreOperation, 1);
		assert.equal(staleAfterRestore.status, 409, JSON.stringify(staleAfterRestore.body));
		assert.equal(staleAfterRestore.body.error.version, 7);
		const conflictResolutionOperation = randomUUID();
		const resolvedRestoreConflict = await patchRestoredProgress(7, conflictResolutionOperation, 1);
		assert.equal(resolvedRestoreConflict.status, 200, JSON.stringify(resolvedRestoreConflict.body));
		assert.equal(resolvedRestoreConflict.body.data.version, 8);

		const concurrencyDelete = await deleteRestoredProgress(8);
		assert.equal(concurrencyDelete.status, 201, JSON.stringify(concurrencyDelete.body));
		assert.equal(concurrencyDelete.body.data.version, 9);
		const concurrentRestoreOperations = [randomUUID(), randomUUID()];
		const concurrentRestores = await Promise.all(
			concurrentRestoreOperations.map((operationId) => patchRestoredProgress(9, operationId, 1)),
		);
		assert.deepEqual(
			concurrentRestores.map((result) => result.status).sort((left, right) => left - right),
			[200, 409],
			JSON.stringify(concurrentRestores),
		);
		const concurrentWinnerIndex = concurrentRestores.findIndex((result) => result.status === 200);
		const concurrentWinnerOperation = concurrentRestoreOperations[concurrentWinnerIndex];
		const concurrentLoserOperation = concurrentRestoreOperations[1 - concurrentWinnerIndex];
		assert.equal(concurrentRestores[concurrentWinnerIndex].body.data.version, 10);
		const secondContextBootstrap = await api(worker.baseUrl, '/api/v1/sync/bootstrap', {
			user: restoreUser,
		});
		const secondContextProgress = secondContextBootstrap.body.data.entities.find(
			(entity) => entity.entityType === 'daily-progress' && entity.entityId === restoreEntityId,
		);
		assert.equal(secondContextProgress.operation, 'upsert');
		assert.equal(secondContextProgress.version, 10);
		assert.equal(secondContextProgress.payload.version, 10);
		const restoreChanges = await api(worker.baseUrl, '/api/v1/sync/changes?cursor=0&limit=500', {
			user: restoreUser,
		});
		assert.ok(
			restoreChanges.body.data.changes.every(
				(change) =>
					change.operationId !== staleProgressRestoreOperation &&
					change.operationId !== concurrentLoserOperation,
			),
			'stale and losing restore operations must not leave change-log acknowledgements',
		);
		assert.equal(
			restoreChanges.body.data.changes.filter(
				(change) => change.operationId === progressRestoreOperation,
			).length,
			1,
			'a response-loss retry must not create a duplicate restore change',
		);
		assert.equal(
			restoreChanges.body.data.changes.filter(
				(change) => change.operationId === concurrentWinnerOperation,
			).length,
			1,
			'the winning concurrent restore must create exactly one change',
		);

		const coreDeleted = await api(worker.baseUrl, '/api/v1/sync/deletions', {
			user,
			method: 'POST',
			body: {
				operationId: randomUUID(),
				schemaVersion: 1,
				deviceId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
				entityType: 'session',
				entityId: previewPayload.sessionId,
				expectedVersion: 1,
				createdAt: new Date().toISOString(),
			},
		});
		assert.equal(coreDeleted.status, 201, JSON.stringify(coreDeleted.body));
		const afterCoreDelete = await api(worker.baseUrl, '/api/v1/sync/bootstrap', { user });
		coreOwnedEntityKeys.add(`review-event:${reviewRequest.eventId}`);
		const coreOwned = afterCoreDelete.body.data.entities.filter((entity) =>
			coreOwnedEntityKeys.has(`${entity.entityType}:${entity.entityId}`),
		);
		assert.ok(coreOwned.length >= 4, 'the Core fixture must expose dependent sync entities');
		assert.ok(
			coreOwned.every((entity) => entity.operation === 'delete' && entity.payload === null),
			JSON.stringify(coreOwned),
		);
		const progressAfterCoreDelete = afterCoreDelete.body.data.entities.find(
			(entity) =>
				entity.entityType === 'daily-progress' && entity.entityId === `study:${today}:curriculum:1`,
		);
		assert.equal(progressAfterCoreDelete.operation, 'upsert');
		assert.equal(progressAfterCoreDelete.payload.coreSessionImported, false);
		assert.equal(progressAfterCoreDelete.payload.coreCompleted, false);

		const restoredTargetTombstones = coreOwned.filter(
			(entity) =>
				entity.entityType === 'session' ||
				((entity.entityType === 'learning-item' ||
					entity.entityType === 'acquisition-event' ||
					entity.entityType === 'review-card') &&
					entity.entityId.startsWith(`${previewPayload.sessionId}:`)),
		);
		assert.deepEqual(
			new Set(restoredTargetTombstones.map((entity) => entity.entityType)),
			new Set(['session', 'learning-item', 'acquisition-event', 'review-card']),
		);
		const restoredTimeZone = await api(worker.baseUrl, '/api/v1/sync/mutations', {
			user,
			method: 'POST',
			body: profileMutation({
				operationId: 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1',
				baseVersion: 2,
				startDate: today,
				timeZone: 'Asia/Tokyo',
				updatedAt: new Date().toISOString(),
			}),
		});
		assert.equal(restoredTimeZone.status, 201, JSON.stringify(restoredTimeZone.body));
		const deletedSessionTombstone = restoredTargetTombstones.find(
			(entity) => entity.entityType === 'session',
		);
		assert.ok(deletedSessionTombstone);
		const restoreOperation = 'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2';
		const restoredCore = await api(worker.baseUrl, '/api/v1/session-imports', {
			user,
			method: 'POST',
			body: {
				...previewRequest,
				idempotencyKey: restoreOperation,
				expectedVersion: deletedSessionTombstone.version,
			},
		});
		assert.equal(restoredCore.status, 201, JSON.stringify(restoredCore.body));
		assert.ok(restoredCore.body.data.version > deletedSessionTombstone.version);
		const afterCoreRestore = await api(worker.baseUrl, '/api/v1/sync/bootstrap', { user });
		for (const tombstoneEntity of restoredTargetTombstones) {
			const restoredEntity = afterCoreRestore.body.data.entities.find(
				(entity) =>
					entity.entityType === tombstoneEntity.entityType &&
					entity.entityId === tombstoneEntity.entityId,
			);
			assert.equal(restoredEntity.operation, 'upsert', JSON.stringify(restoredEntity));
			assert.ok(restoredEntity.version > tombstoneEntity.version, JSON.stringify(restoredEntity));
			if (restoredEntity.entityType === 'review-card') {
				assert.equal(restoredEntity.payload.version, restoredEntity.version);
			}
		}
		const restoredSession = afterCoreRestore.body.data.entities.find(
			(entity) => entity.entityType === 'session' && entity.entityId === previewPayload.sessionId,
		);
		const staleRestoredDeleteOperation = 'b3b3b3b3-b3b3-43b3-83b3-b3b3b3b3b3b3';
		const staleRestoredDelete = await api(worker.baseUrl, '/api/v1/sync/deletions', {
			user,
			method: 'POST',
			body: {
				operationId: staleRestoredDeleteOperation,
				schemaVersion: 1,
				deviceId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
				entityType: 'session',
				entityId: previewPayload.sessionId,
				expectedVersion: deletedSessionTombstone.version,
				createdAt: new Date().toISOString(),
			},
		});
		assert.equal(staleRestoredDelete.status, 409, JSON.stringify(staleRestoredDelete.body));
		const restoredDeletedAgain = await api(worker.baseUrl, '/api/v1/sync/deletions', {
			user,
			method: 'POST',
			body: {
				operationId: 'b4b4b4b4-b4b4-44b4-84b4-b4b4b4b4b4b4',
				schemaVersion: 1,
				deviceId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
				entityType: 'session',
				entityId: previewPayload.sessionId,
				expectedVersion: restoredSession.version,
				createdAt: new Date().toISOString(),
			},
		});
		assert.equal(restoredDeletedAgain.status, 201, JSON.stringify(restoredDeletedAgain.body));
		const staleRestoreOperation = 'b5b5b5b5-b5b5-45b5-85b5-b5b5b5b5b5b5';
		const staleRestore = await api(worker.baseUrl, '/api/v1/session-imports', {
			user,
			method: 'POST',
			body: {
				...previewRequest,
				idempotencyKey: staleRestoreOperation,
				expectedVersion: deletedSessionTombstone.version,
			},
		});
		assert.equal(staleRestore.status, 409, JSON.stringify(staleRestore.body));
		const changesAfterStaleSessionOperations = await api(
			worker.baseUrl,
			'/api/v1/sync/changes?cursor=0&limit=500',
			{ user },
		);
		assert.ok(
			changesAfterStaleSessionOperations.body.data.changes.every(
				(change) =>
					change.operationId !== staleRestoredDeleteOperation &&
					change.operationId !== staleRestoreOperation,
			),
			'conflicted session operations must not leave change-log acknowledgements',
		);
		await stopWorker(worker.child);
		const restoreLearnerId = `learner-${hash(restoreUser).slice(0, 32)}`;
		const restoredVersionRows = queryRows(
			freshPersistence,
			`SELECT progress.version AS physical_version,
			        mirror.version AS mirror_version,
			        CAST(json_extract(mirror.payload_json, '$.version') AS INTEGER) AS payload_version,
			        (
			          SELECT CAST(json_extract(change.payload_json, '$.version') AS INTEGER)
			          FROM change_log AS change
			          WHERE change.learner_id = progress.learner_id
			            AND change.entity_type = 'sync:daily-progress'
			            AND change.entity_id = '${restoreEntityId}'
			            AND change.operation_id = '${concurrentWinnerOperation}'
			          ORDER BY change.sequence DESC LIMIT 1
			        ) AS change_version
			 FROM daily_progress AS progress
			 JOIN sync_entities AS mirror
			   ON mirror.learner_id = progress.learner_id
			  AND mirror.entity_type = 'daily-progress'
			  AND mirror.entity_id = '${restoreEntityId}'
			 WHERE progress.learner_id = '${restoreLearnerId}'
			   AND progress.study_date = '${today}'`,
		);
		assert.deepEqual(restoredVersionRows, [
			{ physical_version: 10, mirror_version: 10, payload_version: 10, change_version: 10 },
		]);
		const invalidRestoreMutations = queryRows(
			freshPersistence,
			`SELECT mutation_id FROM processed_mutations
			 WHERE learner_id = '${restoreLearnerId}'
			   AND mutation_id IN ('${staleProgressRestoreOperation}', '${concurrentLoserOperation}')`,
		);
		assert.deepEqual(invalidRestoreMutations, []);
		const conflictedSessionMutations = queryRows(
			freshPersistence,
			`SELECT mutation_id FROM processed_mutations
			 WHERE mutation_id IN ('${staleRestoredDeleteOperation}', '${staleRestoreOperation}')`,
		);
		assert.deepEqual(conflictedSessionMutations, []);

		const futureActiveUser = 'future-active-progression';
		const futureAccessSubject = hash(futureActiveUser);
		const futureLearnerId = `learner-${futureAccessSubject.slice(0, 32)}`;
		executeSql(
			freshPersistence,
			`INSERT INTO learners (
			   id, access_subject, timezone, start_date, created_at, updated_at
			 ) VALUES (
			   '${futureLearnerId}', '${futureAccessSubject}', 'Asia/Tokyo', '2020-01-01',
			   '2020-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z'
			 );
			 WITH RECURSIVE days(day_number) AS (
			   SELECT 1 UNION ALL SELECT day_number + 1 FROM days WHERE day_number < 180
			 )
			 INSERT INTO session_imports (
			   id, learner_id, external_session_id, idempotency_key, source_text_hash, kind,
			   study_date, occurred_at, curriculum_day, boost_duration_minutes, boost_mode,
			   summary_ja, duration_minutes, task_completion_score, grammar_score,
			   vocabulary_score, fluency_score, interaction_score, evaluation_comment_ja,
			   contract_version, imported_at
			 )
			 SELECT
			   'future-session-' || day_number, '${futureLearnerId}',
			   'future-external-' || day_number, 'future-operation-' || day_number,
			   printf('%064d', day_number), 'core',
			   date('2020-01-01', printf('+%d days', day_number - 1)),
			   date('2020-01-01', printf('+%d days', day_number - 1)) || 'T00:00:00.000Z',
			   day_number, NULL, NULL, 'future progression', 10, 4, 4, 4, 4, 4,
			   'future progression', 1,
			   date('2020-01-01', printf('+%d days', day_number - 1)) || 'T00:00:00.000Z'
			 FROM days;
			 WITH RECURSIVE days(day_number) AS (
			   SELECT 1 UNION ALL SELECT day_number + 1 FROM days WHERE day_number < 180
			 )
			 INSERT INTO daily_progress (
			   learner_id, study_date, curriculum_day, review_completed, grammar_completed,
			   core_voice_imported, core_completed, version, updated_at
			 )
			 SELECT
			   '${futureLearnerId}',
			   date('2020-01-01', printf('+%d days', day_number - 1)), day_number,
			   1, 1, 1, 1, 1,
			   date('2020-01-01', printf('+%d days', day_number - 1)) || 'T00:00:00.000Z'
			 FROM days;`,
		);
		worker = await startWorker(freshPersistence);
		const futureProgress = await api(worker.baseUrl, `/api/v1/daily-progress/${today}`, {
			user: futureActiveUser,
			method: 'PATCH',
			body: {
				curriculumDay: 181,
				reviewCompleted: true,
				expectedVersion: 0,
				clientMutationId: '96969696-9696-4696-8696-969696969696',
				updatedAt: `${today}T00:00:00.000Z`,
			},
		});
		assert.equal(futureProgress.status, 200, JSON.stringify(futureProgress.body));
		assert.deepEqual(
			queryRows(
				freshPersistence,
				`SELECT curriculum_day, review_completed, core_completed
				 FROM daily_progress WHERE learner_id = '${futureLearnerId}' AND study_date = '${today}'`,
			),
			[{ curriculum_day: 181, review_completed: 1, core_completed: 0 }],
			'180 completed Core days must derive Day 181 without bulk data migration or a pre-created row',
		);
	} finally {
		await stopWorker(worker.child);
	}
}

async function verifyLegacyMigration() {
	const [initialMigration, ...laterMigrations] = migrationFiles;
	assert.equal(initialMigration, '0001_initial.sql');
	executeFile(legacyPersistence, join(root, 'migrations', initialMigration));
	const user = 'legacy-d1-regression';
	const accessSubject = hash(user);
	const learnerId = `learner-${accessSubject.slice(0, 32)}`;
	const today = dateIn('Asia/Tokyo');
	const fixture = `
		INSERT INTO learners (id, access_subject, timezone, created_at, updated_at)
		VALUES ('${learnerId}', '${accessSubject}', 'Asia/Tokyo', '${today}T00:00:00.000Z', '${today}T00:00:00.000Z');
		INSERT INTO learners (id, access_subject, timezone, created_at, updated_at)
		VALUES (
			'migration-repair-learner', 'migration-repair-subject', 'Asia/Tokyo',
			'${today}T00:00:00.000Z', '${today}T00:00:00.000Z'
		);
		WITH RECURSIVE days(day_number) AS (
			SELECT 1 UNION ALL SELECT day_number + 1 FROM days WHERE day_number < 90
		)
		INSERT INTO curriculum_days (day_number, phase, title, grammar_topic_key, scenario)
		SELECT day_number, ((day_number - 1) / 15) + 1, 'Day ' || day_number,
			'd' || day_number || '-grammar', 'legacy' FROM days;
		INSERT INTO session_imports (
			id, learner_id, external_session_id, idempotency_key, source_text_hash, kind,
			study_date, occurred_at, curriculum_day, boost_duration_minutes, boost_mode,
			summary_ja, duration_minutes, task_completion_score, grammar_score,
			vocabulary_score, fluency_score, interaction_score, evaluation_comment_ja,
			contract_version, imported_at
		) VALUES
		('legacy-session-1', '${learnerId}', '11111111-1111-4111-8111-111111111111',
		 'legacy-operation-1', '${'1'.repeat(64)}', 'boost', '${today}', '${today}T01:00:00.000Z',
		 NULL, 5, 'free_talk', '', 5, 4, 4, 4, 4, 4, 'legacy', 1, '${today}T01:00:00.000Z'),
		('legacy-session-2', '${learnerId}', '22222222-2222-4222-8222-222222222222',
		 'legacy-operation-2', '${'2'.repeat(64)}', 'boost', '${today}', '${today}T02:00:00.000Z',
		 NULL, 5, 'free_talk', NULL, 5, 4, 4, 4, 4, 4, 'legacy', 1, '${today}T02:00:00.000Z');
		INSERT INTO session_imports (
			id, learner_id, external_session_id, idempotency_key, source_text_hash, kind,
			study_date, occurred_at, curriculum_day, boost_duration_minutes, boost_mode,
			summary_ja, duration_minutes, task_completion_score, grammar_score,
			vocabulary_score, fluency_score, interaction_score, evaluation_comment_ja,
			contract_version, imported_at
		) VALUES (
			'migration-repair-session', 'migration-repair-learner',
			'33333333-3333-4333-8333-333333333333', 'migration-repair-operation',
			'${'3'.repeat(64)}', 'core', '${today}', '${today}T03:00:00.000Z', 1,
			NULL, NULL, 'repair', 10, 4, 4, 4, 4, 4, 'repair', 1, '${today}T03:00:00.000Z'
		);
		INSERT INTO daily_progress (
			learner_id, study_date, curriculum_day, review_completed, grammar_completed,
			core_voice_imported, core_completed, version, updated_at
		) VALUES
		('migration-repair-learner', '${today}', 1, 1, 1, 1, 0, 1, '${today}T03:00:00.000Z'),
		('migration-repair-learner', '2000-01-02', 2, 1, 1, 1, 1, 1, '2000-01-02T00:00:00.000Z'),
		('migration-repair-learner', '2000-01-03', 3, 1, 1, 1, 1, 1, '2000-01-03T00:00:00.000Z'),
		('migration-repair-learner', '2000-01-04', NULL, 1, 1, 1, 0, 1, '2000-01-04T00:00:00.000Z');
		INSERT INTO vocabulary (
			id, learner_id, session_id, client_id, study_date, term, normalized_term,
			meaning_ja, example, state, created_at, updated_at
		) VALUES
		('legacy-word-1', '${learnerId}', 'legacy-session-1', 'legacy-client-1', '${today}',
		 ' Ｈｅｌｌｏ ', ' ｈｅｌｌｏ ', 'こんにちは', 'Hello.', 'new', '${today}T01:00:00.000Z', '${today}T01:00:00.000Z'),
		('legacy-word-2', '${learnerId}', 'legacy-session-2', 'legacy-client-2', '${today}',
		 'hello', 'hello', 'こんにちは', 'Hello again.', 'new', '${today}T02:00:00.000Z', '${today}T02:00:00.000Z');
		INSERT INTO mistakes (
			id, learner_id, session_id, client_id, category, original_text, correction_text,
			explanation_ja, severity, occurrence_count, created_at, updated_at
		) VALUES
		('legacy-mistake-1', '${learnerId}', 'legacy-session-1', 'legacy-mistake-client-1',
		 'grammar_tense', 'Ｉ\u3000ｇｏ yesterday.', 'I went yesterday.', 'legacy', 'medium', 1,
		 '${today}T01:00:00.000Z', '${today}T01:00:00.000Z'),
		('legacy-mistake-2', '${learnerId}', 'legacy-session-2', 'legacy-mistake-client-2',
		 'grammar_tense', 'I go yesterday.', 'I went yesterday.', 'legacy', 'medium', 2,
		 '${today}T02:00:00.000Z', '${today}T02:00:00.000Z');
	`;
	executeSql(legacyPersistence, fixture);
	const inconsistentBeforeMigration = queryRows(
		legacyPersistence,
		`SELECT COUNT(*) AS count
		 FROM daily_progress
		 WHERE learner_id = 'migration-repair-learner'
		   AND (
		     core_completed != CASE
		       WHEN review_completed = 1 AND grammar_completed = 1 AND core_voice_imported = 1
		       THEN 1 ELSE 0
		     END
		     OR (core_voice_imported = 1 AND NOT EXISTS (
		       SELECT 1 FROM session_imports
		       WHERE session_imports.learner_id = daily_progress.learner_id
		         AND session_imports.study_date = daily_progress.study_date
		         AND session_imports.curriculum_day = daily_progress.curriculum_day
		         AND session_imports.kind = 'core'
		     ))
		   )`,
	);
	assert.equal(Number(inconsistentBeforeMigration[0].count), 4);
	const insertGuardMigration = '0007_daily_progress_insert_guard.sql';
	const catalogMigration = '0008_expand_curriculum_catalog.sql';
	const assessmentMigration = '0009_stage_assessments.sql';
	const activationMigration = '0010_activate_independent_curriculum.sql';
	const fluencyActivationMigration = '0011_activate_fluency_curriculum.sql';
	const b2ChallengeActivationMigration = '0012_activate_b2_challenge_curriculum.sql';
	const languageNeutralSessionMigration = '0013_language_neutral_session_support.sql';
	const insertGuardIndex = laterMigrations.indexOf(insertGuardMigration);
	assert.ok(insertGuardIndex >= 0);
	assert.ok(laterMigrations.includes(b2ChallengeActivationMigration));
	assert.equal(laterMigrations.at(-1), languageNeutralSessionMigration);
	for (const migration of laterMigrations.slice(0, insertGuardIndex)) {
		executeFile(legacyPersistence, join(root, 'migrations', migration));
	}
	executeSql(
		legacyPersistence,
		`INSERT INTO session_imports (
		   id, learner_id, external_session_id, idempotency_key, source_text_hash, kind,
		   study_date, occurred_at, curriculum_day, boost_duration_minutes, boost_mode,
		   summary_ja, duration_minutes, task_completion_score, grammar_score,
		   vocabulary_score, fluency_score, interaction_score, evaluation_comment_ja,
		   contract_version, imported_at
		 ) VALUES (
		   'migration-deleted-session', 'migration-repair-learner',
		   '44444444-4444-4444-8444-444444444444',
		   '81818181-8181-4181-8181-818181818181', '${'4'.repeat(64)}', 'boost',
		   '${today}', '${today}T04:00:00.000Z', NULL, 5, 'free_talk',
		   'deleted legacy session', 5, 4, 4, 4, 4, 4, 'legacy delete', 1,
		   '${today}T04:00:00.000Z'
		 );
		 INSERT INTO vocabulary (
		   id, learner_id, session_id, client_id, study_date, term, normalized_term,
		   meaning_ja, example, state, created_at, updated_at
		 ) VALUES (
		   'migration-deleted-word', 'migration-repair-learner', 'migration-deleted-session',
		   'migration-deleted-word-client', '${today}', 'obsolete', 'obsolete',
		   '削除対象', 'obsolete item', 'new', '${today}T04:00:00.000Z', '${today}T04:00:00.000Z'
		 );
		 INSERT INTO mistakes (
		   id, learner_id, session_id, client_id, category, original_text, correction_text,
		   explanation_ja, severity, occurrence_count, created_at, updated_at, canonical_identity
		 ) VALUES (
		   'migration-deleted-mistake', 'migration-repair-learner', 'migration-deleted-session',
		   'migration-deleted-mistake-client', 'grammar_tense', 'He go.', 'He goes.',
		   'legacy delete', 'medium', 1, '${today}T04:00:00.000Z',
		   '${today}T04:00:00.000Z', 'grammar_tense:he go.:he goes.'
		 );
		 INSERT INTO review_cards (
		   id, learner_id, source_type, source_id, front_text, back_text, due_date,
		   interval_days, ease_factor, repetitions, version, updated_at
		 ) VALUES (
		   'migration-deleted-card', 'migration-repair-learner', 'mistake',
		   'migration-deleted-mistake', 'He go.', 'He goes.', '${today}',
		   1, 2.5, 0, 1, '${today}T04:00:00.000Z'
		 );
		 INSERT INTO review_events (
		   id, learner_id, card_id, grade, occurred_at, study_date, curriculum_day,
		   algorithm_version, before_json, after_json, created_at
		 ) VALUES (
		   'migration-deleted-review-event', 'migration-repair-learner',
		   'migration-deleted-card', 'good', '${today}T04:01:00.000Z', '${today}', 1,
		   1, '{}', '{}', '${today}T04:01:00.000Z'
		 );
		 INSERT INTO sync_entities (
		   learner_id, entity_type, entity_id, operation, payload_json,
		   version, last_mutation_id, updated_at
		 ) VALUES
		 ('migration-repair-learner', 'daily-progress', 'study:2000-01-02:curriculum:2',
		  'delete', 'null', 7, '71717171-7171-4717-8717-717171717171', '2000-01-02T00:00:00.000Z'),
		 ('migration-repair-learner', 'daily-progress', 'study:${today}:curriculum:1',
		  'upsert', '{"id":"study:${today}:curriculum:1","studyDate":"${today}","curriculumDay":1,"reviewsCompleted":true,"grammarCompleted":true,"coreSessionImported":true,"coreCompleted":false,"version":10,"updatedAt":"${today}T03:00:00.000Z"}',
		  10, 'legacy-high-version-progress', '${today}T03:00:00.000Z'),
		 ('migration-repair-learner', 'session', '44444444-4444-4444-8444-444444444444',
		  'delete', 'null', 2, '82828282-8282-4282-8282-828282828282', '${today}T04:02:00.000Z'),
		 ('migration-repair-learner', 'learning-item', 'migration-deleted-word',
		  'upsert', '{"id":"migration-deleted-word","kind":"vocabulary","canonicalText":"obsolete","displayText":"obsolete","meaningJa":"削除対象","status":"new","updatedAt":"${today}T04:00:00.000Z"}',
		  1, '83838383-8383-4383-8383-838383838383', '${today}T04:00:00.000Z'),
		 ('migration-repair-learner', 'acquisition-event', 'migration-deleted-acquisition',
		  'upsert', '{"eventId":"migration-deleted-acquisition","studyDate":"${today}","kind":"vocabulary","entityId":"migration-deleted-word","sourceSessionId":"44444444-4444-4444-8444-444444444444","createdAt":"${today}T04:00:00.000Z"}',
		  1, '84848484-8484-4484-8484-848484848484', '${today}T04:00:00.000Z'),
		 ('migration-repair-learner', 'mistake', 'migration-deleted-mistake',
		  'upsert', '{"id":"migration-deleted-mistake","category":"grammar_tense","original":"He go.","correction":"He goes.","repetitions":1,"sessionId":"44444444-4444-4444-8444-444444444444"}',
		  1, '85858585-8585-4585-8585-858585858585', '${today}T04:00:00.000Z'),
		 ('migration-repair-learner', 'review-card', 'migration-deleted-card',
		  'upsert', '{"id":"migration-deleted-card","front":"He go.","back":"He goes.","dueAt":"${today}","state":"new","sourceType":"mistake","sourceId":"migration-deleted-mistake","stabilityLevel":0,"lapses":0,"algorithmVersion":1,"version":1,"updatedAt":"${today}T04:00:00.000Z"}',
		  1, '86868686-8686-4686-8686-868686868686', '${today}T04:00:00.000Z'),
		 ('migration-repair-learner', 'review-event', 'migration-deleted-review-event',
		  'upsert', '{"eventId":"migration-deleted-review-event","cardId":"migration-deleted-card","grade":"good","occurredAt":"${today}T04:01:00.000Z","studyDate":"${today}","curriculumDay":1,"algorithmVersion":1,"before":{},"after":{}}',
		  1, '87878787-8787-4787-8787-878787878787', '${today}T04:01:00.000Z')`,
	);
	const curriculumBeforeCatalogMigration = queryRows(
		legacyPersistence,
		`SELECT day_number, phase, title, grammar_topic_key, scenario
		 FROM curriculum_days ORDER BY day_number`,
	);
	executeSql(
		legacyPersistence,
		`INSERT INTO assessments (
		   learner_id, id, type, completed_at, payload_json, version, last_mutation_id, updated_at
		 ) VALUES
		 ('migration-repair-learner', 'baseline:current', 'baseline', '${today}T05:00:00.000Z',
		  '{"confidence":3}', 2, 'legacy-baseline-operation', '${today}T05:00:00.000Z'),
		 ('migration-repair-learner', 'legacy-weekly', 'weekly', '${today}T06:00:00.000Z',
		  '{"startDay":1,"endDay":7}', 4, 'legacy-weekly-operation', '${today}T06:00:00.000Z');`,
	);
	const assessmentsBeforeStageMigration = queryRows(
		legacyPersistence,
		`SELECT learner_id, id, type, completed_at, payload_json, version, last_mutation_id, updated_at
		 FROM assessments ORDER BY learner_id, id`,
	);
	const assessmentGuardBeforeStageMigration = queryRows(
		legacyPersistence,
		`SELECT sql FROM sqlite_master
		 WHERE type = 'trigger' AND name = 'assessment_mutation_write_guard'`,
	);
	assert.equal(assessmentGuardBeforeStageMigration.length, 1);
	executeFile(legacyPersistence, join(root, 'migrations', insertGuardMigration));
	executeFile(legacyPersistence, join(root, 'migrations', catalogMigration));
	executeFile(legacyPersistence, join(root, 'migrations', assessmentMigration));
	executeFile(legacyPersistence, join(root, 'migrations', activationMigration));
	const curriculumBeforeFluencyMigration = queryRows(
		legacyPersistence,
		`SELECT day_number, phase, title, grammar_topic_key, scenario
		 FROM curriculum_days WHERE day_number <= 180 ORDER BY day_number`,
	);
	executeFile(legacyPersistence, join(root, 'migrations', fluencyActivationMigration));
	const curriculumBeforeB2ChallengeMigration = queryRows(
		legacyPersistence,
		`SELECT day_number, phase, title, grammar_topic_key, scenario
		 FROM curriculum_days WHERE day_number <= 270 ORDER BY day_number`,
	);
	executeFile(legacyPersistence, join(root, 'migrations', b2ChallengeActivationMigration));
	const legacySessionSupportBeforeNeutralMigration = queryRows(
		legacyPersistence,
		`SELECT id, summary_ja, evaluation_comment_ja FROM session_imports ORDER BY id`,
	);
	executeFile(legacyPersistence, join(root, 'migrations', languageNeutralSessionMigration));
	assert.deepEqual(
		queryRows(
			legacyPersistence,
			`SELECT id, summary_ja, evaluation_comment_ja FROM session_imports ORDER BY id`,
		),
		legacySessionSupportBeforeNeutralMigration,
		'0013 must preserve every legacy Japanese session value',
	);
	assert.deepEqual(
		queryRows(
			legacyPersistence,
			`SELECT COUNT(*) AS missing FROM session_imports
			 WHERE support_language != 'ja'
			    OR summary_text IS NOT summary_ja
			    OR evaluation_comment_text IS NOT evaluation_comment_ja`,
		),
		[{ missing: 0 }],
		'0013 must backfill neutral session fields for every legacy row',
	);
	assert.deepEqual(
		queryRows(
			legacyPersistence,
			`SELECT day_number, phase, title, grammar_topic_key, scenario
			 FROM curriculum_days WHERE day_number <= 270 ORDER BY day_number`,
		),
		curriculumBeforeB2ChallengeMigration,
		'Day 1-270 curriculum rows must survive the B2 Challenge activation byte-for-byte by value',
	);
	assert.deepEqual(
		queryRows(
			legacyPersistence,
			`SELECT day_number, phase, title, grammar_topic_key, scenario
			 FROM curriculum_days WHERE day_number <= 180 ORDER BY day_number`,
		),
		curriculumBeforeFluencyMigration,
		'Day 1-180 curriculum rows must survive the Fluency activation byte-for-byte by value',
	);
	assert.deepEqual(
		queryRows(
			legacyPersistence,
			`SELECT catalog.content_version, catalog.active_total_days,
			        COUNT(days.day_number) AS curriculum_days,
			        MIN(days.day_number) AS first_day, MAX(days.day_number) AS last_day
			 FROM curriculum_catalog AS catalog
			 JOIN curriculum_days AS days ON 1 = 1
			 WHERE catalog.curriculum_id = 'english-os-core'`,
		),
		[
			{
				content_version: 'b2-challenge-365-v1',
				active_total_days: 365,
				curriculum_days: 365,
				first_day: 1,
				last_day: 365,
			},
		],
		'legacy upgrades must activate exactly the 365 bundled curriculum days',
	);
	assert.deepEqual(
		queryRows(
			legacyPersistence,
			`SELECT day_number, phase, title, grammar_topic_key, scenario
			 FROM curriculum_days WHERE day_number <= 90 ORDER BY day_number`,
		),
		curriculumBeforeCatalogMigration,
		'Day 1-90 curriculum rows must survive the table rebuild byte-for-byte by value',
	);
	assert.deepEqual(
		queryRows(
			legacyPersistence,
			`SELECT learner_id, id, type, completed_at, payload_json, version, last_mutation_id, updated_at
			 FROM assessments ORDER BY learner_id, id`,
		),
		assessmentsBeforeStageMigration,
		'baseline and weekly assessment rows must survive the Stage Assessment table rebuild',
	);
	assert.deepEqual(
		queryRows(
			legacyPersistence,
			`SELECT sql FROM sqlite_master
			 WHERE type = 'trigger' AND name = 'assessment_mutation_write_guard'`,
		),
		assessmentGuardBeforeStageMigration,
		'the Stage Assessment migration must preserve the existing assessment mutation guard verbatim',
	);
	assert.deepEqual(queryRows(legacyPersistence, 'PRAGMA foreign_key_check'), []);
	const legacyTombstoneCleanup = queryRows(
		legacyPersistence,
		`SELECT
		   (SELECT COUNT(*) FROM session_imports WHERE id = 'migration-deleted-session') AS sessions,
		   (SELECT COUNT(*) FROM vocabulary WHERE id = 'migration-deleted-word') AS words,
		   (SELECT COUNT(*) FROM mistakes WHERE id = 'migration-deleted-mistake') AS mistakes,
		   (SELECT COUNT(*) FROM review_cards WHERE id = 'migration-deleted-card') AS cards,
		   (SELECT COUNT(*) FROM review_events WHERE id = 'migration-deleted-review-event') AS events,
		   (SELECT COUNT(*) FROM acquisition_identities WHERE entity_id = 'migration-deleted-word') AS identities`,
	);
	assert.deepEqual(legacyTombstoneCleanup, [
		{ sessions: 0, words: 0, mistakes: 0, cards: 0, events: 0, identities: 0 },
	]);
	const legacyCascadeMirrors = queryRows(
		legacyPersistence,
		`SELECT entity_type, entity_id, operation, payload_json, last_mutation_id
		 FROM sync_entities
		 WHERE learner_id = 'migration-repair-learner'
		   AND entity_id IN (
		     'migration-deleted-word', 'migration-deleted-acquisition',
		     'migration-deleted-mistake', 'migration-deleted-card',
		     'migration-deleted-review-event'
		   )
		 ORDER BY entity_type`,
	);
	assert.equal(legacyCascadeMirrors.length, 5);
	for (const mirror of legacyCascadeMirrors) {
		assert.equal(mirror.operation, 'delete');
		assert.equal(mirror.payload_json, 'null');
		assert.match(mirror.last_mutation_id, UUID_V4_PATTERN);
		const matchingChange = queryRows(
			legacyPersistence,
			`SELECT COUNT(*) AS count FROM change_log
			 WHERE learner_id = 'migration-repair-learner'
			   AND entity_type = 'sync:${mirror.entity_type}'
			   AND entity_id = '${mirror.entity_id}'
			   AND operation_id = '${mirror.last_mutation_id}'`,
		);
		assert.equal(Number(matchingChange[0].count), 1);
	}
	const repairedProgress = queryRows(
		legacyPersistence,
		`SELECT study_date, curriculum_day, core_voice_imported, core_completed, version, last_mutation_id
		 FROM daily_progress
		 WHERE learner_id = 'migration-repair-learner'
		 ORDER BY study_date`,
	);
	assert.deepEqual(
		repairedProgress.map((row) => ({
			study_date: row.study_date,
			curriculum_day: row.curriculum_day,
			core_voice_imported: row.core_voice_imported,
			core_completed: row.core_completed,
			version: row.version,
		})),
		[
			{
				study_date: '2000-01-03',
				curriculum_day: 3,
				core_voice_imported: 0,
				core_completed: 0,
				version: 2,
			},
			{
				study_date: '2000-01-04',
				curriculum_day: null,
				core_voice_imported: 0,
				core_completed: 0,
				version: 2,
			},
			{
				study_date: today,
				curriculum_day: 1,
				core_voice_imported: 1,
				core_completed: 1,
				version: 11,
			},
		],
	);
	for (const progress of repairedProgress) assert.match(progress.last_mutation_id, UUID_V4_PATTERN);
	const repairedMirrors = queryRows(
		legacyPersistence,
		`SELECT entity_id, operation, payload_json, version, last_mutation_id
		 FROM sync_entities
		 WHERE learner_id = 'migration-repair-learner' AND entity_type = 'daily-progress'
		 ORDER BY entity_id`,
	);
	assert.equal(repairedMirrors.length, 3);
	const preservedTombstone = repairedMirrors.find(
		(row) => row.entity_id === 'study:2000-01-02:curriculum:2',
	);
	assert.deepEqual(preservedTombstone, {
		entity_id: 'study:2000-01-02:curriculum:2',
		operation: 'delete',
		payload_json: 'null',
		version: 7,
		last_mutation_id: '71717171-7171-4717-8717-717171717171',
	});
	for (const mirror of repairedMirrors.filter((row) => row.operation === 'upsert')) {
		const payload = JSON.parse(mirror.payload_json);
		const expectedVersion = payload.studyDate === today ? 11 : 2;
		assert.equal(Number(mirror.version), expectedVersion);
		assert.equal(payload.version, expectedVersion);
		assert.equal(payload.coreSessionImported, payload.studyDate === today);
		assert.equal(payload.coreCompleted, payload.studyDate === today);
		assert.match(mirror.last_mutation_id, UUID_V4_PATTERN);
	}
	const repairChanges = queryRows(
		legacyPersistence,
		`SELECT entity_id, payload_json, operation_id
		 FROM change_log
		 WHERE learner_id = 'migration-repair-learner'
		   AND entity_type = 'sync:daily-progress'
		 ORDER BY entity_id`,
	);
	assert.equal(repairChanges.length, 2);
	for (const change of repairChanges) {
		const envelope = JSON.parse(change.payload_json);
		const expectedVersion = envelope.payload.studyDate === today ? 11 : 2;
		assert.equal(envelope.version, expectedVersion);
		assert.equal(envelope.payload.version, expectedVersion);
		assert.match(change.operation_id, UUID_V4_PATTERN);
		assert.equal(
			change.operation_id,
			repairedMirrors.find((mirror) => mirror.entity_id === change.entity_id)?.last_mutation_id,
		);
	}
	const worker = await startWorker(legacyPersistence);
	try {
		const bootstrap = await api(worker.baseUrl, '/api/v1/sync/bootstrap', { user });
		assert.equal(bootstrap.status, 200, JSON.stringify(bootstrap.body));
		const sessions = bootstrap.body.data.entities.filter(
			(entity) => entity.entityType === 'session' && entity.operation === 'upsert',
		);
		assert.equal(sessions.length, 2);
		assert.ok(sessions.every((entity) => entity.payload.summary === 'Legacy session'));
	} finally {
		await stopWorker(worker.child);
	}
	const vocabulary = queryRows(
		legacyPersistence,
		`SELECT COUNT(*) AS count, MIN(normalized_term) AS canonical
		 FROM vocabulary WHERE learner_id = '${learnerId}'`,
	);
	assert.equal(Number(vocabulary[0].count), 1);
	assert.equal(vocabulary[0].canonical, 'hello');
	const markers = queryRows(
		legacyPersistence,
		`SELECT COUNT(*) AS count FROM learner_data_migrations
		 WHERE learner_id = '${learnerId}' AND migration_key = 'v1-normalized-sync-backfill'`,
	);
	assert.equal(Number(markers[0].count), 1);
	const mistakes = queryRows(
		legacyPersistence,
		`SELECT COUNT(*) AS count, MIN(occurrence_count) AS occurrences,
		        MIN(canonical_identity) AS canonical
		 FROM mistakes WHERE learner_id = '${learnerId}'`,
	);
	assert.equal(Number(mistakes[0].count), 1);
	assert.equal(Number(mistakes[0].occurrences), 3);
	assert.equal(mistakes[0].canonical, 'grammar_tense:i go yesterday.:i went yesterday.');
}

try {
	await verifyFreshDatabase();
	await verifyLegacyMigration();
	console.log(
		'Local D1 verification passed: fresh migrations, real API transactions, sync, and legacy backfill.',
	);
} finally {
	rmSync(temporaryRoot, { recursive: true, force: true });
}
