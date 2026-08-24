import Dexie from 'dexie';
import { z } from 'zod';
import { SUPPORTED_CURRICULUM_DAY_MAX } from '../curriculum/constants';
import { LegacyAppDataSchema, sanitizeLegacyData } from '../domain/appData';
import { StageAssessmentSchema } from '../domain/assessment';
import { addStudyDays, studyDateAt } from '../domain/calendar';
import { reconstructReviewHistory } from '../domain/srs';
import { parseStrictJson } from '../lib/strictJson';
import {
	BaselineAssessmentSchema,
	ExternalSessionJsonSchema,
	IanaTimeZoneSchema,
	WeeklyAssessmentSchema,
} from '../lib/schemas';
import {
	db,
	effectiveActiveCurriculumTotalDays,
	type AcquisitionEventRecord,
	type AssessmentRecord,
	type DailyProgressRecord,
	type GrammarProgressRecord,
	type LearnerProfileRecord,
	type LearningEventRecord,
	type LearningItemRecord,
	type OutboxRecord,
	type ReviewCardRecord,
	type ReviewEventRecord,
	type SessionRecord,
	type SettingsRecord,
	type StoredMistakeRecord,
} from './db';

const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
const BACKUP_SCHEMA_VERSION = '2.0' as const;
const APPLICATION_VERSION = '1.0' as const;
const DATABASE_SCHEMA_VERSION = 5;
const CURRENT_ID = 'current' as const;

const TimestampSchema = z
	.string()
	.min(1)
	.max(64)
	.refine((value) => Number.isFinite(Date.parse(value)), '日時が不正です');
const IdSchema = z.string().min(1).max(128);

const LearnerProfileSchema = z
	.object({
		id: z.literal(CURRENT_ID),
		onboarded: z.boolean(),
		learnerName: z.string().max(200),
		goal: z.string().max(500),
		timeZone: IanaTimeZoneSchema,
		startDate: z.iso.date(),
		currentDay: z.number().int().min(1).max(SUPPORTED_CURRICULUM_DAY_MAX),
		streak: z.number().int().nonnegative().max(10_000),
		updatedAt: TimestampSchema,
	})
	.strict();

const SettingsSchema = z
	.object({
		id: z.literal(CURRENT_ID),
		dailyMinutes: z.number().int().min(1).max(240),
		syncEnabled: z.boolean(),
		reduceMotion: z.boolean(),
		updatedAt: TimestampSchema,
	})
	.strict();

const DailyProgressSchema = z
	.object({
		id: IdSchema,
		studyDate: z.iso.date(),
		curriculumDay: z.number().int().min(1).max(SUPPORTED_CURRICULUM_DAY_MAX),
		reviewsCompleted: z.boolean(),
		grammarCompleted: z.boolean(),
		coreSessionImported: z.boolean(),
		coreCompleted: z.boolean(),
		version: z.number().int().nonnegative(),
		updatedAt: TimestampSchema,
	})
	.strict();

const LearningEventSchema = z
	.object({
		eventId: IdSchema,
		type: z.string().min(1).max(128),
		studyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
		curriculumDay: z.number().int().min(1).max(SUPPORTED_CURRICULUM_DAY_MAX),
		payload: z.object({}).strict(),
		createdAt: TimestampSchema,
	})
	.strict();

const SessionSchema = z
	.object({
		sessionId: IdSchema,
		kind: z.enum(['core', 'boost']),
		completedAt: TimestampSchema,
		durationMinutes: z.number().int().min(1).max(120),
		summary: z.string().min(1).max(1_000),
		score: z.number().min(0).max(100),
		mistakes: z.array(z.string().max(1_000)).max(20),
		payload: ExternalSessionJsonSchema.optional(),
		studyDate: z.iso.date().optional(),
		canonicalContentHash: z
			.string()
			.regex(/^[a-f0-9]{64}$/u)
			.optional(),
	})
	.strict();

const MistakeSchema = z
	.object({
		id: IdSchema,
		category: z.string().min(1).max(128),
		original: z.string().max(1_000),
		correction: z.string().max(1_000),
		repetitions: z.number().int().nonnegative().max(10_000),
		sessionId: IdSchema.optional(),
	})
	.strict();

const LearningItemSchema = z
	.object({
		id: IdSchema,
		kind: z.enum(['vocabulary', 'phrase']),
		canonicalText: z.string().min(1).max(500),
		displayText: z.string().min(1).max(500),
		meaning: z.string().max(1_000).optional(),
		supportLanguage: z.enum(['ja', 'en']).optional(),
		meaningJa: z.string().max(1_000).optional(),
		status: z.enum(['new', 'learning', 'learned', 'previewed']),
		updatedAt: TimestampSchema,
	})
	.strict()
	.refine((value) => Boolean(value.meaning || value.meaningJa), 'A meaning is required.');

const AcquisitionEventSchema = z
	.object({
		eventId: IdSchema,
		studyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
		kind: z.enum(['vocabulary', 'phrase', 'grammar-preview']),
		entityId: IdSchema,
		sourceSessionId: IdSchema.optional(),
		createdAt: TimestampSchema,
	})
	.strict();

const ReviewCardSchema = z
	.object({
		id: IdSchema,
		front: z.string().min(1).max(1_000),
		back: z.string().min(1).max(1_000),
		dueAt: TimestampSchema,
		state: z.enum(['new', 'learning', 'review', 'relearning', 'previewed', 'suspended']),
		sourceType: z.enum(['vocabulary', 'phrase', 'mistake', 'session']),
		sourceId: IdSchema,
		stabilityLevel: z.number().int().nonnegative().max(10_000),
		lapses: z.number().int().nonnegative().max(10_000),
		lastReviewedAt: TimestampSchema.optional(),
		algorithmVersion: z.literal(1),
		version: z.number().int().nonnegative(),
		updatedAt: TimestampSchema,
	})
	.strict();

const ReviewEventSchema = z
	.object({
		eventId: IdSchema,
		cardId: IdSchema,
		grade: z.enum(['again', 'hard', 'good', 'easy']),
		occurredAt: TimestampSchema,
		studyDate: z.iso.date(),
		curriculumDay: z.number().int().min(1).max(SUPPORTED_CURRICULUM_DAY_MAX),
		algorithmVersion: z.literal(1),
		before: z
			.object({
				id: IdSchema,
				front: z.string().min(1).max(1_000),
				back: z.string().min(1).max(1_000),
				dueAt: TimestampSchema,
				state: z.enum(['new', 'learning', 'review', 'relearning', 'previewed', 'suspended']),
				stabilityLevel: z.number().int().nonnegative(),
				lapses: z.number().int().nonnegative(),
				lastReviewedAt: TimestampSchema.optional(),
				version: z.number().int().nonnegative(),
			})
			.strict(),
		after: z
			.object({
				id: IdSchema,
				front: z.string().min(1).max(1_000),
				back: z.string().min(1).max(1_000),
				dueAt: TimestampSchema,
				state: z.enum(['new', 'learning', 'review', 'relearning', 'previewed', 'suspended']),
				stabilityLevel: z.number().int().nonnegative(),
				lapses: z.number().int().nonnegative(),
				lastReviewedAt: TimestampSchema.optional(),
				version: z.number().int().nonnegative(),
			})
			.strict(),
	})
	.strict();

const GrammarProgressSchema = z
	.object({
		id: IdSchema,
		curriculumDay: z.number().int().min(1).max(SUPPORTED_CURRICULUM_DAY_MAX),
		status: z.enum(['previewed', 'completed']),
		updatedAt: TimestampSchema,
	})
	.strict();

const AssessmentSchema = z.discriminatedUnion('type', [
	z
		.object({
			id: IdSchema,
			type: z.literal('baseline'),
			completedAt: TimestampSchema,
			payload: BaselineAssessmentSchema,
		})
		.strict(),
	z
		.object({
			id: IdSchema,
			type: z.literal('weekly'),
			completedAt: TimestampSchema,
			payload: WeeklyAssessmentSchema,
		})
		.strict(),
	z
		.object({
			id: z.string().uuid(),
			type: z.literal('stage'),
			completedAt: TimestampSchema,
			payload: StageAssessmentSchema,
		})
		.strict()
		.superRefine((value, context) => {
			if (value.id !== value.payload.attemptId) {
				context.addIssue({
					code: 'custom',
					path: ['id'],
					message: 'Assessment entity ID must match attemptId.',
				});
			}
			if (value.completedAt !== value.payload.completedAt) {
				context.addIssue({
					code: 'custom',
					path: ['completedAt'],
					message: 'Assessment completedAt must match payload completedAt.',
				});
			}
		}),
]);

const BackupDataSchema = z
	.object({
		profile: LearnerProfileSchema,
		settings: SettingsSchema,
		dailyProgress: z.array(DailyProgressSchema).max(SUPPORTED_CURRICULUM_DAY_MAX),
		learningEvents: z.array(LearningEventSchema).max(100_000),
		sessions: z.array(SessionSchema).max(10_000),
		mistakes: z.array(MistakeSchema).max(100_000),
		learningItems: z.array(LearningItemSchema).max(100_000),
		acquisitionEvents: z.array(AcquisitionEventSchema).max(100_000),
		reviewCards: z.array(ReviewCardSchema).max(100_000),
		reviewEvents: z.array(ReviewEventSchema).max(1_000_000),
		grammarProgress: z.array(GrammarProgressSchema).max(SUPPORTED_CURRICULUM_DAY_MAX * 2),
		assessments: z.array(AssessmentSchema).max(1_000),
	})
	.strict();

const CountSchema = z
	.object({
		dailyProgress: z.number().int().nonnegative(),
		learningEvents: z.number().int().nonnegative(),
		sessions: z.number().int().nonnegative(),
		mistakes: z.number().int().nonnegative(),
		learningItems: z.number().int().nonnegative(),
		acquisitionEvents: z.number().int().nonnegative(),
		reviewCards: z.number().int().nonnegative(),
		reviewEvents: z.number().int().nonnegative(),
		grammarProgress: z.number().int().nonnegative(),
		assessments: z.number().int().nonnegative(),
	})
	.strict();

const BackupEnvelopeSchema = z
	.object({
		schemaVersion: z.literal(BACKUP_SCHEMA_VERSION),
		createdAt: TimestampSchema,
		applicationVersion: z.literal(APPLICATION_VERSION),
		integrity: z
			.object({
				algorithm: z.literal('SHA-256'),
				canonicalization: z.literal('json-key-sort-v1'),
				sha256: z.string().regex(/^[a-f0-9]{64}$/u),
				counts: CountSchema,
				totalRecords: z.number().int().nonnegative(),
			})
			.strict(),
		data: BackupDataSchema,
	})
	.strict();

export interface BackupData {
	profile: LearnerProfileRecord;
	settings: SettingsRecord;
	dailyProgress: DailyProgressRecord[];
	learningEvents: LearningEventRecord[];
	sessions: SessionRecord[];
	mistakes: StoredMistakeRecord[];
	learningItems: LearningItemRecord[];
	acquisitionEvents: AcquisitionEventRecord[];
	reviewCards: ReviewCardRecord[];
	reviewEvents: ReviewEventRecord[];
	grammarProgress: GrammarProgressRecord[];
	assessments: AssessmentRecord[];
}

export interface BackupCounts {
	dailyProgress: number;
	learningEvents: number;
	sessions: number;
	mistakes: number;
	learningItems: number;
	acquisitionEvents: number;
	reviewCards: number;
	reviewEvents: number;
	grammarProgress: number;
	assessments: number;
}

export interface BackupEnvelope {
	schemaVersion: typeof BACKUP_SCHEMA_VERSION;
	createdAt: string;
	applicationVersion: typeof APPLICATION_VERSION;
	integrity: {
		algorithm: 'SHA-256';
		canonicalization: 'json-key-sort-v1';
		sha256: string;
		counts: BackupCounts;
		totalRecords: number;
	};
	data: BackupData;
}

export interface BackupImpact {
	incoming: number;
	add: number;
	update: number;
	remove: number;
}

export interface BackupPreview {
	envelope: BackupEnvelope;
	baseRevision: number;
	impact: Record<keyof BackupCounts, BackupImpact>;
}

const syncEntityTypes = [
	'profile-settings',
	'daily-progress',
	'learning-event',
	'session',
	'mistake',
	'learning-item',
	'acquisition-event',
	'review-card',
	'review-event',
	'grammar-progress',
	'assessment',
] as const;

function incomingSyncIds(data: BackupData): Map<string, Set<string>> {
	return new Map([
		['profile-settings', new Set([CURRENT_ID])],
		['daily-progress', new Set(data.dailyProgress.map((item) => item.id))],
		['learning-event', new Set(data.learningEvents.map((item) => item.eventId))],
		['session', new Set(data.sessions.map((item) => item.sessionId))],
		['mistake', new Set(data.mistakes.map((item) => item.id))],
		['learning-item', new Set(data.learningItems.map((item) => item.id))],
		['acquisition-event', new Set(data.acquisitionEvents.map((item) => item.eventId))],
		['review-card', new Set(data.reviewCards.map((item) => item.id))],
		['review-event', new Set(data.reviewEvents.map((item) => item.eventId))],
		['grammar-progress', new Set(data.grammarProgress.map((item) => item.id))],
		['assessment', new Set(data.assessments.map((item) => item.id))],
	]);
}

function parseRemoteVersionKey(key: string): { entityType: string; entityId: string } | null {
	for (const entityType of syncEntityTypes) {
		const prefix = `remoteVersion:${entityType}:`;
		if (key.startsWith(prefix) && key.length > prefix.length) {
			return { entityType, entityId: key.slice(prefix.length) };
		}
	}
	return null;
}

export class BackupValidationError extends Error {
	constructor(message: string, cause?: unknown) {
		super(message, { cause });
		this.name = 'BackupValidationError';
	}
}

function assertBackupWithinActiveCurriculum(data: BackupData, activeTotalDays: number): void {
	const days: Array<{ day: number; label: string }> = [
		{ day: data.profile.currentDay, label: 'プロフィール' },
		...data.dailyProgress.map((item) => ({
			day: item.curriculumDay,
			label: `日次進捗「${item.id}」`,
		})),
		...data.learningEvents.map((item) => ({
			day: item.curriculumDay,
			label: `学習イベント「${item.eventId}」`,
		})),
		...data.reviewEvents.map((item) => ({
			day: item.curriculumDay,
			label: `復習イベント「${item.eventId}」`,
		})),
		...data.grammarProgress.map((item) => ({
			day: item.curriculumDay,
			label: `文法進捗「${item.id}」`,
		})),
	];
	for (const session of data.sessions) {
		if (!session.payload) continue;
		days.push({
			day: ExternalSessionJsonSchema.parse(session.payload).curriculumDay,
			label: `セッション「${session.sessionId}」`,
		});
	}
	for (const assessment of data.assessments) {
		if (assessment.type === 'weekly') {
			const weekly = WeeklyAssessmentSchema.parse(assessment.payload);
			days.push(
				{ day: weekly.startDay, label: `アセスメント「${assessment.id}」` },
				{ day: weekly.endDay, label: `アセスメント「${assessment.id}」` },
			);
		} else if (assessment.type === 'stage') {
			const stage = StageAssessmentSchema.parse(assessment.payload);
			days.push(
				{ day: stage.curriculumRange.startDay, label: `アセスメント「${assessment.id}」` },
				{ day: stage.curriculumRange.endDay, label: `アセスメント「${assessment.id}」` },
			);
		}
	}
	const invalid = days.find(({ day }) => day > activeTotalDays);
	if (invalid) {
		throw new BackupValidationError(
			`${invalid.label}のDay ${invalid.day}は現在有効なDay ${activeTotalDays}を超えています。端末内データは変更していません。`,
		);
	}
}

const dataTables = () => [
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
];

function canonicalize(value: unknown): unknown {
	if (Array.isArray(value)) return value.map((item) => canonicalize(item));
	if (value && typeof value === 'object') {
		const result: Record<string, unknown> = {};
		for (const key of Object.keys(value).sort()) {
			const child = (value as Record<string, unknown>)[key];
			if (child !== undefined) result[key] = canonicalize(child);
		}
		return result;
	}
	return value;
}

function canonicalJson(value: unknown): string {
	return JSON.stringify(canonicalize(value));
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

async function sha256(value: unknown): Promise<string> {
	const bytes = new TextEncoder().encode(canonicalJson(value));
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function countsFor(data: BackupData): BackupCounts {
	return {
		dailyProgress: data.dailyProgress.length,
		learningEvents: data.learningEvents.length,
		sessions: data.sessions.length,
		mistakes: data.mistakes.length,
		learningItems: data.learningItems.length,
		acquisitionEvents: data.acquisitionEvents.length,
		reviewCards: data.reviewCards.length,
		reviewEvents: data.reviewEvents.length,
		grammarProgress: data.grammarProgress.length,
		assessments: data.assessments.length,
	};
}

function totalCounts(counts: BackupCounts): number {
	return Object.values(counts).reduce((total, count) => total + count, 0) + 2;
}

function sortBy<T>(items: T[], key: (item: T) => string): T[] {
	return [...items].sort((left, right) => key(left).localeCompare(key(right)));
}

async function readBackupData(): Promise<{ data: BackupData; revision: number }> {
	return db.transaction('r', [db.metadata, ...dataTables()], async () => {
		const [
			profile,
			settings,
			dailyProgress,
			learningEvents,
			sessions,
			mistakes,
			learningItems,
			acquisitionEvents,
			reviewCards,
			reviewEvents,
			grammarProgress,
			assessments,
			revisionRecord,
		] = await Promise.all([
			db.learnerProfiles.get(CURRENT_ID),
			db.settings.get(CURRENT_ID),
			db.dailyProgress.toArray(),
			db.learningEvents.toArray(),
			db.sessions.toArray(),
			db.mistakes.toArray(),
			db.learningItems.toArray(),
			db.acquisitionEvents.toArray(),
			db.reviewCards.toArray(),
			db.reviewEvents.toArray(),
			db.grammarProgress.toArray(),
			db.assessments.toArray(),
			db.metadata.get('localRevision'),
		]);
		if (!profile || !settings) {
			throw new BackupValidationError(
				'初期設定が完了していないため、バックアップを作成できません。',
			);
		}
		const revisionResult = z.number().int().nonnegative().safeParse(revisionRecord?.value);
		return {
			revision: revisionResult.success ? revisionResult.data : 0,
			data: {
				profile,
				settings,
				dailyProgress: sortBy(dailyProgress, (item) => item.id),
				learningEvents: sortBy(learningEvents, (item) => item.eventId),
				sessions: sortBy(sessions, (item) => item.sessionId),
				mistakes: sortBy(mistakes, (item) => item.id),
				learningItems: sortBy(learningItems, (item) => item.id),
				acquisitionEvents: sortBy(acquisitionEvents, (item) => item.eventId),
				reviewCards: sortBy(reviewCards, (item) => item.id),
				reviewEvents: sortBy(reviewEvents, (item) => item.eventId),
				grammarProgress: sortBy(grammarProgress, (item) => item.id),
				assessments: sortBy(assessments, (item) => item.id),
			},
		};
	});
}

function assertUnique<T>(items: T[], key: (item: T) => string, label: string): void {
	const seen = new Set<string>();
	for (const item of items) {
		const id = key(item);
		if (seen.has(id)) throw new BackupValidationError(`${label}に重複ID「${id}」があります。`);
		seen.add(id);
	}
}

async function validateSemantics(data: BackupData): Promise<void> {
	assertUnique(data.dailyProgress, (item) => item.id, '日次進捗');
	assertUnique(data.learningEvents, (item) => item.eventId, '学習イベント');
	assertUnique(data.sessions, (item) => item.sessionId, 'セッション');
	assertUnique(data.mistakes, (item) => item.id, '間違い');
	assertUnique(data.learningItems, (item) => item.id, '学習項目');
	assertUnique(data.acquisitionEvents, (item) => item.eventId, '獲得イベント');
	assertUnique(data.reviewCards, (item) => item.id, '復習カード');
	assertUnique(data.reviewEvents, (item) => item.eventId, '復習イベント');
	assertUnique(data.grammarProgress, (item) => item.id, '文法進捗');
	assertUnique(data.assessments, (item) => item.id, 'アセスメント');

	const sessions = new Set(data.sessions.map((item) => item.sessionId));
	const learningItems = new Map(data.learningItems.map((item) => [item.id, item]));
	const cards = new Map(data.reviewCards.map((item) => [item.id, item]));
	const mistakes = new Set(data.mistakes.map((item) => item.id));
	const grammarProgress = new Set(data.grammarProgress.map((item) => item.id));
	const completedCurriculumDays = new Set<number>();
	for (const progress of data.dailyProgress) {
		if (progress.id !== `study:${progress.studyDate}:curriculum:${progress.curriculumDay}`) {
			throw new BackupValidationError(`日次進捗「${progress.id}」のIDと日付・Dayが一致しません。`);
		}
		if (
			progress.coreCompleted !==
			(progress.reviewsCompleted && progress.grammarCompleted && progress.coreSessionImported)
		) {
			throw new BackupValidationError(`日次進捗「${progress.id}」のCore証跡が矛盾しています。`);
		}
		if (progress.coreCompleted) {
			if (completedCurriculumDays.has(progress.curriculumDay)) {
				throw new BackupValidationError(
					`カリキュラム日「${progress.curriculumDay}」に完了済みの日次進捗が複数あります。`,
				);
			}
			completedCurriculumDays.add(progress.curriculumDay);
		}
	}
	for (const session of data.sessions) {
		if (session.payload) {
			const payload = ExternalSessionJsonSchema.parse(session.payload);
			if (payload.sessionId !== session.sessionId || payload.sessionType !== session.kind) {
				throw new BackupValidationError(
					`セッション「${session.sessionId}」の構造化payloadが一致しません。`,
				);
			}
			if (session.canonicalContentHash) {
				const actual = await sha256(canonicalSessionValue(payload));
				if (actual !== session.canonicalContentHash) {
					throw new BackupValidationError(
						`セッション「${session.sessionId}」のcanonical hashが一致しません。`,
					);
				}
			}
		}
	}
	for (const item of data.learningItems) {
		const canonical = item.displayText
			.normalize('NFKC')
			.trim()
			.toLocaleLowerCase('en-US')
			.replace(/\s+/gu, ' ');
		if (item.canonicalText !== canonical) {
			throw new BackupValidationError(`学習項目「${item.id}」のcanonical identityが不正です。`);
		}
	}
	for (const mistake of data.mistakes) {
		if (mistake.sessionId && !sessions.has(mistake.sessionId)) {
			throw new BackupValidationError(`間違い「${mistake.id}」の参照先セッションがありません。`);
		}
	}
	for (const event of data.acquisitionEvents) {
		if (event.sourceSessionId && !sessions.has(event.sourceSessionId)) {
			throw new BackupValidationError(`獲得イベント「${event.eventId}」の参照先がありません。`);
		}
		if (event.kind === 'grammar-preview') {
			if (!grammarProgress.has(`preview:${event.entityId}`)) {
				throw new BackupValidationError(`獲得イベント「${event.eventId}」の文法予習がありません。`);
			}
		} else if (learningItems.get(event.entityId)?.kind !== event.kind) {
			throw new BackupValidationError(`獲得イベント「${event.eventId}」の学習項目が一致しません。`);
		}
	}
	for (const card of data.reviewCards) {
		const sourceExists =
			card.sourceType === 'mistake'
				? mistakes.has(card.sourceId)
				: card.sourceType === 'session'
					? sessions.has(card.sourceId)
					: learningItems.get(card.sourceId)?.kind === card.sourceType;
		if (!sourceExists) {
			throw new BackupValidationError(`復習カード「${card.id}」の参照元がありません。`);
		}
	}
	const eventsByCard = new Map<string, ReviewEventRecord[]>();
	for (const event of data.reviewEvents) {
		if (!cards.has(event.cardId)) {
			throw new BackupValidationError(`復習イベント「${event.eventId}」のカードがありません。`);
		}
		if (event.before.id !== event.cardId || event.after.id !== event.cardId) {
			throw new BackupValidationError(`復習イベント「${event.eventId}」のsnapshot IDが不正です。`);
		}
		eventsByCard.set(event.cardId, [...(eventsByCard.get(event.cardId) ?? []), event]);
	}
	for (const [cardId, events] of eventsByCard) {
		let reconstructed;
		try {
			reconstructed = reconstructReviewHistory(events, data.profile.timeZone);
		} catch (error) {
			throw new BackupValidationError(`復習カード「${cardId}」の履歴を再計算できません。`, error);
		}
		const card = cards.get(cardId);
		if (
			!reconstructed ||
			!card ||
			reconstructed.version !== card.version ||
			reconstructed.state !== card.state ||
			reconstructed.dueAt !== card.dueAt ||
			reconstructed.stabilityLevel !== card.stabilityLevel ||
			reconstructed.lapses !== card.lapses
		) {
			throw new BackupValidationError(`復習カード「${cardId}」とイベント履歴が一致しません。`);
		}
	}

	const dailyLimits = new Map<string, { vocabulary: number; phrase: number; grammar: number }>();
	for (const event of data.acquisitionEvents) {
		const values = dailyLimits.get(event.studyDate) ?? { vocabulary: 0, phrase: 0, grammar: 0 };
		if (event.kind === 'vocabulary') values.vocabulary += 1;
		if (event.kind === 'phrase') values.phrase += 1;
		if (event.kind === 'grammar-preview') values.grammar += 1;
		dailyLimits.set(event.studyDate, values);
	}
	for (const [studyDate, values] of dailyLimits) {
		if (values.vocabulary > 8 || values.phrase > 3 || values.grammar > 1) {
			throw new BackupValidationError(
				`${studyDate} の新規獲得数が上限（単語8・定型表現3・文法プレビュー1）を超えています。`,
			);
		}
	}
}

function sameCounts(left: BackupCounts, right: BackupCounts): boolean {
	return (Object.keys(left) as Array<keyof BackupCounts>).every((key) => left[key] === right[key]);
}

function idSets(data: BackupData): Record<keyof BackupCounts, Set<string>> {
	return {
		dailyProgress: new Set(data.dailyProgress.map((item) => item.id)),
		learningEvents: new Set(data.learningEvents.map((item) => item.eventId)),
		sessions: new Set(data.sessions.map((item) => item.sessionId)),
		mistakes: new Set(data.mistakes.map((item) => item.id)),
		learningItems: new Set(data.learningItems.map((item) => item.id)),
		acquisitionEvents: new Set(data.acquisitionEvents.map((item) => item.eventId)),
		reviewCards: new Set(data.reviewCards.map((item) => item.id)),
		reviewEvents: new Set(data.reviewEvents.map((item) => item.eventId)),
		grammarProgress: new Set(data.grammarProgress.map((item) => item.id)),
		assessments: new Set(data.assessments.map((item) => item.id)),
	};
}

function calculateImpact(current: BackupData, incoming: BackupData): BackupPreview['impact'] {
	const currentIds = idSets(current);
	const incomingIds = idSets(incoming);
	return Object.fromEntries(
		(Object.keys(currentIds) as Array<keyof BackupCounts>).map((key) => {
			const common = [...incomingIds[key]].filter((id) => currentIds[key].has(id)).length;
			return [
				key,
				{
					incoming: incomingIds[key].size,
					add: incomingIds[key].size - common,
					update: common,
					remove: currentIds[key].size - common,
				},
			];
		}),
	) as BackupPreview['impact'];
}

export async function createBackupText(): Promise<string> {
	const { data } = await readBackupData();
	assertBackupWithinActiveCurriculum(data, await effectiveActiveCurriculumTotalDays());
	await validateSemantics(data);
	const counts = countsFor(data);
	const envelope: BackupEnvelope = {
		schemaVersion: BACKUP_SCHEMA_VERSION,
		createdAt: new Date().toISOString(),
		applicationVersion: APPLICATION_VERSION,
		integrity: {
			algorithm: 'SHA-256',
			canonicalization: 'json-key-sort-v1',
			sha256: await sha256(data),
			counts,
			totalRecords: totalCounts(counts),
		},
		data,
	};
	return JSON.stringify(envelope, null, 2);
}

async function legacyEnvelope(value: unknown): Promise<BackupEnvelope | null> {
	const parsed = LegacyAppDataSchema.safeParse(value);
	if (!parsed.success) return null;
	const legacy = sanitizeLegacyData(parsed.data);
	const now = new Date().toISOString();
	const timeZone = 'Asia/Tokyo';
	const today = studyDateAt(now, timeZone);
	const startDate = addStudyDays(today, -(legacy.currentDay - 1));
	const progressDays = Array.from(new Set([...legacy.completedDays, legacy.currentDay])).sort(
		(left, right) => left - right,
	);
	const data: BackupData = {
		profile: {
			id: CURRENT_ID,
			onboarded: legacy.onboarded,
			learnerName: legacy.learnerName,
			goal: legacy.goal,
			timeZone,
			startDate,
			currentDay: legacy.currentDay,
			streak: legacy.streak,
			updatedAt: now,
		},
		settings: {
			id: CURRENT_ID,
			dailyMinutes: legacy.dailyMinutes,
			syncEnabled: legacy.syncEnabled,
			reduceMotion: legacy.reduceMotion,
			updatedAt: now,
		},
		dailyProgress: progressDays.map((curriculumDay) => {
			const current = curriculumDay === legacy.currentDay;
			const completed =
				legacy.completedDays.includes(curriculumDay) ||
				(current && legacy.core.reviews && legacy.core.grammar && legacy.core.import);
			const studyDate = addStudyDays(startDate, curriculumDay - 1);
			return {
				id: `study:${studyDate}:curriculum:${curriculumDay}`,
				studyDate,
				curriculumDay,
				reviewsCompleted: completed || (current && legacy.core.reviews),
				grammarCompleted: completed || (current && legacy.core.grammar),
				coreSessionImported: completed || (current && legacy.core.import),
				coreCompleted: completed,
				version: 1,
				updatedAt: now,
			};
		}),
		learningEvents: [],
		sessions: legacy.sessions.map((session) => {
			const { payload: rawPayload, ...safeSession } = session;
			const payload = ExternalSessionJsonSchema.safeParse(rawPayload);
			return {
				...safeSession,
				...(payload.success ? { payload: payload.data } : {}),
				studyDate: studyDateAt(session.completedAt, timeZone),
			};
		}),
		mistakes: legacy.mistakes,
		learningItems: [],
		acquisitionEvents: [],
		reviewCards: [],
		reviewEvents: [],
		grammarProgress: legacy.previewedDays.map((curriculumDay) => ({
			id: `preview:d${curriculumDay}-grammar`,
			curriculumDay,
			status: 'previewed',
			updatedAt: now,
		})),
		assessments: [],
	};
	const validated = BackupDataSchema.parse(data) as BackupData;
	await validateSemantics(validated);
	const counts = countsFor(validated);
	return {
		schemaVersion: BACKUP_SCHEMA_VERSION,
		createdAt: now,
		applicationVersion: APPLICATION_VERSION,
		integrity: {
			algorithm: 'SHA-256',
			canonicalization: 'json-key-sort-v1',
			sha256: await sha256(validated),
			counts,
			totalRecords: totalCounts(counts),
		},
		data: validated,
	};
}

export async function previewBackupText(source: string): Promise<BackupPreview> {
	if (new TextEncoder().encode(source).byteLength > MAX_BACKUP_BYTES) {
		throw new BackupValidationError('バックアップファイルが20MBを超えています。');
	}
	let parsed: unknown;
	try {
		parsed = parseStrictJson(source);
	} catch (error) {
		throw new BackupValidationError(
			'JSONを厳格に解析できません。重複キーや不正な形式を確認してください。',
			error,
		);
	}
	const result = BackupEnvelopeSchema.safeParse(parsed);
	const envelope = result.success ? (result.data as BackupEnvelope) : await legacyEnvelope(parsed);
	if (!envelope) {
		throw new BackupValidationError(
			`Trellune v2または完全な旧v1バックアップ形式ではありません: ${result.success ? '形式エラー' : (result.error.issues[0]?.message ?? '形式エラー')}`,
		);
	}
	assertBackupWithinActiveCurriculum(envelope.data, await effectiveActiveCurriculumTotalDays());
	await validateSemantics(envelope.data);
	const actualCounts = countsFor(envelope.data);
	if (
		!sameCounts(envelope.integrity.counts, actualCounts) ||
		envelope.integrity.totalRecords !== totalCounts(actualCounts)
	) {
		throw new BackupValidationError('バックアップの件数情報が内容と一致しません。');
	}
	if ((await sha256(envelope.data)) !== envelope.integrity.sha256) {
		throw new BackupValidationError(
			'バックアップのSHA-256が一致しません。改ざんまたは破損の可能性があります。',
		);
	}
	const current = await readBackupData();
	return {
		envelope,
		baseRevision: current.revision,
		impact: calculateImpact(current.data, envelope.data),
	};
}

async function bulkPutIfAny<T>(items: T[], put: (items: T[]) => Promise<unknown>): Promise<void> {
	if (items.length) await put(items);
}

export async function applyBackupPreview(preview: BackupPreview): Promise<void> {
	const now = new Date().toISOString();
	await db.transaction(
		'rw',
		[db.metadata, ...dataTables(), db.outbox, db.conflicts, db.syncState],
		async () => {
			if (await db.metadata.get('localDataDeleted')) {
				throw new BackupValidationError(
					'この端末のデータは削除済みです。初期設定後にバックアップをもう一度確認してください。',
				);
			}
			assertBackupWithinActiveCurriculum(
				preview.envelope.data,
				await effectiveActiveCurriculumTotalDays(),
			);
			const revisionRecord = await db.metadata.get('localRevision');
			const revisionResult = z.number().int().nonnegative().safeParse(revisionRecord?.value);
			const currentRevision = revisionResult.success ? revisionResult.data : 0;
			if (currentRevision !== preview.baseRevision) {
				throw new BackupValidationError(
					'プレビュー後に端末内データが変更されました。安全のため、ファイルをもう一度確認してください。',
				);
			}
			const remoteVersions = await db.metadata.where('key').startsWith('remoteVersion:').toArray();
			const deviceIdResult = z
				.string()
				.uuid()
				.safeParse((await db.metadata.get('deviceId'))?.value);
			const deviceId = deviceIdResult.success ? deviceIdResult.data : crypto.randomUUID();

			for (const table of dataTables()) await table.clear();
			await db.outbox.clear();
			await db.conflicts.clear();
			await db.syncState.clear();
			const staleSyncKeys = await db.metadata
				.filter(
					(record) =>
						record.key === 'syncSeeded' ||
						record.key.startsWith('entityVersion:') ||
						record.key.startsWith('remoteVersion:'),
				)
				.primaryKeys();
			if (staleSyncKeys.length) await db.metadata.bulkDelete(staleSyncKeys);

			const data = preview.envelope.data;
			await db.learnerProfiles.put(data.profile);
			await db.settings.put(data.settings);
			await bulkPutIfAny(data.dailyProgress, (items) => db.dailyProgress.bulkPut(items));
			await bulkPutIfAny(data.learningEvents, (items) => db.learningEvents.bulkPut(items));
			await bulkPutIfAny(data.sessions, (items) => db.sessions.bulkPut(items));
			await bulkPutIfAny(data.mistakes, (items) => db.mistakes.bulkPut(items));
			await bulkPutIfAny(data.learningItems, (items) => db.learningItems.bulkPut(items));
			await bulkPutIfAny(data.acquisitionEvents, (items) => db.acquisitionEvents.bulkPut(items));
			await bulkPutIfAny(data.reviewCards, (items) => db.reviewCards.bulkPut(items));
			await bulkPutIfAny(data.reviewEvents, (items) => db.reviewEvents.bulkPut(items));
			await bulkPutIfAny(data.grammarProgress, (items) => db.grammarProgress.bulkPut(items));
			await bulkPutIfAny(data.assessments, (items) => db.assessments.bulkPut(items));

			await db.metadata.put({
				key: 'bootstrapComplete',
				value: { schemaVersion: DATABASE_SCHEMA_VERSION, migration: false },
				updatedAt: now,
			});
			await db.metadata.put({ key: 'localRevision', value: currentRevision + 1, updatedAt: now });
			const incomingIds = incomingSyncIds(data);
			const incomingEntityKeys = Array.from(incomingIds.entries())
				.flatMap(([entityType, ids]) => Array.from(ids, (entityId) => `${entityType}:${entityId}`))
				.sort();
			await db.metadata.put({
				key: 'lastBackupRestore',
				value: {
					restoredAt: now,
					sha256: preview.envelope.integrity.sha256,
					requiresRemoteReconciliation: true,
					incomingEntityKeys,
				},
				updatedAt: now,
			});

			const tombstones: OutboxRecord[] = [];
			for (const remoteVersion of remoteVersions) {
				const remote = parseRemoteVersionKey(remoteVersion.key);
				const version = z.number().int().nonnegative().safeParse(remoteVersion.value);
				if (
					!remote ||
					!version.success ||
					remote.entityType === 'profile-settings' ||
					incomingIds.get(remote.entityType)?.has(remote.entityId)
				) {
					continue;
				}
				tombstones.push({
					operationId: crypto.randomUUID(),
					schemaVersion: 1,
					deviceId,
					entityType: remote.entityType,
					entityId: remote.entityId,
					operationType: 'delete',
					payload: null,
					baseVersion: version.data,
					createdAt: now,
					attempts: 0,
					nextAttemptAt: now,
					status: 'pending',
				});
			}
			if (tombstones.length) await db.outbox.bulkAdd(tombstones);

			const readbackData = (await readBackupData()).data;
			await Dexie.waitFor(validateSemantics(readbackData));
			const readback = countsFor(readbackData);
			const readbackHash = await Dexie.waitFor(sha256(readbackData));
			if (
				!sameCounts(readback, preview.envelope.integrity.counts) ||
				readbackHash !== preview.envelope.integrity.sha256
			) {
				throw new BackupValidationError('復元後の完全性検証に失敗しました。元データへ戻しました。');
			}
		},
	);
	notifyBackupCommit();
}

function notifyBackupCommit(): void {
	if (typeof BroadcastChannel === 'undefined') return;
	const channel = new BroadcastChannel('english-os-database-v2');
	channel.postMessage({ type: 'committed' });
	channel.close();
}

export function backupFailureMessage(error: unknown): string {
	if (error instanceof BackupValidationError) return error.message;
	return '復元処理を完了できませんでした。端末内の元データは変更していません。';
}

export function assertBackupFileSize(byteLength: number): void {
	if (!Number.isFinite(byteLength) || byteLength < 0 || byteLength > MAX_BACKUP_BYTES) {
		throw new BackupValidationError('バックアップファイルが20MBを超えています。');
	}
}
