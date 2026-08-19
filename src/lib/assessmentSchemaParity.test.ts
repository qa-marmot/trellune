import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { beforeAll, describe, expect, it } from 'vitest';
import publishedSchema from '../../docs/schemas/assessment-json-1.0.schema.json';
import {
	FOUNDATION_STAGE_ASSESSMENT,
	FLUENCY_STAGE_ASSESSMENT,
	GRADUATION_STAGE_ASSESSMENT,
	INTEGRATED_GRADUATION_STAGE_ASSESSMENT,
	INDEPENDENT_STAGE_ASSESSMENT,
	StageAssessmentSchema,
} from '../domain/assessment';

const canonical = {
	schemaVersion: '1.0',
	assessmentId: FOUNDATION_STAGE_ASSESSMENT.assessmentId,
	attemptId: '12345678-1234-4234-8234-123456789abc',
	assessmentType: 'stage',
	stageId: FOUNDATION_STAGE_ASSESSMENT.stageId,
	curriculumRange: { startDay: 1, endDay: 90 },
	completedAt: '2026-08-13T10:00:00+09:00',
	result: 'pass',
	scores: { grammar: 4, vocabulary: 4, speaking: 3, interaction: 4 },
	strengths: ['会話を継続できた'],
	reinforcementTargets: [],
	evidence: [{ skill: 'interaction', note: '聞き返しを使えた。' }],
	nextTargets: ['説明を詳しくする'],
};

const independent = {
	...canonical,
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

const fluency = {
	...canonical,
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

const graduation = {
	...canonical,
	assessmentId: GRADUATION_STAGE_ASSESSMENT.assessmentId,
	attemptId: '42345678-1234-4234-8234-123456789abc',
	stageId: GRADUATION_STAGE_ASSESSMENT.stageId,
	curriculumRange: { startDay: 271, endDay: 365 },
	cefrEstimate: 'B2-entry',
	cefrEstimateScope: 'spoken',
	scores: {
		speaking: 4,
		interaction: 4,
		fluency: 4,
		grammar: 4,
		vocabulary: 4,
		listening: 3,
	},
};

const integratedGraduation = {
	...graduation,
	assessmentId: INTEGRATED_GRADUATION_STAGE_ASSESSMENT.assessmentId,
	attemptId: '52345678-1234-4234-8234-123456789abc',
	cefrEstimateScope: 'integrated',
	scores: { ...graduation.scores, reading: 4, writing: 3 },
	evidence: INTEGRATED_GRADUATION_STAGE_ASSESSMENT.requiredSkills.map((skill) => ({
		skill,
		note: `${skill} evidence`,
	})),
};

const legacyIntegratedGraduation = {
	...integratedGraduation,
	assessmentId: 'english-os-stage-assessment-graduation-integrated-v1',
	attemptId: '62345678-1234-4234-8234-123456789abc',
	evidence: canonical.evidence,
};

let validatePublishedSchema: ReturnType<Ajv2020['compile']>;

beforeAll(() => {
	const ajv = new Ajv2020({ strict: true, allErrors: true });
	addFormats(ajv);
	validatePublishedSchema = ajv.compile(publishedSchema);
});

describe('published ASSESSMENT_JSON schema parity', () => {
	it.each([
		['valid required scores only', canonical],
		['valid optional skill', { ...canonical, scores: { ...canonical.scores, pronunciation: 3 } }],
		[
			'valid optional reading and writing skills',
			{ ...canonical, scores: { ...canonical.scores, reading: 3, writing: 3 } },
		],
		['missing required score', { ...canonical, scores: { grammar: 4, vocabulary: 4 } }],
		['unknown score', { ...canonical, scores: { ...canonical.scores, confidence: 4 } }],
		['wrong range', { ...canonical, curriculumRange: { startDay: 1, endDay: 91 } }],
		['wrong definition', { ...canonical, assessmentId: 'future-assessment' }],
		['valid Independent assessment', independent],
		['Independent missing listening', { ...independent, scores: canonical.scores }],
		['Independent wrong range', { ...independent, curriculumRange: { startDay: 90, endDay: 180 } }],
		['valid Fluency assessment', fluency],
		[
			'Fluency missing listening',
			{ ...fluency, scores: { ...fluency.scores, listening: undefined } },
		],
		['Fluency wrong range', { ...fluency, curriculumRange: { startDay: 180, endDay: 270 } }],
		['valid Graduation assessment', graduation],
		['Graduation estimate B1+', { ...graduation, cefrEstimate: 'B1+' }],
		['Graduation estimate B2', { ...graduation, cefrEstimate: 'B2' }],
		['legacy Graduation without scope', { ...graduation, cefrEstimateScope: undefined }],
		['Graduation integrated scope rejected', { ...graduation, cefrEstimateScope: 'integrated' }],
		['Graduation missing estimate', { ...graduation, cefrEstimate: undefined }],
		['Graduation invalid estimate', { ...graduation, cefrEstimate: 'C1' }],
		['valid integrated Graduation assessment', integratedGraduation],
		['legacy integrated Graduation remains valid', legacyIntegratedGraduation],
		[
			'integrated Graduation missing reading',
			{ ...integratedGraduation, scores: { ...integratedGraduation.scores, reading: undefined } },
		],
		[
			'integrated Graduation missing scope',
			{ ...integratedGraduation, cefrEstimateScope: undefined },
		],
		[
			'integrated Graduation spoken scope rejected',
			{ ...integratedGraduation, cefrEstimateScope: 'spoken' },
		],
		[
			'integrated Graduation requires evidence for every core skill',
			{ ...integratedGraduation, evidence: canonical.evidence },
		],
		[
			'integrated Graduation B2-entry rejects a score below 3',
			{ ...integratedGraduation, scores: { ...integratedGraduation.scores, writing: 2 } },
		],
		[
			'integrated Graduation B2 rejects a score below 4',
			{ ...integratedGraduation, cefrEstimate: 'B2' },
		],
		[
			'integrated Graduation B2 requires pass',
			{
				...integratedGraduation,
				cefrEstimate: 'B2',
				result: 'provisional',
				scores: Object.fromEntries(
					INTEGRATED_GRADUATION_STAGE_ASSESSMENT.requiredSkills.map((skill) => [skill, 4]),
				),
			},
		],
		['non-Graduation estimate rejected', { ...canonical, cefrEstimate: 'B2' }],
		['non-Graduation scope rejected', { ...canonical, cefrEstimateScope: 'spoken' }],
		['UUID v1 is rejected', { ...canonical, attemptId: '12345678-1234-1234-8234-123456789abc' }],
		['unknown top-level field', { ...canonical, cefrAwarded: 'B2' }],
	])('%s', (_label, fixture) => {
		const runtimeAccepted = StageAssessmentSchema.safeParse(fixture).success;
		const publishedAccepted = validatePublishedSchema(fixture) as boolean;
		expect(publishedAccepted, JSON.stringify(validatePublishedSchema.errors)).toBe(runtimeAccepted);
	});
});
