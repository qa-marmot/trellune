import type { AcquisitionCounts, CoreCompletion } from '../domain';
import {
	applySessionToProgress,
	calculateCoreCompletion,
	checkDailyAcquisitionLimits,
	importedItemState,
} from '../domain';
import { scheduleReview } from '../domain/srs';
import type {
	BaselineAssessmentImportRequest,
	DailyProgressPatch,
	ReviewEventMutationRequest,
	SessionImportRequest,
	StageAssessmentImportRequest,
} from '../lib/schemas';
import { normalizeExternalSession } from '../lib/schemas';
import {
	DailyProgressPayloadSchema,
	GrammarProgressPayloadSchema,
	type SyncDeletionRequest,
	type SyncEntityType,
	type SyncMutation,
} from '../sync/contracts';
import { nextCurriculumDay, studyDateAt } from '../domain/calendar';
import { CURRICULUM_CATALOG_ID, SUPPORTED_CURRICULUM_DAY_MAX } from '../curriculum/constants';
import { ActiveCurriculumTotalDaysSchema } from '../curriculum/availability';

export interface D1Result<T = Record<string, unknown>> {
	results?: T[];
	success: boolean;
	meta?: { changes?: number; last_row_id?: number };
}

export interface D1PreparedStatement {
	bind(...values: unknown[]): D1PreparedStatement;
	first<T = Record<string, unknown>>(): Promise<T | null>;
	all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
	run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

export interface D1DatabaseLike {
	prepare(query: string): D1PreparedStatement;
	batch<T = Record<string, unknown>>(
		statements: D1PreparedStatement[],
	): Promise<Array<D1Result<T>>>;
}

interface DuplicateRow {
	id: string;
	external_session_id: string;
	idempotency_key: string;
	source_text_hash: string;
	canonical_payload_hash: string | null;
	study_date: string;
}

interface ExistingMistakeRow {
	id: string;
	occurrence_count: number;
}

interface CountRow {
	words: number;
	phrases: number;
	preview_grammar: number;
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const DAILY_PROGRESS_ENTITY_PATTERN = /^study:(\d{4}-\d{2}-\d{2}):curriculum:(\d+)$/u;

function normalizeStoredSyncPayload(entityType: string, payload: unknown): unknown {
	if (
		entityType !== 'review-card' ||
		payload === null ||
		typeof payload !== 'object' ||
		Array.isArray(payload)
	) {
		return payload;
	}
	const dueAt = (payload as Record<string, unknown>).dueAt;
	if (typeof dueAt !== 'string' || !DATE_ONLY_PATTERN.test(dueAt)) return payload;
	return { ...payload, dueAt: `${dueAt}T00:00:00.000Z` };
}

interface ProgressRow {
	curriculum_day: number | null;
	review_completed: number;
	grammar_completed: number;
	core_voice_imported: number;
	core_completed: number;
	version: number;
	updated_at: string;
}

interface SyncEntityRow {
	entity_type: string;
	entity_id: string;
	operation: 'upsert' | 'delete';
	payload_json: string;
	version: number;
	last_mutation_id: string;
	updated_at: string;
}

interface DailyProgressVersionAuthorityRow {
	authoritative_version: number;
}

interface FormalReviewCardRow {
	id: string;
	front_text: string;
	back_text: string;
	due_date: string;
	state: 'new' | 'learning' | 'review' | 'relearning' | 'previewed' | 'suspended';
	source_type: 'vocabulary' | 'phrase' | 'mistake' | 'session';
	source_id: string;
	stability_level: number;
	lapses: number;
	last_reviewed_at: string | null;
	algorithm_version: 1;
	version: number;
	updated_at: string;
}

interface AssessmentRow {
	version: number;
	payload_json: string;
	completed_at: string;
	updated_at: string;
}

export interface SessionPreview {
	duplicate: null | {
		importId: string;
		exactIdempotentReplay: boolean;
		sameCanonicalContent: boolean;
	};
	countsBefore: AcquisitionCounts;
	countsIncoming: AcquisitionCounts;
	limits: ReturnType<typeof checkDailyAcquisitionLimits>;
}

export interface StoredSession {
	operationId: string;
	importId: string;
	replayed: boolean;
	version: number;
	changedAt: string;
	coreProgress: CoreCompletion;
}

export interface SyncMutationResult {
	operationId: string;
	entityType: SyncEntityType;
	entityId: string;
	operation: 'upsert' | 'delete';
	payload: unknown;
	version: number;
	sequence: number;
	replayed: boolean;
	changedAt: string;
}

const EMPTY_PROGRESS: CoreCompletion = {
	reviewCompleted: false,
	grammarCompleted: false,
	coreVoiceImported: false,
	coreCompleted: false,
};

function boolean(value: number | undefined): boolean {
	return value === 1;
}

function parseProgress(row: ProgressRow | null): CoreCompletion {
	if (!row) return EMPTY_PROGRESS;
	return {
		reviewCompleted: boolean(row.review_completed),
		grammarCompleted: boolean(row.grammar_completed),
		coreVoiceImported: boolean(row.core_voice_imported),
		coreCompleted: boolean(row.core_completed),
	};
}

export function normalizeEnglishIdentity(value: string): string {
	return value.normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/\s+/gu, ' ');
}

export function allocateDailyProgressVersion(
	authoritativeVersion: number,
	sourceVersion = 0,
): number {
	const floor = Math.max(authoritativeVersion, sourceVersion);
	if (!Number.isSafeInteger(floor) || floor < 0 || floor >= Number.MAX_SAFE_INTEGER) {
		throw new RangeError('The daily progress version space is exhausted.');
	}
	return floor + 1;
}

function canonicalize(value: unknown, excludedKeys: ReadonlySet<string> = new Set()): unknown {
	if (typeof value === 'string') return value.normalize('NFKC');
	if (Array.isArray(value)) return value.map((item) => canonicalize(item, excludedKeys));
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.keys(value)
				.sort()
				.filter(
					(key) => !excludedKeys.has(key) && (value as Record<string, unknown>)[key] !== undefined,
				)
				.map((key) => [key, canonicalize((value as Record<string, unknown>)[key], excludedKeys)]),
		);
	}
	return value;
}

async function canonicalHash(
	value: unknown,
	excludedKeys: ReadonlySet<string> = new Set(),
): Promise<string> {
	const bytes = new TextEncoder().encode(JSON.stringify(canonicalize(value, excludedKeys)));
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export class EnglishOsRepository {
	constructor(private readonly database: D1DatabaseLike) {}

	async ensureLearner(learnerId: string, accessSubject: string, now: string): Promise<void> {
		await this.database
			.prepare(
				`INSERT INTO learners (id, access_subject, timezone, start_date, created_at, updated_at)
				 VALUES (?, ?, 'Asia/Tokyo', DATE(?), ?, ?)
				 ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at`,
			)
			.bind(learnerId, accessSubject, now, now, now)
			.run();
		await this.backfillLegacyState(learnerId, now);
	}

	async previewSession(learnerId: string, request: SessionImportRequest): Promise<SessionPreview> {
		await this.assertCurriculumDayActive(request.payload.curriculumDay);
		const canonicalPayloadHash = await canonicalHash(request.payload, new Set(['sessionId']));
		const duplicate = await this.findDuplicate(learnerId, request, canonicalPayloadHash);
		const countsBefore = await this.dailyCounts(learnerId, request.studyDate);
		const countsIncoming = await this.newAcquisitionCounts(learnerId, request);
		return {
			duplicate: duplicate
				? {
						importId: duplicate.id,
						sameCanonicalContent: duplicate.canonical_payload_hash === canonicalPayloadHash,
						exactIdempotentReplay:
							duplicate.idempotency_key === request.idempotencyKey &&
							duplicate.external_session_id === request.payload.sessionId &&
							duplicate.canonical_payload_hash === canonicalPayloadHash,
					}
				: null,
			countsBefore,
			countsIncoming,
			limits: checkDailyAcquisitionLimits(countsBefore, countsIncoming),
		};
	}

	async importSession(
		learnerId: string,
		request: SessionImportRequest,
		now: string,
		progressRetryCount = 0,
	): Promise<StoredSession> {
		const requestFingerprint = await canonicalHash(request);
		const cached = await this.database
			.prepare(
				`SELECT response_json, request_fingerprint FROM processed_mutations
				 WHERE learner_id = ? AND mutation_id = ?`,
			)
			.bind(learnerId, request.idempotencyKey)
			.first<{ response_json: string; request_fingerprint: string | null }>();
		if (cached) {
			if (cached.request_fingerprint && cached.request_fingerprint !== requestFingerprint) {
				throw new MutationReplayMismatchError();
			}
			return {
				...(JSON.parse(cached.response_json) as Omit<StoredSession, 'replayed'>),
				replayed: true,
			};
		}
		const preview = await this.previewSession(learnerId, request);
		if (preview.duplicate) {
			if (!preview.duplicate.sameCanonicalContent) throw new ImportConflictError();
			const duplicate = await this.findDuplicate(
				learnerId,
				request,
				await canonicalHash(request.payload, new Set(['sessionId'])),
			);
			const progress = await this.progress(learnerId, duplicate?.study_date ?? request.studyDate);
			const duplicateMirror = duplicate
				? await this.syncEntity(learnerId, 'session', duplicate.external_session_id)
				: null;
			return {
				operationId: request.idempotencyKey,
				importId: preview.duplicate.importId,
				replayed: true,
				version: duplicateMirror?.version ?? 1,
				changedAt: now,
				coreProgress: parseProgress(progress),
			};
		}
		const currentSessionMirror = await this.syncEntity(
			learnerId,
			'session',
			request.payload.sessionId,
		);
		if ((currentSessionMirror?.version ?? 0) !== request.expectedVersion) {
			throw new SyncVersionConflictError(
				currentSessionMirror?.payload_json === 'null'
					? null
					: JSON.parse(currentSessionMirror?.payload_json ?? 'null'),
				currentSessionMirror?.version ?? 0,
			);
		}
		const sessionVersion = request.expectedVersion + 1;
		if (request.payload.sessionType === 'core') {
			const timeZone = await this.learnerTimeZone(learnerId);
			const expectedStudyDate = studyDateAt(request.payload.occurredAt, timeZone);
			const expectedCurriculumDay = await this.expectedCurriculumDay(learnerId, request.studyDate);
			if (
				request.studyDate !== expectedStudyDate ||
				request.payload.curriculumDay !== expectedCurriculumDay
			) {
				throw new SessionContextError(expectedStudyDate, expectedCurriculumDay);
			}
		} else {
			const timeZone = await this.learnerTimeZone(learnerId);
			const expectedStudyDate = studyDateAt(request.payload.occurredAt, timeZone);
			const progress = await this.progress(learnerId, request.studyDate);
			const expectedCurriculumDay = await this.expectedCurriculumDay(learnerId, request.studyDate);
			if (
				request.studyDate !== expectedStudyDate ||
				request.payload.curriculumDay !== expectedCurriculumDay ||
				progress?.core_completed !== 1
			) {
				throw new BoostContextError(expectedStudyDate, expectedCurriculumDay);
			}
			if (request.payload.previewGrammar.length) {
				const nextDay = expectedCurriculumDay + 1;
				const curriculum = await this.database
					.prepare('SELECT grammar_topic_key FROM curriculum_days WHERE day_number = ?')
					.bind(nextDay)
					.first<{ grammar_topic_key: string }>();
				if (
					request.payload.boost?.mode !== 'next_lesson_preview' ||
					!curriculum ||
					request.payload.previewGrammar[0]?.topicId !== curriculum.grammar_topic_key
				) {
					throw new BoostPreviewContextError();
				}
			}
		}
		if (!preview.limits.accepted) throw new AcquisitionLimitError(preview);

		const sourcePayload = request.payload;
		const payload = normalizeExternalSession(sourcePayload);
		const canonicalPayloadHash = await canonicalHash(sourcePayload, new Set(['sessionId']));
		const importId = crypto.randomUUID();
		const state = importedItemState(payload);
		const statements: D1PreparedStatement[] = [];

		statements.push(
			this.database
				.prepare(
					`INSERT INTO session_imports (
							 id, learner_id, external_session_id, idempotency_key, source_text_hash,
							 canonical_payload_hash, kind,
             study_date, occurred_at, curriculum_day, boost_duration_minutes, boost_mode,
							 summary_ja, support_language, summary_text, duration_minutes,
							 task_completion_score, grammar_score, vocabulary_score, fluency_score,
							 interaction_score, evaluation_comment_ja, evaluation_comment_text,
							 contract_version, imported_at
						 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				)
				.bind(
					importId,
					learnerId,
					payload.sessionId,
					request.idempotencyKey,
					request.sourceTextHash,
					canonicalPayloadHash,
					payload.sessionType,
					request.studyDate,
					payload.occurredAt,
					payload.sessionType === 'core' ? payload.curriculumDay : null,
					payload.sessionType === 'boost' ? payload.boost?.duration : null,
					payload.sessionType === 'boost' ? payload.boost?.mode : null,
					payload.supportLanguage === 'ja' ? payload.summary : null,
					payload.supportLanguage,
					payload.summary,
					payload.durationMinutes,
					payload.evaluation.taskCompletion,
					payload.evaluation.grammar,
					payload.evaluation.vocabulary,
					payload.evaluation.fluency,
					payload.evaluation.interaction,
					payload.supportLanguage === 'ja' ? payload.evaluation.comment : '',
					payload.evaluation.comment,
					1,
					now,
				),
		);

		for (const [index, word] of payload.newVocabulary.entries()) {
			const id = `${payload.sessionId}:vocabulary:${index}`;
			const cardId = `${payload.sessionId}:card:vocabulary:${index}`;
			statements.push(
				this.database
					.prepare(
						`INSERT INTO vocabulary (
               id, learner_id, session_id, client_id, study_date, term, normalized_term,
               meaning_ja, support_language, meaning_text, example, state, created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					)
					.bind(
						id,
						learnerId,
						importId,
						`${payload.sessionId}:vocabulary:${index}`,
						request.studyDate,
						word.text,
						normalizeEnglishIdentity(word.text),
						payload.supportLanguage === 'ja' ? word.meaning : '',
						payload.supportLanguage,
						word.meaning,
						word.example,
						state,
						now,
						now,
					),
			);
			statements.push(
				this.reviewCardStatement(
					cardId,
					learnerId,
					'vocabulary',
					id,
					word.text,
					`${word.meaning}\n${word.example}`,
					request.studyDate,
					now,
					'vocabulary',
					id,
					state,
				),
			);
			statements.push(
				...this.importedLearningMirrorStatements(
					learnerId,
					payload.sessionId,
					request.idempotencyKey,
					request.studyDate,
					'vocabulary',
					index,
					id,
					cardId,
					word,
					payload.supportLanguage,
					state,
					now,
				),
			);
		}

		for (const [index, phrase] of payload.newPhrases.entries()) {
			const id = `${payload.sessionId}:phrase:${index}`;
			const cardId = `${payload.sessionId}:card:phrase:${index}`;
			statements.push(
				this.database
					.prepare(
						`INSERT INTO phrases (
               id, learner_id, session_id, client_id, study_date, phrase, normalized_phrase,
               meaning_ja, support_language, meaning_text, example, state, created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					)
					.bind(
						id,
						learnerId,
						importId,
						`${payload.sessionId}:phrase:${index}`,
						request.studyDate,
						phrase.text,
						normalizeEnglishIdentity(phrase.text),
						payload.supportLanguage === 'ja' ? phrase.meaning : '',
						payload.supportLanguage,
						phrase.meaning,
						phrase.example,
						state,
						now,
						now,
					),
			);
			statements.push(
				this.reviewCardStatement(
					cardId,
					learnerId,
					'phrase',
					id,
					phrase.text,
					`${phrase.meaning}\n${phrase.example}`,
					request.studyDate,
					now,
					'phrases',
					id,
					state,
				),
			);
			statements.push(
				...this.importedLearningMirrorStatements(
					learnerId,
					payload.sessionId,
					request.idempotencyKey,
					request.studyDate,
					'phrase',
					index,
					id,
					cardId,
					phrase,
					payload.supportLanguage,
					state,
					now,
				),
			);
		}

		if (payload.sessionType === 'boost') {
			for (const [index, grammar] of payload.previewGrammar.entries()) {
				const grammarId = `${payload.sessionId}:grammar:${index}`;
				statements.push(
					this.database
						.prepare(
							`INSERT INTO grammar_previews (
                 id, learner_id, session_id, client_id, study_date, topic_key, title,
                 note_ja, support_language, note_text, state, created_at
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'previewed', ?)`,
						)
						.bind(
							grammarId,
							learnerId,
							importId,
							`${payload.sessionId}:grammar:${index}`,
							request.studyDate,
							grammar.topicId,
							grammar.title,
							payload.supportLanguage === 'ja' ? grammar.note : null,
							payload.supportLanguage,
							grammar.note,
							now,
						),
				);
				const grammarProgressId = `preview:${grammar.topicId}`;
				statements.push(
					...this.conditionalSyncMirrorStatements(
						'grammar_previews',
						grammarId,
						learnerId,
						'grammar-progress',
						grammarProgressId,
						{
							id: grammarProgressId,
							curriculumDay: payload.curriculumDay + 1,
							status: 'previewed',
							updatedAt: now,
						},
						1,
						crypto.randomUUID(),
						now,
						request.idempotencyKey,
					),
				);
				const acquisitionId = `${payload.sessionId}:acquisition:grammar:${index}`;
				statements.push(
					...this.conditionalSyncMirrorStatements(
						'grammar_previews',
						grammarId,
						learnerId,
						'acquisition-event',
						acquisitionId,
						{
							eventId: acquisitionId,
							studyDate: request.studyDate,
							kind: 'grammar-preview',
							entityId: grammar.topicId,
							sourceSessionId: payload.sessionId,
							createdAt: now,
						},
						1,
						crypto.randomUUID(),
						now,
						request.idempotencyKey,
					),
				);
			}
		}

		const mistakeIds: string[] = [];
		const mistakeAggregates = new Map<
			string,
			{
				id: string;
				baseOccurrences: number;
				incomingOccurrences: number;
				firstIndex: number;
				mistake: (typeof payload.mistakes)[number];
			}
		>();
		for (const [index, mistake] of payload.mistakes.entries()) {
			const canonicalIdentity = `${normalizeEnglishIdentity(mistake.category)}:${normalizeEnglishIdentity(mistake.learnerSaid)}:${normalizeEnglishIdentity(mistake.suggested)}`;
			let aggregate = mistakeAggregates.get(canonicalIdentity);
			if (!aggregate) {
				const existing = await this.database
					.prepare(
						`SELECT id, occurrence_count FROM mistakes
						 WHERE learner_id = ? AND canonical_identity = ? LIMIT 1`,
					)
					.bind(learnerId, canonicalIdentity)
					.first<ExistingMistakeRow>();
				aggregate = {
					id:
						existing?.id ??
						`mistake:${(await canonicalHash(`${learnerId}:${canonicalIdentity}`)).slice(0, 48)}`,
					baseOccurrences: existing?.occurrence_count ?? 0,
					incomingOccurrences: 0,
					firstIndex: index,
					mistake,
				};
				mistakeAggregates.set(canonicalIdentity, aggregate);
			}
			aggregate.incomingOccurrences += 1;
			mistakeIds.push(aggregate.id);
		}

		for (const [canonicalIdentity, aggregate] of mistakeAggregates) {
			if (aggregate.baseOccurrences > 0) {
				statements.push(
					this.database
						.prepare(
							`UPDATE mistakes SET
							   occurrence_count = occurrence_count + ?,
							   explanation_ja = ?, support_language = ?, explanation_text = ?,
							   severity = ?, updated_at = ?
							 WHERE learner_id = ? AND id = ? AND canonical_identity = ?`,
						)
						.bind(
							aggregate.incomingOccurrences,
							payload.supportLanguage === 'ja' ? aggregate.mistake.explanation : null,
							payload.supportLanguage,
							aggregate.mistake.explanation,
							aggregate.mistake.severity,
							now,
							learnerId,
							aggregate.id,
							canonicalIdentity,
						),
				);
			} else {
				statements.push(
					this.database
						.prepare(
							`INSERT INTO mistakes (
							 id, learner_id, session_id, client_id, category, original_text,
							 correction_text, explanation_ja, support_language, explanation_text,
							 severity, occurrence_count, created_at, updated_at,
							 canonical_identity
						 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
						 ON CONFLICT(id) DO UPDATE SET
						   occurrence_count = mistakes.occurrence_count + excluded.occurrence_count,
						   explanation_ja = excluded.explanation_ja,
						   support_language = excluded.support_language,
						   explanation_text = excluded.explanation_text,
						   severity = excluded.severity,
						   updated_at = excluded.updated_at`,
						)
						.bind(
							aggregate.id,
							learnerId,
							importId,
							`${payload.sessionId}:mistake:${aggregate.firstIndex}`,
							aggregate.mistake.category,
							aggregate.mistake.learnerSaid,
							aggregate.mistake.suggested,
							payload.supportLanguage === 'ja' ? aggregate.mistake.explanation : null,
							payload.supportLanguage,
							aggregate.mistake.explanation,
							aggregate.mistake.severity,
							aggregate.incomingOccurrences,
							now,
							now,
							canonicalIdentity,
						),
				);
			}
		}

		const mistakeCardIds = new Map<string, string>();
		for (const [index, card] of payload.reviewCards.entries()) {
			const mistakeId =
				card.sourceMistakeIndex === null ? null : mistakeIds[card.sourceMistakeIndex];
			let cardId = `${payload.sessionId}:card:candidate:${index}`;
			let shouldCreateCard = true;
			if (mistakeId) {
				const stagedCardId = mistakeCardIds.get(mistakeId);
				const existingCard = stagedCardId
					? null
					: await this.database
							.prepare(
								`SELECT id FROM review_cards
								 WHERE learner_id = ? AND source_type = 'mistake' AND source_id = ? LIMIT 1`,
							)
							.bind(learnerId, mistakeId)
							.first<{ id: string }>();
				cardId = stagedCardId ?? existingCard?.id ?? `card:${mistakeId}`;
				shouldCreateCard = !stagedCardId && !existingCard;
				mistakeCardIds.set(mistakeId, cardId);
			}
			if (!shouldCreateCard) continue;
			statements.push(
				this.reviewCardStatement(
					cardId,
					learnerId,
					mistakeId ? 'mistake' : 'session',
					mistakeId ?? `${importId}:review:${index}`,
					card.front,
					card.back,
					request.studyDate,
					now,
					mistakeId ? 'mistakes' : 'session_imports',
					mistakeId ?? importId,
					'new',
					Boolean(mistakeId),
				),
			);
			statements.push(
				...(mistakeId
					? this.formalReviewCardMirrorStatements(
							learnerId,
							cardId,
							crypto.randomUUID(),
							now,
							request.idempotencyKey,
						)
					: this.conditionalSyncMirrorStatements(
							'review_cards',
							cardId,
							learnerId,
							'review-card',
							cardId,
							{
								id: cardId,
								front: card.front,
								back: card.back,
								dueAt: now,
								state: 'new',
								sourceType: mistakeId ? 'mistake' : 'session',
								sourceId: mistakeId ?? payload.sessionId,
								stabilityLevel: 0,
								lapses: 0,
								algorithmVersion: 1,
								version: 1,
								updatedAt: now,
							},
							1,
							crypto.randomUUID(),
							now,
							request.idempotencyKey,
						)),
			);
		}

		for (const cardId of request.reviewedCardIds) {
			statements.push(
				this.database
					.prepare('INSERT INTO reviewed_cards (session_id, card_id) VALUES (?, ?)')
					.bind(importId, cardId),
			);
		}

		const existingProgressRow = await this.progress(learnerId, request.studyDate);
		const existingProgress = parseProgress(existingProgressRow);
		const nextProgress = applySessionToProgress(existingProgress, payload);
		const curriculumDay =
			payload.sessionType === 'core'
				? payload.curriculumDay
				: (existingProgressRow?.curriculum_day ?? payload.curriculumDay);
		const progressAuthority = await this.dailyProgressVersionAuthority(
			learnerId,
			request.studyDate,
		);
		const nextProgressVersion = allocateDailyProgressVersion(progressAuthority);
		const progressMutationId = crypto.randomUUID();
		statements.push(
			this.guardedDailyProgressStatement(
				learnerId,
				request.studyDate,
				curriculumDay,
				nextProgress,
				nextProgressVersion,
				progressMutationId,
				now,
				existingProgressRow?.version ?? 0,
				progressAuthority,
			),
		);

		const scoreValues = Object.values(payload.evaluation).filter(
			(value): value is number => typeof value === 'number',
		);
		const sessionPayload = {
			sessionId: payload.sessionId,
			kind: payload.sessionType,
			completedAt: payload.occurredAt,
			durationMinutes: payload.durationMinutes,
			summary: payload.summary,
			score: Math.round(
				(scoreValues.reduce((total, value) => total + value, 0) / scoreValues.length) * 20,
			),
			mistakes: payload.mistakes.map((item) => `${item.learnerSaid} → ${item.suggested}`),
			payload: sourcePayload,
		};
		statements.push(
			this.database
				.prepare(
					`INSERT INTO sync_entities (
					   learner_id, entity_type, entity_id, operation, payload_json,
					   version, last_mutation_id, updated_at
					 ) VALUES (?, 'session', ?, 'upsert', ?, ?, ?, ?)
					 ON CONFLICT(learner_id, entity_type, entity_id) DO UPDATE SET
					   operation = 'upsert', payload_json = excluded.payload_json,
					   version = excluded.version, last_mutation_id = excluded.last_mutation_id,
					   updated_at = excluded.updated_at
					 WHERE sync_entities.version = ?`,
				)
				.bind(
					learnerId,
					payload.sessionId,
					JSON.stringify(sessionPayload),
					sessionVersion,
					request.idempotencyKey,
					now,
					request.expectedVersion,
				),
			this.database
				.prepare(
					`INSERT INTO change_log (
					   learner_id, entity_type, entity_id, operation, payload_json, operation_id, changed_at
					 ) VALUES (?, 'sync:session', ?, 'upsert', ?, ?, ?)`,
				)
				.bind(
					learnerId,
					payload.sessionId,
					JSON.stringify({ payload: sessionPayload, version: sessionVersion }),
					request.idempotencyKey,
					now,
				),
		);
		for (const aggregate of mistakeAggregates.values()) {
			statements.push(
				...this.mistakeMirrorStatements(
					learnerId,
					aggregate.id,
					payload.sessionId,
					crypto.randomUUID(),
					now,
					request.idempotencyKey,
				),
			);
		}
		if (curriculumDay) {
			const progressId = `study:${request.studyDate}:curriculum:${curriculumDay}`;
			statements.push(
				...this.dailyProgressMirrorStatements(
					learnerId,
					progressId,
					request.studyDate,
					progressMutationId,
					request.idempotencyKey,
				),
			);
		}
		statements.push(
			this.database
				.prepare(
					`INSERT INTO processed_mutations (
					   learner_id, mutation_id, response_json, entity_type, entity_id,
					   entity_version, request_fingerprint, processed_at
					 ) VALUES (?, ?, ?, 'daily_progress', ?, ?, ?, ?)`,
				)
				.bind(
					learnerId,
					progressMutationId,
					JSON.stringify({ operationId: progressMutationId, version: nextProgressVersion }),
					request.studyDate,
					nextProgressVersion,
					requestFingerprint,
					now,
				),
		);
		const response: Omit<StoredSession, 'replayed'> = {
			operationId: request.idempotencyKey,
			importId,
			version: sessionVersion,
			changedAt: now,
			coreProgress: nextProgress,
		};
		statements.push(
			this.database
				.prepare(
					`INSERT INTO processed_mutations (
					   learner_id, mutation_id, response_json, entity_type, entity_id,
					   entity_version, request_fingerprint, processed_at
					 ) VALUES (?, ?, ?, 'sync:session', ?, ?, ?, ?)`,
				)
				.bind(
					learnerId,
					request.idempotencyKey,
					JSON.stringify(response),
					payload.sessionId,
					sessionVersion,
					requestFingerprint,
					now,
				),
		);

		try {
			await this.database.batch(statements);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (message.includes('progress_version_conflict')) {
				// Session identity has its own strict CAS. Daily Core evidence is a monotonic,
				// commutative side effect, so two different valid session imports may race on
				// the same study date. Rebuild the entire atomic batch from the new authority
				// instead of misreporting that race as a stale session mutation.
				if (progressRetryCount < 2) {
					return this.importSession(learnerId, request, now, progressRetryCount + 1);
				}
				const latest = await this.syncEntity(learnerId, 'session', payload.sessionId);
				throw new SyncVersionConflictError(
					latest?.payload_json === 'null' ? null : JSON.parse(latest?.payload_json ?? 'null'),
					latest?.version ?? 0,
				);
			}
			if (message.includes('sync_version_conflict')) {
				const latest = await this.syncEntity(learnerId, 'session', payload.sessionId);
				throw new SyncVersionConflictError(
					latest?.payload_json === 'null' ? null : JSON.parse(latest?.payload_json ?? 'null'),
					latest?.version ?? 0,
				);
			}
			if (message.includes('daily_'))
				throw new AcquisitionLimitError(await this.previewSession(learnerId, request));
			if (message.includes('UNIQUE')) {
				const racedPreview = await this.previewSession(learnerId, request);
				if (racedPreview.duplicate?.sameCanonicalContent) {
					const racedProgress = await this.progress(learnerId, request.studyDate);
					return {
						operationId: request.idempotencyKey,
						importId: racedPreview.duplicate.importId,
						replayed: true,
						version:
							(await this.syncEntity(learnerId, 'session', request.payload.sessionId))?.version ??
							1,
						changedAt: now,
						coreProgress: parseProgress(racedProgress),
					};
				}
				throw new ImportConflictError();
			}
			throw error;
		}

		const storedProgress = await this.progress(learnerId, request.studyDate);
		return {
			...response,
			replayed: false,
			coreProgress: parseProgress(storedProgress),
		};
	}

	async patchProgress(
		learnerId: string,
		studyDate: string,
		patch: DailyProgressPatch,
		now: string,
	): Promise<{
		operationId: string;
		progress: CoreCompletion;
		version: number;
		replayed: boolean;
		changedAt: string;
	}> {
		const requestFingerprint = await canonicalHash({ studyDate, patch });
		const cached = await this.database
			.prepare(
				`SELECT response_json, request_fingerprint FROM processed_mutations
				 WHERE learner_id = ? AND mutation_id = ?`,
			)
			.bind(learnerId, patch.clientMutationId)
			.first<{ response_json: string; request_fingerprint: string | null }>();
		if (cached) {
			if (cached.request_fingerprint && cached.request_fingerprint !== requestFingerprint) {
				throw new MutationReplayMismatchError();
			}
			return {
				...(JSON.parse(cached.response_json) as {
					operationId: string;
					progress: CoreCompletion;
					version: number;
					changedAt: string;
				}),
				replayed: true,
			};
		}
		if (patch.curriculumDay !== undefined) {
			await this.assertCurriculumDayActive(patch.curriculumDay);
		}

		const currentRow = await this.progress(learnerId, studyDate);
		const current = parseProgress(currentRow);
		const expectedCurriculumDay = await this.expectedCurriculumDay(learnerId, studyDate);
		if (
			(currentRow?.curriculum_day &&
				patch.curriculumDay !== undefined &&
				patch.curriculumDay !== currentRow.curriculum_day) ||
			(!currentRow &&
				patch.curriculumDay !== undefined &&
				patch.curriculumDay !== expectedCurriculumDay)
		) {
			throw new ProgressContextError(expectedCurriculumDay);
		}
		const curriculumDay = patch.curriculumDay ?? currentRow?.curriculum_day;
		if (!curriculumDay) throw new ProgressContextError();
		const authoritativeVersion = await this.dailyProgressVersionAuthority(learnerId, studyDate);
		if (patch.expectedVersion !== undefined && patch.expectedVersion !== authoritativeVersion) {
			throw new VersionConflictError(current, authoritativeVersion);
		}

		const next = calculateCoreCompletion({
			...current,
			reviewCompleted: patch.reviewCompleted ?? current.reviewCompleted,
			grammarCompleted: patch.grammarCompleted ?? current.grammarCompleted,
		});
		const nextVersion = allocateDailyProgressVersion(authoritativeVersion, patch.sourceVersion);
		const response = {
			operationId: patch.clientMutationId,
			progress: next,
			version: nextVersion,
			changedAt: now,
		};
		const entityId = `study:${studyDate}:curriculum:${curriculumDay}`;
		let grammarMirrorStatements: D1PreparedStatement[] = [];
		if (next.grammarCompleted && !current.grammarCompleted) {
			const grammar = await this.database
				.prepare('SELECT grammar_topic_key FROM curriculum_days WHERE day_number = ?')
				.bind(curriculumDay)
				.first<{ grammar_topic_key: string }>();
			if (!grammar) throw new ProgressContextError(expectedCurriculumDay);
			const preview = await this.database
				.prepare(
					`SELECT id FROM grammar_previews
					 WHERE learner_id = ? AND topic_key = ? ORDER BY created_at LIMIT 1`,
				)
				.bind(learnerId, grammar.grammar_topic_key)
				.first<{ id: string }>();
			const grammarEntityId = `${preview ? 'preview' : 'completed'}:${grammar.grammar_topic_key}`;
			const currentGrammar = await this.syncEntity(learnerId, 'grammar-progress', grammarEntityId);
			grammarMirrorStatements = this.syncMirrorStatements(
				learnerId,
				'grammar-progress',
				grammarEntityId,
				{
					id: grammarEntityId,
					curriculumDay,
					status: 'completed',
					updatedAt: now,
				},
				(currentGrammar?.version ?? 0) + 1,
				crypto.randomUUID(),
				now,
				patch.clientMutationId,
			);
		}
		try {
			const results = await this.database.batch([
				this.guardedDailyProgressStatement(
					learnerId,
					studyDate,
					curriculumDay,
					next,
					nextVersion,
					patch.clientMutationId,
					now,
					currentRow?.version ?? 0,
					authoritativeVersion,
				),
				...this.dailyProgressMirrorStatements(
					learnerId,
					entityId,
					studyDate,
					patch.clientMutationId,
					patch.clientMutationId,
				),
				...grammarMirrorStatements,
				this.database
					.prepare(
						`INSERT INTO processed_mutations (
				 learner_id, mutation_id, response_json, entity_type, entity_id, entity_version,
				 request_fingerprint, processed_at
			   ) VALUES (?, ?, ?, 'daily_progress', ?, ?, ?, ?)`,
					)
					.bind(
						learnerId,
						patch.clientMutationId,
						JSON.stringify(response),
						studyDate,
						nextVersion,
						requestFingerprint,
						now,
					),
			]);
			if (results[0]?.meta?.changes === 0) throw new Error('progress_version_conflict');
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (!message.includes('progress_version_conflict')) throw error;
			const [latest, latestAuthority] = await Promise.all([
				this.progress(learnerId, studyDate),
				this.dailyProgressVersionAuthority(learnerId, studyDate),
			]);
			throw new VersionConflictError(parseProgress(latest), latestAuthority);
		}
		return { ...response, replayed: false };
	}

	async gradeReview(
		learnerId: string,
		request: ReviewEventMutationRequest,
		now: string,
	): Promise<{
		operationId: string;
		eventId: string;
		cardId: string;
		version: number;
		replayed: boolean;
		changedAt: string;
	}> {
		const requestFingerprint = await canonicalHash(request);
		const cached = await this.database
			.prepare(
				`SELECT response_json, request_fingerprint FROM processed_mutations
				 WHERE learner_id = ? AND mutation_id = ?`,
			)
			.bind(learnerId, request.operationId)
			.first<{ response_json: string; request_fingerprint: string | null }>();
		if (cached) {
			if (cached.request_fingerprint && cached.request_fingerprint !== requestFingerprint) {
				throw new MutationReplayMismatchError();
			}
			return {
				...(JSON.parse(cached.response_json) as {
					operationId: string;
					eventId: string;
					cardId: string;
					version: number;
					changedAt: string;
				}),
				replayed: true,
			};
		}
		await this.assertCurriculumDayActive(request.curriculumDay);

		const timeZone = await this.learnerTimeZone(learnerId);
		const expectedStudyDate = studyDateAt(request.occurredAt, timeZone);
		const expectedCurriculumDay = await this.expectedCurriculumDay(learnerId, request.studyDate);
		if (
			request.studyDate !== expectedStudyDate ||
			request.curriculumDay !== expectedCurriculumDay
		) {
			throw new SessionContextError(expectedStudyDate, expectedCurriculumDay);
		}

		const card = await this.database
			.prepare(
				`SELECT id, front_text, back_text, due_date, state, source_type, source_id,
				        stability_level, lapses, last_reviewed_at, algorithm_version,
				        version, updated_at
				 FROM review_cards WHERE learner_id = ? AND id = ?`,
			)
			.bind(learnerId, request.cardId)
			.first<FormalReviewCardRow>();
		if (!card || card.version !== request.expectedVersion) {
			throw new SyncVersionConflictError(
				card ? this.reviewCardPayload(card) : null,
				card?.version ?? 0,
			);
		}
		if (card.state === 'previewed' || card.state === 'suspended') throw new ReviewStateError();

		const scheduled = scheduleReview(
			{
				state: card.state,
				dueAt: card.due_date,
				lastReviewedAt: card.last_reviewed_at ?? undefined,
				stabilityLevel: card.stability_level,
				lapses: card.lapses,
			},
			request.grade,
			request.occurredAt,
			timeZone,
		);
		const nextVersion = card.version + 1;
		const nextCard = {
			id: card.id,
			front: card.front_text,
			back: card.back_text,
			dueAt: scheduled.dueAt,
			state: scheduled.state,
			sourceType: card.source_type,
			sourceId: card.source_id,
			stabilityLevel: scheduled.stabilityLevel,
			lapses: scheduled.lapses,
			lastReviewedAt: scheduled.lastReviewedAt,
			algorithmVersion: 1 as const,
			version: nextVersion,
			updatedAt: now,
		};
		const before = {
			id: card.id,
			front: card.front_text,
			back: card.back_text,
			dueAt: card.due_date,
			state: card.state,
			stabilityLevel: card.stability_level,
			lapses: card.lapses,
			lastReviewedAt: card.last_reviewed_at ?? undefined,
			version: card.version,
		};
		const after = {
			id: nextCard.id,
			front: nextCard.front,
			back: nextCard.back,
			dueAt: nextCard.dueAt,
			state: nextCard.state,
			stabilityLevel: nextCard.stabilityLevel,
			lapses: nextCard.lapses,
			lastReviewedAt: nextCard.lastReviewedAt,
			version: nextCard.version,
		};
		const event = {
			eventId: request.eventId,
			cardId: request.cardId,
			grade: request.grade,
			occurredAt: request.occurredAt,
			studyDate: request.studyDate,
			curriculumDay: request.curriculumDay,
			algorithmVersion: 1 as const,
			before,
			after,
		};
		const response = {
			operationId: request.operationId,
			eventId: request.eventId,
			cardId: request.cardId,
			version: nextVersion,
			changedAt: now,
		};
		try {
			const results = await this.database.batch([
				this.database
					.prepare(
						`UPDATE review_cards SET
						   due_date = ?, interval_days = ?, state = ?, stability_level = ?,
						   lapses = ?, last_reviewed_at = ?, algorithm_version = 1,
						   version = version + 1, last_mutation_id = ?, updated_at = ?
						 WHERE learner_id = ? AND id = ? AND version = ?`,
					)
					.bind(
						scheduled.dueAt,
						Math.max(1, scheduled.intervalDays),
						scheduled.state,
						scheduled.stabilityLevel,
						scheduled.lapses,
						scheduled.lastReviewedAt,
						request.operationId,
						now,
						learnerId,
						request.cardId,
						request.expectedVersion,
					),
				this.database
					.prepare(
						`INSERT INTO review_events (
						   id, learner_id, card_id, grade, occurred_at, study_date,
						   curriculum_day, algorithm_version, before_json, after_json, created_at
						 ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
					)
					.bind(
						request.eventId,
						learnerId,
						request.cardId,
						request.grade,
						request.occurredAt,
						request.studyDate,
						request.curriculumDay,
						JSON.stringify(before),
						JSON.stringify(after),
						now,
					),
				...this.syncMirrorStatements(
					learnerId,
					'review-card',
					request.cardId,
					nextCard,
					nextVersion,
					request.operationId,
					now,
				),
				...this.syncMirrorStatements(
					learnerId,
					'review-event',
					request.eventId,
					event,
					1,
					crypto.randomUUID(),
					now,
					request.operationId,
				),
				this.database
					.prepare(
						`INSERT INTO processed_mutations (
						   learner_id, mutation_id, response_json, entity_type, entity_id,
						   entity_version, request_fingerprint, processed_at
						 ) VALUES (?, ?, ?, 'review_event', ?, ?, ?, ?)`,
					)
					.bind(
						learnerId,
						request.operationId,
						JSON.stringify(response),
						request.cardId,
						nextVersion,
						requestFingerprint,
						now,
					),
			]);
			if (results[0]?.meta?.changes === 0) throw new Error('review_version_conflict');
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (!message.includes('review_version_conflict')) throw error;
			const latest = await this.database
				.prepare(
					`SELECT id, front_text, back_text, due_date, state, source_type, source_id,
					        stability_level, lapses, last_reviewed_at, algorithm_version,
					        version, updated_at
					 FROM review_cards WHERE learner_id = ? AND id = ?`,
				)
				.bind(learnerId, request.cardId)
				.first<FormalReviewCardRow>();
			throw new SyncVersionConflictError(
				latest ? this.reviewCardPayload(latest) : null,
				latest?.version ?? 0,
			);
		}
		return { ...response, replayed: false };
	}

	async importBaselineAssessment(
		learnerId: string,
		request: BaselineAssessmentImportRequest,
		now: string,
	) {
		return this.importAssessment(learnerId, request, now);
	}

	async importStageAssessment(
		learnerId: string,
		request: StageAssessmentImportRequest,
		now: string,
	): Promise<{
		operationId: string;
		assessmentId: string;
		attemptId: string;
		version: number;
		replayed: boolean;
		changedAt: string;
	}> {
		const result = await this.importAssessment(learnerId, request, now, async () => {
			const activeTotalDays = await this.activeCurriculumTotalDays();
			await this.assertCurriculumDayActive(
				request.assessment.payload.curriculumRange.startDay,
				activeTotalDays,
			);
			await this.assertCurriculumDayActive(
				request.assessment.payload.curriculumRange.endDay,
				activeTotalDays,
			);
		});
		return {
			...result,
			assessmentId: request.assessment.payload.assessmentId,
			attemptId: result.assessmentId,
		};
	}

	private async importAssessment(
		learnerId: string,
		request: BaselineAssessmentImportRequest | StageAssessmentImportRequest,
		now: string,
		validateBeforeWrite?: () => Promise<void>,
	): Promise<{
		operationId: string;
		assessmentId: string;
		version: number;
		replayed: boolean;
		changedAt: string;
	}> {
		const requestFingerprint = await canonicalHash(request);
		const cached = await this.database
			.prepare(
				`SELECT response_json, request_fingerprint FROM processed_mutations
				 WHERE learner_id = ? AND mutation_id = ?`,
			)
			.bind(learnerId, request.operationId)
			.first<{ response_json: string; request_fingerprint: string | null }>();
		if (cached) {
			if (cached.request_fingerprint && cached.request_fingerprint !== requestFingerprint) {
				throw new MutationReplayMismatchError();
			}
			return {
				...(JSON.parse(cached.response_json) as {
					operationId: string;
					assessmentId: string;
					version: number;
					changedAt: string;
				}),
				replayed: true,
			};
		}
		await validateBeforeWrite?.();
		const current = await this.database
			.prepare(
				`SELECT version, payload_json, completed_at, updated_at FROM assessments
				 WHERE learner_id = ? AND id = ?`,
			)
			.bind(learnerId, request.assessment.id)
			.first<AssessmentRow>();
		if ((current?.version ?? 0) !== request.expectedVersion) {
			throw new SyncVersionConflictError(
				current
					? {
							...request.assessment,
							completedAt: current.completed_at,
							payload: JSON.parse(current.payload_json) as unknown,
						}
					: null,
				current?.version ?? 0,
			);
		}
		const nextVersion = (current?.version ?? 0) + 1;
		const response = {
			operationId: request.operationId,
			assessmentId: request.assessment.id,
			version: nextVersion,
			changedAt: now,
		};
		try {
			const results = await this.database.batch([
				this.database
					.prepare(
						`INSERT INTO assessments (
						   learner_id, id, type, completed_at, payload_json, version,
						   last_mutation_id, updated_at
						 ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)
						 ON CONFLICT(learner_id, id) DO UPDATE SET
						   type = excluded.type,
						   completed_at = excluded.completed_at,
						   payload_json = excluded.payload_json,
						   version = assessments.version + 1,
						   last_mutation_id = excluded.last_mutation_id,
						   updated_at = excluded.updated_at
						 WHERE assessments.version = ?`,
					)
					.bind(
						learnerId,
						request.assessment.id,
						request.assessment.type,
						request.assessment.completedAt,
						JSON.stringify(request.assessment.payload),
						request.operationId,
						now,
						request.expectedVersion,
					),
				...this.syncMirrorStatements(
					learnerId,
					'assessment',
					request.assessment.id,
					request.assessment,
					nextVersion,
					request.operationId,
					now,
				),
				this.database
					.prepare(
						`INSERT INTO processed_mutations (
						   learner_id, mutation_id, response_json, entity_type, entity_id,
						   entity_version, request_fingerprint, processed_at
						 ) VALUES (?, ?, ?, 'assessment', ?, ?, ?, ?)`,
					)
					.bind(
						learnerId,
						request.operationId,
						JSON.stringify(response),
						request.assessment.id,
						nextVersion,
						requestFingerprint,
						now,
					),
			]);
			if (results[0]?.meta?.changes === 0) throw new Error('assessment_version_conflict');
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (!message.includes('assessment_version_conflict')) throw error;
			const latest = await this.database
				.prepare(
					`SELECT version, payload_json, completed_at, updated_at FROM assessments
					 WHERE learner_id = ? AND id = ?`,
				)
				.bind(learnerId, request.assessment.id)
				.first<AssessmentRow>();
			throw new SyncVersionConflictError(
				latest
					? {
							...request.assessment,
							completedAt: latest.completed_at,
							payload: JSON.parse(latest.payload_json) as unknown,
						}
					: null,
				latest?.version ?? 0,
			);
		}
		return { ...response, replayed: false };
	}

	async applySyncMutation(
		learnerId: string,
		mutation: SyncMutation,
		now: string,
	): Promise<SyncMutationResult> {
		const requestFingerprint = await canonicalHash({
			entityType: mutation.entityType,
			entityId: mutation.entityId,
			operationType: mutation.operationType,
			payload: mutation.payload,
			baseVersion: mutation.baseVersion,
		});
		const cached = await this.database
			.prepare(
				`SELECT response_json, request_fingerprint FROM processed_mutations
				 WHERE learner_id = ? AND mutation_id = ?`,
			)
			.bind(learnerId, mutation.operationId)
			.first<{ response_json: string; request_fingerprint: string | null }>();
		if (cached) {
			if (cached.request_fingerprint && cached.request_fingerprint !== requestFingerprint) {
				throw new MutationReplayMismatchError();
			}
			return {
				...(JSON.parse(cached.response_json) as Omit<SyncMutationResult, 'replayed'>),
				replayed: true,
			};
		}
		await this.assertCurriculumDayActive(mutation.payload.profile.currentDay);

		const current = await this.syncEntity(learnerId, mutation.entityType, mutation.entityId);
		if (current && current.version !== mutation.baseVersion) {
			throw new SyncVersionConflictError(
				current.payload_json === 'null' ? null : (JSON.parse(current.payload_json) as unknown),
				current.version,
			);
		}
		const version = Math.max(current?.version ?? 0, mutation.baseVersion ?? 0) + 1;
		const response: Omit<SyncMutationResult, 'replayed'> = {
			operationId: mutation.operationId,
			entityType: mutation.entityType,
			entityId: mutation.entityId,
			operation: mutation.operationType,
			payload: mutation.payload,
			version,
			sequence: 0,
			changedAt: now,
		};
		try {
			const results = await this.database.batch([
				this.database
					.prepare(
						`INSERT INTO sync_entities (
             learner_id, entity_type, entity_id, operation, payload_json,
             version, last_mutation_id, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(learner_id, entity_type, entity_id) DO UPDATE SET
             operation = excluded.operation,
             payload_json = excluded.payload_json,
             version = excluded.version,
             last_mutation_id = excluded.last_mutation_id,
             updated_at = excluded.updated_at
           WHERE sync_entities.version = ?`,
					)
					.bind(
						learnerId,
						mutation.entityType,
						mutation.entityId,
						mutation.operationType,
						JSON.stringify(mutation.payload),
						version,
						mutation.operationId,
						now,
						mutation.baseVersion,
					),
				this.database
					.prepare(
						'UPDATE learners SET timezone = ?, start_date = ?, entry_day = ?, updated_at = ? WHERE id = ?',
					)
					.bind(
						mutation.payload.profile.timeZone,
						mutation.payload.profile.startDate,
						mutation.payload.profile.entryDay,
						now,
						learnerId,
					),
				this.database
					.prepare(
						`INSERT INTO change_log (
				 learner_id, entity_type, entity_id, operation, payload_json, operation_id, changed_at
			   ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
					)
					.bind(
						learnerId,
						`sync:${mutation.entityType}`,
						mutation.entityId,
						mutation.operationType,
						JSON.stringify({ payload: mutation.payload, version }),
						mutation.operationId,
						now,
					),
				this.database
					.prepare(
						`INSERT INTO processed_mutations (
             learner_id, mutation_id, response_json, entity_type, entity_id,
				 entity_version, request_fingerprint, processed_at
			   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
					)
					.bind(
						learnerId,
						mutation.operationId,
						JSON.stringify(response),
						`sync:${mutation.entityType}`,
						mutation.entityId,
						version,
						requestFingerprint,
						now,
					),
			]);
			if (results[0]?.meta?.changes === 0) throw new Error('sync_version_conflict');
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (!message.includes('sync_version_conflict')) throw error;
			const latest = await this.syncEntity(learnerId, mutation.entityType, mutation.entityId);
			throw new SyncVersionConflictError(
				latest?.payload_json ? (JSON.parse(latest.payload_json) as unknown) : null,
				latest?.version ?? 0,
			);
		}
		return { ...response, replayed: false };
	}

	private sessionPreDeleteStatements(
		learnerId: string,
		request: SyncDeletionRequest,
		now: string,
	): D1PreparedStatement[] {
		if (request.entityType !== 'session') return [];
		const progressMutationId = crypto.randomUUID();
		return [
			// A semantic mistake can be updated by a later session while its physical
			// owner remains the first session. Move it to that later live session before
			// deleting the old owner so the aggregate is not lost by the FK cascade.
			this.database
				.prepare(
					`UPDATE mistakes
					 SET session_id = (
					   SELECT replacement.id
					   FROM sync_entities AS mirror
					   JOIN session_imports AS replacement
					     ON replacement.learner_id = mirror.learner_id
					    AND replacement.external_session_id = json_extract(mirror.payload_json, '$.sessionId')
					   WHERE mirror.learner_id = mistakes.learner_id
					     AND mirror.entity_type = 'mistake'
					     AND mirror.entity_id = mistakes.id
					     AND mirror.operation = 'upsert'
					     AND json_extract(mirror.payload_json, '$.sessionId') <> ?
					   LIMIT 1
					 )
					 WHERE learner_id = ?
					   AND session_id IN (
					     SELECT id FROM session_imports
					     WHERE learner_id = ? AND external_session_id = ?
					   )
					   AND EXISTS (
					     SELECT 1
					     FROM sync_entities AS mirror
					     JOIN session_imports AS replacement
					       ON replacement.learner_id = mirror.learner_id
					      AND replacement.external_session_id = json_extract(mirror.payload_json, '$.sessionId')
					     WHERE mirror.learner_id = mistakes.learner_id
					       AND mirror.entity_type = 'mistake'
					       AND mirror.entity_id = mistakes.id
					       AND mirror.operation = 'upsert'
					       AND json_extract(mirror.payload_json, '$.sessionId') <> ?
					   )`,
				)
				.bind(request.entityId, learnerId, learnerId, request.entityId, request.entityId),
			// If the deleted session is only the most recent observation of a
			// semantic mistake, point the mirror back to its surviving physical
			// owner so backup and client referential checks remain valid.
			this.database
				.prepare(
					`UPDATE sync_entities AS mirror
					 SET payload_json = json_set(
					       mirror.payload_json,
					       '$.sessionId',
					       (
					         SELECT owner.external_session_id
					         FROM mistakes AS item
					         JOIN session_imports AS owner ON owner.id = item.session_id
					         WHERE item.learner_id = mirror.learner_id AND item.id = mirror.entity_id
					       )
					     ),
					     version = version + 1,
					     last_mutation_id = lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) ||
					       '-4' || substr(lower(hex(randomblob(2))), 2) || '-' ||
					       substr('89ab', (random() & 3) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' ||
					       lower(hex(randomblob(6))),
					     updated_at = ?
					 WHERE mirror.learner_id = ?
					   AND mirror.entity_type = 'mistake' AND mirror.operation = 'upsert'
					   AND json_extract(mirror.payload_json, '$.sessionId') = ?
					   AND EXISTS (
					     SELECT 1
					     FROM mistakes AS item
					     JOIN session_imports AS owner ON owner.id = item.session_id
					     WHERE item.learner_id = mirror.learner_id AND item.id = mirror.entity_id
					       AND owner.external_session_id <> ?
					   )`,
				)
				.bind(now, learnerId, request.entityId, request.entityId),
			this.database
				.prepare(
					`INSERT INTO change_log (
					   learner_id, entity_type, entity_id, operation, payload_json, operation_id, changed_at
					 )
					 SELECT mirror.learner_id, 'sync:mistake', mirror.entity_id, 'upsert',
					   json_object('payload', json(mirror.payload_json), 'version', mirror.version),
					   mirror.last_mutation_id, mirror.updated_at
					 FROM sync_entities AS mirror
					 WHERE mirror.learner_id = ?
					   AND mirror.entity_type = 'mistake' AND mirror.operation = 'upsert'
					   AND mirror.updated_at = ?
					   AND json_extract(mirror.payload_json, '$.sessionId') <> ?
					   AND EXISTS (
					     SELECT 1
					     FROM mistakes AS item
					     JOIN session_imports AS owner ON owner.id = item.session_id
					     WHERE item.learner_id = mirror.learner_id AND item.id = mirror.entity_id
					       AND owner.external_session_id = json_extract(mirror.payload_json, '$.sessionId')
					   )
					   AND NOT EXISTS (
					     SELECT 1 FROM change_log AS logged
					     WHERE logged.learner_id = mirror.learner_id
					       AND logged.operation_id = mirror.last_mutation_id
					   )`,
				)
				.bind(learnerId, now, request.entityId),
			// Removing the last matching Core session must also remove its completion
			// evidence. Keep the physical version monotonic with any existing mirror.
			this.database
				.prepare(
					`UPDATE daily_progress
					 SET core_voice_imported = 0,
					     core_completed = 0,
					     version = MAX(version, COALESCE((
					       SELECT mirror.version FROM sync_entities AS mirror
					       WHERE mirror.learner_id = daily_progress.learner_id
					         AND mirror.entity_type = 'daily-progress'
					         AND mirror.entity_id = 'study:' || daily_progress.study_date || ':curriculum:' || daily_progress.curriculum_day
					     ), 0)) + 1,
					     last_mutation_id = ?,
					     updated_at = ?
					 WHERE learner_id = ?
					   AND EXISTS (
					     SELECT 1 FROM session_imports AS target
					     WHERE target.learner_id = daily_progress.learner_id
					       AND target.external_session_id = ?
					       AND target.kind = 'core'
					       AND target.study_date = daily_progress.study_date
					       AND target.curriculum_day = daily_progress.curriculum_day
					   )
					   AND NOT EXISTS (
					     SELECT 1 FROM session_imports AS other
					     WHERE other.learner_id = daily_progress.learner_id
					       AND other.external_session_id <> ?
					       AND other.kind = 'core'
					       AND other.study_date = daily_progress.study_date
					       AND other.curriculum_day = daily_progress.curriculum_day
					   )`,
				)
				.bind(progressMutationId, now, learnerId, request.entityId, request.entityId),
			this.database
				.prepare(
					`INSERT INTO sync_entities (
					   learner_id, entity_type, entity_id, operation, payload_json,
					   version, last_mutation_id, updated_at
					 )
					 SELECT learner_id, 'daily-progress',
					   'study:' || study_date || ':curriculum:' || curriculum_day,
					   'upsert',
					   json_object(
					     'id', 'study:' || study_date || ':curriculum:' || curriculum_day,
					     'studyDate', study_date, 'curriculumDay', curriculum_day,
					     'reviewsCompleted', json(CASE review_completed WHEN 1 THEN 'true' ELSE 'false' END),
					     'grammarCompleted', json(CASE grammar_completed WHEN 1 THEN 'true' ELSE 'false' END),
					     'coreSessionImported', json('false'), 'coreCompleted', json('false'),
					     'version', version, 'updatedAt', updated_at
					   ), version, last_mutation_id, updated_at
					 FROM daily_progress
					 WHERE learner_id = ? AND last_mutation_id = ?
					 ON CONFLICT(learner_id, entity_type, entity_id) DO UPDATE SET
					   operation = excluded.operation, payload_json = excluded.payload_json,
					   version = excluded.version, last_mutation_id = excluded.last_mutation_id,
					   updated_at = excluded.updated_at`,
				)
				.bind(learnerId, progressMutationId),
			this.database
				.prepare(
					`INSERT INTO change_log (
					   learner_id, entity_type, entity_id, operation, payload_json, operation_id, changed_at
					 )
					 SELECT learner_id, 'sync:daily-progress',
					   'study:' || study_date || ':curriculum:' || curriculum_day,
					   'upsert',
					   json_object('payload', json_object(
					     'id', 'study:' || study_date || ':curriculum:' || curriculum_day,
					     'studyDate', study_date, 'curriculumDay', curriculum_day,
					     'reviewsCompleted', json(CASE review_completed WHEN 1 THEN 'true' ELSE 'false' END),
					     'grammarCompleted', json(CASE grammar_completed WHEN 1 THEN 'true' ELSE 'false' END),
					     'coreSessionImported', json('false'), 'coreCompleted', json('false'),
					     'version', version, 'updatedAt', updated_at
					   ), 'version', version), last_mutation_id, updated_at
					 FROM daily_progress
					 WHERE learner_id = ? AND last_mutation_id = ?`,
				)
				.bind(learnerId, progressMutationId),
		];
	}

	private dependentMirrorDeleteStatements(
		learnerId: string,
		request: SyncDeletionRequest,
		now: string,
	): D1PreparedStatement[] {
		const updates: D1PreparedStatement[] = [];
		if (request.entityType === 'session') {
			updates.push(
				this.database
					.prepare(
						`UPDATE sync_entities AS event
						 SET operation = 'delete', payload_json = 'null', version = version + 1,
						     last_mutation_id = lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) ||
						       '-4' || substr(lower(hex(randomblob(2))), 2) || '-' ||
						       substr('89ab', (random() & 3) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' ||
						       lower(hex(randomblob(6))),
						     updated_at = ?
						 WHERE event.learner_id = ? AND event.operation = 'upsert'
						   AND event.entity_type = 'review-event'
						   AND json_extract(event.payload_json, '$.cardId') IN (
						     SELECT card.entity_id FROM sync_entities AS card
						     WHERE card.learner_id = event.learner_id
						       AND card.entity_type = 'review-card' AND card.operation = 'upsert'
						       AND (
						         (json_extract(card.payload_json, '$.sourceType') = 'session'
						          AND json_extract(card.payload_json, '$.sourceId') = ?)
						         OR (json_extract(card.payload_json, '$.sourceType') = 'mistake'
						          AND json_extract(card.payload_json, '$.sourceId') IN (
						            SELECT item.id FROM mistakes AS item
						            JOIN session_imports AS owner ON owner.id = item.session_id
						            WHERE owner.learner_id = event.learner_id
						              AND owner.external_session_id = ?
						          ))
						         OR json_extract(card.payload_json, '$.sourceId') IN (
						           SELECT item.id FROM vocabulary AS item
						           JOIN session_imports AS owner ON owner.id = item.session_id
						           WHERE owner.learner_id = event.learner_id AND owner.external_session_id = ?
						           UNION ALL
						           SELECT item.id FROM phrases AS item
						           JOIN session_imports AS owner ON owner.id = item.session_id
						           WHERE owner.learner_id = event.learner_id AND owner.external_session_id = ?
						         )
						       )
						   )`,
					)
					.bind(
						now,
						learnerId,
						request.entityId,
						request.entityId,
						request.entityId,
						request.entityId,
					),
				this.database
					.prepare(
						`UPDATE sync_entities AS entity
						 SET operation = 'delete', payload_json = 'null', version = version + 1,
						     last_mutation_id = lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) ||
						       '-4' || substr(lower(hex(randomblob(2))), 2) || '-' ||
						       substr('89ab', (random() & 3) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' ||
						       lower(hex(randomblob(6))),
						     updated_at = ?
						 WHERE entity.learner_id = ? AND entity.operation = 'upsert'
						   AND (
						     (entity.entity_type = 'mistake' AND entity.entity_id IN (
						       SELECT item.id FROM mistakes AS item
						       JOIN session_imports AS owner ON owner.id = item.session_id
						       WHERE owner.learner_id = entity.learner_id AND owner.external_session_id = ?
						     ))
						     OR (entity.entity_type = 'acquisition-event' AND json_extract(entity.payload_json, '$.sourceSessionId') = ?)
						     OR (entity.entity_type = 'learning-item' AND entity.entity_id IN (
						       SELECT item.id FROM vocabulary AS item
						       JOIN session_imports AS owner ON owner.id = item.session_id
						       WHERE owner.learner_id = entity.learner_id AND owner.external_session_id = ?
						       UNION ALL
						       SELECT item.id FROM phrases AS item
						       JOIN session_imports AS owner ON owner.id = item.session_id
						       WHERE owner.learner_id = entity.learner_id AND owner.external_session_id = ?
						     ))
						     OR (entity.entity_type = 'grammar-progress' AND entity.entity_id IN (
						       SELECT 'preview:' || item.topic_key FROM grammar_previews AS item
						       JOIN session_imports AS owner ON owner.id = item.session_id
						       WHERE owner.learner_id = entity.learner_id AND owner.external_session_id = ?
						     ))
						     OR (entity.entity_type = 'review-card' AND (
						       (json_extract(entity.payload_json, '$.sourceType') = 'session'
						        AND json_extract(entity.payload_json, '$.sourceId') = ?)
						       OR (json_extract(entity.payload_json, '$.sourceType') = 'mistake'
						        AND json_extract(entity.payload_json, '$.sourceId') IN (
						          SELECT item.id FROM mistakes AS item
						          JOIN session_imports AS owner ON owner.id = item.session_id
						          WHERE owner.learner_id = entity.learner_id
						            AND owner.external_session_id = ?
						        ))
						       OR json_extract(entity.payload_json, '$.sourceId') IN (
						         SELECT item.id FROM vocabulary AS item
						         JOIN session_imports AS owner ON owner.id = item.session_id
						         WHERE owner.learner_id = entity.learner_id AND owner.external_session_id = ?
						         UNION ALL
						         SELECT item.id FROM phrases AS item
						         JOIN session_imports AS owner ON owner.id = item.session_id
						         WHERE owner.learner_id = entity.learner_id AND owner.external_session_id = ?
						       )
						     ))
						   )`,
					)
					.bind(
						now,
						learnerId,
						request.entityId,
						request.entityId,
						request.entityId,
						request.entityId,
						request.entityId,
						request.entityId,
						request.entityId,
						request.entityId,
						request.entityId,
					),
			);
		} else if (request.entityType === 'mistake') {
			updates.push(
				this.database
					.prepare(
						`UPDATE sync_entities AS entity
						 SET operation = 'delete', payload_json = 'null', version = version + 1,
						     last_mutation_id = lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) ||
						       '-4' || substr(lower(hex(randomblob(2))), 2) || '-' ||
						       substr('89ab', (random() & 3) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' ||
						       lower(hex(randomblob(6))),
						     updated_at = ?
						 WHERE entity.learner_id = ? AND entity.operation = 'upsert'
						   AND ((entity.entity_type = 'review-card'
						         AND json_extract(entity.payload_json, '$.sourceType') = 'mistake'
						         AND json_extract(entity.payload_json, '$.sourceId') = ?)
						     OR (entity.entity_type = 'review-event'
						         AND json_extract(entity.payload_json, '$.cardId') IN (
						           SELECT card.entity_id FROM sync_entities AS card
						           WHERE card.learner_id = entity.learner_id
						             AND card.entity_type = 'review-card' AND card.operation = 'upsert'
						             AND json_extract(card.payload_json, '$.sourceType') = 'mistake'
						             AND json_extract(card.payload_json, '$.sourceId') = ?
						         )))`,
					)
					.bind(now, learnerId, request.entityId, request.entityId),
			);
		} else if (request.entityType === 'learning-item') {
			updates.push(
				this.database
					.prepare(
						`UPDATE sync_entities AS entity
						 SET operation = 'delete', payload_json = 'null', version = version + 1,
						     last_mutation_id = lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) ||
						       '-4' || substr(lower(hex(randomblob(2))), 2) || '-' ||
						       substr('89ab', (random() & 3) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' ||
						       lower(hex(randomblob(6))),
						     updated_at = ?
						 WHERE entity.learner_id = ? AND entity.operation = 'upsert'
						   AND ((entity.entity_type = 'review-card'
						         AND json_extract(entity.payload_json, '$.sourceId') = ?)
						     OR (entity.entity_type = 'review-event'
						         AND json_extract(entity.payload_json, '$.cardId') IN (
						           SELECT card.entity_id FROM sync_entities AS card
						           WHERE card.learner_id = entity.learner_id
						             AND card.entity_type = 'review-card' AND card.operation = 'upsert'
						             AND json_extract(card.payload_json, '$.sourceId') = ?
						         ))
						     OR (entity.entity_type = 'acquisition-event'
						         AND json_extract(entity.payload_json, '$.entityId') = ?))`,
					)
					.bind(now, learnerId, request.entityId, request.entityId, request.entityId),
			);
		} else if (request.entityType === 'review-card') {
			updates.push(
				this.database
					.prepare(
						`UPDATE sync_entities AS entity
						 SET operation = 'delete', payload_json = 'null', version = version + 1,
						     last_mutation_id = lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) ||
						       '-4' || substr(lower(hex(randomblob(2))), 2) || '-' ||
						       substr('89ab', (random() & 3) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' ||
						       lower(hex(randomblob(6))),
						     updated_at = ?
						 WHERE entity.learner_id = ? AND entity.operation = 'upsert'
						   AND entity.entity_type = 'review-event'
						   AND json_extract(entity.payload_json, '$.cardId') = ?`,
					)
					.bind(now, learnerId, request.entityId),
			);
		} else if (
			request.entityType === 'grammar-progress' &&
			request.entityId.startsWith('preview:')
		) {
			updates.push(
				this.database
					.prepare(
						`UPDATE sync_entities AS entity
						 SET operation = 'delete', payload_json = 'null', version = version + 1,
						     last_mutation_id = lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) ||
						       '-4' || substr(lower(hex(randomblob(2))), 2) || '-' ||
						       substr('89ab', (random() & 3) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' ||
						       lower(hex(randomblob(6))),
						     updated_at = ?
						 WHERE entity.learner_id = ? AND entity.operation = 'upsert'
						   AND entity.entity_type = 'acquisition-event'
						   AND json_extract(entity.payload_json, '$.kind') = 'grammar-preview'
						   AND json_extract(entity.payload_json, '$.entityId') = ?`,
					)
					.bind(now, learnerId, request.entityId.slice('preview:'.length)),
			);
		}
		if (!updates.length) return [];
		return [
			...updates,
			this.database
				.prepare(
					`INSERT INTO change_log (
					   learner_id, entity_type, entity_id, operation, payload_json, operation_id, changed_at
					 )
					 SELECT entity.learner_id, 'sync:' || entity.entity_type, entity.entity_id, 'delete',
					   json_object('payload', NULL, 'version', entity.version),
					   entity.last_mutation_id, entity.updated_at
					 FROM sync_entities AS entity
					 WHERE entity.learner_id = ?
					   AND entity.operation = 'delete'
					   AND entity.updated_at = ?
					   AND NOT EXISTS (
					     SELECT 1 FROM change_log AS logged
					     WHERE logged.learner_id = entity.learner_id
					       AND logged.operation_id = entity.last_mutation_id
					   )`,
				)
				.bind(learnerId, now),
		];
	}

	private domainDeleteStatements(
		learnerId: string,
		request: SyncDeletionRequest,
		current: SyncEntityRow | null,
	): D1PreparedStatement[] {
		if (request.entityType === 'daily-progress') {
			if (!current || current.payload_json === 'null') return [];
			const progress = DailyProgressPayloadSchema.parse(JSON.parse(current.payload_json));
			return [
				this.database
					.prepare('DELETE FROM daily_progress WHERE learner_id = ? AND study_date = ?')
					.bind(learnerId, progress.studyDate),
			];
		}
		if (request.entityType === 'session') {
			return [
				this.database
					.prepare(
						`DELETE FROM review_cards
						 WHERE learner_id = ? AND (
						   (source_type = 'session' AND EXISTS (
						     SELECT 1 FROM session_imports AS session
						     WHERE session.learner_id = ? AND session.external_session_id = ?
						       AND review_cards.source_id LIKE session.id || ':review:%'
						   )) OR (source_type = 'vocabulary' AND source_id IN (
						     SELECT item.id FROM vocabulary AS item
						     JOIN session_imports AS session ON session.id = item.session_id
						     WHERE session.learner_id = ? AND session.external_session_id = ?
						   )) OR (source_type = 'phrase' AND source_id IN (
						     SELECT item.id FROM phrases AS item
						     JOIN session_imports AS session ON session.id = item.session_id
						     WHERE session.learner_id = ? AND session.external_session_id = ?
						   )) OR (source_type = 'mistake' AND source_id IN (
						     SELECT item.id FROM mistakes AS item
						     JOIN session_imports AS session ON session.id = item.session_id
						     WHERE session.learner_id = ? AND session.external_session_id = ?
						   ))
						 )`,
					)
					.bind(
						learnerId,
						learnerId,
						request.entityId,
						learnerId,
						request.entityId,
						learnerId,
						request.entityId,
						learnerId,
						request.entityId,
					),
				this.database
					.prepare(
						`DELETE FROM acquisition_identities
						 WHERE learner_id = ? AND entity_id IN (
						   SELECT item.id FROM vocabulary AS item
						   JOIN session_imports AS session ON session.id = item.session_id
						   WHERE session.learner_id = ? AND session.external_session_id = ?
						   UNION ALL
						   SELECT item.id FROM phrases AS item
						   JOIN session_imports AS session ON session.id = item.session_id
						   WHERE session.learner_id = ? AND session.external_session_id = ?
						   UNION ALL
						   SELECT item.id FROM grammar_previews AS item
						   JOIN session_imports AS session ON session.id = item.session_id
						   WHERE session.learner_id = ? AND session.external_session_id = ?
						 )`,
					)
					.bind(
						learnerId,
						learnerId,
						request.entityId,
						learnerId,
						request.entityId,
						learnerId,
						request.entityId,
					),
				this.database
					.prepare('DELETE FROM session_imports WHERE learner_id = ? AND external_session_id = ?')
					.bind(learnerId, request.entityId),
			];
		}
		if (request.entityType === 'mistake') {
			return [
				this.database
					.prepare(
						`DELETE FROM review_cards
						 WHERE learner_id = ? AND source_type = 'mistake' AND source_id = ?`,
					)
					.bind(learnerId, request.entityId),
				this.database
					.prepare('DELETE FROM mistakes WHERE learner_id = ? AND id = ?')
					.bind(learnerId, request.entityId),
			];
		}
		if (request.entityType === 'learning-item') {
			return [
				this.database
					.prepare(
						`DELETE FROM review_cards
						 WHERE learner_id = ? AND source_type IN ('vocabulary', 'phrase') AND source_id = ?`,
					)
					.bind(learnerId, request.entityId),
				this.database
					.prepare('DELETE FROM acquisition_identities WHERE learner_id = ? AND entity_id = ?')
					.bind(learnerId, request.entityId),
				this.database
					.prepare('DELETE FROM vocabulary WHERE learner_id = ? AND id = ?')
					.bind(learnerId, request.entityId),
				this.database
					.prepare('DELETE FROM phrases WHERE learner_id = ? AND id = ?')
					.bind(learnerId, request.entityId),
			];
		}
		if (request.entityType === 'review-card') {
			return [
				this.database
					.prepare(
						`DELETE FROM reviewed_cards
						 WHERE card_id = ? AND EXISTS (
						   SELECT 1 FROM review_cards
						   WHERE review_cards.id = reviewed_cards.card_id
						     AND review_cards.learner_id = ?
						 )`,
					)
					.bind(request.entityId, learnerId),
				this.database
					.prepare('DELETE FROM review_cards WHERE learner_id = ? AND id = ?')
					.bind(learnerId, request.entityId),
			];
		}
		if (request.entityType === 'review-event') {
			return [
				this.database
					.prepare('DELETE FROM review_events WHERE learner_id = ? AND id = ?')
					.bind(learnerId, request.entityId),
			];
		}
		if (request.entityType === 'grammar-progress') {
			if (!current || current.payload_json === 'null') return [];
			const grammar = GrammarProgressPayloadSchema.parse(JSON.parse(current.payload_json));
			if (!grammar.id.startsWith('preview:')) return [];
			const topicKey = grammar.id.slice('preview:'.length);
			return [
				this.database
					.prepare(
						`DELETE FROM acquisition_identities
						 WHERE learner_id = ? AND kind = 'grammar-preview' AND canonical_text = ?`,
					)
					.bind(learnerId, topicKey),
				this.database
					.prepare('DELETE FROM grammar_previews WHERE learner_id = ? AND topic_key = ?')
					.bind(learnerId, topicKey),
			];
		}
		if (request.entityType === 'assessment') {
			return [
				this.database
					.prepare('DELETE FROM assessments WHERE learner_id = ? AND id = ?')
					.bind(learnerId, request.entityId),
			];
		}
		return [];
	}

	async tombstoneSyncEntity(
		learnerId: string,
		request: SyncDeletionRequest,
		now: string,
	): Promise<SyncMutationResult> {
		const requestFingerprint = await canonicalHash(request);
		const cached = await this.database
			.prepare(
				`SELECT response_json, request_fingerprint FROM processed_mutations
				 WHERE learner_id = ? AND mutation_id = ?`,
			)
			.bind(learnerId, request.operationId)
			.first<{ response_json: string; request_fingerprint: string | null }>();
		if (cached) {
			if (cached.request_fingerprint && cached.request_fingerprint !== requestFingerprint) {
				throw new MutationReplayMismatchError();
			}
			return {
				...(JSON.parse(cached.response_json) as Omit<SyncMutationResult, 'replayed'>),
				replayed: true,
			};
		}
		const current = await this.syncEntity(learnerId, request.entityType, request.entityId);
		const progressEntityMatch =
			request.entityType === 'daily-progress'
				? DAILY_PROGRESS_ENTITY_PATTERN.exec(request.entityId)
				: null;
		if (request.entityType === 'daily-progress') {
			const progressPayload =
				current?.payload_json && current.payload_json !== 'null'
					? DailyProgressPayloadSchema.parse(JSON.parse(current.payload_json))
					: undefined;
			const curriculumDay = progressPayload?.curriculumDay ?? Number(progressEntityMatch?.[2]);
			if (Number.isInteger(curriculumDay)) await this.assertCurriculumDayActive(curriculumDay);
		}
		const progressStudyDate =
			request.entityType === 'daily-progress'
				? current?.payload_json && current.payload_json !== 'null'
					? DailyProgressPayloadSchema.parse(JSON.parse(current.payload_json)).studyDate
					: progressEntityMatch?.[1]
				: undefined;
		const authoritativeVersion = progressStudyDate
			? await this.dailyProgressVersionAuthority(learnerId, progressStudyDate)
			: (current?.version ?? 0);
		if (authoritativeVersion !== request.expectedVersion) {
			throw new SyncVersionConflictError(
				current?.payload_json === 'null' ? null : JSON.parse(current?.payload_json ?? 'null'),
				authoritativeVersion,
			);
		}
		const version = allocateDailyProgressVersion(authoritativeVersion);
		const response: Omit<SyncMutationResult, 'replayed'> = {
			operationId: request.operationId,
			entityType: request.entityType,
			entityId: request.entityId,
			operation: 'delete',
			payload: null,
			version,
			sequence: 0,
			changedAt: now,
		};
		try {
			const results = await this.database.batch([
				...this.sessionPreDeleteStatements(learnerId, request, now),
				...this.dependentMirrorDeleteStatements(learnerId, request, now),
				...this.domainDeleteStatements(learnerId, request, current),
				progressStudyDate
					? this.guardedDailyProgressTombstoneStatement(
							learnerId,
							request.entityId,
							progressStudyDate,
							version,
							request.operationId,
							now,
							current?.version ?? 0,
							authoritativeVersion,
						)
					: this.database
							.prepare(
								`INSERT INTO sync_entities (
						   learner_id, entity_type, entity_id, operation, payload_json,
						   version, last_mutation_id, updated_at
						 ) VALUES (?, ?, ?, 'delete', 'null', ?, ?, ?)
						 ON CONFLICT(learner_id, entity_type, entity_id) DO UPDATE SET
						   operation = 'delete', payload_json = 'null', version = excluded.version,
						   last_mutation_id = excluded.last_mutation_id, updated_at = excluded.updated_at
						 WHERE sync_entities.version = ?`,
							)
							.bind(
								learnerId,
								request.entityType,
								request.entityId,
								version,
								request.operationId,
								now,
								request.expectedVersion,
							),
				this.database
					.prepare(
						`INSERT INTO change_log (
						   learner_id, entity_type, entity_id, operation, payload_json, operation_id, changed_at
						 ) VALUES (?, ?, ?, 'delete', ?, ?, ?)`,
					)
					.bind(
						learnerId,
						`sync:${request.entityType}`,
						request.entityId,
						JSON.stringify({ payload: null, version }),
						request.operationId,
						now,
					),
				this.database
					.prepare(
						`INSERT INTO processed_mutations (
						   learner_id, mutation_id, response_json, entity_type, entity_id,
						   entity_version, request_fingerprint, processed_at
						 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
					)
					.bind(
						learnerId,
						request.operationId,
						JSON.stringify(response),
						`sync:${request.entityType}`,
						request.entityId,
						version,
						requestFingerprint,
						now,
					),
			]);
			const mirrorResult = results[results.length - 3];
			if (mirrorResult?.meta?.changes === 0) throw new Error('sync_version_conflict');
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (!message.includes('sync_version_conflict')) throw error;
			const latest = await this.syncEntity(learnerId, request.entityType, request.entityId);
			const latestVersion = progressStudyDate
				? await this.dailyProgressVersionAuthority(learnerId, progressStudyDate)
				: (latest?.version ?? 0);
			throw new SyncVersionConflictError(
				latest?.payload_json === 'null' ? null : JSON.parse(latest?.payload_json ?? 'null'),
				latestVersion,
			);
		}
		return { ...response, replayed: false };
	}

	async bootstrapSync(learnerId: string) {
		const activeTotalDays = await this.activeCurriculumTotalDays();
		const [entitiesResult, cursorResult] = await this.database.batch([
			this.database
				.prepare(
					`SELECT entity_type, entity_id, operation, payload_json, version,
                last_mutation_id, updated_at
         FROM sync_entities WHERE learner_id = ? ORDER BY entity_type, entity_id`,
				)
				.bind(learnerId),
			this.database
				.prepare(
					`SELECT COALESCE(MAX(sequence), 0) AS cursor FROM change_log
         WHERE learner_id = ? AND entity_type LIKE 'sync:%'`,
				)
				.bind(learnerId),
		]);
		const cursorRow = cursorResult?.results?.[0] as { cursor?: number } | undefined;
		const cursor = cursorRow?.cursor ?? 0;
		return {
			entities: ((entitiesResult.results ?? []) as unknown as SyncEntityRow[]).map((row) => {
				const payload = JSON.parse(row.payload_json) as unknown;
				return {
					operationId: row.last_mutation_id,
					entityType: row.entity_type,
					entityId: row.entity_id,
					operation: row.operation,
					payload: normalizeStoredSyncPayload(row.entity_type, payload),
					version: row.version,
					sequence: cursor,
					changedAt: row.updated_at,
				};
			}),
			cursor,
			activeTotalDays,
		};
	}

	async pullChanges(learnerId: string, cursor: number, limit: number) {
		const result = await this.database
			.prepare(
				`SELECT sequence, entity_type, entity_id, operation, payload_json, operation_id, changed_at
		 FROM change_log
		 WHERE learner_id = ? AND sequence > ? AND entity_type LIKE 'sync:%'
		 ORDER BY sequence ASC LIMIT ?`,
			)
			.bind(learnerId, cursor, limit)
			.all<{
				sequence: number;
				entity_type: string;
				entity_id: string;
				operation: 'upsert' | 'delete';
				payload_json: string;
				operation_id: string | null;
				changed_at: string;
			}>();
		const rows = result.results ?? [];
		return {
			changes: rows.map((row) => {
				const envelope = JSON.parse(row.payload_json) as { payload: unknown; version: number };
				const entityType = row.entity_type.slice(5);
				return {
					operationId: row.operation_id,
					sequence: row.sequence,
					entityType,
					entityId: row.entity_id,
					operation: row.operation,
					payload: normalizeStoredSyncPayload(entityType, envelope.payload),
					version: envelope.version,
					changedAt: row.changed_at,
				};
			}),
			cursor: rows.at(-1)?.sequence ?? cursor,
			hasMore: rows.length === limit,
		};
	}

	async getToday(learnerId: string, studyDate: string) {
		const [progress, counts, overdue] = await Promise.all([
			this.progress(learnerId, studyDate),
			this.dailyCounts(learnerId, studyDate),
			this.database
				.prepare(
					'SELECT COUNT(*) AS count FROM review_cards WHERE learner_id = ? AND due_date <= ?',
				)
				.bind(learnerId, studyDate)
				.first<{ count: number }>(),
		]);
		return {
			studyDate,
			progress: parseProgress(progress),
			version: progress?.version ?? 0,
			acquisitionCounts: counts,
			overdueReviewCount: overdue?.count ?? 0,
		};
	}

	private async findDuplicate(
		learnerId: string,
		request: SessionImportRequest,
		canonicalPayloadHash: string,
	) {
		return this.database
			.prepare(
				`SELECT id, external_session_id, idempotency_key, source_text_hash,
						canonical_payload_hash, study_date
         FROM session_imports
		 WHERE learner_id = ? AND (
		   external_session_id = ? OR idempotency_key = ? OR canonical_payload_hash = ?
		 ) LIMIT 1`,
			)
			.bind(learnerId, request.payload.sessionId, request.idempotencyKey, canonicalPayloadHash)
			.first<DuplicateRow>();
	}

	private async dailyCounts(learnerId: string, studyDate: string): Promise<AcquisitionCounts> {
		const row = await this.database
			.prepare(
				`SELECT
           (SELECT COUNT(*) FROM vocabulary WHERE learner_id = ? AND study_date = ?) AS words,
           (SELECT COUNT(*) FROM phrases WHERE learner_id = ? AND study_date = ?) AS phrases,
           (SELECT COUNT(*) FROM grammar_previews WHERE learner_id = ? AND study_date = ?) AS preview_grammar`,
			)
			.bind(learnerId, studyDate, learnerId, studyDate, learnerId, studyDate)
			.first<CountRow>();
		return {
			words: row?.words ?? 0,
			phrases: row?.phrases ?? 0,
			previewGrammar: row?.preview_grammar ?? 0,
		};
	}

	private async newAcquisitionCounts(
		learnerId: string,
		request: SessionImportRequest,
	): Promise<AcquisitionCounts> {
		const uniqueWords = new Set(
			request.payload.newVocabulary.map((item) => normalizeEnglishIdentity(item.text)),
		);
		const uniquePhrases = new Set(
			request.payload.newPhrases.map((item) => normalizeEnglishIdentity(item.text)),
		);
		const uniqueGrammar = new Set(
			request.payload.previewGrammar.map((item) => normalizeEnglishIdentity(item.topicId)),
		);
		const unseen = async (kind: string, identities: Set<string>) => {
			let count = 0;
			for (const identity of identities) {
				const row = await this.database
					.prepare(
						`SELECT 1 AS found FROM acquisition_identities
						 WHERE learner_id = ? AND kind = ? AND canonical_text = ?`,
					)
					.bind(learnerId, kind, identity)
					.first<{ found: number }>();
				if (!row) count += 1;
			}
			return count;
		};
		return {
			words: await unseen('vocabulary', uniqueWords),
			phrases: await unseen('phrase', uniquePhrases),
			previewGrammar: await unseen('grammar-preview', uniqueGrammar),
		};
	}

	private progress(learnerId: string, studyDate: string) {
		return this.database
			.prepare(
				`SELECT curriculum_day, review_completed, grammar_completed, core_voice_imported,
                core_completed, version, updated_at
         FROM daily_progress WHERE learner_id = ? AND study_date = ?`,
			)
			.bind(learnerId, studyDate)
			.first<ProgressRow>();
	}

	private async learnerTimeZone(learnerId: string): Promise<string> {
		const row = await this.database
			.prepare('SELECT timezone FROM learners WHERE id = ?')
			.bind(learnerId)
			.first<{ timezone: string }>();
		return row?.timezone ?? 'Asia/Tokyo';
	}

	private async expectedCurriculumDay(learnerId: string, studyDate: string): Promise<number> {
		const activeTotalDays = await this.activeCurriculumTotalDays();
		const today = await this.progress(learnerId, studyDate);
		if (today?.curriculum_day) {
			await this.assertCurriculumDayActive(today.curriculum_day, activeTotalDays);
			return today.curriculum_day;
		}
		const learner = await this.database
			.prepare('SELECT start_date, entry_day FROM learners WHERE id = ?')
			.bind(learnerId)
			.first<{ start_date: string | null; entry_day: number | null }>();
		const startDate = learner?.start_date ?? studyDate;
		const entryDay = learner?.entry_day ?? 1;
		if (studyDate < startDate) throw new CurriculumInactiveError('before-start', startDate);
		const result = await this.database
			.prepare(
				`SELECT curriculum_day, core_completed FROM daily_progress
				 WHERE learner_id = ? AND curriculum_day IS NOT NULL`,
			)
			.bind(learnerId)
			.all<{ curriculum_day: number; core_completed: number }>();
		const rows = (result.results ?? []).map((row) => ({
			curriculumDay: row.curriculum_day,
			coreCompleted: row.core_completed === 1,
		}));
		if (
			new Set(
				rows
					.filter(
						(row) =>
							row.coreCompleted &&
							row.curriculumDay >= entryDay &&
							row.curriculumDay <= activeTotalDays,
					)
					.map((row) => row.curriculumDay),
			).size ===
			activeTotalDays - entryDay + 1
		) {
			throw new CurriculumInactiveError('graduated', startDate, activeTotalDays);
		}
		return nextCurriculumDay(rows, activeTotalDays, entryDay);
	}

	private async activeCurriculumTotalDays(): Promise<number> {
		const row = await this.database
			.prepare(
				`SELECT active_total_days FROM curriculum_catalog
				 WHERE curriculum_id = ?`,
			)
			.bind(CURRICULUM_CATALOG_ID)
			.first<{ active_total_days: number }>();
		const parsed = ActiveCurriculumTotalDaysSchema.safeParse(row?.active_total_days);
		if (!parsed.success) {
			throw new Error(
				`The active curriculum catalog must contain an integer from 1 to ${SUPPORTED_CURRICULUM_DAY_MAX}.`,
			);
		}
		return parsed.data;
	}

	private async assertCurriculumDayActive(
		curriculumDay: number,
		activeTotalDays?: number,
	): Promise<void> {
		const active = activeTotalDays ?? (await this.activeCurriculumTotalDays());
		if (curriculumDay < 1 || curriculumDay > active) {
			throw new CurriculumDayUnavailableError(curriculumDay, active);
		}
	}

	private syncEntity(learnerId: string, entityType: string, entityId: string) {
		return this.database
			.prepare(
				`SELECT entity_type, entity_id, operation, payload_json, version,
						last_mutation_id, updated_at
			 FROM sync_entities WHERE learner_id = ? AND entity_type = ? AND entity_id = ?`,
			)
			.bind(learnerId, entityType, entityId)
			.first<SyncEntityRow>();
	}

	private async backfillLegacyState(learnerId: string, now: string): Promise<void> {
		const migrationKey = 'v1-normalized-sync-backfill';
		const completed = await this.database
			.prepare(
				'SELECT 1 AS completed FROM learner_data_migrations WHERE learner_id = ? AND migration_key = ?',
			)
			.bind(learnerId, migrationKey)
			.first<{ completed: number }>();
		if (completed) return;

		await this.normalizeLegacyLearningItems(learnerId, now);
		await this.database.batch([
			this.database
				.prepare(
					`INSERT OR IGNORE INTO sync_entities (
					   learner_id, entity_type, entity_id, operation, payload_json,
					   version, last_mutation_id, updated_at
					 )
					 SELECT learner_id, 'daily-progress',
					   'study:' || study_date || ':curriculum:' || curriculum_day,
					   'upsert',
					   json_object(
					     'id', 'study:' || study_date || ':curriculum:' || curriculum_day,
					     'studyDate', study_date, 'curriculumDay', curriculum_day,
					     'reviewsCompleted', json(CASE review_completed WHEN 1 THEN 'true' ELSE 'false' END),
					     'grammarCompleted', json(CASE grammar_completed WHEN 1 THEN 'true' ELSE 'false' END),
					     'coreSessionImported', json(CASE core_voice_imported WHEN 1 THEN 'true' ELSE 'false' END),
					     'coreCompleted', json(CASE core_completed WHEN 1 THEN 'true' ELSE 'false' END),
					     'version', version, 'updatedAt', updated_at
					   ), version, 'legacy:daily:' || study_date || ':' || curriculum_day, updated_at
					 FROM daily_progress WHERE learner_id = ?`,
				)
				.bind(learnerId),
			this.database
				.prepare(
					`INSERT OR IGNORE INTO sync_entities (
					   learner_id, entity_type, entity_id, operation, payload_json,
					   version, last_mutation_id, updated_at
					 )
					 SELECT learner_id, 'session', external_session_id, 'upsert',
					   json_object(
					     'sessionId', external_session_id, 'kind', kind, 'completedAt', occurred_at,
					     'durationMinutes', duration_minutes,
					     'summary', COALESCE(NULLIF(summary_text, ''), NULLIF(summary_ja, ''), 'Legacy session'),
					     'score', ROUND((task_completion_score + grammar_score + vocabulary_score + fluency_score + interaction_score) * 4),
					     'mistakes', json_array(), 'studyDate', study_date,
					     'canonicalContentHash', canonical_payload_hash
					   ), 1, 'legacy:session:' || id, imported_at
					 FROM session_imports WHERE learner_id = ?`,
				)
				.bind(learnerId),
			this.database
				.prepare(
					`INSERT OR IGNORE INTO sync_entities (
					   learner_id, entity_type, entity_id, operation, payload_json,
					   version, last_mutation_id, updated_at
					 )
					 SELECT learner_id, 'mistake', id, 'upsert',
					   json_object('id', id, 'category', category, 'original', original_text,
					     'correction', correction_text, 'repetitions', occurrence_count),
					   occurrence_count, 'legacy:mistake:' || id, updated_at
					 FROM mistakes WHERE learner_id = ?`,
				)
				.bind(learnerId),
			this.database
				.prepare(
					`INSERT OR IGNORE INTO sync_entities (
					   learner_id, entity_type, entity_id, operation, payload_json,
					   version, last_mutation_id, updated_at
					 )
					 SELECT item.learner_id, 'learning-item', item.id, 'upsert',
					   json_object('id', item.id, 'kind', item.kind, 'canonicalText', item.canonical_text,
					     'displayText', item.display_text,
					     'meaning', COALESCE(NULLIF(item.meaning_text, ''), item.meaning_ja),
					     'supportLanguage', item.support_language,
					     'status', CASE item.state
					       WHEN 'active' THEN 'learning' WHEN 'mastered' THEN 'learned' ELSE item.state END,
					     'updatedAt', item.updated_at),
					   1, 'legacy:item:' || item.kind || ':' || item.id, item.updated_at
					 FROM (
					   SELECT learner_id, id, 'vocabulary' AS kind, normalized_term AS canonical_text,
					     term AS display_text, meaning_ja, meaning_text, support_language, state, updated_at FROM vocabulary
					   UNION ALL
					   SELECT learner_id, id, 'phrase', normalized_phrase, phrase, meaning_ja, meaning_text,
					     support_language, state, updated_at FROM phrases
					 ) AS item WHERE item.learner_id = ?`,
				)
				.bind(learnerId),
			this.database
				.prepare(
					`INSERT OR IGNORE INTO sync_entities (
					   learner_id, entity_type, entity_id, operation, payload_json,
					   version, last_mutation_id, updated_at
					 )
					 SELECT item.learner_id, 'acquisition-event',
					   'legacy:acquisition:' || item.kind || ':' || item.id, 'upsert',
					   json_object('eventId', 'legacy:acquisition:' || item.kind || ':' || item.id,
					     'studyDate', item.study_date, 'kind', item.kind, 'entityId', item.entity_id,
					     'sourceSessionId', item.session_id, 'createdAt', item.created_at),
					   1, 'legacy:acquisition:' || item.kind || ':' || item.id, item.created_at
					 FROM (
					   SELECT vocabulary.learner_id, vocabulary.id, 'vocabulary' AS kind,
					     vocabulary.study_date, vocabulary.id AS entity_id,
					     session_imports.external_session_id AS session_id, vocabulary.created_at
					   FROM vocabulary JOIN session_imports ON session_imports.id = vocabulary.session_id
					   UNION ALL
					   SELECT phrases.learner_id, phrases.id, 'phrase', phrases.study_date, phrases.id,
					     session_imports.external_session_id, phrases.created_at
					   FROM phrases JOIN session_imports ON session_imports.id = phrases.session_id
					 ) AS item WHERE item.learner_id = ?`,
				)
				.bind(learnerId),
			this.database
				.prepare(
					`INSERT OR IGNORE INTO sync_entities (
					   learner_id, entity_type, entity_id, operation, payload_json,
					   version, last_mutation_id, updated_at
					 )
					 SELECT learner_id, 'review-card', id, 'upsert',
					   json_patch(json_object('id', id, 'front', front_text, 'back', back_text,
					     'dueAt', due_date, 'state', state, 'sourceType', source_type,
					     'sourceId', source_id, 'stabilityLevel', stability_level,
					     'lapses', lapses, 'algorithmVersion', 1,
					     'version', version, 'updatedAt', updated_at),
					     CASE WHEN last_reviewed_at IS NULL THEN '{}' ELSE
					       json_object('lastReviewedAt', last_reviewed_at) END),
					   version, 'legacy:review-card:' || id, updated_at
					 FROM review_cards WHERE learner_id = ?`,
				)
				.bind(learnerId),
			this.database
				.prepare(
					`INSERT OR IGNORE INTO sync_entities (
					   learner_id, entity_type, entity_id, operation, payload_json,
					   version, last_mutation_id, updated_at
					 )
					 SELECT learner_id, 'review-event', id, 'upsert',
					   json_object('eventId', id, 'cardId', card_id, 'grade', grade,
					     'occurredAt', occurred_at, 'studyDate', study_date,
					     'curriculumDay', curriculum_day, 'algorithmVersion', 1,
					     'before', json(before_json), 'after', json(after_json)),
					   1, 'legacy:review-event:' || id, created_at
					 FROM review_events WHERE learner_id = ?`,
				)
				.bind(learnerId),
			this.database
				.prepare(
					`INSERT OR IGNORE INTO sync_entities (
					   learner_id, entity_type, entity_id, operation, payload_json,
					   version, last_mutation_id, updated_at
					 )
					 SELECT gp.learner_id, 'grammar-progress', 'preview:' || gp.topic_key, 'upsert',
					   json_object('id', 'preview:' || gp.topic_key,
					     'curriculumDay', COALESCE((SELECT day_number FROM curriculum_days WHERE grammar_topic_key = gp.topic_key), 1),
					     'status', CASE WHEN EXISTS (
					       SELECT 1 FROM daily_progress AS dp
					       JOIN curriculum_days AS cd ON cd.day_number = dp.curriculum_day
					       WHERE dp.learner_id = gp.learner_id AND cd.grammar_topic_key = gp.topic_key
					         AND dp.grammar_completed = 1
					     ) THEN 'completed' ELSE 'previewed' END,
					     'updatedAt', gp.created_at),
					   1, 'legacy:grammar:' || gp.id, gp.created_at
					 FROM grammar_previews AS gp WHERE gp.learner_id = ?`,
				)
				.bind(learnerId),
			this.database
				.prepare(
					`INSERT OR IGNORE INTO sync_entities (
					   learner_id, entity_type, entity_id, operation, payload_json,
					   version, last_mutation_id, updated_at
					 )
					 SELECT dp.learner_id, 'grammar-progress', 'completed:' || cd.grammar_topic_key, 'upsert',
					   json_object('id', 'completed:' || cd.grammar_topic_key,
					     'curriculumDay', dp.curriculum_day, 'status', 'completed',
					     'updatedAt', dp.updated_at),
					   1, 'legacy:grammar-completed:' || dp.study_date || ':' || dp.curriculum_day,
					   dp.updated_at
					 FROM daily_progress AS dp
					 JOIN curriculum_days AS cd ON cd.day_number = dp.curriculum_day
					 WHERE dp.learner_id = ? AND dp.grammar_completed = 1
					   AND NOT EXISTS (
					     SELECT 1 FROM grammar_previews AS gp
					     WHERE gp.learner_id = dp.learner_id AND gp.topic_key = cd.grammar_topic_key
					   )`,
				)
				.bind(learnerId),
			this.database
				.prepare(
					`INSERT OR IGNORE INTO sync_entities (
					   learner_id, entity_type, entity_id, operation, payload_json,
					   version, last_mutation_id, updated_at
					 )
					 SELECT learner_id, 'assessment', id, 'upsert',
					   json_object('id', id, 'type', type, 'completedAt', completed_at,
					     'payload', json(payload_json)),
					   version, 'legacy:assessment:' || id, updated_at
					 FROM assessments WHERE learner_id = ?`,
				)
				.bind(learnerId),
			this.database
				.prepare(
					`INSERT INTO learner_data_migrations (learner_id, migration_key, completed_at)
					 VALUES (?, ?, ?)`,
				)
				.bind(learnerId, migrationKey, now),
		]);
	}

	private async normalizeLegacyLearningItems(learnerId: string, now: string): Promise<void> {
		for (const config of [
			{
				kind: 'vocabulary' as const,
				sourceType: 'vocabulary' as const,
				selectSql:
					'SELECT id, term AS display_text, created_at FROM vocabulary WHERE learner_id = ? ORDER BY created_at, id',
				deleteSql: 'DELETE FROM vocabulary WHERE id = ?',
				updateSql: 'UPDATE vocabulary SET normalized_term = ? WHERE id = ?',
			},
			{
				kind: 'phrase' as const,
				sourceType: 'phrase' as const,
				selectSql:
					'SELECT id, phrase AS display_text, created_at FROM phrases WHERE learner_id = ? ORDER BY created_at, id',
				deleteSql: 'DELETE FROM phrases WHERE id = ?',
				updateSql: 'UPDATE phrases SET normalized_phrase = ? WHERE id = ?',
			},
		] as const) {
			const rows = await this.database
				.prepare(config.selectSql)
				.bind(learnerId)
				.all<{ id: string; display_text: string; created_at: string }>();
			const groups = new Map<string, Array<{ id: string; display_text: string }>>();
			for (const row of rows.results ?? []) {
				const canonical = normalizeEnglishIdentity(row.display_text);
				groups.set(canonical, [...(groups.get(canonical) ?? []), row]);
			}
			for (const [canonical, group] of groups) {
				const keeper = group[0];
				if (!keeper) continue;
				const duplicateIds = group.slice(1).map((row) => row.id);
				const cards = await this.database
					.prepare(
						`SELECT id, source_id FROM review_cards
						 WHERE learner_id = ? AND source_type = ?
						   AND source_id IN (SELECT value FROM json_each(?))
						 ORDER BY updated_at, id`,
					)
					.bind(learnerId, config.sourceType, JSON.stringify(group.map((row) => row.id)))
					.all<{ id: string; source_id: string }>();
				const statements: D1PreparedStatement[] = [];
				const keeperCard = cards.results?.[0];
				if (keeperCard) {
					statements.push(
						this.database
							.prepare('UPDATE review_cards SET source_id = ? WHERE id = ?')
							.bind(keeper.id, keeperCard.id),
					);
					for (const card of cards.results?.slice(1) ?? []) {
						statements.push(
							this.database.prepare('DELETE FROM review_cards WHERE id = ?').bind(card.id),
						);
					}
				}
				for (const duplicateId of duplicateIds) {
					statements.push(this.database.prepare(config.deleteSql).bind(duplicateId));
				}
				statements.push(
					this.database
						.prepare(
							`DELETE FROM acquisition_identities
							 WHERE learner_id = ? AND kind = ?
							   AND entity_id IN (SELECT value FROM json_each(?))`,
						)
						.bind(learnerId, config.kind, JSON.stringify(group.map((row) => row.id))),
					this.database.prepare(config.updateSql).bind(canonical, keeper.id),
					this.database
						.prepare(
							`INSERT OR REPLACE INTO acquisition_identities
							 (learner_id, kind, canonical_text, entity_id, created_at)
							 VALUES (?, ?, ?, ?, ?)`,
						)
						.bind(learnerId, config.kind, canonical, keeper.id, now),
				);
				await this.database.batch(statements);
			}
		}

		const mistakeRows = await this.database
			.prepare(
				`SELECT id, category, original_text, correction_text, occurrence_count
				 FROM mistakes WHERE learner_id = ? ORDER BY created_at, id`,
			)
			.bind(learnerId)
			.all<{
				id: string;
				category: string;
				original_text: string;
				correction_text: string;
				occurrence_count: number;
			}>();
		const mistakeGroups = new Map<string, Array<{ id: string; occurrence_count: number }>>();
		for (const row of mistakeRows.results ?? []) {
			const canonical = `${normalizeEnglishIdentity(row.category)}:${normalizeEnglishIdentity(row.original_text)}:${normalizeEnglishIdentity(row.correction_text)}`;
			mistakeGroups.set(canonical, [
				...(mistakeGroups.get(canonical) ?? []),
				{ id: row.id, occurrence_count: row.occurrence_count },
			]);
		}
		for (const [canonical, group] of mistakeGroups) {
			const keeper = group[0];
			if (!keeper) continue;
			const duplicateIds = group.slice(1).map((row) => row.id);
			const cards = await this.database
				.prepare(
					`SELECT id, source_id FROM review_cards
					 WHERE learner_id = ? AND source_type = 'mistake'
					   AND source_id IN (SELECT value FROM json_each(?))
					 ORDER BY CASE WHEN source_id = ? THEN 0 ELSE 1 END, updated_at, id`,
				)
				.bind(learnerId, JSON.stringify(group.map((row) => row.id)), keeper.id)
				.all<{ id: string; source_id: string }>();
			const statements: D1PreparedStatement[] = [];
			const keeperCard = cards.results?.[0];
			for (const card of cards.results?.slice(1) ?? []) {
				statements.push(
					this.database.prepare('DELETE FROM review_cards WHERE id = ?').bind(card.id),
				);
			}
			if (keeperCard && keeperCard.source_id !== keeper.id) {
				statements.push(
					this.database
						.prepare('UPDATE review_cards SET source_id = ? WHERE id = ?')
						.bind(keeper.id, keeperCard.id),
				);
			}
			for (const duplicateId of duplicateIds) {
				statements.push(
					this.database.prepare('DELETE FROM mistakes WHERE id = ?').bind(duplicateId),
				);
			}
			statements.push(
				this.database
					.prepare(
						`UPDATE mistakes SET canonical_identity = ?, occurrence_count = ?, updated_at = ?
						 WHERE learner_id = ? AND id = ?`,
					)
					.bind(
						canonical,
						group.reduce((total, row) => total + row.occurrence_count, 0),
						now,
						learnerId,
						keeper.id,
					),
			);
			await this.database.batch(statements);
		}
	}

	private reviewCardPayload(row: FormalReviewCardRow) {
		return {
			id: row.id,
			front: row.front_text,
			back: row.back_text,
			dueAt: row.due_date,
			state: row.state,
			sourceType: row.source_type,
			sourceId: row.source_id,
			stabilityLevel: row.stability_level,
			lapses: row.lapses,
			lastReviewedAt: row.last_reviewed_at ?? undefined,
			algorithmVersion: 1 as const,
			version: row.version,
			updatedAt: row.updated_at,
		};
	}

	private syncMirrorStatements(
		learnerId: string,
		entityType: string,
		entityId: string,
		payload: unknown,
		version: number,
		entityMutationId: string,
		now: string,
		changeOperationId = entityMutationId,
	): D1PreparedStatement[] {
		return [
			this.database
				.prepare(
					`INSERT INTO sync_entities (
             learner_id, entity_type, entity_id, operation, payload_json,
             version, last_mutation_id, updated_at
           ) VALUES (?, ?, ?, 'upsert', ?, ?, ?, ?)
           ON CONFLICT(learner_id, entity_type, entity_id) DO UPDATE SET
             operation = excluded.operation,
             payload_json = excluded.payload_json,
             version = excluded.version,
             last_mutation_id = excluded.last_mutation_id,
             updated_at = excluded.updated_at`,
				)
				.bind(
					learnerId,
					entityType,
					entityId,
					JSON.stringify(payload),
					version,
					entityMutationId,
					now,
				),
			this.database
				.prepare(
					`INSERT INTO change_log (
             learner_id, entity_type, entity_id, operation, payload_json, operation_id, changed_at
           ) VALUES (?, ?, ?, 'upsert', ?, ?, ?)`,
				)
				.bind(
					learnerId,
					`sync:${entityType}`,
					entityId,
					JSON.stringify({ payload, version }),
					changeOperationId,
					now,
				),
		];
	}

	private async dailyProgressVersionAuthority(
		learnerId: string,
		studyDate: string,
	): Promise<number> {
		const row = await this.database
			.prepare(
				`WITH input(learner_id, study_date, entity_prefix) AS (VALUES (?, ?, ?)),
				 version_candidates(version) AS (
				   SELECT progress.version
				   FROM daily_progress AS progress, input
				   WHERE progress.learner_id = input.learner_id
				     AND progress.study_date = input.study_date
				   UNION ALL
				   SELECT entity.version
				   FROM sync_entities AS entity, input
				   WHERE entity.learner_id = input.learner_id
				     AND entity.entity_type = 'daily-progress'
				     AND entity.entity_id LIKE input.entity_prefix
				   UNION ALL
				   SELECT CAST(json_extract(entity.payload_json, '$.version') AS INTEGER)
				   FROM sync_entities AS entity, input
				   WHERE entity.learner_id = input.learner_id
				     AND entity.entity_type = 'daily-progress'
				     AND entity.entity_id LIKE input.entity_prefix
				     AND json_valid(entity.payload_json)
				     AND json_type(entity.payload_json, '$.version') = 'integer'
				   UNION ALL
				   SELECT CAST(json_extract(change.payload_json, '$.version') AS INTEGER)
				   FROM change_log AS change, input
				   WHERE change.learner_id = input.learner_id
				     AND change.entity_type = 'sync:daily-progress'
				     AND change.entity_id LIKE input.entity_prefix
				     AND json_valid(change.payload_json)
				     AND json_type(change.payload_json, '$.version') = 'integer'
				   UNION ALL
				   SELECT mutation.entity_version
				   FROM processed_mutations AS mutation, input
				   WHERE mutation.learner_id = input.learner_id
				     AND mutation.entity_version IS NOT NULL
				     AND (
				       (mutation.entity_type = 'daily_progress' AND mutation.entity_id = input.study_date)
				       OR
				       (mutation.entity_type = 'sync:daily-progress' AND mutation.entity_id LIKE input.entity_prefix)
				     )
				 )
				 SELECT COALESCE(MAX(version), 0) AS authoritative_version FROM version_candidates`,
			)
			.bind(learnerId, studyDate, `study:${studyDate}:curriculum:%`)
			.first<DailyProgressVersionAuthorityRow>();
		return row?.authoritative_version ?? 0;
	}

	private guardedDailyProgressStatement(
		learnerId: string,
		studyDate: string,
		curriculumDay: number,
		progress: CoreCompletion,
		nextVersion: number,
		mutationId: string,
		now: string,
		expectedPhysicalVersion: number,
		expectedAuthoritativeVersion: number,
	): D1PreparedStatement {
		return this.database
			.prepare(
				`WITH input(learner_id, study_date, entity_prefix) AS (VALUES (?, ?, ?)),
				 version_candidates(version) AS (
				   SELECT physical.version
				   FROM daily_progress AS physical, input
				   WHERE physical.learner_id = input.learner_id
				     AND physical.study_date = input.study_date
				   UNION ALL
				   SELECT entity.version
				   FROM sync_entities AS entity, input
				   WHERE entity.learner_id = input.learner_id
				     AND entity.entity_type = 'daily-progress'
				     AND entity.entity_id LIKE input.entity_prefix
				   UNION ALL
				   SELECT CAST(json_extract(entity.payload_json, '$.version') AS INTEGER)
				   FROM sync_entities AS entity, input
				   WHERE entity.learner_id = input.learner_id
				     AND entity.entity_type = 'daily-progress'
				     AND entity.entity_id LIKE input.entity_prefix
				     AND json_valid(entity.payload_json)
				     AND json_type(entity.payload_json, '$.version') = 'integer'
				   UNION ALL
				   SELECT CAST(json_extract(change.payload_json, '$.version') AS INTEGER)
				   FROM change_log AS change, input
				   WHERE change.learner_id = input.learner_id
				     AND change.entity_type = 'sync:daily-progress'
				     AND change.entity_id LIKE input.entity_prefix
				     AND json_valid(change.payload_json)
				     AND json_type(change.payload_json, '$.version') = 'integer'
				   UNION ALL
				   SELECT mutation.entity_version
				   FROM processed_mutations AS mutation, input
				   WHERE mutation.learner_id = input.learner_id
				     AND mutation.entity_version IS NOT NULL
				     AND (
				       (mutation.entity_type = 'daily_progress' AND mutation.entity_id = input.study_date)
				       OR
				       (mutation.entity_type = 'sync:daily-progress' AND mutation.entity_id LIKE input.entity_prefix)
				     )
				 )
				 INSERT INTO daily_progress (
				   learner_id, study_date, curriculum_day, review_completed, grammar_completed,
				   core_voice_imported, core_completed, version, last_mutation_id, updated_at
				 )
				 SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
				 WHERE (SELECT COALESCE(MAX(version), 0) FROM version_candidates) = ?
				 ON CONFLICT(learner_id, study_date) DO UPDATE SET
				   curriculum_day = COALESCE(daily_progress.curriculum_day, excluded.curriculum_day),
				   review_completed = excluded.review_completed,
				   grammar_completed = excluded.grammar_completed,
				   core_voice_imported = excluded.core_voice_imported,
				   core_completed = excluded.core_completed,
				   version = excluded.version,
				   last_mutation_id = excluded.last_mutation_id,
				   updated_at = excluded.updated_at
				 WHERE daily_progress.version = ?`,
			)
			.bind(
				learnerId,
				studyDate,
				`study:${studyDate}:curriculum:%`,
				learnerId,
				studyDate,
				curriculumDay,
				progress.reviewCompleted ? 1 : 0,
				progress.grammarCompleted ? 1 : 0,
				progress.coreVoiceImported ? 1 : 0,
				progress.coreCompleted ? 1 : 0,
				nextVersion,
				mutationId,
				now,
				expectedAuthoritativeVersion,
				expectedPhysicalVersion,
			);
	}

	private guardedDailyProgressTombstoneStatement(
		learnerId: string,
		entityId: string,
		studyDate: string,
		nextVersion: number,
		mutationId: string,
		now: string,
		expectedMirrorVersion: number,
		expectedAuthoritativeVersion: number,
	): D1PreparedStatement {
		return this.database
			.prepare(
				`WITH input(learner_id, study_date, entity_prefix) AS (VALUES (?, ?, ?)),
				 version_candidates(version) AS (
				   SELECT physical.version
				   FROM daily_progress AS physical, input
				   WHERE physical.learner_id = input.learner_id
				     AND physical.study_date = input.study_date
				   UNION ALL
				   SELECT entity.version
				   FROM sync_entities AS entity, input
				   WHERE entity.learner_id = input.learner_id
				     AND entity.entity_type = 'daily-progress'
				     AND entity.entity_id LIKE input.entity_prefix
				   UNION ALL
				   SELECT CAST(json_extract(entity.payload_json, '$.version') AS INTEGER)
				   FROM sync_entities AS entity, input
				   WHERE entity.learner_id = input.learner_id
				     AND entity.entity_type = 'daily-progress'
				     AND entity.entity_id LIKE input.entity_prefix
				     AND json_valid(entity.payload_json)
				     AND json_type(entity.payload_json, '$.version') = 'integer'
				   UNION ALL
				   SELECT CAST(json_extract(change.payload_json, '$.version') AS INTEGER)
				   FROM change_log AS change, input
				   WHERE change.learner_id = input.learner_id
				     AND change.entity_type = 'sync:daily-progress'
				     AND change.entity_id LIKE input.entity_prefix
				     AND json_valid(change.payload_json)
				     AND json_type(change.payload_json, '$.version') = 'integer'
				   UNION ALL
				   SELECT mutation.entity_version
				   FROM processed_mutations AS mutation, input
				   WHERE mutation.learner_id = input.learner_id
				     AND mutation.entity_version IS NOT NULL
				     AND (
				       (mutation.entity_type = 'daily_progress' AND mutation.entity_id = input.study_date)
				       OR
				       (mutation.entity_type = 'sync:daily-progress' AND mutation.entity_id LIKE input.entity_prefix)
				     )
				 )
				 INSERT INTO sync_entities (
				   learner_id, entity_type, entity_id, operation, payload_json,
				   version, last_mutation_id, updated_at
				 )
				 SELECT ?, 'daily-progress', ?, 'delete', 'null', ?, ?, ?
				 WHERE (SELECT COALESCE(MAX(version), 0) FROM version_candidates) = ?
				 ON CONFLICT(learner_id, entity_type, entity_id) DO UPDATE SET
				   operation = 'delete',
				   payload_json = 'null',
				   version = excluded.version,
				   last_mutation_id = excluded.last_mutation_id,
				   updated_at = excluded.updated_at
				 WHERE sync_entities.version = ?`,
			)
			.bind(
				learnerId,
				studyDate,
				`study:${studyDate}:curriculum:%`,
				learnerId,
				entityId,
				nextVersion,
				mutationId,
				now,
				expectedAuthoritativeVersion,
				expectedMirrorVersion,
			);
	}

	private dailyProgressMirrorStatements(
		learnerId: string,
		entityId: string,
		studyDate: string,
		entityMutationId: string,
		changeOperationId: string,
	): D1PreparedStatement[] {
		return [
			this.database
				.prepare(
					`INSERT INTO sync_entities (
					   learner_id, entity_type, entity_id, operation, payload_json,
					   version, last_mutation_id, updated_at
					 )
					 SELECT learner_id, 'daily-progress', ?, 'upsert',
					   json_object(
					     'id', ?, 'studyDate', study_date, 'curriculumDay', curriculum_day,
					     'reviewsCompleted', json(CASE review_completed WHEN 1 THEN 'true' ELSE 'false' END),
					     'grammarCompleted', json(CASE grammar_completed WHEN 1 THEN 'true' ELSE 'false' END),
					     'coreSessionImported', json(CASE core_voice_imported WHEN 1 THEN 'true' ELSE 'false' END),
					     'coreCompleted', json(CASE core_completed WHEN 1 THEN 'true' ELSE 'false' END),
					     'version', version, 'updatedAt', updated_at
					   ),
					   version, ?, updated_at
					 FROM daily_progress WHERE learner_id = ? AND study_date = ?
					 ON CONFLICT(learner_id, entity_type, entity_id) DO UPDATE SET
					   operation = excluded.operation,
					   payload_json = excluded.payload_json,
					   version = excluded.version,
					   last_mutation_id = excluded.last_mutation_id,
					   updated_at = excluded.updated_at`,
				)
				.bind(entityId, entityId, entityMutationId, learnerId, studyDate),
			this.database
				.prepare(
					`INSERT INTO change_log (
					   learner_id, entity_type, entity_id, operation, payload_json, operation_id, changed_at
					 )
					 SELECT learner_id, 'sync:daily-progress', ?, 'upsert',
					   json_object(
					     'payload', json_object(
					       'id', ?, 'studyDate', study_date, 'curriculumDay', curriculum_day,
					       'reviewsCompleted', json(CASE review_completed WHEN 1 THEN 'true' ELSE 'false' END),
					       'grammarCompleted', json(CASE grammar_completed WHEN 1 THEN 'true' ELSE 'false' END),
					       'coreSessionImported', json(CASE core_voice_imported WHEN 1 THEN 'true' ELSE 'false' END),
					       'coreCompleted', json(CASE core_completed WHEN 1 THEN 'true' ELSE 'false' END),
					       'version', version, 'updatedAt', updated_at
					     ),
					     'version', version
					   ), ?, updated_at
					 FROM daily_progress WHERE learner_id = ? AND study_date = ?`,
				)
				.bind(entityId, entityId, changeOperationId, learnerId, studyDate),
		];
	}

	private importedLearningMirrorStatements(
		learnerId: string,
		sessionId: string,
		operationId: string,
		studyDate: string,
		kind: 'vocabulary' | 'phrase',
		index: number,
		entityId: string,
		cardId: string,
		item: { text: string; meaning: string; example: string },
		supportLanguage: 'ja' | 'en',
		state: 'new' | 'previewed',
		now: string,
	): D1PreparedStatement[] {
		const acquisitionId = `${sessionId}:acquisition:${kind}:${index}`;
		const sourceTable = kind === 'vocabulary' ? 'vocabulary' : 'phrases';
		return [
			...this.conditionalSyncMirrorStatements(
				sourceTable,
				entityId,
				learnerId,
				'learning-item',
				entityId,
				{
					id: entityId,
					kind,
					canonicalText: normalizeEnglishIdentity(item.text),
					displayText: item.text,
					meaning: item.meaning,
					supportLanguage,
					status: state,
					updatedAt: now,
				},
				1,
				crypto.randomUUID(),
				now,
				operationId,
			),
			...this.conditionalSyncMirrorStatements(
				sourceTable,
				entityId,
				learnerId,
				'acquisition-event',
				acquisitionId,
				{
					eventId: acquisitionId,
					studyDate,
					kind,
					entityId,
					sourceSessionId: sessionId,
					createdAt: now,
				},
				1,
				crypto.randomUUID(),
				now,
				operationId,
			),
			...this.conditionalSyncMirrorStatements(
				'review_cards',
				cardId,
				learnerId,
				'review-card',
				cardId,
				{
					id: cardId,
					front: item.text,
					back: `${item.meaning}\n${item.example}`,
					dueAt: now,
					state,
					sourceType: kind,
					sourceId: entityId,
					stabilityLevel: 0,
					lapses: 0,
					algorithmVersion: 1,
					version: 1,
					updatedAt: now,
				},
				1,
				crypto.randomUUID(),
				now,
				operationId,
			),
		];
	}

	private conditionalSyncMirrorStatements(
		sourceTable: 'vocabulary' | 'phrases' | 'grammar_previews' | 'review_cards',
		sourceId: string,
		learnerId: string,
		entityType: string,
		entityId: string,
		payload: unknown,
		version: number,
		entityMutationId: string,
		now: string,
		changeOperationId = entityMutationId,
	): D1PreparedStatement[] {
		const syncEntitySql = {
			vocabulary: `INSERT INTO sync_entities (
				learner_id, entity_type, entity_id, operation, payload_json,
				version, last_mutation_id, updated_at
			) SELECT ?, ?, ?, 'upsert', ?, ?, ?, ?
			WHERE EXISTS (SELECT 1 FROM vocabulary WHERE id = ?)
			ON CONFLICT(learner_id, entity_type, entity_id) DO UPDATE SET
				operation = excluded.operation, payload_json = excluded.payload_json,
				version = MAX(excluded.version, sync_entities.version + 1),
				last_mutation_id = excluded.last_mutation_id,
				updated_at = excluded.updated_at`,
			phrases: `INSERT INTO sync_entities (
				learner_id, entity_type, entity_id, operation, payload_json,
				version, last_mutation_id, updated_at
			) SELECT ?, ?, ?, 'upsert', ?, ?, ?, ?
			WHERE EXISTS (SELECT 1 FROM phrases WHERE id = ?)
			ON CONFLICT(learner_id, entity_type, entity_id) DO UPDATE SET
				operation = excluded.operation, payload_json = excluded.payload_json,
				version = MAX(excluded.version, sync_entities.version + 1),
				last_mutation_id = excluded.last_mutation_id,
				updated_at = excluded.updated_at`,
			grammar_previews: `INSERT INTO sync_entities (
				learner_id, entity_type, entity_id, operation, payload_json,
				version, last_mutation_id, updated_at
			) SELECT ?, ?, ?, 'upsert', ?, ?, ?, ?
			WHERE EXISTS (SELECT 1 FROM grammar_previews WHERE id = ?)
			ON CONFLICT(learner_id, entity_type, entity_id) DO UPDATE SET
				operation = excluded.operation, payload_json = excluded.payload_json,
				version = MAX(excluded.version, sync_entities.version + 1),
				last_mutation_id = excluded.last_mutation_id,
				updated_at = excluded.updated_at`,
			review_cards: `INSERT INTO sync_entities (
				learner_id, entity_type, entity_id, operation, payload_json,
				version, last_mutation_id, updated_at
			) SELECT ?, ?, ?, 'upsert', json_set(json(?), '$.version', card.version),
				card.version, ?, ?
			FROM review_cards AS card WHERE card.id = ?
			ON CONFLICT(learner_id, entity_type, entity_id) DO UPDATE SET
				operation = excluded.operation,
				payload_json = json_set(
					excluded.payload_json, '$.version',
					MAX(excluded.version, sync_entities.version + 1)
				),
				version = MAX(excluded.version, sync_entities.version + 1),
				last_mutation_id = excluded.last_mutation_id,
				updated_at = excluded.updated_at`,
		} as const;
		const changeLogSql = {
			vocabulary: `INSERT INTO change_log (
				learner_id, entity_type, entity_id, operation, payload_json, operation_id, changed_at
			) SELECT mirror.learner_id, 'sync:' || mirror.entity_type, mirror.entity_id, 'upsert',
				json_object('payload', json(mirror.payload_json), 'version', mirror.version), ?, ?
			FROM sync_entities AS mirror
			WHERE mirror.learner_id = ? AND mirror.entity_type = ? AND mirror.entity_id = ?
			  AND EXISTS (SELECT 1 FROM vocabulary WHERE id = ?)`,
			phrases: `INSERT INTO change_log (
				learner_id, entity_type, entity_id, operation, payload_json, operation_id, changed_at
			) SELECT mirror.learner_id, 'sync:' || mirror.entity_type, mirror.entity_id, 'upsert',
				json_object('payload', json(mirror.payload_json), 'version', mirror.version), ?, ?
			FROM sync_entities AS mirror
			WHERE mirror.learner_id = ? AND mirror.entity_type = ? AND mirror.entity_id = ?
			  AND EXISTS (SELECT 1 FROM phrases WHERE id = ?)`,
			grammar_previews: `INSERT INTO change_log (
				learner_id, entity_type, entity_id, operation, payload_json, operation_id, changed_at
			) SELECT mirror.learner_id, 'sync:' || mirror.entity_type, mirror.entity_id, 'upsert',
				json_object('payload', json(mirror.payload_json), 'version', mirror.version), ?, ?
			FROM sync_entities AS mirror
			WHERE mirror.learner_id = ? AND mirror.entity_type = ? AND mirror.entity_id = ?
			  AND EXISTS (SELECT 1 FROM grammar_previews WHERE id = ?)`,
			review_cards: `INSERT INTO change_log (
				learner_id, entity_type, entity_id, operation, payload_json, operation_id, changed_at
			) SELECT mirror.learner_id, 'sync:' || mirror.entity_type, mirror.entity_id, 'upsert',
				json_object('payload', json(mirror.payload_json), 'version', mirror.version), ?, ?
			FROM sync_entities AS mirror
			WHERE mirror.learner_id = ? AND mirror.entity_type = ? AND mirror.entity_id = ?
			  AND EXISTS (SELECT 1 FROM review_cards WHERE id = ?)`,
		} as const;
		const syncStatement = this.database.prepare(syncEntitySql[sourceTable]);
		return [
			sourceTable === 'review_cards'
				? syncStatement.bind(
						learnerId,
						entityType,
						entityId,
						JSON.stringify(payload),
						entityMutationId,
						now,
						sourceId,
					)
				: syncStatement.bind(
						learnerId,
						entityType,
						entityId,
						JSON.stringify(payload),
						version,
						entityMutationId,
						now,
						sourceId,
					),
			this.database
				.prepare(changeLogSql[sourceTable])
				.bind(changeOperationId, now, learnerId, entityType, entityId, sourceId),
		];
	}

	private mistakeMirrorStatements(
		learnerId: string,
		mistakeId: string,
		sessionId: string,
		entityMutationId: string,
		now: string,
		changeOperationId: string,
	): D1PreparedStatement[] {
		return [
			this.database
				.prepare(
					`INSERT INTO sync_entities (
					   learner_id, entity_type, entity_id, operation, payload_json,
					   version, last_mutation_id, updated_at
					 )
					 SELECT learner_id, 'mistake', id, 'upsert',
					   json_object('id', id, 'category', category, 'original', original_text,
					     'correction', correction_text, 'repetitions', occurrence_count,
					     'sessionId', ?),
					   occurrence_count, ?, ?
					 FROM mistakes WHERE learner_id = ? AND id = ?
					 ON CONFLICT(learner_id, entity_type, entity_id) DO UPDATE SET
					   operation = excluded.operation, payload_json = excluded.payload_json,
					   version = MAX(excluded.version, sync_entities.version + 1),
					   last_mutation_id = excluded.last_mutation_id,
					   updated_at = excluded.updated_at`,
				)
				.bind(sessionId, entityMutationId, now, learnerId, mistakeId),
			this.database
				.prepare(
					`INSERT INTO change_log (
					   learner_id, entity_type, entity_id, operation, payload_json, operation_id, changed_at
					 )
					 SELECT item.learner_id, 'sync:mistake', item.id, 'upsert',
					   json_object('payload', json_object(
					     'id', item.id, 'category', item.category, 'original', item.original_text,
					     'correction', item.correction_text, 'repetitions', item.occurrence_count,
					     'sessionId', ?), 'version', mirror.version),
					   ?, ?
					 FROM mistakes AS item
					 JOIN sync_entities AS mirror
					   ON mirror.learner_id = item.learner_id
					  AND mirror.entity_type = 'mistake' AND mirror.entity_id = item.id
					 WHERE item.learner_id = ? AND item.id = ?`,
				)
				.bind(sessionId, changeOperationId, now, learnerId, mistakeId),
		];
	}

	private formalReviewCardMirrorStatements(
		learnerId: string,
		cardId: string,
		entityMutationId: string,
		now: string,
		changeOperationId: string,
	): D1PreparedStatement[] {
		return [
			this.database
				.prepare(
					`INSERT INTO sync_entities (
					   learner_id, entity_type, entity_id, operation, payload_json,
					   version, last_mutation_id, updated_at
					 )
					 SELECT learner_id, 'review-card', id, 'upsert',
					   json_patch(json_object(
					     'id', id, 'front', front_text, 'back', back_text, 'dueAt',
					     CASE WHEN length(due_date) = 10 THEN due_date || 'T00:00:00.000Z' ELSE due_date END,
					     'state', state, 'sourceType', source_type, 'sourceId', source_id,
					     'stabilityLevel', stability_level, 'lapses', lapses,
					     'algorithmVersion', 1, 'version', version, 'updatedAt', updated_at
					   ), CASE WHEN last_reviewed_at IS NULL THEN '{}' ELSE
					     json_object('lastReviewedAt', last_reviewed_at) END),
					   version, ?, ?
					 FROM review_cards WHERE learner_id = ? AND id = ?
					 ON CONFLICT(learner_id, entity_type, entity_id) DO UPDATE SET
					   operation = excluded.operation, payload_json = excluded.payload_json,
					   version = excluded.version, last_mutation_id = excluded.last_mutation_id,
					   updated_at = excluded.updated_at`,
				)
				.bind(entityMutationId, now, learnerId, cardId),
			this.database
				.prepare(
					`INSERT INTO change_log (
					   learner_id, entity_type, entity_id, operation, payload_json, operation_id, changed_at
					 )
					 SELECT learner_id, 'sync:review-card', id, 'upsert',
					   json_object('payload', json_patch(json_object(
					     'id', id, 'front', front_text, 'back', back_text, 'dueAt',
					     CASE WHEN length(due_date) = 10 THEN due_date || 'T00:00:00.000Z' ELSE due_date END,
					     'state', state, 'sourceType', source_type, 'sourceId', source_id,
					     'stabilityLevel', stability_level, 'lapses', lapses,
					     'algorithmVersion', 1, 'version', version, 'updatedAt', updated_at
					   ), CASE WHEN last_reviewed_at IS NULL THEN '{}' ELSE
					     json_object('lastReviewedAt', last_reviewed_at) END), 'version', version), ?, ?
					 FROM review_cards WHERE learner_id = ? AND id = ?`,
				)
				.bind(changeOperationId, now, learnerId, cardId),
		];
	}

	private reviewCardStatement(
		cardId: string,
		learnerId: string,
		sourceType: 'vocabulary' | 'phrase' | 'mistake' | 'session',
		sourceId: string,
		front: string,
		back: string,
		dueDate: string,
		now: string,
		requiredTable: 'vocabulary' | 'phrases' | 'mistakes' | 'session_imports',
		requiredId = sourceId,
		state: 'new' | 'previewed' = 'new',
		ignoreDuplicate = false,
	) {
		const sql = ignoreDuplicate
			? `INSERT OR IGNORE INTO review_cards (
				 id, learner_id, source_type, source_id, front_text, back_text, due_date,
				 interval_days, ease_factor, repetitions, version, updated_at,
				 state, stability_level, lapses, algorithm_version
				 ) SELECT ?, ?, ?, ?, ?, ?, ?, 1, 2.5, 0,
				   COALESCE((
				     SELECT version + 1 FROM sync_entities
				     WHERE learner_id = ? AND entity_type = 'review-card' AND entity_id = ?
				   ), 1), ?, ?, 0, 0, 1
				 WHERE CASE ?
				   WHEN 'vocabulary' THEN EXISTS (SELECT 1 FROM vocabulary WHERE id = ?)
				   WHEN 'phrases' THEN EXISTS (SELECT 1 FROM phrases WHERE id = ?)
				   WHEN 'mistakes' THEN EXISTS (SELECT 1 FROM mistakes WHERE id = ?)
				   WHEN 'session_imports' THEN EXISTS (SELECT 1 FROM session_imports WHERE id = ?)
				   ELSE 0
				 END`
			: `INSERT INTO review_cards (
				 id, learner_id, source_type, source_id, front_text, back_text, due_date,
				 interval_days, ease_factor, repetitions, version, updated_at,
				 state, stability_level, lapses, algorithm_version
				 ) SELECT ?, ?, ?, ?, ?, ?, ?, 1, 2.5, 0,
				   COALESCE((
				     SELECT version + 1 FROM sync_entities
				     WHERE learner_id = ? AND entity_type = 'review-card' AND entity_id = ?
				   ), 1), ?, ?, 0, 0, 1
				 WHERE CASE ?
				   WHEN 'vocabulary' THEN EXISTS (SELECT 1 FROM vocabulary WHERE id = ?)
				   WHEN 'phrases' THEN EXISTS (SELECT 1 FROM phrases WHERE id = ?)
				   WHEN 'mistakes' THEN EXISTS (SELECT 1 FROM mistakes WHERE id = ?)
				   WHEN 'session_imports' THEN EXISTS (SELECT 1 FROM session_imports WHERE id = ?)
				   ELSE 0
				 END`;
		return this.database
			.prepare(sql)
			.bind(
				cardId,
				learnerId,
				sourceType,
				sourceId,
				front,
				back,
				dueDate,
				learnerId,
				cardId,
				now,
				state,
				requiredTable,
				requiredId,
				requiredId,
				requiredId,
				requiredId,
			);
	}
}

export class ImportConflictError extends Error {
	constructor() {
		super(
			'The session, idempotency key, or pasted source was already imported with different identifiers.',
		);
	}
}

export class CurriculumInactiveError extends Error {
	constructor(
		readonly status: 'before-start' | 'graduated',
		readonly startDate: string,
		readonly activeTotalDays = 90,
	) {
		super(
			status === 'before-start'
				? `Learning starts on ${startDate}; no Core record may be created before that date.`
				: `The ${activeTotalDays}-day active curriculum is complete; no new Core day may be created.`,
		);
	}
}

export class CurriculumDayUnavailableError extends Error {
	constructor(
		readonly curriculumDay: number,
		readonly activeTotalDays: number,
	) {
		super(`Curriculum Day ${curriculumDay} exceeds active Day ${activeTotalDays}.`);
	}
}

export class AcquisitionLimitError extends Error {
	constructor(readonly preview: SessionPreview) {
		super('Daily acquisition limit exceeded. Reviews and conversation remain available.');
	}
}

export class VersionConflictError extends Error {
	constructor(
		readonly current: CoreCompletion,
		readonly version: number,
	) {
		super('The daily progress record changed on another device.');
	}
}

export class SyncVersionConflictError extends Error {
	constructor(
		readonly current: unknown,
		readonly version: number,
	) {
		super('The synchronized entity changed on another device.');
	}
}

export class MutationReplayMismatchError extends Error {
	constructor() {
		super('The mutation ID was already used with a different request payload.');
	}
}

export class ProgressContextError extends Error {
	constructor(readonly expectedCurriculumDay?: number) {
		super('The curriculum day is missing or does not match the learner progression.');
	}
}

export class ReviewStateError extends Error {
	constructor() {
		super('The review card is previewed or suspended and cannot be graded.');
	}
}

export class BoostPreviewContextError extends Error {
	constructor() {
		super('Grammar preview must be the next curriculum topic in Next Lesson Preview mode.');
	}
}

export class SessionContextError extends Error {
	constructor(
		readonly expectedStudyDate: string,
		readonly expectedCurriculumDay: number,
	) {
		super('Core session date or curriculum day does not match the learner schedule.');
	}
}

export class BoostContextError extends SessionContextError {
	constructor(expectedStudyDate: string, expectedCurriculumDay: number) {
		super(expectedStudyDate, expectedCurriculumDay);
		this.message = 'Boost requires the completed current-day Core context.';
	}
}
