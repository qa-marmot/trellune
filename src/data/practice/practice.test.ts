import { describe, expect, it } from 'vitest';
import { CURRICULUM_MANIFEST } from '../../curriculum/manifest';
import { grammarOperationsFor } from './grammarTargeting';

const lessons = CURRICULUM_MANIFEST.lessons;
const integrationBlocks = lessons.flatMap((lesson) =>
	lesson.practiceBlocks
		.filter((block) => block.kind === 'integration')
		.map((block) => ({ day: lesson.day, block })),
);
const labs = integrationBlocks.filter(({ block }) => block.id.endsWith('-reading-writing-lab'));
const longFormChallenges = integrationBlocks.filter(({ block }) =>
	block.id.endsWith('-long-form-challenge'),
);

function englishWords(value: string): number {
	return value.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/gu)?.length ?? 0;
}

function average(values: readonly number[]): number {
	return values.reduce((total, value) => total + value, 0) / values.length;
}

function writingOutput({ block }: (typeof labs)[number]) {
	return block.prompts.find((prompt) => prompt.id.endsWith('-writing-response'))?.output;
}

describe('Day 1-365 non-Voice practice', () => {
	it('adds daily grammar transfer and productive vocabulary retrieval across every stage', () => {
		expect(lessons).toHaveLength(365);
		for (const lesson of lessons) {
			expect(lesson.practiceBlocks.map((block) => block.kind)).toEqual(
				expect.arrayContaining(['grammar', 'vocabulary']),
			);
			expect(lesson.skillTargets).toEqual(
				expect.arrayContaining(['grammar', 'vocabulary', 'writing']),
			);
		}
	});

	it('provides 64 authored reading-writing labs on deterministic checkpoint days', () => {
		expect(labs.map(({ day }) => day)).toEqual([
			6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72, 78, 84, 90, 96, 102, 108, 114, 120, 126, 132,
			138, 144, 150, 156, 162, 168, 174, 180, 186, 192, 198, 204, 210, 216, 222, 228, 234, 240, 246,
			252, 258, 264, 270, 275, 280, 285, 290, 295, 300, 305, 310, 315, 320, 325, 330, 335, 340, 345,
			350, 355, 360, 365,
		]);
		expect(new Set(labs.map(({ block }) => block.title)).size).toBe(64);
		expect(new Set(labs.map(({ block }) => block.sourceText)).size).toBe(64);
		for (const { block } of labs) {
			expect(block.sourceText).toBeTruthy();
			expect(block.skillTargets).toEqual(expect.arrayContaining(['reading', 'writing']));
			expect(block.prompts).toHaveLength(2);
			expect(block.prompts.every((prompt) => prompt.output)).toBe(true);
		}
	});

	it('adds seven bounded long-form challenges without replacing daily Labs', () => {
		expect(longFormChallenges.map(({ day }) => day)).toEqual([179, 224, 269, 299, 329, 344, 359]);
		expect(new Set(longFormChallenges.map(({ block }) => block.title)).size).toBe(7);
		expect(longFormChallenges.every(({ day }) => !labs.some((lab) => lab.day === day))).toBe(true);
		for (const { block } of longFormChallenges) {
			const words = englishWords(block.sourceText!);
			expect(words).toBeGreaterThanOrEqual(400);
			expect(words).toBeLessThanOrEqual(700);
			expect(block.prompts).toHaveLength(3);
			expect(block.prompts.slice(0, 2).every((prompt) => prompt.feedback.keyPoints?.length)).toBe(
				true,
			);
			expect(block.prompts.at(-1)?.output?.minimumWords).toBeGreaterThanOrEqual(100);
		}
		const multiTextDays = longFormChallenges
			.filter(({ block }) => /Text A|Review A|Report —/u.test(block.sourceText!))
			.map(({ day }) => day);
		expect(multiTextDays).toEqual([224, 299, 329, 359]);
	});

	it('gives every open task actionable authored feedback without pretending exact grading', () => {
		for (const lesson of lessons) {
			for (const block of lesson.practiceBlocks) {
				for (const prompt of block.prompts) {
					expect(prompt.feedback.rationale.length).toBeGreaterThan(20);
					expect(prompt.feedback.checklist.length).toBeGreaterThanOrEqual(3);
				}
			}
		}
		for (const { block } of labs) {
			const reading = block.prompts.find((prompt) => prompt.id.endsWith('-reading-comprehension'))!;
			expect(reading.expectedAnswer).toBeUndefined();
			expect(reading.feedback.keyPoints?.length).toBeGreaterThan(0);
			expect(reading.feedback.evidenceClue?.length).toBeGreaterThan(3);
			expect(reading.feedback.commonErrors?.length).toBeGreaterThan(0);
			const writing = block.prompts.find((prompt) => prompt.id.endsWith('-writing-response'))!;
			expect(writing.feedback.checklist.length).toBeGreaterThanOrEqual(4);
		}
	});

	it('raises reading length and writing expectations from Foundation through B2 Challenge', () => {
		const foundation = labs.slice(0, 15);
		const independent = labs.slice(15, 30);
		const fluency = labs.slice(30, 45);
		const challenge = labs.slice(45);
		const firstFoundation = foundation
			.slice(0, 5)
			.map(({ block }) => englishWords(block.sourceText!));
		const lastFoundation = foundation.slice(-5).map(({ block }) => englishWords(block.sourceText!));
		const firstIndependent = independent
			.slice(0, 5)
			.map(({ block }) => englishWords(block.sourceText!));
		const lastIndependent = independent
			.slice(-5)
			.map(({ block }) => englishWords(block.sourceText!));

		expect(average(lastFoundation)).toBeGreaterThan(average(firstFoundation));
		expect(average(firstIndependent)).toBeGreaterThan(average(lastFoundation));
		expect(average(lastIndependent)).toBeGreaterThan(average(firstIndependent));
		expect(average(fluency.map(({ block }) => englishWords(block.sourceText!)))).toBeGreaterThan(
			average(independent.map(({ block }) => englishWords(block.sourceText!))),
		);
		expect(average(challenge.map(({ block }) => englishWords(block.sourceText!)))).toBeGreaterThan(
			average(fluency.map(({ block }) => englishWords(block.sourceText!))),
		);
		expect(writingOutput(foundation[0]!)?.minimumWords).toBe(4);
		expect(writingOutput(foundation.at(-1)!)?.minimumWords).toBe(45);
		expect(writingOutput(independent[0]!)?.minimumWords).toBe(55);
		expect(writingOutput(independent.at(-1)!)?.minimumWords).toBe(95);
		expect(writingOutput(fluency.at(-1)!)?.minimumWords).toBe(140);
		expect(writingOutput(challenge.at(-1)!)?.minimumWords).toBe(180);
		expect(writingOutput(challenge.at(-1)!)?.maximumWords).toBe(250);
	});

	it('selects grammar operations from the target category instead of day-only rotation', () => {
		const categories = new Set<string>();
		for (const lesson of lessons) {
			const prompt = lesson.practiceBlocks.find((block) => block.kind === 'grammar')!.prompts[0]!;
			expect(prompt.grammarCategory).toBeTruthy();
			categories.add(prompt.grammarCategory!);
			expect(grammarOperationsFor(prompt.grammarCategory!, lesson.day)).toContain(prompt.operation);
			if (prompt.grammarCategory === 'discourse-cohesion') {
				expect(prompt.operation).not.toBe('transformation');
				expect(prompt.prompt).not.toContain('主語・肯定');
			}
			if (prompt.operation === 'error-correction') {
				expect(prompt.prompt).not.toContain('意図的に');
				expect(prompt.feedback.commonErrors?.[0]).toContain('→');
			}
			if (lesson.day <= 30) expect(prompt.operation).not.toBe('error-correction');
		}
		expect(categories.size).toBeGreaterThanOrEqual(10);
		expect(
			lessons[29]!.practiceBlocks.find((block) => block.kind === 'grammar')!.prompts[0]!
				.grammarCategory,
		).toBe('noun-article-quantity');
		expect(
			lessons[364]!.practiceBlocks.find((block) => block.kind === 'grammar')!.prompts[0]!
				.grammarCategory,
		).toBe('integrated-grammar');
	});

	it('keeps authored grammar targeting aligned with the actual language function', () => {
		const grammarPrompt = (day: number) =>
			lessons[day - 1]!.practiceBlocks.find((block) => block.kind === 'grammar')!.prompts[0]!;

		expect(grammarPrompt(6)).toMatchObject({ grammarCategory: 'interaction-repair' });
		expect(grammarPrompt(6).prompt).toContain('丁寧な依頼');
		expect(grammarPrompt(6).feedback.commonErrors?.[0]).toContain('Could you repeat that, please?');
		expect(grammarPrompt(30).feedback.commonErrors?.[0]).toContain('large blue bag');
		expect(grammarPrompt(54)).toMatchObject({ grammarCategory: 'clause-linking' });
		expect(grammarPrompt(54).prompt).toContain('need to + verb');
		expect(grammarPrompt(72)).toMatchObject({ grammarCategory: 'hedging-stance' });
		expect(grammarPrompt(72).prompt).toContain('残る懸念');
		expect(grammarPrompt(11)).toMatchObject({ grammarCategory: 'tense-aspect' });
		expect(grammarPrompt(11).prompt).toContain('always / usually');
		expect(grammarPrompt(17).prompt).toContain('人数');
		expect(grammarPrompt(29).feedback.commonErrors?.[0]).toContain('want to buy');
		expect(grammarPrompt(34)).toMatchObject({ grammarCategory: 'tense-aspect' });
		expect(grammarPrompt(37).feedback.commonErrors?.[0]).toContain('Did you go');
		expect(grammarPrompt(117)).toMatchObject({ grammarCategory: 'comparison' });
		expect(grammarPrompt(139).feedback.commonErrors?.[0]).toContain('we checked the weather');
		expect(grammarPrompt(265)).toMatchObject({ grammarCategory: 'integrated-grammar' });
		expect(grammarPrompt(310).feedback.commonErrors?.[0]).toContain('where the station is');
		expect(grammarPrompt(300)).toMatchObject({ grammarCategory: 'modal-condition' });
		expect(grammarPrompt(350)).toMatchObject({ grammarCategory: 'discourse-cohesion' });
		expect(grammarPrompt(350).prompt).not.toContain('本当に知りたいこと');
		expect(grammarPrompt(360)).toMatchObject({ grammarCategory: 'integrated-grammar' });
		expect(grammarPrompt(365).feedback.commonErrors?.[0]).toContain('assessment suggests B2-entry');
	});

	it('recycles vocabulary at bounded D+1/D+3/D+7/D+21 curriculum intervals', () => {
		const intervals = new Set<number>();
		for (let index = 1; index < lessons.length; index += 1) {
			const lesson = lessons[index]!;
			const prompt = lesson.practiceBlocks.find((block) => block.kind === 'vocabulary')!
				.prompts[0]!;
			expect(prompt.retrievalTargets?.length).toBeGreaterThanOrEqual(1);
			expect(prompt.retrievalTargets?.length).toBeLessThanOrEqual(2);
			for (const target of prompt.retrievalTargets ?? []) {
				intervals.add(target.intervalDays);
				expect(target.introducedDay).toBe(lesson.day - target.intervalDays);
				expect(target.introducedDay).toBeGreaterThanOrEqual(1);
				expect(
					lessons[target.introducedDay - 1]!.content.vocabulary.map((item) => item.text),
				).toContain(target.text);
				expect(prompt.prompt).toContain(target.text);
			}
		}
		expect([...intervals].sort((a, b) => a - b)).toEqual([1, 3, 7, 21]);
	});

	it('calibrates Foundation writing length to communicative task size', () => {
		const ranges = labs.slice(0, 15).map((entry) => writingOutput(entry)!);
		expect(ranges.map((output) => output.minimumWords)).toEqual([
			4, 8, 4, 8, 10, 18, 24, 18, 18, 24, 24, 28, 16, 24, 45,
		]);
		expect(ranges[0]!.maximumWords).toBe(14);
		expect(ranges[2]!.maximumWords).toBe(16);
		expect(ranges[12]!.maximumWords).toBe(45);
		expect(ranges.at(-1)!.minimumWords).toBeGreaterThan(ranges[0]!.minimumWords);
	});

	it('covers B1+/B2 descriptor work with authored tasks instead of labels alone', () => {
		const advancedText = labs
			.slice(30)
			.flatMap(({ block }) => [
				block.title,
				block.instructions,
				block.sourceText,
				...block.prompts.map((prompt) => prompt.prompt),
			])
			.join(' ')
			.toLocaleLowerCase('en-US');
		for (const descriptor of [
			'counter',
			'evidence',
			'infer',
			'paraphrase',
			'stance',
			'summary',
			'trade-off',
		]) {
			expect(advancedText).toContain(descriptor);
		}
		const challenge = labs.slice(45);
		expect(challenge.every(({ block }) => block.prompts[0]?.operation === 'inference')).toBe(true);
		expect(challenge.every((entry) => (writingOutput(entry)?.minimumWords ?? 0) >= 140)).toBe(true);
		expect(
			challenge.every(
				({ block }) =>
					block.sourceText?.includes('\n\n') &&
					englishWords(block.sourceText) >= 150 &&
					englishWords(block.sourceText) <= 260,
			),
		).toBe(true);
	});

	it('broadens advanced reading genres beyond work and policy scenarios', () => {
		const advancedReading = integrationBlocks
			.filter(({ day }) => day >= 271)
			.map(({ block }) => `${block.title} ${block.sourceText}`)
			.join(' ')
			.toLocaleLowerCase('en-US');
		for (const topic of [
			'cinema',
			'museum',
			'walking group',
			'concert hall',
			'guesthouse',
			'travel',
			'sports',
			'radio',
			'news feed',
		]) {
			expect(advancedReading).toContain(topic);
		}
	});

	it('keeps the added daily burden within a sustainable rotation', () => {
		const minutes = lessons.map((lesson) =>
			lesson.practiceBlocks.reduce((total, block) => total + block.estimatedMinutes, 0),
		);
		expect(Math.min(...minutes)).toBe(9);
		expect(Math.max(...minutes)).toBe(43);
		expect(average(minutes)).toBeLessThan(18);
	});
});
