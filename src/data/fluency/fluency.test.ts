import { describe, expect, it } from 'vitest';
import { FLUENCY_LESSONS, FLUENCY_UNIT_LESSONS } from '.';

describe('Fluency curriculum authoring', () => {
	it('keeps every authored unit contiguous and within acquisition limits', () => {
		expect(FLUENCY_LESSONS).toHaveLength(FLUENCY_UNIT_LESSONS.length * 15);
		expect(FLUENCY_LESSONS.map((lesson) => lesson.content.day)).toEqual(
			Array.from({ length: FLUENCY_LESSONS.length }, (_, index) => index + 181),
		);
		for (const unit of FLUENCY_UNIT_LESSONS) {
			expect(unit).toHaveLength(15);
			expect(unit.every((lesson) => lesson.content.phase === 'Fluency')).toBe(true);
			expect(
				unit.every(
					(lesson) =>
						lesson.content.vocabulary.length >= 3 && lesson.content.vocabulary.length <= 5,
				),
			).toBe(true);
			expect(
				unit.every(
					(lesson) => lesson.content.phrases.length >= 1 && lesson.content.phrases.length <= 3,
				),
			).toBe(true);
		}
	});

	it('uses unique content IDs, themes, and meaningful skill targets', () => {
		const grammarIds = FLUENCY_LESSONS.map((lesson) => lesson.content.grammar.id);
		const itemIds = FLUENCY_LESSONS.flatMap((lesson) => [
			...lesson.content.vocabulary.map((item) => item.id),
			...lesson.content.phrases.map((item) => item.id),
		]);
		expect(new Set(grammarIds).size).toBe(grammarIds.length);
		expect(new Set(itemIds).size).toBe(itemIds.length);
		expect(new Set(FLUENCY_LESSONS.map((lesson) => lesson.content.theme)).size).toBe(
			FLUENCY_LESSONS.length,
		);
		expect(FLUENCY_LESSONS.every((lesson) => lesson.skillTargets.length >= 3)).toBe(true);
		expect(new Set(FLUENCY_LESSONS.map((lesson) => lesson.content.objective)).size).toBe(90);
		expect(new Set(FLUENCY_LESSONS.map((lesson) => lesson.content.voiceTask)).size).toBe(90);
	});

	it('recycles selectively without reducing each unit to template substitutions', () => {
		for (const unit of FLUENCY_UNIT_LESSONS) {
			const words = unit.flatMap((lesson) =>
				lesson.content.vocabulary.map((item) => item.text.toLocaleLowerCase('en-US')),
			);
			const phrases = unit.flatMap((lesson) =>
				lesson.content.phrases.map((item) => item.text.toLocaleLowerCase('en-US')),
			);
			expect(new Set(words).size).toBeGreaterThanOrEqual(55);
			expect(new Set(phrases).size).toBeGreaterThanOrEqual(28);
		}
	});

	it('builds from detailed explanation to sustained B1+ integration', () => {
		const at = (day: number) => FLUENCY_LESSONS[day - 181]!.content;
		expect(at(181).voiceTask).toContain('2分');
		expect(at(195).voiceTask).toContain('6分');
		expect(at(210).voiceTask).toContain('三文summary');
		expect(at(225).voiceTask).toContain('8分');
		expect(at(240).voiceTask).toContain('10分');
		expect(at(255).voiceTask).toContain('12分');
		expect(at(265).voiceTask).toContain('12～15分');
		expect(at(270).voiceTask).toContain('12～18分');
		const titles = FLUENCY_LESSONS.map((lesson) => lesson.content.grammar.title).join(' | ');
		expect(titles).toContain('second conditional introduction');
		expect(titles).toContain('indirect diagnostic questions');
		expect(titles).toContain('reported speech in a story');
		expect(titles).toContain('passive and sequence for incidents');
		expect(
			FLUENCY_LESSONS.filter((lesson) => lesson.skillTargets.includes('listening')).length,
		).toBeGreaterThanOrEqual(50);
	});
});
