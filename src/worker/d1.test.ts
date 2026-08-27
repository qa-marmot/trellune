import { describe, expect, it } from 'vitest';
import { SyncBootstrapResponseSchema, type SyncMutation } from '../sync/contracts';
import {
	EnglishOsRepository,
	allocateDailyProgressVersion,
	CurriculumDayUnavailableError,
	normalizeEnglishIdentity,
	SyncVersionConflictError,
	VersionConflictError,
	type D1DatabaseLike,
	type D1PreparedStatement,
	type D1Result,
} from './d1';

class FakeStatement implements D1PreparedStatement {
	values: unknown[] = [];

	constructor(
		readonly sql: string,
		private readonly database: FakeDatabase,
	) {}

	bind(...values: unknown[]): D1PreparedStatement {
		this.values = values;
		return this;
	}

	async first<T>(): Promise<T | null> {
		return this.database.first(this.sql) as T | null;
	}

	async all<T>(): Promise<D1Result<T>> {
		return { success: true, results: this.database.allResults as T[] };
	}

	async run<T>(): Promise<D1Result<T>> {
		return { success: true };
	}
}

class FakeDatabase implements D1DatabaseLike {
	readonly statements: FakeStatement[] = [];
	batchResults: Array<D1Result> = [];
	allResults: Array<Record<string, unknown>> = [];
	processedResponse: string | null = null;
	currentSyncEntity: Record<string, unknown> | null = null;
	progressRow: Record<string, unknown> | null = null;
	authoritativeVersion: number | null = null;
	learnerRow: { start_date: string | null; entry_day: number | null } | null = null;
	activeTotalDays = 90;

	prepare(query: string): D1PreparedStatement {
		const statement = new FakeStatement(query, this);
		this.statements.push(statement);
		return statement;
	}

	async batch<T>(): Promise<Array<D1Result<T>>> {
		return this.batchResults as Array<D1Result<T>>;
	}

	first(sql: string): Record<string, unknown> | null {
		if (sql.includes('FROM curriculum_catalog')) {
			return { active_total_days: this.activeTotalDays };
		}
		if (sql.includes('SELECT start_date, entry_day FROM learners')) return this.learnerRow;
		if (sql.includes('SELECT response_json')) {
			return this.processedResponse ? { response_json: this.processedResponse } : null;
		}
		if (sql.includes('AS authoritative_version')) {
			const progressVersion = Number(this.progressRow?.version ?? 0);
			const mirrorVersion = Number(this.currentSyncEntity?.version ?? 0);
			const payload = this.currentSyncEntity?.payload_json;
			const payloadVersion =
				typeof payload === 'string'
					? Number((JSON.parse(payload) as { version?: number } | null)?.version ?? 0)
					: 0;
			return {
				authoritative_version:
					this.authoritativeVersion ?? Math.max(progressVersion, mirrorVersion, payloadVersion),
			};
		}
		if (sql.includes('FROM sync_entities')) return this.currentSyncEntity;
		if (sql.includes('FROM daily_progress')) return this.progressRow;
		return null;
	}
}

function mutation(currentDay = 1): SyncMutation {
	return {
		operationId: '11111111-1111-4111-8111-111111111111',
		schemaVersion: 1,
		deviceId: '22222222-2222-4222-8222-222222222222',
		entityType: 'profile-settings',
		entityId: 'current',
		operationType: 'upsert',
		payload: {
			profile: {
				id: 'current',
				onboarded: true,
				learnerName: 'Learner',
				goal: 'Speak',
				timeZone: 'Asia/Tokyo',
				startDate: '2026-08-10',
				entryDay: 1,
				currentDay,
				streak: 0,
				updatedAt: '2026-08-10T00:00:00.000Z',
			},
			settings: {
				id: 'current',
				dailyMinutes: 20,
				syncEnabled: true,
				reduceMotion: false,
				updatedAt: '2026-08-10T00:00:00.000Z',
			},
		},
		baseVersion: 1,
		createdAt: '2026-08-10T00:00:00.000Z',
	};
}

describe('D1 synchronization integrity', () => {
	it.each([
		{ label: 'A: backup only', physical: 0, mirror: 0, tombstone: 0, backup: 1, next: 2 },
		{ label: 'B: physical wins', physical: 5, mirror: 0, tombstone: 0, backup: 1, next: 6 },
		{ label: 'C: mirror wins', physical: 0, mirror: 5, tombstone: 0, backup: 1, next: 6 },
		{ label: 'D: tombstone wins', physical: 0, mirror: 0, tombstone: 6, backup: 1, next: 7 },
		{ label: 'E: backup wins', physical: 0, mirror: 0, tombstone: 6, backup: 8, next: 9 },
		{
			label: 'F: highest authority wins',
			physical: 4,
			mirror: 7,
			tombstone: 6,
			backup: 2,
			next: 8,
		},
	])('allocates a monotonic daily progress version ($label)', (input) => {
		expect(
			allocateDailyProgressVersion(
				Math.max(input.physical, input.mirror, input.tombstone),
				input.backup,
			),
		).toBe(input.next);
	});

	it('rejects daily progress version overflow', () => {
		expect(() => allocateDailyProgressVersion(Number.MAX_SAFE_INTEGER, 1)).toThrow(RangeError);
	});

	it('normalizes a legacy date-only review-card due date in bootstrap responses', async () => {
		const database = new FakeDatabase();
		database.batchResults = [
			{
				success: true,
				results: [
					{
						entity_type: 'review-card',
						entity_id: 'card:mistake:legacy',
						operation: 'upsert',
						payload_json: JSON.stringify({
							id: 'card:mistake:legacy',
							front: 'I live ___ Tokyo.',
							back: 'I live in Tokyo.',
							dueAt: '2026-08-12',
							state: 'new',
							sourceType: 'mistake',
							sourceId: 'mistake:legacy',
							stabilityLevel: 0,
							lapses: 0,
							algorithmVersion: 1,
							version: 1,
							updatedAt: '2026-08-12T01:41:12.822Z',
						}),
						version: 1,
						last_mutation_id: '11111111-1111-4111-8111-111111111111',
						updated_at: '2026-08-12T01:41:12.822Z',
					},
				],
			},
			{ success: true, results: [{ cursor: 7 }] },
		];

		const bootstrap = await new EnglishOsRepository(database).bootstrapSync('learner-test');
		const parsed = SyncBootstrapResponseSchema.safeParse({ data: bootstrap });

		expect(parsed.success).toBe(true);
		expect(bootstrap.entities[0]?.payload).toMatchObject({
			dueAt: '2026-08-12T00:00:00.000Z',
		});
		expect(bootstrap.activeTotalDays).toBe(90);
	});

	it('rejects a structurally supported profile day above ACTIVE before writing', async () => {
		const database = new FakeDatabase();
		await expect(
			new EnglishOsRepository(database).applySyncMutation(
				'learner-test',
				mutation(91),
				'2026-08-10T00:00:01.000Z',
			),
		).rejects.toEqual(new CurriculumDayUnavailableError(91, 90));
		expect(database.statements).toHaveLength(2);
		expect(database.statements[1]?.sql).toContain('FROM curriculum_catalog');
	});

	it('uses a learner Stage entry as the first authoritative Core day', async () => {
		const database = new FakeDatabase();
		database.activeTotalDays = 365;
		database.learnerRow = { start_date: '2026-08-10', entry_day: 181 };
		database.batchResults = [
			{ success: true, meta: { changes: 1 } },
			{ success: true, meta: { changes: 1 } },
			{ success: true, meta: { changes: 1 } },
			{ success: true, meta: { changes: 1 } },
		];

		await new EnglishOsRepository(database).patchProgress(
			'learner-test',
			'2026-08-10',
			{
				curriculumDay: 181,
				reviewCompleted: true,
				expectedVersion: 0,
				clientMutationId: '99999999-9999-4999-8999-999999999999',
				updatedAt: '2026-08-10T00:00:00.000Z',
			},
			'2026-08-10T00:00:01.000Z',
		);

		expect(
			database.statements.some(
				(statement) =>
					statement.sql.includes('INSERT INTO daily_progress') && statement.values.includes(181),
			),
		).toBe(true);
	});

	it('normalizes a legacy date-only review-card due date in incremental changes', async () => {
		const database = new FakeDatabase();
		database.allResults = [
			{
				sequence: 8,
				entity_type: 'sync:review-card',
				entity_id: 'card:mistake:legacy',
				operation: 'upsert',
				payload_json: JSON.stringify({
					payload: {
						id: 'card:mistake:legacy',
						front: 'I live ___ Tokyo.',
						back: 'I live in Tokyo.',
						dueAt: '2026-08-12',
						state: 'new',
						sourceType: 'mistake',
						sourceId: 'mistake:legacy',
						stabilityLevel: 0,
						lapses: 0,
						algorithmVersion: 1,
						version: 1,
						updatedAt: '2026-08-12T01:41:12.822Z',
					},
					version: 1,
				}),
				operation_id: '22222222-2222-4222-8222-222222222222',
				changed_at: '2026-08-12T01:41:12.822Z',
			},
		];

		const changes = await new EnglishOsRepository(database).pullChanges('learner-test', 7, 100);
		const parsed = SyncBootstrapResponseSchema.safeParse({
			data: { entities: changes.changes, cursor: changes.cursor, activeTotalDays: 90 },
		});

		expect(parsed.success).toBe(true);
		expect(changes.changes[0]?.payload).toMatchObject({
			dueAt: '2026-08-12T00:00:00.000Z',
		});
	});

	it('normalizes acquisition identity with NFKC, trim, case and whitespace folding', () => {
		expect(normalizeEnglishIdentity('  Ｈｅｌｌｏ　  WORLD  ')).toBe('hello world');
	});

	it('rejects a zero-row synchronized update instead of recording false success', async () => {
		const database = new FakeDatabase();
		database.currentSyncEntity = {
			entity_type: 'profile-settings',
			entity_id: 'current',
			operation: 'upsert',
			payload_json: JSON.stringify({ server: 'current' }),
			version: 1,
			last_mutation_id: 'previous',
			updated_at: '2026-08-10T00:00:00.000Z',
		};
		database.batchResults = [
			{ success: true, meta: { changes: 0 } },
			{ success: true, meta: { changes: 1, last_row_id: 9 } },
			{ success: true, meta: { changes: 1 } },
		];
		const repository = new EnglishOsRepository(database);

		await expect(
			repository.applySyncMutation('learner-test', mutation(), '2026-08-10T00:00:01.000Z'),
		).rejects.toBeInstanceOf(SyncVersionConflictError);
		expect(database.statements.some((item) => item.sql.includes('last_mutation_id'))).toBe(true);
		expect(database.statements.every((item) => !item.sql.includes('learner-test'))).toBe(true);
	});

	it('replays a processed operation without writing a second change', async () => {
		const database = new FakeDatabase();
		database.processedResponse = JSON.stringify({
			operationId: mutation().operationId,
			entityType: 'profile-settings',
			entityId: 'current',
			operation: 'upsert',
			payload: mutation().payload,
			version: 2,
			sequence: 0,
			changedAt: '2026-08-10T00:00:01.000Z',
		});
		const result = await new EnglishOsRepository(database).applySyncMutation(
			'learner-test',
			mutation(),
			'2026-08-10T00:00:02.000Z',
		);

		expect(result.replayed).toBe(true);
		expect(database.statements).toHaveLength(1);
	});

	it('rejects a zero-row legacy progress patch before reporting success', async () => {
		const database = new FakeDatabase();
		database.progressRow = {
			curriculum_day: 1,
			review_completed: 0,
			grammar_completed: 0,
			core_voice_imported: 0,
			core_completed: 0,
			version: 2,
			updated_at: '2026-08-10T00:00:00.000Z',
		};
		database.batchResults = [
			{ success: true, meta: { changes: 0 } },
			{ success: true, meta: { changes: 1 } },
			{ success: true, meta: { changes: 1 } },
		];

		await expect(
			new EnglishOsRepository(database).patchProgress(
				'learner-test',
				'2026-08-10',
				{
					reviewCompleted: true,
					expectedVersion: 2,
					clientMutationId: '33333333-3333-4333-8333-333333333333',
					updatedAt: '2026-08-10T00:00:00.000Z',
				},
				'2026-08-10T00:00:01.000Z',
			),
		).rejects.toBeInstanceOf(VersionConflictError);
	});

	it('restores daily progress above an authoritative remote tombstone', async () => {
		const database = new FakeDatabase();
		database.currentSyncEntity = {
			entity_type: 'daily-progress',
			entity_id: 'study:2026-08-10:curriculum:1',
			operation: 'delete',
			payload_json: 'null',
			version: 6,
			last_mutation_id: '44444444-4444-4444-8444-444444444444',
			updated_at: '2026-08-10T00:00:00.000Z',
		};
		database.batchResults = [
			{ success: true, meta: { changes: 1 } },
			{ success: true, meta: { changes: 1 } },
			{ success: true, meta: { changes: 1 } },
			{ success: true, meta: { changes: 1 } },
		];

		const result = await new EnglishOsRepository(database).patchProgress(
			'learner-test',
			'2026-08-10',
			{
				curriculumDay: 1,
				reviewCompleted: true,
				expectedVersion: 6,
				sourceVersion: 1,
				clientMutationId: '55555555-5555-4555-8555-555555555555',
				updatedAt: '2026-08-10T00:00:00.000Z',
			},
			'2026-08-10T00:00:01.000Z',
		);

		expect(result.version).toBe(7);
		const physicalWrite = database.statements.find(
			(statement) =>
				statement.sql.includes('INSERT INTO daily_progress') &&
				statement.sql.includes('version_candidates'),
		);
		expect(physicalWrite?.values).toEqual([
			'learner-test',
			'2026-08-10',
			'study:2026-08-10:curriculum:%',
			'learner-test',
			'2026-08-10',
			1,
			1,
			0,
			0,
			0,
			7,
			'55555555-5555-4555-8555-555555555555',
			'2026-08-10T00:00:01.000Z',
			6,
			0,
		]);
		expect(
			database.statements.filter(
				(statement) =>
					statement.sql.includes('INSERT INTO change_log') &&
					statement.sql.includes("'sync:daily-progress'"),
			),
		).toHaveLength(1);
	});

	it('advances a daily progress delete above higher retained history', async () => {
		const database = new FakeDatabase();
		database.authoritativeVersion = 6;
		database.currentSyncEntity = {
			entity_type: 'daily-progress',
			entity_id: 'study:2026-08-10:curriculum:1',
			operation: 'upsert',
			payload_json: JSON.stringify({
				id: 'study:2026-08-10:curriculum:1',
				studyDate: '2026-08-10',
				curriculumDay: 1,
				reviewsCompleted: true,
				grammarCompleted: false,
				coreSessionImported: false,
				coreCompleted: false,
				version: 1,
				updatedAt: '2026-08-10T00:00:00.000Z',
			}),
			version: 1,
			last_mutation_id: '44444444-4444-4444-8444-444444444444',
			updated_at: '2026-08-10T00:00:00.000Z',
		};
		database.batchResults = [
			{ success: true, meta: { changes: 1 } },
			{ success: true, meta: { changes: 1 } },
			{ success: true, meta: { changes: 1 } },
			{ success: true, meta: { changes: 1 } },
		];
		const repository = new EnglishOsRepository(database);

		await expect(
			repository.tombstoneSyncEntity(
				'learner-test',
				{
					operationId: '66666666-6666-4666-8666-666666666666',
					schemaVersion: 1,
					deviceId: '77777777-7777-4777-8777-777777777777',
					entityType: 'daily-progress',
					entityId: 'study:2026-08-10:curriculum:1',
					expectedVersion: 1,
					createdAt: '2026-08-10T00:00:00.000Z',
				},
				'2026-08-10T00:00:01.000Z',
			),
		).rejects.toMatchObject({ version: 6 });

		const deleted = await repository.tombstoneSyncEntity(
			'learner-test',
			{
				operationId: '88888888-8888-4888-8888-888888888888',
				schemaVersion: 1,
				deviceId: '77777777-7777-4777-8777-777777777777',
				entityType: 'daily-progress',
				entityId: 'study:2026-08-10:curriculum:1',
				expectedVersion: 6,
				createdAt: '2026-08-10T00:00:00.000Z',
			},
			'2026-08-10T00:00:01.000Z',
		);

		expect(deleted.version).toBe(7);
		expect(
			database.statements.some(
				(statement) =>
					statement.sql.includes('INSERT INTO sync_entities') &&
					statement.sql.includes('version_candidates') &&
					statement.values.includes(7),
			),
		).toBe(true);
	});
});
