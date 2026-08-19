import { describe, expect, it } from 'vitest';
import {
	ActiveCurriculumTotalDaysSchema,
	CurriculumCompatibilityError,
	assertBundledCurriculumCompatibility,
} from './availability';
import { AVAILABLE_CURRICULUM_TOTAL_DAYS, SUPPORTED_CURRICULUM_DAY_MAX } from './constants';

describe('curriculum availability compatibility', () => {
	it('keeps ACTIVE 365 within AVAILABLE 365 and SUPPORTED 540', () => {
		expect(assertBundledCurriculumCompatibility(90)).toBe(90);
		expect(assertBundledCurriculumCompatibility(180)).toBe(180);
		expect(assertBundledCurriculumCompatibility(270)).toBe(270);
		expect(assertBundledCurriculumCompatibility(365)).toBe(365);
		expect(AVAILABLE_CURRICULUM_TOTAL_DAYS).toBe(365);
		expect(SUPPORTED_CURRICULUM_DAY_MAX).toBe(540);
		expect(ActiveCurriculumTotalDaysSchema.safeParse(540).success).toBe(true);
	});

	it.each([366, 540])(
		'fails closed when server ACTIVE %i exceeds bundled availability',
		(active) => {
			expect(() => assertBundledCurriculumCompatibility(active)).toThrow(
				CurriculumCompatibilityError,
			);
		},
	);
});
