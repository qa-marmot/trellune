import type { SkillTarget } from '../../curriculum/model';
import type { CurriculumDay, CurriculumItem, GrammarFocus } from '../curriculum';

export interface FluencyLessonSeed {
	readonly day: number;
	readonly theme: string;
	readonly objective: string;
	readonly grammar: readonly [
		title: string,
		focus: string,
		explanation: string,
		exampleOne: string,
		exampleTwo: string,
		exercise: string,
		expectedAnswer: string,
	];
	readonly vocabulary: string;
	readonly phrases: string;
	readonly voiceTask: string;
	readonly skillTargets: readonly SkillTarget[];
}

export interface FluencyLesson {
	readonly content: CurriculumDay;
	readonly skillTargets: readonly SkillTarget[];
}

function parseItems(source: string, prefix: string): readonly CurriculumItem[] {
	return Object.freeze(
		source.split(';').map((pair, index) => {
			const separator = pair.indexOf('|');
			if (separator <= 0 || separator === pair.length - 1) {
				throw new Error(`Invalid authored Fluency item: ${pair}`);
			}
			return Object.freeze({
				id: `${prefix}-${index + 1}`,
				text: pair.slice(0, separator),
				meaning: pair.slice(separator + 1),
			});
		}),
	);
}

export function buildFluencyUnit(
	startDay: number,
	seeds: readonly FluencyLessonSeed[],
): readonly FluencyLesson[] {
	if (seeds.length !== 15)
		throw new Error(`Fluency unit starting Day ${startDay} must have 15 days.`);
	return Object.freeze(
		seeds.map((seed, index) => {
			const expectedDay = startDay + index;
			if (seed.day !== expectedDay) {
				throw new Error(`Fluency unit sequence is invalid at Day ${expectedDay}.`);
			}
			const vocabulary = parseItems(seed.vocabulary, `d${seed.day}-v`);
			const phrases = parseItems(seed.phrases, `d${seed.day}-p`);
			if (vocabulary.length < 3 || vocabulary.length > 5) {
				throw new Error(`Day ${seed.day} must author 3-5 vocabulary items.`);
			}
			if (phrases.length < 1 || phrases.length > 3) {
				throw new Error(`Day ${seed.day} must author 1-3 phrases.`);
			}
			if (
				seed.skillTargets.length === 0 ||
				new Set(seed.skillTargets).size !== seed.skillTargets.length
			) {
				throw new Error(`Day ${seed.day} has invalid skill targets.`);
			}
			const [title, focus, explanation, exampleOne, exampleTwo, exercise, expectedAnswer] =
				seed.grammar;
			const grammar: GrammarFocus = Object.freeze({
				id: `d${seed.day}-grammar`,
				title,
				focus,
				explanation,
				examples: Object.freeze([exampleOne, exampleTwo] as const),
				exercise,
				expectedAnswer,
			});
			return Object.freeze({
				content: Object.freeze({
					day: seed.day,
					week: Math.floor((seed.day - 1) / 7) + 1,
					phase: 'Fluency',
					theme: seed.theme,
					objective: seed.objective,
					grammar,
					vocabulary,
					phrases,
					voiceTask: seed.voiceTask,
				}),
				skillTargets: Object.freeze([...seed.skillTargets]),
			});
		}),
	);
}
