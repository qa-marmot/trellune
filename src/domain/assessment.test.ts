import { describe, expect, it } from 'vitest';
import {
	FOUNDATION_STAGE_ASSESSMENT,
	FLUENCY_STAGE_ASSESSMENT,
	GRADUATION_STAGE_ASSESSMENT,
	INTEGRATED_GRADUATION_STAGE_ASSESSMENT,
	INDEPENDENT_STAGE_ASSESSMENT,
	StageAssessmentSchema,
	buildStageAssessmentPrompt,
} from './assessment';

const validAssessment = {
	schemaVersion: '1.0' as const,
	assessmentId: FOUNDATION_STAGE_ASSESSMENT.assessmentId,
	attemptId: '12345678-1234-4234-8234-123456789abc',
	assessmentType: 'stage' as const,
	stageId: FOUNDATION_STAGE_ASSESSMENT.stageId,
	curriculumRange: { startDay: 1, endDay: 90 },
	completedAt: '2026-08-13T10:00:00+09:00',
	result: 'provisional' as const,
	scores: { grammar: 4, vocabulary: 3, speaking: 4, interaction: 3 },
	strengths: ['短い説明を自分の言葉で続けられる'],
	reinforcementTargets: ['過去形の精度'],
	evidence: [{ skill: 'grammar' as const, note: '過去形を概ね正しく使えた。' }],
	nextTargets: ['理由を添えて2文で答える'],
};

const validIndependentAssessment = {
	...validAssessment,
	assessmentId: INDEPENDENT_STAGE_ASSESSMENT.assessmentId,
	attemptId: '22345678-1234-4234-8234-123456789abc',
	stageId: INDEPENDENT_STAGE_ASSESSMENT.stageId,
	curriculumRange: { startDay: 91, endDay: 180 },
	scores: {
		grammar: 4,
		vocabulary: 4,
		speaking: 3,
		interaction: 4,
		listening: 3,
		fluency: 3,
	},
};

const validFluencyAssessment = {
	...validAssessment,
	assessmentId: FLUENCY_STAGE_ASSESSMENT.assessmentId,
	attemptId: '32345678-1234-4234-8234-123456789abc',
	stageId: FLUENCY_STAGE_ASSESSMENT.stageId,
	curriculumRange: { startDay: 181, endDay: 270 },
	scores: {
		speaking: 4,
		interaction: 4,
		fluency: 3,
		grammar: 4,
		vocabulary: 4,
		listening: 3,
	},
};

const validGraduationAssessment = {
	...validAssessment,
	assessmentId: GRADUATION_STAGE_ASSESSMENT.assessmentId,
	attemptId: '42345678-1234-4234-8234-123456789abc',
	stageId: GRADUATION_STAGE_ASSESSMENT.stageId,
	curriculumRange: { startDay: 271, endDay: 365 },
	cefrEstimate: 'B2-entry' as const,
	cefrEstimateScope: 'spoken' as const,
	scores: {
		speaking: 4,
		interaction: 4,
		fluency: 4,
		grammar: 4,
		vocabulary: 4,
		listening: 3,
	},
};

const validIntegratedGraduationAssessment = {
	...validGraduationAssessment,
	assessmentId: INTEGRATED_GRADUATION_STAGE_ASSESSMENT.assessmentId,
	attemptId: '52345678-1234-4234-8234-123456789abc',
	cefrEstimateScope: 'integrated' as const,
	scores: {
		...validGraduationAssessment.scores,
		reading: 4,
		writing: 3,
	},
	evidence: INTEGRATED_GRADUATION_STAGE_ASSESSMENT.requiredSkills.map((skill) => ({
		skill,
		note: `${skill}のtask evidenceを確認した。`,
	})),
};

describe('Stage Assessment domain', () => {
	it('requires only the skills selected by the assessment definition', () => {
		expect(StageAssessmentSchema.safeParse(validAssessment).success).toBe(true);
		expect(
			StageAssessmentSchema.safeParse({
				...validAssessment,
				scores: { grammar: 4, vocabulary: 3, speaking: 4 },
			}).success,
		).toBe(false);
		expect(
			StageAssessmentSchema.safeParse({
				...validAssessment,
				scores: { ...validAssessment.scores, pronunciation: 2 },
			}).success,
		).toBe(true);
	});

	it('binds the payload to the available Foundation definition and range', () => {
		expect(
			StageAssessmentSchema.safeParse({ ...validAssessment, assessmentId: 'future-stage' }).success,
		).toBe(false);
		expect(
			StageAssessmentSchema.safeParse({
				...validAssessment,
				curriculumRange: { startDay: 1, endDay: 91 },
			}).success,
		).toBe(false);
	});

	it('validates the Independent definition and only its selected required skills', () => {
		expect(StageAssessmentSchema.safeParse(validIndependentAssessment).success).toBe(true);
		expect(
			StageAssessmentSchema.safeParse({
				...validIndependentAssessment,
				scores: { ...validIndependentAssessment.scores, listening: undefined },
			}).success,
		).toBe(false);
		expect(
			StageAssessmentSchema.safeParse({
				...validIndependentAssessment,
				stageId: FOUNDATION_STAGE_ASSESSMENT.stageId,
			}).success,
		).toBe(false);
	});

	it('builds a bounded learner context without granting CEFR or locking Core', () => {
		const prompt = buildStageAssessmentPrompt(
			FOUNDATION_STAGE_ASSESSMENT,
			validAssessment.attemptId,
			{
				learnerName: 'Alex',
				goal: '英語で会議に参加する',
				currentDay: 90,
				completedDays: 90,
				repeatedWeaknesses: ['I go yesterday. → I went yesterday.'],
				relevantMistakes: [
					{ original: 'I go yesterday.', correction: 'I went yesterday.', repetitions: 3 },
				],
			},
		);
		expect(prompt).toContain('Required skills: grammar, vocabulary, speaking, interaction');
		expect(prompt).toContain('do not claim that a pass automatically certifies CEFR');
		expect(prompt).toContain('must not block continued Core study');
		expect(prompt).toContain('<LEARNER_CONTEXT>');
		expect(prompt).toContain(validAssessment.attemptId);
	});

	it('builds the Independent prompt as an estimate without locking Core or certifying B1', () => {
		const prompt = buildStageAssessmentPrompt(
			INDEPENDENT_STAGE_ASSESSMENT,
			validIndependentAssessment.attemptId,
			{
				learnerName: 'Alex',
				goal: '日常の意見交換を続ける',
				currentDay: 180,
				completedDays: 179,
				repeatedWeaknesses: ['時制の切り替え'],
				relevantMistakes: [],
			},
		);
		expect(prompt).toContain('Curriculum range: Day 91-180');
		expect(prompt).toContain(
			'Required skills: grammar, vocabulary, speaking, interaction, listening, fluency',
		);
		expect(prompt).toContain('estimated learning context only');
		expect(prompt).toContain('do not claim that a pass automatically certifies CEFR');
	});

	it('validates and prompts the Fluency assessment without certifying B1+', () => {
		expect(StageAssessmentSchema.safeParse(validFluencyAssessment).success).toBe(true);
		expect(
			StageAssessmentSchema.safeParse({
				...validFluencyAssessment,
				scores: { ...validFluencyAssessment.scores, listening: undefined },
			}).success,
		).toBe(false);
		const prompt = buildStageAssessmentPrompt(
			FLUENCY_STAGE_ASSESSMENT,
			validFluencyAssessment.attemptId,
			{
				learnerName: 'Alex',
				goal: '長い会話を自然に続ける',
				currentDay: 270,
				completedDays: 269,
				repeatedWeaknesses: ['要約でdetailを残しすぎる'],
				relevantMistakes: [],
			},
		);
		expect(prompt).toContain('Curriculum range: Day 181-270');
		expect(prompt).toContain(
			'Required skills: speaking, interaction, fluency, grammar, vocabulary, listening',
		);
		expect(prompt).toContain('estimated learning context only');
		expect(prompt).toContain('do not claim that a pass automatically certifies CEFR');
	});

	it('requires an evidence-based Graduation estimate without treating completion or pass as B2', () => {
		expect(StageAssessmentSchema.safeParse(validGraduationAssessment).success).toBe(true);
		expect(
			StageAssessmentSchema.safeParse({
				...validGraduationAssessment,
				cefrEstimateScope: undefined,
			}).success,
		).toBe(true);
		expect(
			StageAssessmentSchema.safeParse({
				...validGraduationAssessment,
				cefrEstimate: undefined,
			}).success,
		).toBe(false);
		expect(
			StageAssessmentSchema.safeParse({
				...validGraduationAssessment,
				cefrEstimateScope: 'integrated',
			}).success,
		).toBe(false);
		expect(
			StageAssessmentSchema.safeParse({ ...validAssessment, cefrEstimate: 'B2' }).success,
		).toBe(false);
		const prompt = buildStageAssessmentPrompt(
			GRADUATION_STAGE_ASSESSMENT,
			validGraduationAssessment.attemptId,
			{
				learnerName: 'Alex',
				goal: '複雑な話題でも対話を続ける',
				currentDay: 365,
				completedDays: 364,
				repeatedWeaknesses: ['推測を断定しやすい'],
				relevantMistakes: [],
			},
		);
		expect(prompt).toContain('Curriculum range: Day 271-365');
		expect(prompt).toContain('cefrEstimate');
		expect(prompt).toContain('Curriculum completion and pass status alone must never determine it');
		expect(prompt).toContain('"B1+", "B2-entry", or "B2"');
		expect(prompt).toContain('spoken/listening estimate, not a full CEFR estimate');
		expect(prompt).toContain('- cefrEstimateScope: "spoken"');
	});

	it('offers an integrated Graduation estimate with direct reading and writing evidence', () => {
		expect(StageAssessmentSchema.safeParse(validIntegratedGraduationAssessment).success).toBe(true);
		expect(
			StageAssessmentSchema.safeParse({
				...validIntegratedGraduationAssessment,
				cefrEstimateScope: undefined,
			}).success,
		).toBe(false);
		expect(
			StageAssessmentSchema.safeParse({
				...validIntegratedGraduationAssessment,
				scores: { ...validIntegratedGraduationAssessment.scores, writing: undefined },
			}).success,
		).toBe(false);
		const prompt = buildStageAssessmentPrompt(
			INTEGRATED_GRADUATION_STAGE_ASSESSMENT,
			validIntegratedGraduationAssessment.attemptId,
			{
				learnerName: 'Alex',
				goal: '複雑な話題を読み、書き、話して検討する',
				currentDay: 365,
				completedDays: 365,
				repeatedWeaknesses: ['反論を認めた後の再主張'],
				relevantMistakes: [],
			},
		);
		expect(prompt).toContain(
			'Required skills: speaking, interaction, fluency, grammar, vocabulary, listening, reading, writing',
		);
		expect(prompt).toContain('INTEGRATED READING TASK');
		expect(prompt).toContain('INTEGRATED WRITING TASK');
		expect(prompt).toContain('Required length: 180-250 words');
		expect(prompt).toContain(
			'observed listening, reading, spoken interaction, spoken production, and writing evidence',
		);
		expect(prompt).toContain('- cefrEstimateScope: "integrated"');
		expect(prompt).toContain('SKILL SCORE RUBRIC');
		expect(prompt).toContain(
			'B2: result must be pass and every required skill must score at least 4/5',
		);
		expect(prompt).toContain('Never average away a weak mode');
		expect(prompt).toContain(
			'include at least one specific evidence note for every required skill',
		);
	});

	it('enforces evidence and profile guardrails only for the current integrated assessment', () => {
		expect(
			StageAssessmentSchema.safeParse({
				...validIntegratedGraduationAssessment,
				evidence: validAssessment.evidence,
			}).success,
		).toBe(false);
		expect(
			StageAssessmentSchema.safeParse({
				...validIntegratedGraduationAssessment,
				scores: { ...validIntegratedGraduationAssessment.scores, writing: 2 },
			}).success,
		).toBe(false);
		expect(
			StageAssessmentSchema.safeParse({
				...validIntegratedGraduationAssessment,
				cefrEstimate: 'B2',
				scores: { ...validIntegratedGraduationAssessment.scores, writing: 3 },
			}).success,
		).toBe(false);
		expect(
			StageAssessmentSchema.safeParse({
				...validIntegratedGraduationAssessment,
				cefrEstimate: 'B2',
				result: 'pass',
				scores: Object.fromEntries(
					INTEGRATED_GRADUATION_STAGE_ASSESSMENT.requiredSkills.map((skill) => [skill, 4]),
				),
			}).success,
		).toBe(true);
	});
});
