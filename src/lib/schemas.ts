import { z } from 'zod';
import { SUPPORTED_CURRICULUM_DAY_MAX } from '../curriculum/constants';
import { StageAssessmentSchema } from '../domain/assessment';

const identifier = z
	.string()
	.trim()
	.min(1)
	.max(128)
	.regex(/^[A-Za-z0-9._:-]+$/);
const localDate = z.iso.date();
const instant = z.iso.datetime({ offset: true });
const trimmedText = (max: number) => z.string().max(max).trim().min(1);
const shortText = trimmedText(200);
const uuidV4 = z
	.string()
	.uuid()
	.regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu);

export const IanaTimeZoneSchema = z
	.string()
	.min(1)
	.max(100)
	.refine((value) => {
		try {
			new Intl.DateTimeFormat('en-US', { timeZone: value }).format(0);
			return true;
		} catch {
			return false;
		}
	}, 'A valid IANA time zone is required.');

export const BoostModeSchema = z.enum([
	'review_rescue',
	'speaking_sprint',
	'grammar_deep_dive',
	'scenario_challenge',
	'weakness_attack',
	'next_lesson_preview',
	'free_talk',
]);

export const MistakeCategorySchema = z.enum([
	'grammar_tense',
	'grammar_word_order',
	'grammar_agreement',
	'grammar_article',
	'grammar_preposition',
	'vocabulary_choice',
	'phrase_naturalness',
	'pronunciation_segment',
	'pronunciation_stress',
	'pronunciation_rhythm',
	'listening',
	'interaction',
	'other',
]);

export const EvaluationSchema = z
	.object({
		taskCompletion: z.number().int().min(1).max(5),
		grammar: z.number().int().min(1).max(5),
		vocabulary: z.number().int().min(1).max(5),
		fluency: z.number().int().min(1).max(5),
		interaction: z.number().int().min(1).max(5),
		commentJa: trimmedText(500),
	})
	.strict();

export const LearningItemSchema = z
	.object({
		text: trimmedText(120),
		meaningJa: shortText,
		example: trimmedText(300),
	})
	.strict();

export const GrammarPreviewSchema = z
	.object({
		topicId: z.string().regex(/^[a-z0-9-]{1,80}$/),
		title: trimmedText(120),
		noteJa: trimmedText(500),
		status: z.literal('previewed'),
	})
	.strict();

export const MistakeCandidateSchema = z
	.object({
		category: MistakeCategorySchema,
		learnerSaid: trimmedText(500),
		suggested: trimmedText(500),
		explanationJa: trimmedText(500),
		severity: z.enum(['low', 'medium', 'high']),
	})
	.strict();

export const ReviewCardCandidateSchema = z
	.object({
		front: trimmedText(300),
		back: trimmedText(500),
		sourceMistakeIndex: z.number().int().nonnegative().nullable(),
	})
	.strict();

/**
 * The provider-neutral SESSION_JSON v1.0 contract. It is validated before
 * imported data can reach application state or persistence.
 */
export const SessionJsonSchema = z
	.object({
		schemaVersion: z.literal('1.0'),
		sessionId: uuidV4,
		sessionType: z.enum(['core', 'boost']),
		curriculumDay: z.number().int().min(1).max(SUPPORTED_CURRICULUM_DAY_MAX),
		occurredAt: instant,
		durationMinutes: z.number().int().min(1).max(120),
		boost: z
			.object({
				duration: z.union([z.literal(5), z.literal(15), z.literal(30), z.literal(60)]),
				mode: BoostModeSchema,
			})
			.strict()
			.nullable(),
		summaryJa: trimmedText(1_000),
		evaluation: EvaluationSchema,
		mistakes: z.array(MistakeCandidateSchema).max(20),
		newVocabulary: z.array(LearningItemSchema).max(8),
		newPhrases: z.array(LearningItemSchema).max(3),
		previewGrammar: z.array(GrammarPreviewSchema).max(1),
		reviewCards: z.array(ReviewCardCandidateSchema).max(20),
	})
	.strict()
	.superRefine((value, context) => {
		if (value.sessionType === 'core') {
			if (value.boost !== null)
				context.addIssue({ code: 'custom', path: ['boost'], message: 'Core boost must be null.' });
			if (value.previewGrammar.length !== 0) {
				context.addIssue({
					code: 'custom',
					path: ['previewGrammar'],
					message: 'Core cannot preview future grammar.',
				});
			}
		} else {
			if (value.boost === null)
				context.addIssue({
					code: 'custom',
					path: ['boost'],
					message: 'Boost settings are required.',
				});
			if (value.boost && value.durationMinutes !== value.boost.duration) {
				context.addIssue({
					code: 'custom',
					path: ['durationMinutes'],
					message: 'Boost duration must match boost.duration.',
				});
			}
			if (value.boost?.mode === 'next_lesson_preview' && value.previewGrammar.length !== 1) {
				context.addIssue({
					code: 'custom',
					path: ['previewGrammar'],
					message: 'Next Lesson Preview requires exactly one grammar preview.',
				});
			}
			if (value.boost?.mode !== 'next_lesson_preview' && value.previewGrammar.length !== 0) {
				context.addIssue({
					code: 'custom',
					path: ['previewGrammar'],
					message: 'Only Next Lesson Preview can include preview grammar.',
				});
			}
		}
		for (const [index, card] of value.reviewCards.entries()) {
			if (card.sourceMistakeIndex !== null && card.sourceMistakeIndex >= value.mistakes.length) {
				context.addIssue({
					code: 'custom',
					path: ['reviewCards', index, 'sourceMistakeIndex'],
					message: 'Review card references a missing mistake.',
				});
			}
		}
	});

/** @deprecated Use SessionJsonSchema. Kept so existing imports stay compatible. */
export const ChatGptSessionSchema = SessionJsonSchema;

export const SessionImportRequestSchema = z
	.object({
		payload: SessionJsonSchema,
		studyDate: localDate,
		idempotencyKey: identifier,
		sourceTextHash: z.string().regex(/^[a-f0-9]{64}$/),
		reviewedCardIds: z.array(identifier).max(500).default([]),
		expectedVersion: z.number().int().nonnegative().default(0),
	})
	.strict();

export const DailyProgressPatchSchema = z
	.object({
		curriculumDay: z.number().int().min(1).max(SUPPORTED_CURRICULUM_DAY_MAX).optional(),
		reviewCompleted: z.literal(true).optional(),
		grammarCompleted: z.literal(true).optional(),
		expectedVersion: z.number().int().nonnegative().optional(),
		sourceVersion: z
			.number()
			.int()
			.nonnegative()
			.max(Number.MAX_SAFE_INTEGER - 1)
			.optional(),
		clientMutationId: identifier,
		updatedAt: instant,
	})
	.strict()
	.refine((value) => value.reviewCompleted !== undefined || value.grammarCompleted !== undefined, {
		message: 'At least one progress field is required.',
	});

export const DateQuerySchema = z.object({ date: localDate }).strict();

export const BaselineAssessmentSchema = z
	.object({
		confidence: z.number().int().min(1).max(5),
		taskCompletion: z.number().int().min(1).max(5),
		grammar: z.number().int().min(1).max(5),
		vocabulary: z.number().int().min(1).max(5),
		fluency: z.number().int().min(1).max(5),
		interaction: z.number().int().min(1).max(5),
		strengths: z.array(z.string().trim().min(1).max(300)).max(2),
		priorities: z.array(z.string().trim().min(1).max(300)).max(2),
	})
	.strict();

export const ReviewEventMutationRequestSchema = z
	.object({
		operationId: uuidV4,
		eventId: uuidV4,
		cardId: identifier,
		grade: z.enum(['again', 'hard', 'good', 'easy']),
		occurredAt: instant,
		studyDate: localDate,
		curriculumDay: z.number().int().min(1).max(SUPPORTED_CURRICULUM_DAY_MAX),
		expectedVersion: z.number().int().nonnegative(),
	})
	.strict();

export const BaselineAssessmentImportRequestSchema = z
	.object({
		operationId: uuidV4,
		assessment: z
			.object({
				id: z.literal('baseline:current'),
				type: z.literal('baseline'),
				completedAt: instant,
				payload: BaselineAssessmentSchema,
			})
			.strict(),
		expectedVersion: z.number().int().nonnegative(),
	})
	.strict();

export const StageAssessmentImportRequestSchema = z
	.object({
		operationId: uuidV4,
		assessment: z
			.object({
				id: uuidV4,
				type: z.literal('stage'),
				completedAt: instant,
				payload: StageAssessmentSchema,
			})
			.strict(),
		expectedVersion: z.number().int().nonnegative(),
	})
	.strict()
	.superRefine((value, context) => {
		if (value.assessment.id !== value.assessment.payload.attemptId) {
			context.addIssue({
				code: 'custom',
				path: ['assessment', 'id'],
				message: 'Assessment entity ID must match attemptId.',
			});
		}
		if (value.assessment.completedAt !== value.assessment.payload.completedAt) {
			context.addIssue({
				code: 'custom',
				path: ['assessment', 'completedAt'],
				message: 'Assessment completedAt must match payload completedAt.',
			});
		}
	});

export const WeeklyAssessmentSchema = z
	.object({
		startDay: z.number().int().min(1).max(SUPPORTED_CURRICULUM_DAY_MAX),
		endDay: z.number().int().min(1).max(SUPPORTED_CURRICULUM_DAY_MAX),
		evaluation: EvaluationSchema,
		strength: z.string().trim().min(1).max(300),
		priority: z.string().trim().min(1).max(300),
	})
	.strict()
	.refine((value) => value.startDay <= value.endDay, { message: 'Invalid weekly range.' });
export const ChangeQuerySchema = z
	.object({
		cursor: z.coerce.number().int().nonnegative().default(0),
		limit: z.coerce.number().int().min(1).max(500).default(100),
	})
	.strict();

export type SessionImport = z.infer<typeof SessionJsonSchema>;
export type SessionImportRequest = z.infer<typeof SessionImportRequestSchema>;
export type DailyProgressPatch = z.infer<typeof DailyProgressPatchSchema>;
export type BoostMode = z.infer<typeof BoostModeSchema>;
export type BaselineAssessment = z.infer<typeof BaselineAssessmentSchema>;
export type WeeklyAssessment = z.infer<typeof WeeklyAssessmentSchema>;
export type ReviewEventMutationRequest = z.infer<typeof ReviewEventMutationRequestSchema>;
export type BaselineAssessmentImportRequest = z.infer<typeof BaselineAssessmentImportRequestSchema>;
export type StageAssessmentImportRequest = z.infer<typeof StageAssessmentImportRequestSchema>;
