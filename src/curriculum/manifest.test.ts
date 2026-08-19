import { describe, expect, it } from 'vitest';
import { CURRICULUM, CURRICULUM_TOTAL_DAYS } from '../data/curriculum';
import { AVAILABLE_CURRICULUM_TOTAL_DAYS, SUPPORTED_CURRICULUM_DAY_MAX } from './constants';
import { assertValidCurriculumManifest, CURRICULUM_MANIFEST, curriculumLessonId } from './manifest';

function canonicalize(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonicalize);
	if (value !== null && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
				.map(([key, entry]) => [key, canonicalize(entry)]),
		);
	}
	return value;
}

async function sha256(value: unknown): Promise<string> {
	const bytes = new TextEncoder().encode(JSON.stringify(canonicalize(value)));
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

describe('curriculum foundation manifest', () => {
	it('keeps every adapted Day 1-90 lesson deeply equal to the authored curriculum', () => {
		const adaptedContent = CURRICULUM_MANIFEST.lessons.slice(0, 90).map((lesson) => lesson.content);

		expect(adaptedContent).toEqual(CURRICULUM.slice(0, 90));
		expect(
			CURRICULUM_MANIFEST.lessons
				.slice(0, 90)
				.every((lesson, index) => lesson.content === CURRICULUM[index]),
		).toBe(true);
	});

	it('pins the authored Day 1-90 content fingerprint as a secondary change detector', async () => {
		expect(await sha256(CURRICULUM.slice(0, 90))).toBe(
			'65e894257b1c58e6b103e6b1649348709028efbb9ab6cb7f0f31e88e58491b01',
		);
	});

	it('keeps the released Day 91-180 lessons deeply equal and fingerprinted', async () => {
		const adapted = CURRICULUM_MANIFEST.lessons.slice(90, 180).map((lesson) => lesson.content);
		expect(adapted).toEqual(CURRICULUM.slice(90, 180));
		expect(adapted.every((lesson, index) => lesson === CURRICULUM[index + 90])).toBe(true);
		expect(await sha256(adapted)).toBe(
			'cbd894d3601847b3c0151a3a11b0c1d15a0bfb04baf2f3bdcfd756c9afaf99f8',
		);
	});

	it('keeps the released Day 181-270 lessons deeply equal and fingerprinted', async () => {
		const adapted = CURRICULUM_MANIFEST.lessons.slice(180, 270).map((lesson) => lesson.content);
		expect(adapted).toEqual(CURRICULUM.slice(180, 270));
		expect(adapted.every((lesson, index) => lesson === CURRICULUM[index + 180])).toBe(true);
		expect(await sha256(adapted)).toBe(
			'b27aab2c26022b5ca154e78c32b194791f015ea21bc46f58501362809d43f8ac',
		);
	});

	it('publishes 365 available days within the supported 540-day architecture', () => {
		expect(AVAILABLE_CURRICULUM_TOTAL_DAYS).toBe(365);
		expect(CURRICULUM_TOTAL_DAYS).toBe(AVAILABLE_CURRICULUM_TOTAL_DAYS);
		expect(SUPPORTED_CURRICULUM_DAY_MAX).toBe(540);
		expect(CURRICULUM_MANIFEST.availableTotalDays).toBe(365);
		expect(CURRICULUM_MANIFEST.supportedMaxDay).toBe(540);
		expect(CURRICULUM_MANIFEST.lessons).toHaveLength(365);
		expect(CURRICULUM_MANIFEST.lessons.at(-1)?.day).toBe(365);
		expect(CURRICULUM_MANIFEST.lessons.every((lesson) => lesson.practiceBlocks.length >= 2)).toBe(
			true,
		);
		expect(CURRICULUM_MANIFEST.stages).toEqual([
			expect.objectContaining({ startDay: 1, endDay: 90, entryCefr: 'A1', targetCefr: 'A2' }),
			expect.objectContaining({
				startDay: 91,
				endDay: 180,
				entryCefr: 'A2',
				targetCefr: 'B1',
				timeGuidance: {
					minimumCoreMinutes: [40, 45],
					recommendedMinutes: [45, 60],
					maximumWithBoostMinutes: 75,
					speakingMinutes: [8, 12],
				},
			}),
			expect.objectContaining({
				startDay: 181,
				endDay: 270,
				entryCefr: 'B1',
				targetCefr: 'B1+',
				timeGuidance: {
					minimumCoreMinutes: [45, 45],
					recommendedMinutes: [50, 70],
					maximumWithBoostMinutes: 80,
					speakingMinutes: [12, 18],
				},
			}),
			expect.objectContaining({
				startDay: 271,
				endDay: 365,
				entryCefr: 'B1+',
				targetCefr: 'B2',
				timeGuidance: {
					minimumCoreMinutes: [45, 60],
					recommendedMinutes: [60, 75],
					maximumWithBoostMinutes: 90,
					speakingMinutes: [15, 25],
				},
			}),
		]);
		expect(CURRICULUM_MANIFEST.units.map((unit) => unit.title)).toEqual([
			'Foundation',
			'Daily Life',
			'Connection',
			'Independence',
			'Experiences & Recent Events',
			'Reasons & Comparisons',
			'Plans, Advice & Possibilities',
			'Stories & Explaining Events',
			'Opinions & Everyday Discussions',
			'B1 Entry Integration',
			'Explaining Experiences in Detail',
			'Summarizing & Retelling',
			'Problems, Solutions & Decisions',
			'Opinions, Reasons & Perspectives',
			'Natural Interaction & Paraphrasing',
			'B1+ Integration',
			'Developing & Supporting Opinions',
			'Perspectives, Trade-offs & Hypotheticals',
			'Explaining Complex Ideas Clearly',
			'Discussion, Agreement & Counterpoints',
			'Inference, Nuance & Natural Interaction',
			'B2 Challenge Integration',
			'Graduation Preparation & Assessment',
		]);
		expect(() => assertValidCurriculumManifest(CURRICULUM_MANIFEST)).not.toThrow();
	});

	it('rejects missing lessons, duplicate IDs, and non-contiguous unit coverage', () => {
		expect(() =>
			assertValidCurriculumManifest({
				...CURRICULUM_MANIFEST,
				lessons: CURRICULUM_MANIFEST.lessons.slice(0, -1),
			}),
		).toThrow('every available lesson exactly once');

		expect(() =>
			assertValidCurriculumManifest({
				...CURRICULUM_MANIFEST,
				lessons: CURRICULUM_MANIFEST.lessons.map((lesson, index) =>
					index === 1 ? { ...lesson, id: CURRICULUM_MANIFEST.lessons[0].id } : lesson,
				),
			}),
		).toThrow('lesson IDs must be unique');

		expect(() =>
			assertValidCurriculumManifest({
				...CURRICULUM_MANIFEST,
				units: CURRICULUM_MANIFEST.units.map((unit, index) =>
					index === 0 ? { ...unit, endDay: unit.endDay - 1 } : unit,
				),
			}),
		).toThrow('unit coverage is invalid');

		expect(() =>
			assertValidCurriculumManifest({
				...CURRICULUM_MANIFEST,
				lessons: CURRICULUM_MANIFEST.lessons.map((lesson, index) =>
					index === 0
						? {
								...lesson,
								practiceBlocks: [
									{
										id: 'unstable-practice-id',
										kind: 'reading',
										title: 'Short reading',
										instructions: 'Read and answer.',
										estimatedMinutes: 5,
										skillTargets: ['reading'],
										prompts: [
											{
												id: 'main-idea',
												operation: 'comprehension',
												prompt: 'What is the main idea?',
												feedback: {
													rationale: 'Compare the response with the main idea.',
													checklist: ['I answered the question.'],
												},
											},
										],
									},
								],
							}
						: lesson,
				),
			}),
		).toThrow('practice block ID is unstable');
	});

	it('uses deterministic catalog-only lesson IDs across the supported range', () => {
		expect(curriculumLessonId(1)).toBe('english-os-core-day-001');
		expect(curriculumLessonId(90)).toBe('english-os-core-day-090');
		expect(curriculumLessonId(365)).toBe('english-os-core-day-365');
		expect(curriculumLessonId(540)).toBe('english-os-core-day-540');
		expect(CURRICULUM_MANIFEST.lessons.map((lesson) => lesson.id)).toEqual(
			CURRICULUM.map((day) => curriculumLessonId(day.day)),
		);
	});

	it('covers every Independent Unit boundary with stable references and selected skills', () => {
		const independent = CURRICULUM_MANIFEST.lessons.slice(90, 180);
		expect(independent).toHaveLength(90);
		expect(independent.map((lesson) => lesson.day)).toEqual(
			Array.from({ length: 90 }, (_, index) => index + 91),
		);
		expect(
			[91, 105, 106, 120, 121, 135, 136, 150, 151, 165, 166, 180].map((day) => {
				const lesson = independent.find((candidate) => candidate.day === day);
				return [lesson?.day, lesson?.unitId, lesson?.stageId];
			}),
		).toEqual([
			[91, 'english-os-core-unit-05-experiences', 'english-os-core-stage-independent-a2-b1-entry'],
			[105, 'english-os-core-unit-05-experiences', 'english-os-core-stage-independent-a2-b1-entry'],
			[
				106,
				'english-os-core-unit-06-reasons-comparisons',
				'english-os-core-stage-independent-a2-b1-entry',
			],
			[
				120,
				'english-os-core-unit-06-reasons-comparisons',
				'english-os-core-stage-independent-a2-b1-entry',
			],
			[
				121,
				'english-os-core-unit-07-plans-advice',
				'english-os-core-stage-independent-a2-b1-entry',
			],
			[
				135,
				'english-os-core-unit-07-plans-advice',
				'english-os-core-stage-independent-a2-b1-entry',
			],
			[
				136,
				'english-os-core-unit-08-stories-events',
				'english-os-core-stage-independent-a2-b1-entry',
			],
			[
				150,
				'english-os-core-unit-08-stories-events',
				'english-os-core-stage-independent-a2-b1-entry',
			],
			[151, 'english-os-core-unit-09-opinions', 'english-os-core-stage-independent-a2-b1-entry'],
			[165, 'english-os-core-unit-09-opinions', 'english-os-core-stage-independent-a2-b1-entry'],
			[166, 'english-os-core-unit-10-b1-entry', 'english-os-core-stage-independent-a2-b1-entry'],
			[180, 'english-os-core-unit-10-b1-entry', 'english-os-core-stage-independent-a2-b1-entry'],
		]);
		expect(independent.every((lesson) => lesson.skillTargets.length >= 3)).toBe(true);
		expect(independent.at(-1)?.skillTargets).toEqual([
			'speaking',
			'listening',
			'interaction',
			'fluency',
			'pronunciation',
			'grammar',
			'vocabulary',
			'writing',
			'reading',
		]);
	});

	it('covers every Fluency Unit boundary with stable references and selected skills', () => {
		const fluency = CURRICULUM_MANIFEST.lessons.slice(180, 270);
		expect(fluency).toHaveLength(90);
		expect(fluency.map((lesson) => lesson.day)).toEqual(
			Array.from({ length: 90 }, (_, index) => index + 181),
		);
		expect(
			[181, 195, 196, 210, 211, 225, 226, 240, 241, 255, 256, 270].map((day) => {
				const lesson = fluency.find((candidate) => candidate.day === day);
				return [lesson?.day, lesson?.unitId, lesson?.stageId];
			}),
		).toEqual([
			[
				181,
				'english-os-core-unit-11-detailed-experiences',
				'english-os-core-stage-fluency-b1-b1-plus',
			],
			[
				195,
				'english-os-core-unit-11-detailed-experiences',
				'english-os-core-stage-fluency-b1-b1-plus',
			],
			[
				196,
				'english-os-core-unit-12-summary-retelling',
				'english-os-core-stage-fluency-b1-b1-plus',
			],
			[
				210,
				'english-os-core-unit-12-summary-retelling',
				'english-os-core-stage-fluency-b1-b1-plus',
			],
			[
				211,
				'english-os-core-unit-13-problems-decisions',
				'english-os-core-stage-fluency-b1-b1-plus',
			],
			[
				225,
				'english-os-core-unit-13-problems-decisions',
				'english-os-core-stage-fluency-b1-b1-plus',
			],
			[
				226,
				'english-os-core-unit-14-opinions-perspectives',
				'english-os-core-stage-fluency-b1-b1-plus',
			],
			[
				240,
				'english-os-core-unit-14-opinions-perspectives',
				'english-os-core-stage-fluency-b1-b1-plus',
			],
			[
				241,
				'english-os-core-unit-15-natural-interaction',
				'english-os-core-stage-fluency-b1-b1-plus',
			],
			[
				255,
				'english-os-core-unit-15-natural-interaction',
				'english-os-core-stage-fluency-b1-b1-plus',
			],
			[
				256,
				'english-os-core-unit-16-b1-plus-integration',
				'english-os-core-stage-fluency-b1-b1-plus',
			],
			[
				270,
				'english-os-core-unit-16-b1-plus-integration',
				'english-os-core-stage-fluency-b1-b1-plus',
			],
		]);
		expect(fluency.every((lesson) => lesson.skillTargets.length >= 3)).toBe(true);
		expect(fluency.at(-1)?.skillTargets).toEqual([
			'listening',
			'speaking',
			'interaction',
			'fluency',
			'grammar',
			'vocabulary',
			'writing',
			'reading',
		]);
	});

	it('covers every B2 Challenge Unit boundary with stable references and selected skills', () => {
		const challenge = CURRICULUM_MANIFEST.lessons.slice(270, 365);
		expect(challenge).toHaveLength(95);
		expect(challenge.map((lesson) => lesson.day)).toEqual(
			Array.from({ length: 95 }, (_, index) => index + 271),
		);
		for (const day of [271, 285, 286, 300, 301, 315, 316, 330, 331, 345, 346, 360, 361, 365]) {
			const lesson = challenge.find((candidate) => candidate.day === day);
			expect(lesson?.stageId).toBe('english-os-core-stage-b2-challenge-b1-plus-b2');
			expect(lesson?.skillTargets.length).toBeGreaterThanOrEqual(3);
		}
	});

	it.each([0, 1.5, 541])('rejects an unsupported catalog lesson day: %s', (day) => {
		expect(() => curriculumLessonId(day)).toThrow(RangeError);
	});
});
