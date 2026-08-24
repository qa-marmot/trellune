import { z } from 'zod';
import { SUPPORTED_CURRICULUM_DAY_MAX } from '../curriculum/constants';
import { StageAssessmentSchema } from '../domain/assessment';
import {
	BaselineAssessmentSchema,
	ExternalSessionJsonSchema,
	IanaTimeZoneSchema,
	WeeklyAssessmentSchema,
} from '../lib/schemas';

const IdSchema = z.string().min(1).max(128);
const TimestampSchema = z.iso.datetime({ offset: true });
const StudyDateSchema = z.iso.date();

export const SyncEntityTypeSchema = z.enum([
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
]);

export type SyncEntityType = z.infer<typeof SyncEntityTypeSchema>;

export const ProfileSettingsPayloadSchema = z
	.object({
		profile: z
			.object({
				id: z.literal('current'),
				onboarded: z.boolean(),
				learnerName: z.string().max(200),
				goal: z.string().max(500),
				timeZone: IanaTimeZoneSchema,
				startDate: StudyDateSchema,
				currentDay: z.number().int().min(1).max(SUPPORTED_CURRICULUM_DAY_MAX),
				streak: z.number().int().nonnegative().max(10_000),
				updatedAt: TimestampSchema,
			})
			.strict(),
		settings: z
			.object({
				id: z.literal('current'),
				dailyMinutes: z.number().int().min(1).max(240),
				syncEnabled: z.boolean(),
				reduceMotion: z.boolean(),
				updatedAt: TimestampSchema,
			})
			.strict(),
	})
	.strict();

export const DailyProgressPayloadSchema = z
	.object({
		id: IdSchema,
		studyDate: StudyDateSchema,
		curriculumDay: z.number().int().min(1).max(SUPPORTED_CURRICULUM_DAY_MAX),
		reviewsCompleted: z.boolean(),
		grammarCompleted: z.boolean(),
		coreSessionImported: z.boolean(),
		coreCompleted: z.boolean(),
		version: z.number().int().nonnegative(),
		updatedAt: TimestampSchema,
	})
	.strict();

export const LearningEventPayloadSchema = z
	.object({
		eventId: IdSchema,
		type: z.string().min(1).max(128),
		studyDate: StudyDateSchema,
		curriculumDay: z.number().int().min(1).max(SUPPORTED_CURRICULUM_DAY_MAX),
		payload: z.object({}).strict(),
		createdAt: TimestampSchema,
	})
	.strict();

export const SessionPayloadSchema = z
	.object({
		sessionId: IdSchema,
		kind: z.enum(['core', 'boost']),
		completedAt: TimestampSchema,
		durationMinutes: z.number().int().min(1).max(120),
		summary: z.string().min(1).max(1_000),
		score: z.number().min(0).max(100),
		mistakes: z.array(z.string().max(1_000)).max(20),
		payload: ExternalSessionJsonSchema.optional(),
		studyDate: StudyDateSchema.optional(),
		canonicalContentHash: z
			.string()
			.regex(/^[a-f0-9]{64}$/u)
			.optional(),
	})
	.strict();

export const MistakePayloadSchema = z
	.object({
		id: IdSchema,
		category: z.string().min(1).max(128),
		original: z.string().max(1_000),
		correction: z.string().max(1_000),
		repetitions: z.number().int().nonnegative().max(10_000),
		sessionId: IdSchema.optional(),
	})
	.strict();

export const LearningItemPayloadSchema = z
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
	.superRefine((value, context) => {
		if (!value.meaning && !value.meaningJa) {
			context.addIssue({ code: 'custom', path: ['meaning'], message: 'A meaning is required.' });
		}
		if (value.meaning && !value.supportLanguage) {
			context.addIssue({
				code: 'custom',
				path: ['supportLanguage'],
				message: 'supportLanguage is required for a neutral meaning.',
			});
		}
	});

export const AcquisitionEventPayloadSchema = z
	.object({
		eventId: IdSchema,
		studyDate: StudyDateSchema,
		kind: z.enum(['vocabulary', 'phrase', 'grammar-preview']),
		entityId: IdSchema,
		sourceSessionId: IdSchema.optional(),
		createdAt: TimestampSchema,
	})
	.strict();

export const ReviewCardPayloadSchema = z
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

export const ReviewEventPayloadSchema = z
	.object({
		eventId: IdSchema,
		cardId: IdSchema,
		grade: z.enum(['again', 'hard', 'good', 'easy']),
		occurredAt: TimestampSchema,
		studyDate: StudyDateSchema,
		curriculumDay: z.number().int().min(1).max(SUPPORTED_CURRICULUM_DAY_MAX),
		algorithmVersion: z.literal(1),
		before: ReviewCardPayloadSchema.omit({
			sourceType: true,
			sourceId: true,
			algorithmVersion: true,
			updatedAt: true,
		}),
		after: ReviewCardPayloadSchema.omit({
			sourceType: true,
			sourceId: true,
			algorithmVersion: true,
			updatedAt: true,
		}),
	})
	.strict();

export const GrammarProgressPayloadSchema = z
	.object({
		id: IdSchema,
		curriculumDay: z.number().int().min(1).max(SUPPORTED_CURRICULUM_DAY_MAX),
		status: z.enum(['previewed', 'completed']),
		updatedAt: TimestampSchema,
	})
	.strict();

export const AssessmentPayloadSchema = z.discriminatedUnion('type', [
	z
		.object({
			id: z.literal('baseline:current'),
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

export const SyncPayloadSchemas: Record<SyncEntityType, z.ZodType> = {
	'profile-settings': ProfileSettingsPayloadSchema,
	'daily-progress': DailyProgressPayloadSchema,
	'learning-event': LearningEventPayloadSchema,
	session: SessionPayloadSchema,
	mistake: MistakePayloadSchema,
	'learning-item': LearningItemPayloadSchema,
	'acquisition-event': AcquisitionEventPayloadSchema,
	'review-card': ReviewCardPayloadSchema,
	'review-event': ReviewEventPayloadSchema,
	'grammar-progress': GrammarProgressPayloadSchema,
	assessment: AssessmentPayloadSchema,
};

function payloadEntityId(entityType: SyncEntityType, payload: unknown): string | undefined {
	if (entityType === 'profile-settings') return 'current';
	if (!payload || typeof payload !== 'object') return undefined;
	const value = payload as Record<string, unknown>;
	const key =
		entityType === 'daily-progress' ||
		entityType === 'mistake' ||
		entityType === 'learning-item' ||
		entityType === 'review-card' ||
		entityType === 'grammar-progress' ||
		entityType === 'assessment'
			? 'id'
			: entityType === 'learning-event' ||
				  entityType === 'acquisition-event' ||
				  entityType === 'review-event'
				? 'eventId'
				: 'sessionId';
	return typeof value[key] === 'string' ? value[key] : undefined;
}

function versionedPayloadVersion(entityType: SyncEntityType, payload: unknown): number | undefined {
	if (entityType !== 'daily-progress' && entityType !== 'review-card') return undefined;
	if (!payload || typeof payload !== 'object') return undefined;
	const version = (payload as Record<string, unknown>).version;
	return typeof version === 'number' ? version : undefined;
}

const MutationBaseSchema = z
	.object({
		operationId: z.string().uuid(),
		schemaVersion: z.literal(1),
		deviceId: z.string().uuid(),
		entityType: z.literal('profile-settings'),
		entityId: z.literal('current'),
		operationType: z.literal('upsert'),
		payload: ProfileSettingsPayloadSchema,
		baseVersion: z.number().int().nonnegative().nullable(),
		createdAt: TimestampSchema,
	})
	.strict();

export const SyncMutationSchema = MutationBaseSchema.superRefine((value, context) => {
	const parsed = ProfileSettingsPayloadSchema.safeParse(value.payload);
	if (!parsed.success) {
		for (const issue of parsed.error.issues) {
			context.addIssue({
				code: 'custom',
				path: ['payload', ...issue.path],
				message: issue.message,
			});
		}
		return;
	}
	if (payloadEntityId('profile-settings', parsed.data) !== value.entityId) {
		context.addIssue({
			code: 'custom',
			path: ['entityId'],
			message: 'Entity ID does not match the payload primary key.',
		});
	}
});

export type SyncMutation = z.infer<typeof SyncMutationSchema>;

export const SyncDeletionRequestSchema = z
	.object({
		operationId: z.string().uuid(),
		schemaVersion: z.literal(1),
		deviceId: z.string().uuid(),
		entityType: SyncEntityTypeSchema.exclude(['profile-settings']),
		entityId: IdSchema,
		expectedVersion: z.number().int().nonnegative(),
		createdAt: TimestampSchema,
	})
	.strict();

export type SyncDeletionRequest = z.infer<typeof SyncDeletionRequestSchema>;

export const SyncMutationResponseSchema = z
	.object({
		data: z
			.object({
				operationId: z.string().uuid(),
				entityType: z.literal('profile-settings'),
				entityId: IdSchema,
				operation: z.literal('upsert'),
				payload: ProfileSettingsPayloadSchema,
				version: z.number().int().positive(),
				sequence: z.number().int().nonnegative(),
				replayed: z.boolean(),
				changedAt: TimestampSchema,
			})
			.strict(),
	})
	.strict();

export const SyncDeletionResponseSchema = z
	.object({
		data: z
			.object({
				operationId: z.string().uuid(),
				entityType: SyncEntityTypeSchema.exclude(['profile-settings']),
				entityId: IdSchema,
				operation: z.literal('delete'),
				payload: z.null(),
				version: z.number().int().positive(),
				sequence: z.number().int().nonnegative(),
				replayed: z.boolean(),
				changedAt: TimestampSchema,
			})
			.strict(),
	})
	.strict();

export const RemoteEntitySchema = z
	.object({
		operationId: z.string().uuid().nullable(),
		entityType: SyncEntityTypeSchema,
		entityId: IdSchema,
		operation: z.enum(['upsert', 'delete']),
		payload: z.unknown(),
		version: z.number().int().positive(),
		sequence: z.number().int().nonnegative(),
		changedAt: TimestampSchema,
	})
	.strict()
	.superRefine((value, context) => {
		if (value.operation === 'delete') {
			if (value.payload !== null) {
				context.addIssue({
					code: 'custom',
					path: ['payload'],
					message: 'Delete payload must be null.',
				});
			}
			return;
		}
		const parsed = SyncPayloadSchemas[value.entityType].safeParse(value.payload);
		if (!parsed.success) {
			context.addIssue({
				code: 'custom',
				path: ['payload'],
				message: 'Remote payload is invalid.',
			});
			return;
		}
		if (payloadEntityId(value.entityType, parsed.data) !== value.entityId) {
			context.addIssue({
				code: 'custom',
				path: ['entityId'],
				message: 'Remote entity ID mismatch.',
			});
		}
		const payloadVersion = versionedPayloadVersion(value.entityType, parsed.data);
		if (payloadVersion !== undefined && payloadVersion !== value.version) {
			context.addIssue({
				code: 'custom',
				path: ['payload', 'version'],
				message: 'Remote version mismatch.',
			});
		}
	});

export type RemoteEntity = z.infer<typeof RemoteEntitySchema>;

export const DailyProgressMutationResponseSchema = z
	.object({
		data: z
			.object({
				operationId: z.string().uuid(),
				progress: z
					.object({
						reviewCompleted: z.boolean(),
						grammarCompleted: z.boolean(),
						coreVoiceImported: z.boolean(),
						coreCompleted: z.boolean(),
					})
					.strict(),
				version: z.number().int().positive(),
				replayed: z.boolean(),
				changedAt: TimestampSchema,
			})
			.strict(),
	})
	.strict();

const AcquisitionCountsSchema = z
	.object({
		words: z.number().int().nonnegative(),
		phrases: z.number().int().nonnegative(),
		previewGrammar: z.number().int().nonnegative(),
	})
	.strict();

export const TodayResponseSchema = z
	.object({
		data: z
			.object({
				studyDate: StudyDateSchema,
				progress: z
					.object({
						reviewCompleted: z.boolean(),
						grammarCompleted: z.boolean(),
						coreVoiceImported: z.boolean(),
						coreCompleted: z.boolean(),
					})
					.strict(),
				version: z.number().int().nonnegative(),
				acquisitionCounts: AcquisitionCountsSchema,
				overdueReviewCount: z.number().int().nonnegative(),
			})
			.strict(),
	})
	.strict();

export const SessionPreviewResponseSchema = z
	.object({
		data: z
			.object({
				duplicate: z
					.object({
						importId: IdSchema,
						sameCanonicalContent: z.boolean(),
						exactIdempotentReplay: z.boolean(),
					})
					.strict()
					.nullable(),
				countsBefore: AcquisitionCountsSchema,
				countsIncoming: AcquisitionCountsSchema,
				limits: z
					.object({
						accepted: z.boolean(),
						remaining: AcquisitionCountsSchema,
						violations: z.array(
							z
								.object({
									item: z.enum(['words', 'phrases', 'previewGrammar']),
									limit: z.number().int().nonnegative(),
									attemptedTotal: z.number().int().nonnegative(),
								})
								.strict(),
						),
					})
					.strict(),
			})
			.strict(),
	})
	.strict();

export const SessionImportMutationResponseSchema = z
	.object({
		data: z
			.object({
				operationId: z.string().uuid(),
				importId: z.string().uuid(),
				replayed: z.boolean(),
				version: z.number().int().positive(),
				changedAt: TimestampSchema,
				coreProgress: z
					.object({
						reviewCompleted: z.boolean(),
						grammarCompleted: z.boolean(),
						coreVoiceImported: z.boolean(),
						coreCompleted: z.boolean(),
					})
					.strict(),
			})
			.strict(),
	})
	.strict();

export const ReviewEventMutationResponseSchema = z
	.object({
		data: z
			.object({
				operationId: z.string().uuid(),
				eventId: z.string().uuid(),
				cardId: IdSchema,
				version: z.number().int().positive(),
				replayed: z.boolean(),
				changedAt: TimestampSchema,
			})
			.strict(),
	})
	.strict();

export const BaselineAssessmentMutationResponseSchema = z
	.object({
		data: z
			.object({
				operationId: z.string().uuid(),
				assessmentId: z.literal('baseline:current'),
				version: z.number().int().positive(),
				replayed: z.boolean(),
				changedAt: TimestampSchema,
			})
			.strict(),
	})
	.strict();

export const StageAssessmentMutationResponseSchema = z
	.object({
		data: z
			.object({
				operationId: z.string().uuid(),
				assessmentId: IdSchema,
				attemptId: z.string().uuid(),
				version: z.number().int().positive(),
				replayed: z.boolean(),
				changedAt: TimestampSchema,
			})
			.strict(),
	})
	.strict();

export const SyncBootstrapResponseSchema = z
	.object({
		data: z
			.object({
				entities: z.array(RemoteEntitySchema).max(1_000_000),
				cursor: z.number().int().nonnegative(),
				activeTotalDays: z.number().int().min(1).max(SUPPORTED_CURRICULUM_DAY_MAX),
			})
			.strict(),
	})
	.strict();

export const SyncChangesResponseSchema = z
	.object({
		data: z
			.object({
				changes: z.array(RemoteEntitySchema).max(500),
				cursor: z.number().int().nonnegative(),
				hasMore: z.boolean(),
			})
			.strict(),
	})
	.strict();

export const ApiErrorResponseSchema = z
	.object({
		error: z
			.object({
				code: z.string(),
				message: z.string(),
				current: z.unknown().optional(),
				version: z.number().int().nonnegative().optional(),
			})
			.passthrough(),
	})
	.passthrough();
