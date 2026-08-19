import { describe, expect, it } from 'vitest';
import { SUPPORTED_CURRICULUM_DAY_MAX } from '../curriculum/constants';
import {
	DailyProgressPatchSchema,
	ReviewEventMutationRequestSchema,
	WeeklyAssessmentSchema,
} from './schemas';

const evaluation = {
	taskCompletion: 4,
	grammar: 4,
	vocabulary: 4,
	fluency: 4,
	interaction: 4,
	commentJa: '境界テスト',
};

describe('supported curriculum day structural bounds', () => {
	it.each([
		[
			'Daily progress',
			DailyProgressPatchSchema,
			{
				curriculumDay: SUPPORTED_CURRICULUM_DAY_MAX,
				reviewCompleted: true,
				clientMutationId: 'curriculum-bound-test',
				updatedAt: '2026-08-13T00:00:00.000Z',
			},
		],
		[
			'Review event',
			ReviewEventMutationRequestSchema,
			{
				operationId: '0198ba29-89b5-4000-8000-000000000011',
				eventId: '0198ba29-89b5-4000-8000-000000000012',
				cardId: 'curriculum-bound-card',
				grade: 'good',
				occurredAt: '2026-08-13T00:00:00.000Z',
				studyDate: '2026-08-13',
				curriculumDay: SUPPORTED_CURRICULUM_DAY_MAX,
				expectedVersion: 0,
			},
		],
		[
			'Weekly assessment',
			WeeklyAssessmentSchema,
			{
				startDay: SUPPORTED_CURRICULUM_DAY_MAX - 6,
				endDay: SUPPORTED_CURRICULUM_DAY_MAX,
				evaluation,
				strength: '継続できた',
				priority: '会話を続ける',
			},
		],
	] as const)('%s accepts Day 540 and rejects Day 541', (_label, schema, fixture) => {
		expect(schema.safeParse(fixture).success).toBe(true);
		expect(
			schema.safeParse({
				...fixture,
				...('curriculumDay' in fixture
					? { curriculumDay: SUPPORTED_CURRICULUM_DAY_MAX + 1 }
					: { endDay: SUPPORTED_CURRICULUM_DAY_MAX + 1 }),
			}).success,
		).toBe(false);
	});
});
