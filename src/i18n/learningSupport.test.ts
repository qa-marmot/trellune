import { describe, expect, it } from 'vitest';
import { CURRICULUM_MANIFEST } from '../curriculum/manifest';
import { CURRICULUM } from '../data/curriculum';
import { CJK_TEXT_PATTERN, getLearningSupportCatalog } from './learningSupport';

function collectStrings(value: unknown, path = 'root'): Array<{ path: string; value: string }> {
	if (typeof value === 'string') return [{ path, value }];
	if (Array.isArray(value))
		return value.flatMap((item, index) => collectStrings(item, `${path}[${index}]`));
	if (value && typeof value === 'object')
		return Object.entries(value).flatMap(([key, item]) => collectStrings(item, `${path}.${key}`));
	return [];
}

describe('Day 1–365 learning support catalog', () => {
	it('keeps the Japanese curriculum as the exact canonical objects', () => {
		const catalog = getLearningSupportCatalog('ja');
		expect(catalog.curriculum).toBe(CURRICULUM);
		expect(catalog.manifest).toBe(CURRICULUM_MANIFEST);
	});

	it('provides complete English learner support without CJK fallback', () => {
		const catalog = getLearningSupportCatalog('en');
		expect(catalog.curriculum).toHaveLength(365);
		expect(catalog.manifest.lessons).toHaveLength(365);
		const leaked = collectStrings({
			curriculum: catalog.curriculum,
			practice: catalog.manifest.lessons.map((lesson) => lesson.practiceBlocks),
		}).filter(({ value }) => CJK_TEXT_PATTERN.test(value));
		expect(
			leaked,
			leaked
				.slice(0, 20)
				.map((item) => `${item.path}: ${item.value}`)
				.join('\n'),
		).toEqual([]);
	});

	it('provides a non-empty English gloss for every vocabulary item and phrase', () => {
		const catalog = getLearningSupportCatalog('en');
		const placeholders: string[] = [];
		for (const day of catalog.curriculum) {
			for (const item of [...day.vocabulary, ...day.phrases]) {
				expect(item.meaning.trim(), `Day ${day.day}: ${item.text}`).not.toHaveLength(0);
				expect(item.meaning, `Day ${day.day}: ${item.text}`).not.toMatch(CJK_TEXT_PATTERN);
				if (/^A (?:useful word|reusable expression|curriculum term)\b/u.test(item.meaning)) {
					placeholders.push(`Day ${day.day}: ${item.text}`);
				}
			}
		}
		expect(placeholders, placeholders.slice(0, 30).join('\n')).toEqual([]);
	});

	it('keeps bounded grammar checks solvable without printing the model answer first', () => {
		const catalog = getLearningSupportCatalog('en');
		for (const day of catalog.curriculum) {
			const exercise = day.grammar.exercise.toLocaleLowerCase('en-US');
			const answer = day.grammar.expectedAnswer.toLocaleLowerCase('en-US');
			expect(exercise, `Day ${day.day}`).not.toContain(answer);
			expect(exercise, `Day ${day.day}`).toContain('transfer practice');
		}
	});

	it('preserves every stable lesson, content, item, block, and prompt ID', () => {
		const catalog = getLearningSupportCatalog('en');
		expect(catalog.manifest.lessons.map((lesson) => lesson.id)).toEqual(
			CURRICULUM_MANIFEST.lessons.map((lesson) => lesson.id),
		);
		for (const [index, lesson] of catalog.manifest.lessons.entries()) {
			const canonical = CURRICULUM_MANIFEST.lessons[index]!;
			expect(lesson.day).toBe(canonical.day);
			expect(lesson.content.grammar.id).toBe(canonical.content.grammar.id);
			expect(lesson.content.vocabulary.map((item) => item.id)).toEqual(
				canonical.content.vocabulary.map((item) => item.id),
			);
			expect(lesson.content.phrases.map((item) => item.id)).toEqual(
				canonical.content.phrases.map((item) => item.id),
			);
			expect(lesson.practiceBlocks.map((block) => block.id)).toEqual(
				canonical.practiceBlocks.map((block) => block.id),
			);
			expect(
				lesson.practiceBlocks.flatMap((block) => block.prompts.map((prompt) => prompt.id)),
			).toEqual(
				canonical.practiceBlocks.flatMap((block) => block.prompts.map((prompt) => prompt.id)),
			);
		}
	});

	it.each([1, 7, 30, 90, 91, 120, 180, 181, 224, 270, 271, 310, 359, 365])(
		'has meaningful English support for representative Day %i',
		(day) => {
			const lesson = getLearningSupportCatalog('en').manifest.lessons[day - 1]!;
			expect(lesson.content.theme.length).toBeGreaterThan(8);
			expect(lesson.content.objective.length).toBeGreaterThan(40);
			expect(lesson.content.grammar.explanation.length).toBeGreaterThan(70);
			expect(lesson.content.voiceTask.length).toBeGreaterThan(80);
			expect(lesson.practiceBlocks.every((block) => block.prompts.length > 0)).toBe(true);
		},
	);
});
