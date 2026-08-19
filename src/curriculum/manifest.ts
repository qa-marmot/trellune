import {
	CURRICULUM,
	DAILY_NEW_PHRASE_LIMIT,
	DAILY_NEW_WORD_LIMIT,
	type CurriculumDay,
	type CurriculumPhase,
} from '../data/curriculum';
import { INDEPENDENT_LESSONS } from '../data/independent';
import { FLUENCY_LESSONS } from '../data/fluency';
import { B2_CHALLENGE_LESSONS } from '../data/b2Challenge';
import { FOUNDATION_PRACTICE_LABS } from '../data/practice/foundation';
import { INDEPENDENT_PRACTICE_LABS } from '../data/practice/independent';
import { FLUENCY_PRACTICE_LABS } from '../data/practice/fluency';
import { B2_CHALLENGE_PRACTICE_LABS } from '../data/practice/b2Challenge';
import { LONG_FORM_CHALLENGES } from '../data/practice/longForm';
import { buildPracticeBlocks, type IntegratedLabSeed } from '../data/practice/shared';
import {
	AVAILABLE_CURRICULUM_TOTAL_DAYS,
	CURRICULUM_CATALOG_ID,
	CURRICULUM_CONTENT_VERSION,
	SUPPORTED_CURRICULUM_DAY_MAX,
} from './constants';
import type {
	CurriculumLesson,
	CurriculumManifest,
	CurriculumStage,
	CurriculumUnit,
	PracticeBlock,
	SkillTarget,
} from './model';

export const FOUNDATION_STAGE_ID = 'english-os-core-stage-foundation-a1-a2';
export const INDEPENDENT_STAGE_ID = 'english-os-core-stage-independent-a2-b1-entry';
export const FLUENCY_STAGE_ID = 'english-os-core-stage-fluency-b1-b1-plus';
export const B2_CHALLENGE_STAGE_ID = 'english-os-core-stage-b2-challenge-b1-plus-b2';

type LegacyCurriculumPhase = Exclude<CurriculumPhase, 'Independent' | 'Fluency' | 'B2 Challenge'>;

const LEGACY_UNIT_METADATA = {
	Foundation: { id: 'english-os-core-unit-foundation', title: 'Foundation' },
	'Daily Life': { id: 'english-os-core-unit-daily-life', title: 'Daily Life' },
	Connection: { id: 'english-os-core-unit-connection', title: 'Connection' },
	Independence: { id: 'english-os-core-unit-independence', title: 'Independence' },
} as const satisfies Record<LegacyCurriculumPhase, { readonly id: string; readonly title: string }>;

const INDEPENDENT_UNIT_METADATA = Object.freeze([
	Object.freeze({
		id: 'english-os-core-unit-05-experiences',
		title: 'Experiences & Recent Events',
		startDay: 91,
		endDay: 105,
	}),
	Object.freeze({
		id: 'english-os-core-unit-06-reasons-comparisons',
		title: 'Reasons & Comparisons',
		startDay: 106,
		endDay: 120,
	}),
	Object.freeze({
		id: 'english-os-core-unit-07-plans-advice',
		title: 'Plans, Advice & Possibilities',
		startDay: 121,
		endDay: 135,
	}),
	Object.freeze({
		id: 'english-os-core-unit-08-stories-events',
		title: 'Stories & Explaining Events',
		startDay: 136,
		endDay: 150,
	}),
	Object.freeze({
		id: 'english-os-core-unit-09-opinions',
		title: 'Opinions & Everyday Discussions',
		startDay: 151,
		endDay: 165,
	}),
	Object.freeze({
		id: 'english-os-core-unit-10-b1-entry',
		title: 'B1 Entry Integration',
		startDay: 166,
		endDay: 180,
	}),
]);

const FLUENCY_UNIT_METADATA = Object.freeze([
	Object.freeze({
		id: 'english-os-core-unit-11-detailed-experiences',
		title: 'Explaining Experiences in Detail',
		startDay: 181,
		endDay: 195,
	}),
	Object.freeze({
		id: 'english-os-core-unit-12-summary-retelling',
		title: 'Summarizing & Retelling',
		startDay: 196,
		endDay: 210,
	}),
	Object.freeze({
		id: 'english-os-core-unit-13-problems-decisions',
		title: 'Problems, Solutions & Decisions',
		startDay: 211,
		endDay: 225,
	}),
	Object.freeze({
		id: 'english-os-core-unit-14-opinions-perspectives',
		title: 'Opinions, Reasons & Perspectives',
		startDay: 226,
		endDay: 240,
	}),
	Object.freeze({
		id: 'english-os-core-unit-15-natural-interaction',
		title: 'Natural Interaction & Paraphrasing',
		startDay: 241,
		endDay: 255,
	}),
	Object.freeze({
		id: 'english-os-core-unit-16-b1-plus-integration',
		title: 'B1+ Integration',
		startDay: 256,
		endDay: 270,
	}),
]);

const B2_CHALLENGE_UNIT_METADATA = Object.freeze([
	Object.freeze({
		id: 'english-os-core-unit-17-supported-opinions',
		title: 'Developing & Supporting Opinions',
		startDay: 271,
		endDay: 285,
	}),
	Object.freeze({
		id: 'english-os-core-unit-18-tradeoffs-hypotheticals',
		title: 'Perspectives, Trade-offs & Hypotheticals',
		startDay: 286,
		endDay: 300,
	}),
	Object.freeze({
		id: 'english-os-core-unit-19-complex-explanations',
		title: 'Explaining Complex Ideas Clearly',
		startDay: 301,
		endDay: 315,
	}),
	Object.freeze({
		id: 'english-os-core-unit-20-discussion-counterpoints',
		title: 'Discussion, Agreement & Counterpoints',
		startDay: 316,
		endDay: 330,
	}),
	Object.freeze({
		id: 'english-os-core-unit-21-inference-nuance',
		title: 'Inference, Nuance & Natural Interaction',
		startDay: 331,
		endDay: 345,
	}),
	Object.freeze({
		id: 'english-os-core-unit-22-b2-integration',
		title: 'B2 Challenge Integration',
		startDay: 346,
		endDay: 360,
	}),
	Object.freeze({
		id: 'english-os-core-unit-23-graduation',
		title: 'Graduation Preparation & Assessment',
		startDay: 361,
		endDay: 365,
	}),
]);

const LEGACY_SKILL_TARGETS = Object.freeze([
	'grammar',
	'vocabulary',
	'speaking',
	'interaction',
] as const satisfies readonly SkillTarget[]);

function practiceFor(
	content: CurriculumDay,
	labs: ReadonlyMap<number, IntegratedLabSeed>,
): readonly PracticeBlock[] {
	return buildPracticeBlocks(
		content,
		CURRICULUM.slice(0, content.day - 1),
		labs,
		LONG_FORM_CHALLENGES,
	);
}

function targetsWithPractice(
	base: readonly SkillTarget[],
	practiceBlocks: readonly PracticeBlock[],
): readonly SkillTarget[] {
	return Object.freeze([
		...new Set([...base, ...practiceBlocks.flatMap((block) => block.skillTargets)]),
	]);
}

export function curriculumLessonId(day: number): string {
	if (!Number.isInteger(day) || day < 1 || day > SUPPORTED_CURRICULUM_DAY_MAX) {
		throw new RangeError(
			`Curriculum day must be an integer from 1 to ${SUPPORTED_CURRICULUM_DAY_MAX}.`,
		);
	}
	return `english-os-core-day-${String(day).padStart(3, '0')}`;
}

function buildLegacyUnits(curriculum: readonly CurriculumDay[]): readonly CurriculumUnit[] {
	const phases = [...new Set(curriculum.map((day) => day.phase))];
	return phases.map((phase) => {
		if (phase === 'Independent' || phase === 'Fluency' || phase === 'B2 Challenge') {
			throw new Error('Extended curriculum lessons cannot use legacy units.');
		}
		const matchingDays = curriculum.filter((day) => day.phase === phase).map((day) => day.day);
		const startDay = matchingDays[0];
		const endDay = matchingDays.at(-1);
		if (startDay === undefined || endDay === undefined) {
			throw new Error(`Curriculum phase has no lessons: ${phase}`);
		}
		return Object.freeze({
			...LEGACY_UNIT_METADATA[phase],
			stageId: FOUNDATION_STAGE_ID,
			startDay,
			endDay,
		});
	});
}

function buildIndependentUnits(): readonly CurriculumUnit[] {
	return INDEPENDENT_UNIT_METADATA.map((unit) =>
		Object.freeze({ ...unit, stageId: INDEPENDENT_STAGE_ID }),
	);
}

function buildFluencyUnits(): readonly CurriculumUnit[] {
	return FLUENCY_UNIT_METADATA.map((unit) => Object.freeze({ ...unit, stageId: FLUENCY_STAGE_ID }));
}

function buildB2ChallengeUnits(): readonly CurriculumUnit[] {
	return B2_CHALLENGE_UNIT_METADATA.map((unit) =>
		Object.freeze({ ...unit, stageId: B2_CHALLENGE_STAGE_ID }),
	);
}

function buildLegacyLessons(curriculum: readonly CurriculumDay[]): readonly CurriculumLesson[] {
	return curriculum.map((content) => {
		if (
			content.phase === 'Independent' ||
			content.phase === 'Fluency' ||
			content.phase === 'B2 Challenge'
		) {
			throw new Error(`Extended Day ${content.day} cannot use the legacy adapter.`);
		}
		const practiceBlocks = practiceFor(content, FOUNDATION_PRACTICE_LABS);
		return Object.freeze({
			id: curriculumLessonId(content.day),
			day: content.day,
			week: content.week,
			stageId: FOUNDATION_STAGE_ID,
			unitId: LEGACY_UNIT_METADATA[content.phase].id,
			skillTargets: targetsWithPractice(LEGACY_SKILL_TARGETS, practiceBlocks),
			practiceBlocks,
			content,
		});
	});
}

function buildIndependentLessons(): readonly CurriculumLesson[] {
	return INDEPENDENT_LESSONS.map(({ content, skillTargets }) => {
		const unit = INDEPENDENT_UNIT_METADATA.find(
			(candidate) => candidate.startDay <= content.day && content.day <= candidate.endDay,
		);
		if (!unit) throw new Error(`Independent lesson has no unit: Day ${content.day}`);
		const practiceBlocks = practiceFor(content, INDEPENDENT_PRACTICE_LABS);
		return Object.freeze({
			id: curriculumLessonId(content.day),
			day: content.day,
			week: content.week,
			stageId: INDEPENDENT_STAGE_ID,
			unitId: unit.id,
			skillTargets: targetsWithPractice(skillTargets, practiceBlocks),
			practiceBlocks,
			content,
		});
	});
}

function buildFluencyLessons(): readonly CurriculumLesson[] {
	return FLUENCY_LESSONS.map(({ content, skillTargets }) => {
		const unit = FLUENCY_UNIT_METADATA.find(
			(candidate) => candidate.startDay <= content.day && content.day <= candidate.endDay,
		);
		if (!unit) throw new Error(`Fluency lesson has no unit: Day ${content.day}`);
		const practiceBlocks = practiceFor(content, FLUENCY_PRACTICE_LABS);
		return Object.freeze({
			id: curriculumLessonId(content.day),
			day: content.day,
			week: content.week,
			stageId: FLUENCY_STAGE_ID,
			unitId: unit.id,
			skillTargets: targetsWithPractice(skillTargets, practiceBlocks),
			practiceBlocks,
			content,
		});
	});
}

function buildB2ChallengeLessons(): readonly CurriculumLesson[] {
	return B2_CHALLENGE_LESSONS.map(({ content, skillTargets }) => {
		const unit = B2_CHALLENGE_UNIT_METADATA.find(
			(candidate) => candidate.startDay <= content.day && content.day <= candidate.endDay,
		);
		if (!unit) throw new Error(`B2 Challenge lesson has no unit: Day ${content.day}`);
		const practiceBlocks = practiceFor(content, B2_CHALLENGE_PRACTICE_LABS);
		return Object.freeze({
			id: curriculumLessonId(content.day),
			day: content.day,
			week: content.week,
			stageId: B2_CHALLENGE_STAGE_ID,
			unitId: unit.id,
			skillTargets: targetsWithPractice(skillTargets, practiceBlocks),
			practiceBlocks,
			content,
		});
	});
}

function duplicateValues(values: readonly string[]): readonly string[] {
	const seen = new Set<string>();
	const duplicates = new Set<string>();
	for (const value of values) {
		if (seen.has(value)) duplicates.add(value);
		seen.add(value);
	}
	return [...duplicates];
}

export function assertValidCurriculumManifest(manifest: CurriculumManifest): void {
	if (
		!Number.isInteger(manifest.supportedMaxDay) ||
		manifest.supportedMaxDay < 1 ||
		manifest.supportedMaxDay > SUPPORTED_CURRICULUM_DAY_MAX
	) {
		throw new Error('Curriculum manifest has an invalid supported maximum day.');
	}
	if (
		!Number.isInteger(manifest.availableTotalDays) ||
		manifest.availableTotalDays < 1 ||
		manifest.availableTotalDays > manifest.supportedMaxDay
	) {
		throw new Error('Curriculum manifest has an invalid available total day count.');
	}
	if (manifest.lessons.length !== manifest.availableTotalDays) {
		throw new Error('Curriculum manifest must contain every available lesson exactly once.');
	}

	const stageIds = new Set(manifest.stages.map((stage) => stage.id));
	const unitIds = new Set(manifest.units.map((unit) => unit.id));
	if (stageIds.size !== manifest.stages.length || unitIds.size !== manifest.units.length) {
		throw new Error('Curriculum stage and unit IDs must be unique.');
	}
	if (duplicateValues(manifest.lessons.map((lesson) => lesson.id)).length > 0) {
		throw new Error('Curriculum lesson IDs must be unique.');
	}
	const grammarIds = manifest.lessons.map((lesson) => lesson.content.grammar.id);
	const vocabularyIds = manifest.lessons.flatMap((lesson) =>
		lesson.content.vocabulary.map((item) => item.id),
	);
	const phraseIds = manifest.lessons.flatMap((lesson) =>
		lesson.content.phrases.map((item) => item.id),
	);
	if (
		duplicateValues(grammarIds).length > 0 ||
		duplicateValues(vocabularyIds).length > 0 ||
		duplicateValues(phraseIds).length > 0
	) {
		throw new Error('Curriculum content IDs must be unique.');
	}

	for (const [index, lesson] of manifest.lessons.entries()) {
		const expectedDay = index + 1;
		if (lesson.day !== expectedDay || lesson.content.day !== expectedDay) {
			throw new Error(`Curriculum lesson sequence is invalid at Day ${expectedDay}.`);
		}
		if (lesson.id !== curriculumLessonId(expectedDay)) {
			throw new Error(`Curriculum lesson ID is invalid at Day ${expectedDay}.`);
		}
		if (lesson.week !== lesson.content.week) {
			throw new Error(`Curriculum lesson week is invalid at Day ${expectedDay}.`);
		}
		if (lesson.day > 90 && lesson.week !== Math.floor((lesson.day - 1) / 7) + 1) {
			throw new Error(`Extended curriculum week is invalid at Day ${expectedDay}.`);
		}
		if (!stageIds.has(lesson.stageId) || !unitIds.has(lesson.unitId)) {
			throw new Error(`Curriculum lesson references unknown metadata at Day ${expectedDay}.`);
		}
		const coveringStages = manifest.stages.filter(
			(stage) => stage.startDay <= lesson.day && lesson.day <= stage.endDay,
		);
		const coveringUnits = manifest.units.filter(
			(unit) => unit.startDay <= lesson.day && lesson.day <= unit.endDay,
		);
		if (coveringStages.length !== 1 || coveringStages[0]?.id !== lesson.stageId) {
			throw new Error(`Curriculum stage coverage is invalid at Day ${expectedDay}.`);
		}
		if (
			coveringUnits.length !== 1 ||
			coveringUnits[0]?.id !== lesson.unitId ||
			coveringUnits[0].stageId !== lesson.stageId
		) {
			throw new Error(`Curriculum unit coverage is invalid at Day ${expectedDay}.`);
		}
		if (!coveringStages[0].unitIds.includes(lesson.unitId)) {
			throw new Error(`Curriculum stage does not own the lesson unit at Day ${expectedDay}.`);
		}
		if (lesson.skillTargets.length === 0) {
			throw new Error(`Curriculum lesson has no skill targets at Day ${expectedDay}.`);
		}
		if (new Set(lesson.skillTargets).size !== lesson.skillTargets.length) {
			throw new Error(`Curriculum lesson has duplicate skill targets at Day ${expectedDay}.`);
		}
		const practiceIds = lesson.practiceBlocks.map((block) => block.id);
		const practicePromptIds = lesson.practiceBlocks.flatMap((block) =>
			block.prompts.map((prompt) => prompt.id),
		);
		if (new Set(practiceIds).size !== practiceIds.length) {
			throw new Error(`Curriculum lesson has duplicate practice block IDs at Day ${expectedDay}.`);
		}
		if (new Set(practicePromptIds).size !== practicePromptIds.length) {
			throw new Error(`Curriculum lesson has duplicate practice prompt IDs at Day ${expectedDay}.`);
		}
		for (const block of lesson.practiceBlocks) {
			if (!block.id.startsWith(`${lesson.id}-practice-`)) {
				throw new Error(`Curriculum practice block ID is unstable at Day ${expectedDay}.`);
			}
			if (!Number.isInteger(block.estimatedMinutes) || block.estimatedMinutes < 1) {
				throw new Error(`Curriculum practice time is invalid at Day ${expectedDay}.`);
			}
			if (block.skillTargets.length === 0 || block.prompts.length === 0) {
				throw new Error(`Curriculum practice content is incomplete at Day ${expectedDay}.`);
			}
			if (new Set(block.skillTargets).size !== block.skillTargets.length) {
				throw new Error(`Curriculum practice has duplicate skills at Day ${expectedDay}.`);
			}
			if (block.skillTargets.some((skill) => !lesson.skillTargets.includes(skill))) {
				throw new Error(`Curriculum lesson omits a practice skill at Day ${expectedDay}.`);
			}
			if (block.skillTargets.includes('reading') && !block.sourceText?.trim()) {
				throw new Error(`Curriculum reading practice has no source text at Day ${expectedDay}.`);
			}
			if (new Set(block.prompts.map((prompt) => prompt.id)).size !== block.prompts.length) {
				throw new Error(`Curriculum practice has duplicate prompt IDs at Day ${expectedDay}.`);
			}
			for (const prompt of block.prompts) {
				if (
					prompt.output &&
					(!Number.isInteger(prompt.output.minimumWords) ||
						!Number.isInteger(prompt.output.maximumWords) ||
						prompt.output.minimumWords < 1 ||
						prompt.output.maximumWords < prompt.output.minimumWords)
				) {
					throw new Error(
						`Curriculum practice prompt output range is invalid at Day ${expectedDay}.`,
					);
				}
			}
			if (
				block.output &&
				(!Number.isInteger(block.output.minimumWords) ||
					!Number.isInteger(block.output.maximumWords) ||
					block.output.minimumWords < 1 ||
					block.output.maximumWords < block.output.minimumWords)
			) {
				throw new Error(`Curriculum practice output range is invalid at Day ${expectedDay}.`);
			}
		}
		if (lesson.content.vocabulary.length > DAILY_NEW_WORD_LIMIT) {
			throw new Error(`Curriculum vocabulary limit exceeded at Day ${expectedDay}.`);
		}
		if (lesson.content.phrases.length > DAILY_NEW_PHRASE_LIMIT) {
			throw new Error(`Curriculum phrase limit exceeded at Day ${expectedDay}.`);
		}
	}

	for (const unit of manifest.units) {
		if (!stageIds.has(unit.stageId) || unit.startDay < 1 || unit.endDay < unit.startDay) {
			throw new Error(`Curriculum unit range is invalid: ${unit.id}`);
		}
		for (let day = unit.startDay; day <= unit.endDay; day += 1) {
			if (manifest.lessons[day - 1]?.unitId !== unit.id) {
				throw new Error(`Curriculum unit is not contiguous: ${unit.id}`);
			}
		}
	}

	for (const stage of manifest.stages) {
		if (stage.startDay < 1 || stage.endDay < stage.startDay) {
			throw new Error(`Curriculum stage range is invalid: ${stage.id}`);
		}
		const [minimumStart, minimumEnd] = stage.timeGuidance.minimumCoreMinutes;
		const [recommendedStart, recommendedEnd] = stage.timeGuidance.recommendedMinutes;
		const [speakingStart, speakingEnd] = stage.timeGuidance.speakingMinutes;
		if (
			![
				minimumStart,
				minimumEnd,
				recommendedStart,
				recommendedEnd,
				speakingStart,
				speakingEnd,
			].every((value) => Number.isInteger(value) && value > 0) ||
			minimumStart > minimumEnd ||
			recommendedStart > recommendedEnd ||
			recommendedStart < minimumStart ||
			minimumEnd > recommendedEnd ||
			speakingStart > speakingEnd ||
			!Number.isInteger(stage.timeGuidance.maximumWithBoostMinutes) ||
			stage.timeGuidance.maximumWithBoostMinutes < recommendedEnd
		) {
			throw new Error(`Curriculum stage time guidance is invalid: ${stage.id}`);
		}
		if (stage.unitIds.some((unitId) => !unitIds.has(unitId))) {
			throw new Error(`Curriculum stage references an unknown unit: ${stage.id}`);
		}
		for (let day = stage.startDay; day <= stage.endDay; day += 1) {
			if (manifest.lessons[day - 1]?.stageId !== stage.id) {
				throw new Error(`Curriculum stage is not contiguous: ${stage.id}`);
			}
		}
	}
}

const foundationUnits = buildLegacyUnits(CURRICULUM.slice(0, 90));
const independentUnits = buildIndependentUnits();
const fluencyUnits = buildFluencyUnits();
const b2ChallengeUnits = buildB2ChallengeUnits();
const units = Object.freeze([
	...foundationUnits,
	...independentUnits,
	...fluencyUnits,
	...b2ChallengeUnits,
]);
const stages: readonly CurriculumStage[] = Object.freeze([
	Object.freeze({
		id: FOUNDATION_STAGE_ID,
		title: 'Foundation · A1 to A2',
		startDay: 1,
		endDay: 90,
		entryCefr: 'A1',
		targetCefr: 'A2',
		timeGuidance: Object.freeze({
			minimumCoreMinutes: Object.freeze([20, 20] as const),
			recommendedMinutes: Object.freeze([20, 30] as const),
			maximumWithBoostMinutes: 60,
			speakingMinutes: Object.freeze([4, 10] as const),
		}),
		unitIds: Object.freeze(foundationUnits.map((unit) => unit.id)),
	}),
	Object.freeze({
		id: INDEPENDENT_STAGE_ID,
		title: 'Independent · A2 to B1 Entry',
		startDay: 91,
		endDay: 180,
		entryCefr: 'A2',
		targetCefr: 'B1',
		timeGuidance: Object.freeze({
			minimumCoreMinutes: Object.freeze([40, 45] as const),
			recommendedMinutes: Object.freeze([45, 60] as const),
			maximumWithBoostMinutes: 75,
			speakingMinutes: Object.freeze([8, 12] as const),
		}),
		unitIds: Object.freeze(independentUnits.map((unit) => unit.id)),
	}),
	Object.freeze({
		id: FLUENCY_STAGE_ID,
		title: 'Fluency · B1 to B1+',
		startDay: 181,
		endDay: 270,
		entryCefr: 'B1',
		targetCefr: 'B1+',
		timeGuidance: Object.freeze({
			minimumCoreMinutes: Object.freeze([45, 45] as const),
			recommendedMinutes: Object.freeze([50, 70] as const),
			maximumWithBoostMinutes: 80,
			speakingMinutes: Object.freeze([12, 18] as const),
		}),
		unitIds: Object.freeze(fluencyUnits.map((unit) => unit.id)),
	}),
	Object.freeze({
		id: B2_CHALLENGE_STAGE_ID,
		title: 'B2 Challenge · B1+ to B2 Entry',
		startDay: 271,
		endDay: 365,
		entryCefr: 'B1+',
		targetCefr: 'B2',
		timeGuidance: Object.freeze({
			minimumCoreMinutes: Object.freeze([45, 60] as const),
			recommendedMinutes: Object.freeze([60, 75] as const),
			maximumWithBoostMinutes: 90,
			speakingMinutes: Object.freeze([15, 25] as const),
		}),
		unitIds: Object.freeze(b2ChallengeUnits.map((unit) => unit.id)),
	}),
]);

export const CURRICULUM_MANIFEST: CurriculumManifest = Object.freeze({
	id: CURRICULUM_CATALOG_ID,
	contentVersion: CURRICULUM_CONTENT_VERSION,
	availableTotalDays: AVAILABLE_CURRICULUM_TOTAL_DAYS,
	supportedMaxDay: SUPPORTED_CURRICULUM_DAY_MAX,
	stages,
	units,
	lessons: Object.freeze([
		...buildLegacyLessons(CURRICULUM.slice(0, 90)),
		...buildIndependentLessons(),
		...buildFluencyLessons(),
		...buildB2ChallengeLessons(),
	]),
});

assertValidCurriculumManifest(CURRICULUM_MANIFEST);
