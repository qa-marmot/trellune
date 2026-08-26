import { describe, expect, it } from 'vitest';
import { CURRICULUM_MANIFEST } from '../curriculum/manifest';
import { studyWorkload } from './workload';

describe('manifest-derived workload', () => {
	it('keeps the learner preference separate from each stage workload', () => {
		const foundation = studyWorkload(CURRICULUM_MANIFEST.stages[0]!, 20);
		const challenge = studyWorkload(CURRICULUM_MANIFEST.stages[3]!, 20);
		expect(foundation).toMatchObject({
			preferredMinutes: 20,
			minimumCoreMinutes: [20, 20],
			recommendedMinutes: [20, 30],
			preferredBudgetIsShort: false,
		});
		expect(challenge).toMatchObject({
			preferredMinutes: 20,
			minimumCoreMinutes: [45, 60],
			recommendedMinutes: [60, 75],
			preferredBudgetIsShort: true,
		});
	});
});
