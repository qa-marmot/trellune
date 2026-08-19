import { describe, expect, it } from 'vitest';
import { B2_CHALLENGE_LESSONS, B2_CHALLENGE_UNIT_LESSONS } from '.';

describe('B2 Challenge curriculum authoring', () => {
	it('keeps each authored unit contiguous and within acquisition limits', () => {
		expect(B2_CHALLENGE_LESSONS).toHaveLength(95);
		expect(B2_CHALLENGE_UNIT_LESSONS.map((unit) => unit.length)).toEqual([
			15, 15, 15, 15, 15, 15, 5,
		]);
		expect(B2_CHALLENGE_LESSONS.map((lesson) => lesson.content.day)).toEqual(
			Array.from({ length: B2_CHALLENGE_LESSONS.length }, (_, index) => index + 271),
		);
		for (const unit of B2_CHALLENGE_UNIT_LESSONS) {
			expect(unit.every((lesson) => lesson.content.phase === 'B2 Challenge')).toBe(true);
			expect(
				unit.every(
					(lesson) =>
						lesson.content.vocabulary.length >= 2 && lesson.content.vocabulary.length <= 4,
				),
			).toBe(true);
			expect(
				unit.every(
					(lesson) => lesson.content.phrases.length >= 1 && lesson.content.phrases.length <= 3,
				),
			).toBe(true);
		}
	});

	it('progresses from supported opinions to a 25-minute evidence-based graduation challenge', () => {
		const at = (day: number) => B2_CHALLENGE_LESSONS[day - 271];
		expect(at(271)?.content.voiceTask).toContain('12分');
		expect(at(300)?.content.voiceTask).toContain('15～17分');
		expect(at(345)?.content.voiceTask).toContain('18～20分');
		expect(at(365)?.content.voiceTask).toContain('25分');
		expect(at(365)?.content.voiceTask).toContain('certification');
		expect(at(365)?.skillTargets).toEqual(
			expect.arrayContaining([
				'speaking',
				'interaction',
				'fluency',
				'grammar',
				'vocabulary',
				'listening',
			]),
		);
		expect(
			B2_CHALLENGE_LESSONS.filter((lesson) => lesson.skillTargets.includes('listening')).length,
		).toBeGreaterThanOrEqual(45);
	});

	it('uses unique authored surfaces and meaningful selected skills', () => {
		const content = B2_CHALLENGE_LESSONS.map((lesson) => lesson.content);
		expect(new Set(content.map((lesson) => lesson.theme)).size).toBe(content.length);
		expect(new Set(content.map((lesson) => lesson.objective)).size).toBe(content.length);
		expect(new Set(content.map((lesson) => lesson.voiceTask)).size).toBe(content.length);
		expect(B2_CHALLENGE_LESSONS.every((lesson) => lesson.skillTargets.length >= 3)).toBe(true);
	});
});
