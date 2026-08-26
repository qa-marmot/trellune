import Dexie, { type EntityTable } from 'dexie';
import { z } from 'zod';
import {
	DEFAULT_DATA,
	LegacyAppDataSchema,
	type AppData,
	type CoreStep,
	type ImportedSession,
	type MistakeItem,
	type ReviewCardItem,
	sanitizeImportedSession,
	sanitizeLegacyData,
} from '../domain/appData';
import {
	addStudyDays,
	calculateStreak,
	nextCurriculumDay,
	studyDateAt,
	studyStatus,
	type StudyStatus,
} from '../domain/calendar';
import { CurriculumEntryDaySchema, type CurriculumEntryDay } from '../domain/startingPoint';
import { acceptsCoreSession, deriveCoreState } from '../domain/core';
import { StageAssessmentSchema, type StageAssessment } from '../domain/assessment';
import { reconstructReviewHistory, scheduleReview, type ReviewGrade } from '../domain/srs';
import { CURRICULUM } from '../data/curriculum';
import {
	AVAILABLE_CURRICULUM_TOTAL_DAYS,
	SUPPORTED_CURRICULUM_DAY_MAX,
} from '../curriculum/constants';
import {
	CurriculumCompatibilityError,
	assertBundledCurriculumCompatibility,
} from '../curriculum/availability';
import {
	BaselineAssessmentSchema,
	ExternalSessionJsonSchema,
	normalizeExternalSession,
	IanaTimeZoneSchema,
	WeeklyAssessmentSchema,
	type BaselineAssessment,
	type WeeklyAssessment,
} from '../lib/schemas';
import {
	AcquisitionEventPayloadSchema,
	AssessmentPayloadSchema,
	GrammarProgressPayloadSchema,
	LearningEventPayloadSchema,
	LearningItemPayloadSchema,
	MistakePayloadSchema,
	ReviewCardPayloadSchema,
	ReviewEventPayloadSchema,
	SessionPayloadSchema,
} from '../sync/contracts';
import {
	DEMO_STARTER_PATCH,
	isDemoMode,
	persistenceBroadcastChannel,
	persistenceDatabaseName,
	persistenceLegacyStorageKey,
} from '../demo';

// Legacy persistence identifiers: keep them stable across the Trellune rebrand.
const LEGACY_STORAGE_KEY = persistenceLegacyStorageKey;
const LOCAL_DATA_DELETED_KEY = 'localDataDeleted';
export const ACTIVE_CURRICULUM_TOTAL_DAYS_METADATA_KEY = 'activeCurriculumTotalDays';
const CURRENT_ID = 'current' as const;
const DATABASE_SCHEMA_VERSION = 5;

export interface StoredSnapshot {
	id: 'current';
	version: 1;
	updatedAt: string;
	payload: unknown;
}

export interface LegacySyncQueueItem {
	id?: number;
	operationId: string;
	entity: string;
	action: 'upsert' | 'delete';
	payload: unknown;
	createdAt: string;
	attempts: number;
}

export interface MetadataRecord {
	key: string;
	value: unknown;
	updatedAt: string;
}

export interface LearnerProfileRecord {
	id: 'current';
	onboarded: boolean;
	learnerName: string;
	goal: string;
	timeZone: string;
	startDate: string;
	entryDay: CurriculumEntryDay;
	currentDay: number;
	streak: number;
	updatedAt: string;
}

export interface SettingsRecord {
	id: 'current';
	dailyMinutes: number;
	syncEnabled: boolean;
	reduceMotion: boolean;
	updatedAt: string;
}

export interface DailyProgressRecord {
	id: string;
	studyDate: string;
	curriculumDay: number;
	reviewsCompleted: boolean;
	grammarCompleted: boolean;
	coreSessionImported: boolean;
	coreCompleted: boolean;
	version: number;
	updatedAt: string;
}

export interface SessionRecord extends ImportedSession {
	studyDate?: string;
	canonicalContentHash?: string;
}

export interface StoredMistakeRecord extends MistakeItem {
	sessionId?: string;
}

export interface LearningEventRecord {
	eventId: string;
	type: string;
	studyDate: string;
	curriculumDay: number;
	payload: unknown;
	createdAt: string;
}

export interface LearningItemRecord {
	id: string;
	kind: 'vocabulary' | 'phrase';
	canonicalText: string;
	displayText: string;
	meaning: string;
	supportLanguage: 'ja' | 'en';
	/** Legacy Dexie v5 records are normalized at the read boundary. */
	meaningJa?: string;
	status: 'new' | 'learning' | 'learned' | 'previewed';
	updatedAt: string;
}

export interface AcquisitionEventRecord {
	eventId: string;
	studyDate: string;
	kind: 'vocabulary' | 'phrase' | 'grammar-preview';
	entityId: string;
	sourceSessionId?: string;
	createdAt: string;
}

export interface ReviewCardRecord {
	id: string;
	front: string;
	back: string;
	dueAt: string;
	state: 'new' | 'learning' | 'review' | 'relearning' | 'previewed' | 'suspended';
	sourceType: 'vocabulary' | 'phrase' | 'mistake' | 'session';
	sourceId: string;
	stabilityLevel: number;
	lapses: number;
	lastReviewedAt?: string;
	algorithmVersion: 1;
	version: number;
	updatedAt: string;
}

export interface ReviewEventRecord {
	eventId: string;
	cardId: string;
	grade: 'again' | 'hard' | 'good' | 'easy';
	occurredAt: string;
	studyDate: string;
	curriculumDay: number;
	algorithmVersion: 1;
	before: ReviewCardItem;
	after: ReviewCardItem;
}

export interface GrammarProgressRecord {
	id: string;
	curriculumDay: number;
	status: 'previewed' | 'completed';
	updatedAt: string;
}

export type AssessmentRecord =
	| { id: 'baseline:current'; type: 'baseline'; completedAt: string; payload: BaselineAssessment }
	| { id: string; type: 'weekly'; completedAt: string; payload: WeeklyAssessment }
	| { id: string; type: 'stage'; completedAt: string; payload: StageAssessment };

export interface OutboxRecord {
	operationId: string;
	schemaVersion: 1;
	deviceId: string;
	entityType: string;
	entityId: string;
	operationType: 'upsert' | 'delete';
	payload: unknown;
	baseVersion: number | null;
	/** Validated local version floor carried only by formal backup restore operations. */
	sourceVersion?: number;
	createdAt: string;
	attempts: number;
	nextAttemptAt: string;
	status: 'pending' | 'in_flight' | 'blocked';
	lastErrorCode?: string;
}

export interface ConflictRecord {
	id: string;
	operationId: string;
	entityType: string;
	entityId: string;
	status: 'open' | 'resolved';
	serverValue: unknown;
	localValue: unknown;
	createdAt: string;
}

export interface SyncStateRecord {
	id: 'current';
	cursor: number;
	lastSuccessAt?: string;
	lastErrorCode?: string;
	lastAttemptAt?: string;
	lastAttemptStatus?: 'completed' | 'busy' | 'offline' | 'blocked' | 'failed';
	updatedAt: string;
}

const ProfileRecordSchema = z
	.object({
		id: z.literal('current'),
		onboarded: z.boolean(),
		learnerName: z.string().max(200),
		goal: z.string().max(500),
		timeZone: IanaTimeZoneSchema,
		startDate: z.iso.date(),
		entryDay: CurriculumEntryDaySchema,
		currentDay: z.number().int().min(1).max(SUPPORTED_CURRICULUM_DAY_MAX),
		streak: z.number().int().nonnegative(),
		updatedAt: z.string(),
	})
	.strict()
	.superRefine((value, context) => {
		if (value.currentDay < value.entryDay) {
			context.addIssue({
				code: 'custom',
				path: ['currentDay'],
				message: 'Current Day cannot precede the learner entry Day.',
			});
		}
	});

const ProfileSchema = z.preprocess((value) => {
	if (!value || typeof value !== 'object' || Array.isArray(value) || 'entryDay' in value)
		return value;
	return { ...value, entryDay: 1 };
}, ProfileRecordSchema);

const SettingsSchema = z
	.object({
		id: z.literal('current'),
		dailyMinutes: z.number().int().min(1).max(240),
		syncEnabled: z.boolean(),
		reduceMotion: z.boolean(),
		updatedAt: z.string(),
	})
	.strict();

const DailyProgressSchema = z
	.object({
		id: z.string(),
		studyDate: z.iso.date(),
		curriculumDay: z.number().int().min(1).max(SUPPORTED_CURRICULUM_DAY_MAX),
		reviewsCompleted: z.boolean(),
		grammarCompleted: z.boolean(),
		coreSessionImported: z.boolean(),
		coreCompleted: z.boolean(),
		version: z.number().int().nonnegative(),
		updatedAt: z.string(),
	})
	.strict();

const ReviewBatchSchema = z
	.object({
		studyDate: z.iso.date(),
		curriculumDay: z.number().int().min(1).max(SUPPORTED_CURRICULUM_DAY_MAX),
		cardIds: z.array(z.string().min(1).max(128)).max(100_000),
		completedCardIds: z.array(z.string().min(1).max(128)).max(100_000),
		createdAt: z.iso.datetime({ offset: true }),
	})
	.strict();

class EnglishOsDatabase extends Dexie {
	snapshots!: EntityTable<StoredSnapshot, 'id'>;
	syncQueue!: EntityTable<LegacySyncQueueItem, 'id'>;
	metadata!: EntityTable<MetadataRecord, 'key'>;
	learnerProfiles!: EntityTable<LearnerProfileRecord, 'id'>;
	settings!: EntityTable<SettingsRecord, 'id'>;
	dailyProgress!: EntityTable<DailyProgressRecord, 'id'>;
	learningEvents!: EntityTable<LearningEventRecord, 'eventId'>;
	sessions!: EntityTable<SessionRecord, 'sessionId'>;
	mistakes!: EntityTable<StoredMistakeRecord, 'id'>;
	learningItems!: EntityTable<LearningItemRecord, 'id'>;
	acquisitionEvents!: EntityTable<AcquisitionEventRecord, 'eventId'>;
	reviewCards!: EntityTable<ReviewCardRecord, 'id'>;
	reviewEvents!: EntityTable<ReviewEventRecord, 'eventId'>;
	grammarProgress!: EntityTable<GrammarProgressRecord, 'id'>;
	assessments!: EntityTable<AssessmentRecord, 'id'>;
	outbox!: EntityTable<OutboxRecord, 'operationId'>;
	conflicts!: EntityTable<ConflictRecord, 'id'>;
	syncState!: EntityTable<SyncStateRecord, 'id'>;

	constructor() {
		// Do not rename: existing learner data is stored under this database name.
		super(persistenceDatabaseName);
		this.version(1).stores({
			snapshots: 'id, updatedAt',
			syncQueue: '++id, &operationId, entity, createdAt',
		});
		this.version(2).stores({
			snapshots: 'id, updatedAt',
			syncQueue: '++id, &operationId, entity, createdAt',
			metadata: '&key, updatedAt',
			learnerProfiles: '&id, updatedAt',
			settings: '&id, updatedAt',
			dailyProgress: '&id, curriculumDay, coreCompleted, updatedAt',
			learningEvents: '&eventId, studyDate, curriculumDay, type, createdAt',
			sessions: '&sessionId, kind, completedAt',
			mistakes: '&id, sessionId, category',
			learningItems: '&id, &[kind+canonicalText], kind, status, updatedAt',
			acquisitionEvents: '&eventId, [studyDate+kind], entityId, sourceSessionId',
			reviewCards: '&id, dueAt, state, updatedAt',
			reviewEvents: '&eventId, cardId, occurredAt',
			grammarProgress: '&id, curriculumDay, status, updatedAt',
			assessments: '&id, type, completedAt',
			outbox: '&operationId, status, nextAttemptAt, entityType, entityId, [status+nextAttemptAt]',
			conflicts: '&id, operationId, status, [entityType+entityId]',
			syncState: '&id, updatedAt',
		});
		this.version(3)
			.stores({ dailyProgress: '&id, studyDate, curriculumDay, coreCompleted, updatedAt' })
			.upgrade(async (transaction) => {
				const profileTable = transaction.table('learnerProfiles');
				const progressTable = transaction.table('dailyProgress');
				const legacyProfile = (await profileTable.get(CURRENT_ID)) as
					(Partial<LearnerProfileRecord> & { updatedAt?: string; currentDay?: number }) | undefined;
				if (!legacyProfile) return;
				const timeZone = legacyProfile.timeZone ?? 'Asia/Tokyo';
				const endDate = studyDateAt(legacyProfile.updatedAt ?? new Date().toISOString(), timeZone);
				const currentDay = legacyProfile.currentDay ?? 1;
				const startDate = legacyProfile.startDate ?? addStudyDays(endDate, -(currentDay - 1));
				await profileTable.put({
					...legacyProfile,
					timeZone,
					startDate,
				});
				const legacyProgress = (await progressTable.toArray()) as Array<
					Partial<DailyProgressRecord> & { curriculumDay?: number; updatedAt?: string }
				>;
				await progressTable.clear();
				for (const item of legacyProgress) {
					const curriculumDay = item.curriculumDay ?? 1;
					const studyDate = item.studyDate ?? addStudyDays(startDate, curriculumDay - 1);
					await progressTable.add({
						id: progressId(studyDate, curriculumDay),
						studyDate,
						curriculumDay,
						reviewsCompleted: item.reviewsCompleted ?? false,
						grammarCompleted: item.grammarCompleted ?? false,
						coreSessionImported: item.coreSessionImported ?? false,
						coreCompleted: item.coreCompleted ?? false,
						version: item.version ?? 1,
						updatedAt: item.updatedAt ?? new Date().toISOString(),
					});
				}
			});
		this.version(4)
			.stores({
				reviewCards: '&id, dueAt, state, updatedAt',
				reviewEvents: '&eventId, cardId, studyDate, occurredAt',
				sessions: '&sessionId, kind, completedAt, studyDate, canonicalContentHash',
			})
			.upgrade(async (transaction) => {
				const cards = transaction.table('reviewCards');
				for (const card of (await cards.toArray()) as Array<
					Partial<ReviewCardRecord> & { id: string }
				>) {
					await cards.put({
						...card,
						sourceType: card.sourceType ?? 'session',
						sourceId: card.sourceId ?? card.id,
						stabilityLevel: card.stabilityLevel ?? 0,
						lapses: card.lapses ?? 0,
						algorithmVersion: 1,
					});
				}
			});
		this.version(DATABASE_SCHEMA_VERSION)
			.stores({ reviewEvents: '&eventId, cardId, studyDate, occurredAt' })
			.upgrade(async (transaction) => {
				const profile = (await transaction.table('learnerProfiles').get(CURRENT_ID)) as
					LearnerProfileRecord | undefined;
				const timeZone = profile?.timeZone ?? 'Asia/Tokyo';
				const eventTable = transaction.table('reviewEvents');
				const cardTable = transaction.table('reviewCards');
				const events = (await eventTable.toArray()) as ReviewEventRecord[];
				const byCard = new Map<string, ReviewEventRecord[]>();
				for (const event of events) {
					byCard.set(event.cardId, [...(byCard.get(event.cardId) ?? []), event]);
				}
				for (const [cardId, history] of byCard) {
					let state:
						| {
								state: ReviewCardRecord['state'];
								dueAt: string;
								lastReviewedAt?: string;
								stabilityLevel: number;
								lapses: number;
								version: number;
						  }
						| undefined;
					for (const event of history.sort((left, right) =>
						left.occurredAt === right.occurredAt
							? left.eventId.localeCompare(right.eventId)
							: left.occurredAt.localeCompare(right.occurredAt),
					)) {
						const before = {
							state: state?.state ?? event.before.state,
							dueAt: state?.dueAt ?? event.before.dueAt,
							lastReviewedAt: state?.lastReviewedAt,
							stabilityLevel: state?.stabilityLevel ?? 0,
							lapses: state?.lapses ?? 0,
							version: state?.version ?? event.before.version,
						};
						const scheduled = scheduleReview(before, event.grade, event.occurredAt, timeZone);
						state = { ...scheduled, version: before.version + 1 };
						await eventTable.put({
							...event,
							before: { ...event.before, ...before },
							after: { ...event.after, ...state },
						});
					}
					const card = (await cardTable.get(cardId)) as ReviewCardRecord | undefined;
					if (card && state) {
						await cardTable.put({
							...card,
							...state,
							updatedAt: state.lastReviewedAt ?? card.updatedAt,
						});
					}
				}
			});
	}
}

export const db = new EnglishOsDatabase();

/** Reset only the isolated, synthetic public-demo database. */
export async function resetDemoData(): Promise<AppData> {
	if (!isDemoMode) throw new Error('Demo reset is unavailable in the standard application.');
	db.close();
	await db.delete();
	await db.open();
	await applyAppPatch(DEMO_STARTER_PATCH);
	return loadAppData();
}

export async function seedDemoData(): Promise<AppData> {
	if (!isDemoMode) throw new Error('Demo seed is unavailable in the standard application.');
	await applyAppPatch(DEMO_STARTER_PATCH);
	return loadAppData();
}

function activeCurriculumTotalDaysFromRecord(record: MetadataRecord | undefined): number {
	if (!record) return AVAILABLE_CURRICULUM_TOTAL_DAYS;
	return assertBundledCurriculumCompatibility(record.value);
}

export async function effectiveActiveCurriculumTotalDays(): Promise<number> {
	return activeCurriculumTotalDaysFromRecord(
		await db.metadata.get(ACTIVE_CURRICULUM_TOTAL_DAYS_METADATA_KEY),
	);
}

export async function persistActiveCurriculumTotalDays(activeTotalDays: unknown): Promise<number> {
	const active = assertBundledCurriculumCompatibility(activeTotalDays);
	await db.metadata.put({
		key: ACTIVE_CURRICULUM_TOTAL_DAYS_METADATA_KEY,
		value: active,
		updatedAt: nowIso(),
	});
	return active;
}

export type HydrationStatus = 'ready' | 'recovery-required';

export interface HydrationResult {
	status: HydrationStatus;
	data?: AppData;
	message?: string;
	remoteRecoveryRecommended?: boolean;
}

export class PersistenceError extends Error {
	constructor(
		public readonly code:
			'quota' | 'transaction-aborted' | 'constraint' | 'serialization' | 'corrupt-data' | 'unknown',
		public readonly userMessage: string,
		cause?: unknown,
	) {
		super(userMessage, { cause });
		this.name = 'PersistenceError';
	}
}

function persistenceError(error: unknown): PersistenceError {
	if (error instanceof PersistenceError) return error;
	if (error instanceof CurriculumCompatibilityError) {
		return new PersistenceError('corrupt-data', error.userMessage, error);
	}
	const name = error instanceof DOMException || error instanceof Error ? error.name : '';
	if (name === 'QuotaExceededError') {
		return new PersistenceError(
			'quota',
			'端末の保存容量が不足しているため保存できません。入力内容は変更せず、空き容量を確認してください。',
			error,
		);
	}
	if (name === 'AbortError') {
		return new PersistenceError(
			'transaction-aborted',
			'端末への保存処理が中断されました。データは変更していません。',
			error,
		);
	}
	if (name === 'ConstraintError') {
		return new PersistenceError(
			'constraint',
			'同じデータとの競合があるため保存できません。最新状態を確認してください。',
			error,
		);
	}
	if (name === 'DataCloneError') {
		return new PersistenceError(
			'serialization',
			'保存できない形式のデータが含まれています。データは変更していません。',
			error,
		);
	}
	return new PersistenceError(
		'unknown',
		'端末への保存を完了できませんでした。データは変更していません。',
		error,
	);
}

function nowIso(): string {
	return new Date().toISOString();
}

function progressId(studyDate: string, curriculumDay: number): string {
	return `study:${studyDate}:curriculum:${curriculumDay}`;
}

function emptyProgress(studyDate: string, curriculumDay: number, now: string): DailyProgressRecord {
	return {
		id: progressId(studyDate, curriculumDay),
		studyDate,
		curriculumDay,
		reviewsCompleted: false,
		grammarCompleted: false,
		coreSessionImported: false,
		coreCompleted: false,
		version: 1,
		updatedAt: now,
	};
}

function legacyProgress(
	data: AppData,
	studyDate: string,
	curriculumDay: number,
	now: string,
): DailyProgressRecord {
	const isCurrent = curriculumDay === data.currentDay;
	const completed = data.completedDays.includes(curriculumDay);
	return {
		id: progressId(studyDate, curriculumDay),
		studyDate,
		curriculumDay,
		reviewsCompleted: completed || (isCurrent && data.core.reviews),
		grammarCompleted: completed || (isCurrent && data.core.grammar),
		coreSessionImported: completed || (isCurrent && data.core.import),
		coreCompleted: completed,
		version: 1,
		updatedAt: now,
	};
}

function progressForToday(
	profile: LearnerProfileRecord,
	progress: readonly DailyProgressRecord[],
	now: string,
	activeTotalDays: number,
): {
	studyDate: string;
	curriculumDay: number;
	status: StudyStatus;
	record: DailyProgressRecord;
} {
	const studyDate = studyDateAt(now, profile.timeZone);
	const existing = progress.find((item) => item.studyDate === studyDate);
	const curriculumDay =
		existing?.curriculumDay ?? nextCurriculumDay(progress, activeTotalDays, profile.entryDay);
	return {
		studyDate,
		curriculumDay,
		status: studyStatus(profile.startDate, studyDate, progress, activeTotalDays, profile.entryDay),
		record: existing ?? emptyProgress(studyDate, curriculumDay, now),
	};
}

function reviewBatchKey(studyDate: string, curriculumDay: number): string {
	return `reviewBatch:${studyDate}:curriculum:${curriculumDay}`;
}

async function ensureReviewBatch(now: string): Promise<void> {
	if (!(await db.learnerProfiles.get(CURRENT_ID))) return;
	let changed = false;
	await db.transaction(
		'rw',
		[db.metadata, db.learnerProfiles, db.dailyProgress, db.reviewCards, db.outbox],
		async () => {
			if (await db.metadata.get(LOCAL_DATA_DELETED_KEY)) return;
			const profile = ProfileSchema.parse(await db.learnerProfiles.get(CURRENT_ID));
			const progress = await db.dailyProgress.toArray();
			const activeTotalDays = activeCurriculumTotalDaysFromRecord(
				await db.metadata.get(ACTIVE_CURRICULUM_TOTAL_DAYS_METADATA_KEY),
			);
			const context = progressForToday(profile, progress, now, activeTotalDays);
			if (context.status !== 'active') return;
			const key = reviewBatchKey(context.studyDate, context.curriculumDay);
			const existing = ReviewBatchSchema.safeParse((await db.metadata.get(key))?.value);
			if (existing.success) return;
			const cardIds = (await db.reviewCards.toArray())
				.filter(
					(card) =>
						card.state !== 'previewed' &&
						card.state !== 'suspended' &&
						Date.parse(card.dueAt) <= Date.parse(now),
				)
				.sort(
					(left, right) =>
						left.dueAt.localeCompare(right.dueAt) ||
						right.lapses - left.lapses ||
						left.sourceType.localeCompare(right.sourceType) ||
						left.id.localeCompare(right.id),
				)
				.map((card) => card.id);
			await db.metadata.put({
				key,
				value: {
					studyDate: context.studyDate,
					curriculumDay: context.curriculumDay,
					cardIds,
					completedCardIds: [],
					createdAt: now,
				},
				updatedAt: now,
			});
			if (!cardIds.length && !context.record.reviewsCompleted) {
				const existingProgress = progress.find((item) => item.id === context.record.id);
				const state = deriveCoreState({
					reviewsCompleted: true,
					grammarCompleted: context.record.grammarCompleted,
					coreSessionImported: context.record.coreSessionImported,
				});
				const record: DailyProgressRecord = {
					...context.record,
					...state,
					version: (existingProgress?.version ?? 0) + 1,
					updatedAt: now,
				};
				await db.dailyProgress.put(record);
				await enqueueOutbox(
					'daily-progress',
					record.id,
					'upsert',
					record,
					existingProgress?.version ?? 0,
					now,
				);
			}
			await nextRevision(now);
			changed = true;
		},
	);
	if (changed) broadcastRevision();
}

async function nextRevision(now: string): Promise<number> {
	const record = await db.metadata.get('localRevision');
	const parsed = z.number().int().nonnegative().safeParse(record?.value);
	const revision = (parsed.success ? parsed.data : 0) + 1;
	await db.metadata.put({ key: 'localRevision', value: revision, updatedAt: now });
	return revision;
}

async function getDeviceId(now: string): Promise<string> {
	const record = await db.metadata.get('deviceId');
	const parsed = z.string().uuid().safeParse(record?.value);
	if (parsed.success) return parsed.data;
	const deviceId = crypto.randomUUID();
	await db.metadata.put({ key: 'deviceId', value: deviceId, updatedAt: now });
	return deviceId;
}

async function enqueueOutbox(
	entityType: string,
	entityId: string,
	operationType: OutboxRecord['operationType'],
	payload: unknown,
	baseVersion: number | null,
	now: string,
): Promise<void> {
	const operationId = crypto.randomUUID();
	await db.outbox.add({
		operationId,
		schemaVersion: 1,
		deviceId: await getDeviceId(now),
		entityType,
		entityId,
		operationType,
		payload,
		baseVersion,
		createdAt: now,
		attempts: 0,
		nextAttemptAt: now,
		status: 'pending',
	});
}

const normalizedTables = () => [
	db.metadata,
	db.learnerProfiles,
	db.settings,
	db.dailyProgress,
	db.learningEvents,
	db.sessions,
	db.mistakes,
	db.learningItems,
	db.acquisitionEvents,
	db.reviewCards,
	db.reviewEvents,
	db.grammarProgress,
	db.assessments,
	db.outbox,
	db.conflicts,
	db.syncState,
];

async function replaceNormalizedData(data: AppData, migration: boolean): Promise<void> {
	const now = nowIso();
	const today = studyDateAt(now, data.timeZone);
	const startDate = data.startDate ?? addStudyDays(today, -(data.currentDay - 1));
	try {
		await db.transaction('rw', [...normalizedTables(), db.snapshots, db.syncQueue], async () => {
			if (await db.metadata.get(LOCAL_DATA_DELETED_KEY)) return;
			if (migration && (await db.metadata.get('bootstrapComplete'))) return;
			for (const table of normalizedTables()) await table.clear();
			await db.learnerProfiles.put({
				id: CURRENT_ID,
				onboarded: data.onboarded,
				learnerName: data.learnerName,
				goal: data.goal,
				timeZone: data.timeZone,
				startDate,
				entryDay: data.entryDay,
				currentDay: data.currentDay,
				streak: data.streak,
				updatedAt: now,
			});
			await db.settings.put({
				id: CURRENT_ID,
				dailyMinutes: data.dailyMinutes,
				syncEnabled: data.syncEnabled,
				reduceMotion: data.reduceMotion,
				updatedAt: now,
			});
			const progressDays = Array.from(new Set([...data.completedDays, data.currentDay]));
			await db.dailyProgress.bulkPut(
				progressDays.map((day) => legacyProgress(data, addStudyDays(startDate, day - 1), day, now)),
			);
			await db.grammarProgress.bulkPut(
				data.previewedDays.map((day) => ({
					id: `preview:${day}`,
					curriculumDay: day,
					status: 'previewed' as const,
					updatedAt: now,
				})),
			);
			await db.sessions.bulkPut(data.sessions.map(sanitizeImportedSession));
			await db.mistakes.bulkPut(data.mistakes.map((mistake) => ({ ...mistake })));
			await db.metadata.put({
				key: 'bootstrapComplete',
				value: { schemaVersion: DATABASE_SCHEMA_VERSION, migration },
				updatedAt: now,
			});
			await db.metadata.put({ key: 'localRevision', value: 1, updatedAt: now });
			await db.metadata.put({ key: 'deviceId', value: crypto.randomUUID(), updatedAt: now });
			await db.snapshots.delete(CURRENT_ID);
			await db.syncQueue.clear();
		});
	} catch (error) {
		throw persistenceError(error);
	}
}

function readLegacyLocalStorage(): unknown | undefined {
	if (typeof localStorage === 'undefined') return undefined;
	const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
	if (!raw) return undefined;
	try {
		return JSON.parse(raw) as unknown;
	} catch {
		return Symbol.for('invalid-legacy-json');
	}
}

function mergeLegacyAppData(older: AppData, newer: AppData): AppData {
	const sessions = new Map(older.sessions.map((item) => [item.sessionId, item]));
	for (const session of newer.sessions) {
		const existing = sessions.get(session.sessionId);
		if (
			existing &&
			JSON.stringify(sanitizeImportedSession(existing)) !==
				JSON.stringify(sanitizeImportedSession(session))
		) {
			throw new PersistenceError(
				'corrupt-data',
				'旧保存領域に同じセッションIDの異なる内容があります。元データは変更していません。',
			);
		}
		sessions.set(session.sessionId, session);
	}
	const mistakes = new Map(older.mistakes.map((item) => [item.id, item]));
	for (const mistake of newer.mistakes) {
		const existing = mistakes.get(mistake.id);
		mistakes.set(mistake.id, {
			...mistake,
			repetitions: Math.max(existing?.repetitions ?? 0, mistake.repetitions),
		});
	}
	return {
		...newer,
		onboarded: older.onboarded || newer.onboarded,
		learnerName: newer.learnerName || older.learnerName,
		goal: newer.goal || older.goal,
		currentDay: Math.max(older.currentDay, newer.currentDay),
		streak: Math.max(older.streak, newer.streak),
		core: {
			reviews: older.core.reviews || newer.core.reviews,
			grammar: older.core.grammar || newer.core.grammar,
			import: older.core.import || newer.core.import,
		},
		completedDays: Array.from(new Set([...older.completedDays, ...newer.completedDays])).sort(
			(left, right) => left - right,
		),
		completedStudyDates: [],
		previewedDays: Array.from(new Set([...older.previewedDays, ...newer.previewedDays])).sort(
			(left, right) => left - right,
		),
		reviewCount: Math.max(older.reviewCount, newer.reviewCount),
		reviewCards: [],
		baselineCompleted: false,
		sessions: [...sessions.values()].sort((left, right) =>
			left.completedAt.localeCompare(right.completedAt),
		),
		mistakes: [...mistakes.values()],
	};
}

export async function initializePersistence(): Promise<HydrationResult> {
	if (typeof indexedDB === 'undefined') {
		return { status: 'ready', data: DEFAULT_DATA };
	}
	await db.open();
	const bootstrap = await db.metadata.get('bootstrapComplete');
	if (bootstrap) {
		try {
			const [profile, settings] = await Promise.all([
				db.learnerProfiles.get(CURRENT_ID),
				db.settings.get(CURRENT_ID),
			]);
			if (!profile || !settings) {
				const remoteStateExists = Boolean(
					(await db.syncState.get(CURRENT_ID)) ||
					(await db.metadata.where('key').startsWith('remoteVersion:').first()),
				);
				if (remoteStateExists) {
					return {
						status: 'recovery-required',
						remoteRecoveryRecommended: true,
						message: '端末内の基本設定が欠損しています。D1の同期済み状態から復旧を試みます。',
					};
				}
				const normalizedCount = await Promise.all(
					normalizedTables()
						.filter((table) => table !== db.metadata)
						.map((table) => table.count()),
				);
				if (normalizedCount.some((count) => count > 0)) {
					return {
						status: 'recovery-required',
						message: '基本設定だけが欠損しています。残っている学習データは上書きしていません。',
					};
				}
				return { status: 'ready', data: DEFAULT_DATA };
			}
			return { status: 'ready', data: await loadAppData() };
		} catch (error) {
			return {
				status: 'recovery-required',
				remoteRecoveryRecommended: Boolean(await db.syncState.get(CURRENT_ID)),
				message:
					error instanceof PersistenceError
						? error.userMessage
						: '端末内データを安全に確認できませんでした。',
			};
		}
	}

	const legacySnapshot = await db.snapshots.get(CURRENT_ID);
	const localStorageCandidate = readLegacyLocalStorage();
	const candidates = [legacySnapshot?.payload, localStorageCandidate].filter(
		(value): value is unknown => value !== undefined,
	);
	if (candidates.length) {
		const parsed = candidates.map((candidate) => LegacyAppDataSchema.safeParse(candidate));
		if (parsed.some((result) => !result.success)) {
			return {
				status: 'recovery-required',
				message: '以前の保存データを安全に確認できませんでした。元データは上書きしていません。',
			};
		}
		const normalized = parsed.map((result) =>
			sanitizeLegacyData(
				(result as { success: true; data: z.infer<typeof LegacyAppDataSchema> }).data,
			),
		);
		const migrationData =
			normalized.length === 2 ? mergeLegacyAppData(normalized[0], normalized[1]) : normalized[0];
		await replaceNormalizedData(migrationData, true);
		if (typeof localStorage !== 'undefined') localStorage.removeItem(LEGACY_STORAGE_KEY);
		return { status: 'ready', data: await loadAppData() };
	}

	return { status: 'ready', data: DEFAULT_DATA };
}

function assertInvariant(condition: unknown, message: string): asserts condition {
	if (!condition) throw new RangeError(message);
}

function validateNormalizedInvariants(input: {
	currentDay: number;
	entryDay: CurriculumEntryDay;
	activeTotalDays: number;
	progress: DailyProgressRecord[];
	learningEvents: LearningEventRecord[];
	sessions: SessionRecord[];
	mistakes: StoredMistakeRecord[];
	learningItems: LearningItemRecord[];
	acquisitionEvents: AcquisitionEventRecord[];
	reviewCards: ReviewCardRecord[];
	reviewEvents: ReviewEventRecord[];
	grammarProgress: GrammarProgressRecord[];
	assessments: AssessmentRecord[];
	timeZone: string;
}): void {
	const assertActiveDay = (day: number, label: string) =>
		assertInvariant(
			day <= input.activeTotalDays,
			`${label} Day ${day} exceeds active Day ${input.activeTotalDays}.`,
		);
	assertActiveDay(input.currentDay, 'Profile');
	assertActiveDay(input.entryDay, 'Profile entry');
	assertInvariant(
		input.currentDay >= input.entryDay,
		'Profile current Day precedes its entry Day.',
	);
	const completedDays = new Set<number>();
	for (const progress of input.progress) {
		assertActiveDay(progress.curriculumDay, `Progress ${progress.id}`);
		assertInvariant(
			progress.coreCompleted ===
				(progress.reviewsCompleted && progress.grammarCompleted && progress.coreSessionImported),
			`Core evidence invariant failed for ${progress.id}.`,
		);
		if (progress.coreCompleted) {
			assertInvariant(
				!completedDays.has(progress.curriculumDay),
				`Curriculum Day ${progress.curriculumDay} is completed more than once.`,
			);
			completedDays.add(progress.curriculumDay);
		}
	}
	for (const event of input.learningEvents) {
		assertActiveDay(event.curriculumDay, `Learning event ${event.eventId}`);
	}

	const sessionIds = new Set(input.sessions.map((item) => item.sessionId));
	const mistakeIds = new Set(input.mistakes.map((item) => item.id));
	const learningItems = new Map(input.learningItems.map((item) => [item.id, item]));
	const grammarIds = new Set(input.grammarProgress.map((item) => item.id));
	for (const session of input.sessions) {
		if (session.payload) {
			assertActiveDay(
				ExternalSessionJsonSchema.parse(session.payload).curriculumDay,
				`Session ${session.sessionId}`,
			);
		}
	}
	for (const event of input.reviewEvents) {
		assertActiveDay(event.curriculumDay, `Review event ${event.eventId}`);
	}
	for (const grammar of input.grammarProgress) {
		assertActiveDay(grammar.curriculumDay, `Grammar progress ${grammar.id}`);
	}
	for (const assessment of input.assessments) {
		if (assessment.type === 'weekly') {
			const weekly = WeeklyAssessmentSchema.parse(assessment.payload);
			assertActiveDay(weekly.startDay, `Assessment ${assessment.id}`);
			assertActiveDay(weekly.endDay, `Assessment ${assessment.id}`);
		} else if (assessment.type === 'stage') {
			const stage = StageAssessmentSchema.parse(assessment.payload);
			assertActiveDay(stage.curriculumRange.startDay, `Assessment ${assessment.id}`);
			assertActiveDay(stage.curriculumRange.endDay, `Assessment ${assessment.id}`);
		}
	}
	for (const item of input.learningItems) {
		assertInvariant(
			item.canonicalText === normalizeLearningIdentity(item.displayText),
			`Learning item ${item.id} has a non-canonical identity.`,
		);
	}
	for (const event of input.acquisitionEvents) {
		if (event.kind === 'grammar-preview') {
			assertInvariant(
				grammarIds.has(`preview:${event.entityId}`),
				`Grammar acquisition ${event.eventId} has no preview record.`,
			);
		} else {
			const item = learningItems.get(event.entityId);
			assertInvariant(
				item?.kind === event.kind,
				`Acquisition ${event.eventId} has no matching learning item.`,
			);
		}
		if (event.sourceSessionId) {
			assertInvariant(
				sessionIds.has(event.sourceSessionId),
				`Acquisition ${event.eventId} references a missing session.`,
			);
		}
	}

	const cards = new Map(input.reviewCards.map((item) => [item.id, item]));
	for (const card of input.reviewCards) {
		const sourceExists =
			card.sourceType === 'mistake'
				? mistakeIds.has(card.sourceId)
				: card.sourceType === 'session'
					? sessionIds.has(card.sourceId)
					: learningItems.get(card.sourceId)?.kind === card.sourceType;
		assertInvariant(sourceExists, `Review card ${card.id} references a missing source.`);
	}

	const eventsByCard = new Map<string, ReviewEventRecord[]>();
	for (const event of input.reviewEvents) {
		assertInvariant(cards.has(event.cardId), `Review event ${event.eventId} has no card.`);
		assertInvariant(
			event.before.id === event.cardId && event.after.id === event.cardId,
			`Review event ${event.eventId} snapshot ID does not match its card.`,
		);
		eventsByCard.set(event.cardId, [...(eventsByCard.get(event.cardId) ?? []), event]);
	}
	for (const [cardId, events] of eventsByCard) {
		const reconstructed = reconstructReviewHistory(events, input.timeZone);
		const card = cards.get(cardId);
		assertInvariant(reconstructed && card, `Review history ${cardId} cannot be reconstructed.`);
		assertInvariant(
			reconstructed.version === card.version &&
				reconstructed.state === card.state &&
				reconstructed.dueAt === card.dueAt &&
				reconstructed.stabilityLevel === card.stabilityLevel &&
				reconstructed.lapses === card.lapses,
			`Review card ${cardId} does not match its event history.`,
		);
	}
}

export async function loadAppData(): Promise<AppData> {
	if (typeof indexedDB === 'undefined') return DEFAULT_DATA;
	try {
		const now = nowIso();
		await ensureReviewBatch(now);
		const [
			profileRaw,
			settingsRaw,
			deletionMarker,
			progressRaw,
			sessions,
			mistakes,
			reviewCards,
			assessments,
			reviewBatches,
			learningItems,
			acquisitionEvents,
			reviewEvents,
			allGrammarProgress,
			activeTotalDaysRecord,
		] = await db.transaction('r', normalizedTables(), async () =>
			Promise.all([
				db.learnerProfiles.get(CURRENT_ID),
				db.settings.get(CURRENT_ID),
				db.metadata.get(LOCAL_DATA_DELETED_KEY),
				db.dailyProgress.toArray(),
				db.sessions.orderBy('completedAt').reverse().toArray(),
				db.mistakes.toArray(),
				db.reviewCards.toArray(),
				db.assessments.toArray(),
				db.metadata.where('key').startsWith('reviewBatch:').toArray(),
				db.learningItems.toArray(),
				db.acquisitionEvents.toArray(),
				db.reviewEvents.toArray(),
				db.grammarProgress.toArray(),
				db.metadata.get(ACTIVE_CURRICULUM_TOTAL_DAYS_METADATA_KEY),
			]),
		);
		if (deletionMarker) return DEFAULT_DATA;
		if (!profileRaw || !settingsRaw) {
			throw new PersistenceError(
				'corrupt-data',
				'端末内の基本設定が欠損しています。残っている学習データは変更していません。',
			);
		}
		const profile = ProfileSchema.parse(profileRaw);
		const settings = SettingsSchema.parse(settingsRaw);
		const progress = progressRaw.map((item) => DailyProgressSchema.parse(item));
		const safeSessions = sessions.map((item) => SessionPayloadSchema.parse(item));
		const safeMistakes = mistakes.map((item) => MistakePayloadSchema.parse(item));
		const safeReviewCards = reviewCards.map((item) => ReviewCardPayloadSchema.parse(item));
		const safeAssessments = assessments.map((item) => AssessmentPayloadSchema.parse(item));
		const safeLearningItems = learningItems.map((item) => {
			const parsed = LearningItemPayloadSchema.parse(item);
			return {
				...parsed,
				meaning: parsed.meaning ?? parsed.meaningJa ?? '',
				supportLanguage: parsed.supportLanguage ?? 'ja',
			};
		});
		const safeAcquisitionEvents = acquisitionEvents.map((item) =>
			AcquisitionEventPayloadSchema.parse(item),
		);
		const safeReviewEvents = reviewEvents.map((item) => ReviewEventPayloadSchema.parse(item));
		const safeGrammarProgress = allGrammarProgress.map((item) =>
			GrammarProgressPayloadSchema.parse(item),
		);
		const safeLearningEvents = (await db.learningEvents.toArray()).map((item) =>
			LearningEventPayloadSchema.parse(item),
		);
		const activeTotalDays = activeCurriculumTotalDaysFromRecord(activeTotalDaysRecord);
		validateNormalizedInvariants({
			currentDay: profile.currentDay,
			entryDay: profile.entryDay,
			activeTotalDays,
			progress,
			learningEvents: safeLearningEvents,
			sessions: safeSessions,
			mistakes: safeMistakes,
			learningItems: safeLearningItems,
			acquisitionEvents: safeAcquisitionEvents,
			reviewCards: safeReviewCards,
			reviewEvents: safeReviewEvents,
			grammarProgress: safeGrammarProgress,
			assessments: safeAssessments,
			timeZone: profile.timeZone,
		});
		const current = progressForToday(profile, progress, now, activeTotalDays);
		const batchValue = reviewBatches.find(
			(item) => item.key === reviewBatchKey(current.studyDate, current.curriculumDay),
		)?.value;
		const batch =
			current.status === 'active'
				? ReviewBatchSchema.parse(batchValue)
				: {
						studyDate: current.studyDate,
						curriculumDay: current.curriculumDay,
						cardIds: [],
						completedCardIds: [],
						createdAt: now,
					};
		const completedReviewCards = new Set(batch.completedCardIds);
		const reviewCardsById = new Map(safeReviewCards.map((card) => [card.id, card]));
		const batchCards = batch.cardIds
			.filter((id) => !completedReviewCards.has(id))
			.map((id) => reviewCardsById.get(id))
			.filter((card): card is ReviewCardRecord => Boolean(card));
		const completedDates = progress
			.filter((item) => item.coreCompleted)
			.map((item) => item.studyDate);
		const acquiredToday = safeAcquisitionEvents.filter(
			(event) => event.studyDate === current.studyDate,
		);
		return {
			onboarded: profile.onboarded,
			learnerName: profile.learnerName,
			goal: profile.goal,
			dailyMinutes: settings.dailyMinutes,
			timeZone: profile.timeZone,
			startDate: profile.startDate,
			entryDay: profile.entryDay,
			studyStatus: current.status,
			currentDay: current.curriculumDay,
			streak: calculateStreak(completedDates, current.studyDate),
			core: {
				reviews: current.record.reviewsCompleted,
				grammar: current.record.grammarCompleted,
				import: current.record.coreSessionImported,
			},
			completedDays: progress
				.filter((item) => item.coreCompleted)
				.map((item) => item.curriculumDay)
				.sort((a, b) => a - b),
			completedStudyDates: Array.from(new Set(completedDates)).sort(),
			previewedDays: safeGrammarProgress
				.filter((item) => item.status === 'previewed')
				.map((item) => item.curriculumDay)
				.sort((a, b) => a - b),
			reviewCount: batchCards.length,
			reviewBatchTotal: batch.cardIds.length,
			reviewBatchCompleted: batch.completedCardIds.length,
			reviewCards: batchCards.map((card) => ({
				id: card.id,
				front: card.front,
				back: card.back,
				dueAt: card.dueAt,
				state: card.state,
				stabilityLevel: card.stabilityLevel,
				lapses: card.lapses,
				lastReviewedAt: card.lastReviewedAt,
				version: card.version,
			})),
			learningItems: safeLearningItems.map((item) => ({
				id: item.id,
				kind: item.kind,
				displayText: item.displayText,
				meaning: item.meaning,
				supportLanguage: item.supportLanguage,
				status: item.status,
			})),
			remainingAcquisition: {
				words: Math.max(0, 8 - acquiredToday.filter((item) => item.kind === 'vocabulary').length),
				phrases: Math.max(0, 3 - acquiredToday.filter((item) => item.kind === 'phrase').length),
				previewGrammar: Math.max(
					0,
					1 - acquiredToday.filter((item) => item.kind === 'grammar-preview').length,
				),
			},
			activity: {
				coreSessions: safeSessions.filter((item) => item.kind === 'core').length,
				boostSessions: safeSessions.filter((item) => item.kind === 'boost').length,
				reviewEvents: safeReviewEvents.length,
				acquiredWords: safeAcquisitionEvents.filter((item) => item.kind === 'vocabulary').length,
				acquiredPhrases: safeAcquisitionEvents.filter((item) => item.kind === 'phrase').length,
				grammarProgress: safeGrammarProgress.length,
			},
			baselineCompleted: safeAssessments.some((item) => item.type === 'baseline'),
			stageAssessments: safeAssessments
				.filter((item) => item.type === 'stage')
				.map((item) => item.payload)
				.sort((left, right) => right.completedAt.localeCompare(left.completedAt)),
			sessions: safeSessions.map(sanitizeImportedSession),
			mistakes: safeMistakes.map((mistake) => ({
				id: mistake.id,
				category: mistake.category,
				original: mistake.original,
				correction: mistake.correction,
				repetitions: mistake.repetitions,
				sessionId: mistake.sessionId,
			})),
			syncEnabled: settings.syncEnabled,
			reduceMotion: settings.reduceMotion,
		};
	} catch (error) {
		throw new PersistenceError(
			'corrupt-data',
			'端末内データの整合性を確認できませんでした。元データは変更していません。',
			error,
		);
	}
}

export async function applyAppPatch(patch: Partial<AppData>): Promise<void> {
	const now = nowIso();
	try {
		await db.transaction(
			'rw',
			[db.metadata, db.learnerProfiles, db.settings, db.grammarProgress, db.outbox],
			async () => {
				if ((await db.metadata.get(LOCAL_DATA_DELETED_KEY)) && patch.onboarded !== true) {
					throw new PersistenceError(
						'constraint',
						'この端末のデータは削除済みです。先に初期設定を完了してください。',
					);
				}
				const localVersionRecord = await db.metadata.get('entityVersion:profile-settings');
				const remoteVersionRecord = await db.metadata.get(
					`remoteVersion:profile-settings:${CURRENT_ID}`,
				);
				const localVersion = z.number().int().nonnegative().safeParse(localVersionRecord?.value);
				const remoteVersion = z.number().int().nonnegative().safeParse(remoteVersionRecord?.value);
				const baseVersion = localVersion.success
					? localVersion.data
					: remoteVersion.success
						? remoteVersion.data
						: 0;
				const profile = (await db.learnerProfiles.get(CURRENT_ID)) ?? {
					id: CURRENT_ID,
					onboarded: DEFAULT_DATA.onboarded,
					learnerName: DEFAULT_DATA.learnerName,
					goal: DEFAULT_DATA.goal,
					timeZone: patch.timeZone ?? DEFAULT_DATA.timeZone,
					startDate: studyDateAt(now, patch.timeZone ?? DEFAULT_DATA.timeZone),
					entryDay: DEFAULT_DATA.entryDay,
					currentDay: DEFAULT_DATA.currentDay,
					streak: DEFAULT_DATA.streak,
					updatedAt: now,
				};
				const settings = (await db.settings.get(CURRENT_ID)) ?? {
					id: CURRENT_ID,
					dailyMinutes: DEFAULT_DATA.dailyMinutes,
					syncEnabled: DEFAULT_DATA.syncEnabled,
					reduceMotion: DEFAULT_DATA.reduceMotion,
					updatedAt: now,
				};
				const nextProfile: LearnerProfileRecord = ProfileSchema.parse({
					...profile,
					onboarded: patch.onboarded ?? profile.onboarded,
					learnerName: patch.learnerName ?? profile.learnerName,
					goal: patch.goal ?? profile.goal,
					timeZone: patch.timeZone ?? profile.timeZone,
					startDate: patch.startDate ?? profile.startDate,
					entryDay: patch.entryDay ?? profile.entryDay,
					currentDay: patch.currentDay ?? profile.currentDay,
					streak: patch.streak ?? profile.streak,
					updatedAt: now,
				});
				const nextSettings: SettingsRecord = SettingsSchema.parse({
					...settings,
					dailyMinutes: patch.dailyMinutes ?? settings.dailyMinutes,
					syncEnabled: patch.syncEnabled ?? settings.syncEnabled,
					reduceMotion: patch.reduceMotion ?? settings.reduceMotion,
					updatedAt: now,
				});
				const activeTotalDays = activeCurriculumTotalDaysFromRecord(
					await db.metadata.get(ACTIVE_CURRICULUM_TOTAL_DAYS_METADATA_KEY),
				);
				if (nextProfile.currentDay > activeTotalDays) {
					throw new PersistenceError(
						'constraint',
						`Day ${nextProfile.currentDay}は現在有効なDay ${activeTotalDays}を超えています。`,
					);
				}
				if (
					nextProfile.entryDay > activeTotalDays ||
					nextProfile.currentDay < nextProfile.entryDay
				) {
					throw new PersistenceError(
						'constraint',
						`開始地点Day ${nextProfile.entryDay}は現在のカリキュラム範囲と一致しません。`,
					);
				}
				if (patch.previewedDays?.some((day) => day > activeTotalDays)) {
					throw new PersistenceError(
						'constraint',
						`文法予習は現在有効なDay ${activeTotalDays}まで保存できます。`,
					);
				}
				await db.learnerProfiles.put(nextProfile);
				await db.settings.put(nextSettings);
				if (patch.previewedDays) {
					await db.grammarProgress.bulkPut(
						patch.previewedDays.map((day) => ({
							id: `preview:${day}`,
							curriculumDay: day,
							status: 'previewed' as const,
							updatedAt: now,
						})),
					);
				}
				if (nextSettings.syncEnabled) {
					await enqueueOutbox(
						'profile-settings',
						CURRENT_ID,
						'upsert',
						{ profile: nextProfile, settings: nextSettings },
						baseVersion,
						now,
					);
					await db.metadata.put({
						key: 'entityVersion:profile-settings',
						value: baseVersion + 1,
						updatedAt: now,
					});
				}
				await nextRevision(now);
				await db.metadata.put({
					key: 'bootstrapComplete',
					value: { schemaVersion: DATABASE_SCHEMA_VERSION, migration: false },
					updatedAt: now,
				});
				if (patch.onboarded) await db.metadata.delete(LOCAL_DATA_DELETED_KEY);
			},
		);
		broadcastRevision();
	} catch (error) {
		throw persistenceError(error);
	}
}

export async function deleteLocalLearnerData(): Promise<void> {
	const now = nowIso();
	try {
		await db.transaction('rw', [...normalizedTables(), db.snapshots, db.syncQueue], async () => {
			for (const table of normalizedTables()) await table.clear();
			await db.snapshots.clear();
			await db.syncQueue.clear();
			await db.metadata.put({
				key: LOCAL_DATA_DELETED_KEY,
				value: { remoteDataRetained: true },
				updatedAt: now,
			});
			await db.metadata.put({
				key: 'bootstrapComplete',
				value: { schemaVersion: DATABASE_SCHEMA_VERSION, migration: false },
				updatedAt: now,
			});
		});
		try {
			if (typeof localStorage !== 'undefined') localStorage.removeItem(LEGACY_STORAGE_KEY);
		} catch {
			// The durable deletion marker prevents a blocked legacy localStorage entry from rehydrating.
		}
		broadcastRevision();
	} catch (error) {
		throw persistenceError(error);
	}
}

export async function persistCoreStep(step: CoreStep): Promise<void> {
	const now = nowIso();
	try {
		await db.transaction(
			'rw',
			[db.metadata, db.learnerProfiles, db.dailyProgress, db.grammarProgress, db.outbox],
			async () => {
				if (await db.metadata.get(LOCAL_DATA_DELETED_KEY)) {
					throw new PersistenceError(
						'constraint',
						'この端末のデータは削除済みです。先に初期設定を完了してください。',
					);
				}
				const profile = ProfileSchema.parse(await db.learnerProfiles.get(CURRENT_ID));
				const progress = await db.dailyProgress.toArray();
				const activeTotalDays = activeCurriculumTotalDaysFromRecord(
					await db.metadata.get(ACTIVE_CURRICULUM_TOTAL_DAYS_METADATA_KEY),
				);
				const context = progressForToday(profile, progress, now, activeTotalDays);
				if (context.status !== 'active') {
					throw new PersistenceError(
						'constraint',
						context.status === 'before-start'
							? `学習開始日は${profile.startDate}です。開始日前のCore記録は保存しません。`
							: `${activeTotalDays}日間を修了済みです。新しいCore記録は作成しません。`,
					);
				}
				const existing = progress.find((item) => item.id === context.record.id);
				const next = deriveCoreState({
					reviewsCompleted: step === 'reviews' ? true : context.record.reviewsCompleted,
					grammarCompleted: step === 'grammar' ? true : context.record.grammarCompleted,
					coreSessionImported: context.record.coreSessionImported,
				});
				const record: DailyProgressRecord = {
					...context.record,
					...next,
					version: (existing?.version ?? 0) + 1,
					updatedAt: now,
				};
				await db.dailyProgress.put(record);
				if (step === 'grammar') {
					const grammarId = CURRICULUM[context.curriculumDay - 1]?.grammar.id;
					if (!grammarId) {
						throw new PersistenceError('constraint', '今日の文法教材を特定できません。');
					}
					const previewId = `preview:${grammarId}`;
					const preview = await db.grammarProgress.get(previewId);
					await db.grammarProgress.put({
						id: preview?.id ?? `completed:${grammarId}`,
						curriculumDay: context.curriculumDay,
						status: 'completed',
						updatedAt: now,
					});
				}
				await enqueueOutbox(
					'daily-progress',
					record.id,
					'upsert',
					record,
					existing?.version ?? 0,
					now,
				);
				await nextRevision(now);
			},
		);
		broadcastRevision();
	} catch (error) {
		throw persistenceError(error);
	}
}

function normalizeLearningIdentity(value: string): string {
	return value.normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/\s+/gu, ' ');
}

function canonicalSessionValue(value: unknown): unknown {
	if (typeof value === 'string') return value.normalize('NFKC');
	if (Array.isArray(value)) return value.map(canonicalSessionValue);
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.keys(value)
				.filter((key) => key !== 'sessionId')
				.sort()
				.map((key) => [key, canonicalSessionValue((value as Record<string, unknown>)[key])]),
		);
	}
	return value;
}

async function sessionContentHash(payload: unknown): Promise<string> {
	const source = JSON.stringify(canonicalSessionValue(payload));
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function persistImportedSession(
	session: ImportedSession,
): Promise<'created' | 'duplicate'> {
	const safeSession = sanitizeImportedSession(session);
	const externalPayload = ExternalSessionJsonSchema.parse(safeSession.payload);
	const payload = normalizeExternalSession(externalPayload);
	const canonicalContentHash = await sessionContentHash(externalPayload);
	const now = nowIso();
	try {
		let outcome: 'created' | 'duplicate' = 'created';
		await db.transaction(
			'rw',
			[
				db.metadata,
				db.learnerProfiles,
				db.dailyProgress,
				db.sessions,
				db.mistakes,
				db.learningItems,
				db.acquisitionEvents,
				db.reviewCards,
				db.grammarProgress,
				db.outbox,
			],
			async () => {
				if (await db.metadata.get(LOCAL_DATA_DELETED_KEY)) {
					throw new PersistenceError(
						'constraint',
						'この端末のデータは削除済みです。先に初期設定を完了してください。',
					);
				}
				if (
					(await db.sessions.get(safeSession.sessionId)) ||
					(await db.sessions.where('canonicalContentHash').equals(canonicalContentHash).first())
				) {
					outcome = 'duplicate';
					return;
				}
				const profile = ProfileSchema.parse(await db.learnerProfiles.get(CURRENT_ID));
				const progress = await db.dailyProgress.toArray();
				const activeTotalDays = activeCurriculumTotalDaysFromRecord(
					await db.metadata.get(ACTIVE_CURRICULUM_TOTAL_DAYS_METADATA_KEY),
				);
				const context = progressForToday(profile, progress, now, activeTotalDays);
				const sameDayGraduationBoost =
					context.status === 'graduated' &&
					payload.sessionType === 'boost' &&
					context.record.coreCompleted;
				if (context.status !== 'active' && !sameDayGraduationBoost) {
					throw new PersistenceError(
						'constraint',
						context.status === 'before-start'
							? `学習開始日は${profile.startDate}です。開始日前のセッションは取り込めません。`
							: `${activeTotalDays}日間を修了済みです。新しいCoreセッションは取り込めません。`,
					);
				}
				if (payload.sessionType === 'boost' && !context.record.coreCompleted) {
					throw new PersistenceError(
						'constraint',
						'Boostは今日のCore 3項目が完了した後にだけ取り込めます。',
					);
				}
				if (payload.sessionType === 'boost' && payload.previewGrammar.length) {
					const nextDay = context.curriculumDay + 1;
					const expectedGrammar = CURRICULUM[nextDay - 1]?.grammar.id;
					if (
						payload.boost?.mode !== 'next_lesson_preview' ||
						!expectedGrammar ||
						payload.previewGrammar[0]?.topicId !== expectedGrammar
					) {
						throw new PersistenceError(
							'constraint',
							'文法予習はNext Lesson Previewで、次のDayの文法1件だけ取り込めます。',
						);
					}
				}
				const studyDate = studyDateAt(payload.occurredAt, profile.timeZone);
				if (
					payload.sessionType === 'boost' &&
					(studyDate !== context.studyDate || payload.curriculumDay !== context.curriculumDay)
				) {
					throw new PersistenceError(
						'constraint',
						'Boost結果は今日の学習日・現在のカリキュラムDayと一致する必要があります。',
					);
				}
				const storedSession: SessionRecord = {
					...safeSession,
					payload: externalPayload,
					studyDate,
					canonicalContentHash,
				};

				const newItems: LearningItemRecord[] = [];
				const acquisitionEvents: AcquisitionEventRecord[] = [];
				const cards: ReviewCardRecord[] = [];
				for (const [kind, items] of [
					['vocabulary', payload.newVocabulary],
					['phrase', payload.newPhrases],
				] as const) {
					for (const [index, item] of items.entries()) {
						const canonicalText = normalizeLearningIdentity(item.text);
						if (
							await db.learningItems
								.where('[kind+canonicalText]')
								.equals([kind, canonicalText])
								.first()
						) {
							continue;
						}
						if (
							newItems.some(
								(candidate) => candidate.kind === kind && candidate.canonicalText === canonicalText,
							)
						) {
							continue;
						}
						const id = `${payload.sessionId}:${kind}:${index}`;
						newItems.push({
							id,
							kind,
							canonicalText,
							displayText: item.text,
							meaning: item.meaning,
							supportLanguage: payload.supportLanguage,
							status: payload.sessionType === 'boost' ? 'previewed' : 'new',
							updatedAt: now,
						});
						acquisitionEvents.push({
							eventId: `${payload.sessionId}:acquisition:${kind}:${index}`,
							studyDate,
							kind,
							entityId: id,
							sourceSessionId: payload.sessionId,
							createdAt: now,
						});
						cards.push({
							id: `${payload.sessionId}:card:${kind}:${index}`,
							front: item.text,
							back: `${item.meaning}\n${item.example}`,
							dueAt: now,
							state: payload.sessionType === 'boost' ? 'previewed' : 'new',
							sourceType: kind,
							sourceId: id,
							stabilityLevel: 0,
							lapses: 0,
							algorithmVersion: 1,
							version: 1,
							updatedAt: now,
						});
					}
				}

				const existingCounts = {
					vocabulary: await db.acquisitionEvents
						.where('[studyDate+kind]')
						.equals([studyDate, 'vocabulary'])
						.count(),
					phrase: await db.acquisitionEvents
						.where('[studyDate+kind]')
						.equals([studyDate, 'phrase'])
						.count(),
					grammar: await db.acquisitionEvents
						.where('[studyDate+kind]')
						.equals([studyDate, 'grammar-preview'])
						.count(),
				};
				if (
					existingCounts.vocabulary + newItems.filter((item) => item.kind === 'vocabulary').length >
						8 ||
					existingCounts.phrase + newItems.filter((item) => item.kind === 'phrase').length > 3
				) {
					throw new PersistenceError(
						'constraint',
						'1日の新規獲得上限（単語8・定型表現3）を超えるため取り込めません。',
					);
				}

				const storedMistakes: StoredMistakeRecord[] = [];
				const stagedMistakes = new Map<string, StoredMistakeRecord>();
				for (const [index, mistake] of payload.mistakes.entries()) {
					const identity = `${mistake.category}:${normalizeLearningIdentity(mistake.learnerSaid)}:${normalizeLearningIdentity(mistake.suggested)}`;
					const staged = stagedMistakes.get(identity);
					const existing = staged
						? undefined
						: await db.mistakes
								.filter(
									(item) =>
										`${item.category}:${normalizeLearningIdentity(item.original)}:${normalizeLearningIdentity(item.correction)}` ===
										identity,
								)
								.first();
					const next = {
						id: staged?.id ?? existing?.id ?? `${payload.sessionId}:mistake:${index}`,
						category: mistake.category,
						original: mistake.learnerSaid,
						correction: mistake.suggested,
						repetitions: (staged?.repetitions ?? existing?.repetitions ?? 0) + 1,
						sessionId: payload.sessionId,
					};
					stagedMistakes.set(identity, next);
					storedMistakes.push(next);
				}
				const uniqueStoredMistakes = [...stagedMistakes.values()];

				const stagedMistakeCardSources = new Set<string>();
				for (const [index, candidate] of payload.reviewCards.entries()) {
					const sourceMistake =
						candidate.sourceMistakeIndex === null
							? undefined
							: storedMistakes[candidate.sourceMistakeIndex];
					if (sourceMistake) {
						const existingCard = await db.reviewCards
							.filter((item) => item.sourceType === 'mistake' && item.sourceId === sourceMistake.id)
							.first();
						if (existingCard || stagedMistakeCardSources.has(sourceMistake.id)) continue;
						stagedMistakeCardSources.add(sourceMistake.id);
					}
					cards.push({
						id: `${payload.sessionId}:card:candidate:${index}`,
						front: candidate.front,
						back: candidate.back,
						dueAt: now,
						state: 'new',
						sourceType: sourceMistake ? 'mistake' : 'session',
						sourceId: sourceMistake?.id ?? payload.sessionId,
						stabilityLevel: 0,
						lapses: 0,
						algorithmVersion: 1,
						version: 1,
						updatedAt: now,
					});
				}

				if (payload.sessionType === 'boost' && payload.previewGrammar.length) {
					const preview = payload.previewGrammar[0];
					const previewDay = context.curriculumDay + 1;
					const existingPreview = await db.grammarProgress.get(`preview:${preview.topicId}`);
					if (!existingPreview && existingCounts.grammar >= 1) {
						throw new PersistenceError(
							'constraint',
							'本日の文法予習は1件までです。会話と復習は続けられます。',
						);
					}
					if (!existingPreview) {
						await db.grammarProgress.add({
							id: `preview:${preview.topicId}`,
							curriculumDay: previewDay,
							status: 'previewed',
							updatedAt: now,
						});
						acquisitionEvents.push({
							eventId: `${payload.sessionId}:acquisition:grammar:0`,
							studyDate,
							kind: 'grammar-preview',
							entityId: preview.topicId,
							sourceSessionId: payload.sessionId,
							createdAt: now,
						});
					}
				}

				await db.sessions.add(storedSession);
				if (uniqueStoredMistakes.length) await db.mistakes.bulkPut(uniqueStoredMistakes);
				if (newItems.length) await db.learningItems.bulkAdd(newItems);
				if (acquisitionEvents.length) await db.acquisitionEvents.bulkAdd(acquisitionEvents);
				if (cards.length) await db.reviewCards.bulkAdd(cards);
				if (safeSession.kind === 'core') {
					if (
						!acceptsCoreSession({
							sessionType: payload.sessionType,
							curriculumDay: payload.curriculumDay,
							occurredAt: payload.occurredAt,
							expectedCurriculumDay: context.curriculumDay,
							expectedStudyDate: context.studyDate,
							timeZone: profile.timeZone,
						})
					) {
						throw new PersistenceError(
							'constraint',
							'Core結果は、今日の学習日・現在のカリキュラムDayと一致する場合だけ完了にできます。',
						);
					}
					const existing = progress.find((item) => item.id === context.record.id);
					const state = deriveCoreState({
						reviewsCompleted: context.record.reviewsCompleted,
						grammarCompleted: context.record.grammarCompleted,
						coreSessionImported: true,
					});
					const record: DailyProgressRecord = {
						...context.record,
						...state,
						version: (existing?.version ?? 0) + 1,
						updatedAt: now,
					};
					await db.dailyProgress.put(record);
				}
				await enqueueOutbox('session', safeSession.sessionId, 'upsert', storedSession, 0, now);
				await nextRevision(now);
			},
		);
		if (outcome === 'created') broadcastRevision();
		return outcome;
	} catch (error) {
		throw persistenceError(error);
	}
}

export async function persistReviewGrade(cardId: string, grade: ReviewGrade): Promise<void> {
	const now = nowIso();
	try {
		await ensureReviewBatch(now);
		await db.transaction(
			'rw',
			[
				db.metadata,
				db.learnerProfiles,
				db.dailyProgress,
				db.reviewCards,
				db.reviewEvents,
				db.outbox,
			],
			async () => {
				if (await db.metadata.get(LOCAL_DATA_DELETED_KEY)) {
					throw new PersistenceError(
						'constraint',
						'この端末のデータは削除済みです。先に初期設定を完了してください。',
					);
				}
				const profile = ProfileSchema.parse(await db.learnerProfiles.get(CURRENT_ID));
				const card = await db.reviewCards.get(cardId);
				if (!card || card.state === 'previewed' || card.state === 'suspended') {
					throw new PersistenceError('constraint', 'この復習カードは現在評価できません。');
				}
				const scheduled = scheduleReview(card, grade, now, profile.timeZone);
				const next: ReviewCardRecord = {
					...card,
					state: scheduled.state,
					dueAt: scheduled.dueAt,
					lastReviewedAt: scheduled.lastReviewedAt,
					stabilityLevel: scheduled.stabilityLevel,
					lapses: scheduled.lapses,
					version: card.version + 1,
					updatedAt: now,
				};
				const studyDate = studyDateAt(now, profile.timeZone);
				const activeTotalDays = activeCurriculumTotalDaysFromRecord(
					await db.metadata.get(ACTIVE_CURRICULUM_TOTAL_DAYS_METADATA_KEY),
				);
				const progress = progressForToday(
					profile,
					await db.dailyProgress.toArray(),
					now,
					activeTotalDays,
				);
				if (progress.status !== 'active') {
					throw new PersistenceError(
						'constraint',
						progress.status === 'before-start'
							? `学習開始日は${profile.startDate}です。開始日前の復習記録は保存しません。`
							: `${activeTotalDays}日間を修了済みです。Core用の復習記録は追加しません。`,
					);
				}
				const batchKey = reviewBatchKey(studyDate, progress.curriculumDay);
				const batch = ReviewBatchSchema.parse((await db.metadata.get(batchKey))?.value);
				if (!batch.cardIds.includes(cardId) || batch.completedCardIds.includes(cardId)) {
					throw new PersistenceError(
						'constraint',
						'このカードは今日の固定された復習セットに含まれていません。',
					);
				}
				const eventId = crypto.randomUUID();
				await db.reviewCards.put(next);
				const event: ReviewEventRecord = {
					eventId,
					cardId,
					grade,
					occurredAt: now,
					studyDate,
					curriculumDay: progress.curriculumDay,
					algorithmVersion: 1,
					before: {
						id: card.id,
						front: card.front,
						back: card.back,
						dueAt: card.dueAt,
						state: card.state,
						stabilityLevel: card.stabilityLevel,
						lapses: card.lapses,
						lastReviewedAt: card.lastReviewedAt,
						version: card.version,
					},
					after: {
						id: next.id,
						front: next.front,
						back: next.back,
						dueAt: next.dueAt,
						state: next.state,
						stabilityLevel: next.stabilityLevel,
						lapses: next.lapses,
						lastReviewedAt: next.lastReviewedAt,
						version: next.version,
					},
				};
				await db.reviewEvents.add(event);
				await enqueueOutbox('review-event', cardId, 'upsert', event, card.version, now);
				const completedCardIds = [...batch.completedCardIds, cardId];
				await db.metadata.put({
					key: batchKey,
					value: { ...batch, completedCardIds },
					updatedAt: now,
				});
				if (completedCardIds.length === batch.cardIds.length && !progress.record.reviewsCompleted) {
					const state = deriveCoreState({
						reviewsCompleted: true,
						grammarCompleted: progress.record.grammarCompleted,
						coreSessionImported: progress.record.coreSessionImported,
					});
					const record: DailyProgressRecord = {
						...progress.record,
						...state,
						version: progress.record.version + 1,
						updatedAt: now,
					};
					await db.dailyProgress.put(record);
					await enqueueOutbox(
						'daily-progress',
						record.id,
						'upsert',
						record,
						progress.record.version,
						now,
					);
				}
				await nextRevision(now);
			},
		);
		broadcastRevision();
	} catch (error) {
		throw persistenceError(error);
	}
}

export async function persistBaselineAssessment(
	input: BaselineAssessment,
): Promise<'created' | 'duplicate'> {
	const payload = BaselineAssessmentSchema.parse(input);
	const now = nowIso();
	try {
		const outcome = await db.transaction(
			'rw',
			[db.metadata, db.assessments, db.outbox],
			async () => {
				if (await db.metadata.get(LOCAL_DATA_DELETED_KEY)) {
					throw new PersistenceError(
						'constraint',
						'この端末のデータは削除済みです。先に初期設定を完了してください。',
					);
				}
				const id = 'baseline:current';
				const existing = await db.assessments.get(id);
				if (
					existing?.type === 'baseline' &&
					JSON.stringify(existing.payload) === JSON.stringify(payload)
				) {
					return 'duplicate' as const;
				}
				const versionRecord = await db.metadata.get(`entityVersion:assessment:${id}`);
				const version = z.number().int().nonnegative().safeParse(versionRecord?.value);
				const baseVersion = version.success ? version.data : 0;
				const assessment: AssessmentRecord = {
					id: 'baseline:current',
					type: 'baseline',
					completedAt: now,
					payload,
				};
				await db.assessments.put(assessment);
				await enqueueOutbox('assessment', id, 'upsert', assessment, baseVersion, now);
				await db.metadata.put({
					key: `entityVersion:assessment:${id}`,
					value: baseVersion + 1,
					updatedAt: now,
				});
				await nextRevision(now);
				return 'created' as const;
			},
		);
		if (outcome === 'created') broadcastRevision();
		return outcome;
	} catch (error) {
		throw persistenceError(error);
	}
}

export async function persistStageAssessment(
	input: StageAssessment,
): Promise<'created' | 'duplicate'> {
	const payload = StageAssessmentSchema.parse(input);
	const now = nowIso();
	const id = payload.attemptId;
	try {
		const outcome = await db.transaction(
			'rw',
			[db.metadata, db.assessments, db.outbox],
			async () => {
				if (await db.metadata.get(LOCAL_DATA_DELETED_KEY)) {
					throw new PersistenceError(
						'constraint',
						'この端末のデータは削除済みです。先に初期設定を完了してください。',
					);
				}
				const existing = await db.assessments.get(id);
				if (
					existing?.type === 'stage' &&
					JSON.stringify(existing.payload) === JSON.stringify(payload)
				) {
					return 'duplicate' as const;
				}
				if (existing) {
					throw new PersistenceError(
						'constraint',
						'同じattemptIdの評価が既にあります。既存データは変更していません。',
					);
				}
				const versionRecord = await db.metadata.get(`entityVersion:assessment:${id}`);
				const version = z.number().int().nonnegative().safeParse(versionRecord?.value);
				const baseVersion = version.success ? version.data : 0;
				const assessment: AssessmentRecord = {
					id,
					type: 'stage',
					completedAt: payload.completedAt,
					payload,
				};
				await db.assessments.put(assessment);
				await enqueueOutbox('assessment', id, 'upsert', assessment, baseVersion, now);
				await db.metadata.put({
					key: `entityVersion:assessment:${id}`,
					value: baseVersion + 1,
					updatedAt: now,
				});
				await nextRevision(now);
				return 'created' as const;
			},
		);
		if (outcome === 'created') broadcastRevision();
		return outcome;
	} catch (error) {
		throw persistenceError(error);
	}
}

let broadcastChannel: BroadcastChannel | undefined;

function getBroadcastChannel(): BroadcastChannel | undefined {
	if (typeof BroadcastChannel === 'undefined') return undefined;
	broadcastChannel ??= new BroadcastChannel(persistenceBroadcastChannel);
	return broadcastChannel;
}

function broadcastRevision(): void {
	getBroadcastChannel()?.postMessage({ type: 'committed' });
}

export function subscribeToPersistenceChanges(listener: () => void): () => void {
	const channel = getBroadcastChannel();
	if (!channel) return () => undefined;
	const handler = (event: MessageEvent<unknown>) => {
		const parsed = z.object({ type: z.literal('committed') }).safeParse(event.data);
		if (parsed.success) listener();
	};
	channel.addEventListener('message', handler);
	return () => channel.removeEventListener('message', handler);
}

export function persistenceFailureMessage(error: unknown): string {
	return persistenceError(error).userMessage;
}
