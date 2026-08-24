import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { beforeAll, describe, expect, it } from 'vitest';
import publishedSchema from '../../chatgpt-project-sources/05-session-schema.json';
import publishedSchemaV11 from '../../chatgpt-project-sources/08-session-schema-1.1.json';
import {
	AVAILABLE_CURRICULUM_TOTAL_DAYS,
	SUPPORTED_CURRICULUM_DAY_MAX,
} from '../curriculum/constants';
import { ChatGptSessionSchema, SessionJsonV11Schema } from './schemas';

const canonicalBoost = {
	schemaVersion: '1.0',
	sessionId: '0198ba29-89b5-4000-8000-000000000001',
	sessionType: 'boost',
	curriculumDay: 7,
	occurredAt: '2026-08-10T09:00:00.000Z',
	durationMinutes: 15,
	boost: { duration: 15, mode: 'speaking_sprint' },
	summaryJa: '契約整合テスト',
	evaluation: {
		taskCompletion: 4,
		grammar: 4,
		vocabulary: 4,
		fluency: 4,
		interaction: 4,
		commentJa: '契約整合テスト',
	},
	mistakes: [],
	newVocabulary: [],
	newPhrases: [],
	previewGrammar: [],
	reviewCards: [],
};

let validatePublishedSchema: ReturnType<Ajv2020['compile']>;
let validatePublishedSchemaV11: ReturnType<Ajv2020['compile']>;

beforeAll(async () => {
	const ajv = new Ajv2020({ strict: true, allErrors: true });
	addFormats(ajv);
	validatePublishedSchema = ajv.compile(publishedSchema);
	validatePublishedSchemaV11 = ajv.compile(publishedSchemaV11);
});

describe('published SESSION_JSON 1.1 schema parity', () => {
	const canonicalEnglish = {
		schemaVersion: '1.1',
		supportLanguage: 'en',
		sessionId: '0198ba29-89b5-4000-8000-000000000011',
		sessionType: 'core',
		curriculumDay: 365,
		occurredAt: '2026-08-10T09:00:00.000Z',
		durationMinutes: 10,
		boost: null,
		summary: 'Completed an English learning conversation.',
		evaluation: {
			taskCompletion: 4,
			grammar: 4,
			vocabulary: 4,
			fluency: 4,
			interaction: 4,
			comment: 'Clear interaction with one priority correction.',
		},
		mistakes: [],
		newVocabulary: [],
		newPhrases: [],
		previewGrammar: [],
		reviewCards: [],
	};

	it.each([
		['valid English Core', canonicalEnglish],
		['valid Japanese support label', { ...canonicalEnglish, supportLanguage: 'ja' }],
		['unknown legacy field rejected', { ...canonicalEnglish, summaryJa: 'legacy alias' }],
		['Day 540 structural bound accepted', { ...canonicalEnglish, curriculumDay: 540 }],
		['Day 541 rejected', { ...canonicalEnglish, curriculumDay: 541 }],
	])('%s', (_label, fixture) => {
		const runtimeAccepted = SessionJsonV11Schema.safeParse(fixture).success;
		const publishedAccepted = validatePublishedSchemaV11(fixture) as boolean;
		expect(publishedAccepted, JSON.stringify(validatePublishedSchemaV11.errors)).toBe(
			runtimeAccepted,
		);
	});
});

describe('published SESSION_JSON schema parity', () => {
	it.each([
		['valid Boost', canonicalBoost],
		['available Day 1 is accepted', { ...canonicalBoost, curriculumDay: 1 }],
		['available Day 90 is accepted', { ...canonicalBoost, curriculumDay: 90 }],
		['structurally supported Day 91 is accepted', { ...canonicalBoost, curriculumDay: 91 }],
		['available Day 365 is accepted', { ...canonicalBoost, curriculumDay: 365 }],
		['structurally supported Day 540 is accepted', { ...canonicalBoost, curriculumDay: 540 }],
		[
			'valid Core',
			{
				...canonicalBoost,
				sessionId: '0198ba29-89b5-4000-8000-000000000002',
				sessionType: 'core',
				durationMinutes: 10,
				boost: null,
			},
		],
		[
			'UUID v1 is not accepted',
			{ ...canonicalBoost, sessionId: '0198ba29-89b5-1000-8000-000000000003' },
		],
		['Boost durations must agree', { ...canonicalBoost, durationMinutes: 30 }],
		['Core cannot carry Boost settings', { ...canonicalBoost, sessionType: 'core' }],
		['Boost requires settings', { ...canonicalBoost, boost: null }],
		['unknown fields are rejected', { ...canonicalBoost, fabricated: true }],
		['whitespace-only required text is rejected', { ...canonicalBoost, summaryJa: '   ' }],
		[
			'raw text longer than the published maximum is rejected before trimming',
			{ ...canonicalBoost, summaryJa: ` ${'a'.repeat(1_000)} ` },
		],
		[
			'Next Lesson Preview requires one grammar item',
			{
				...canonicalBoost,
				boost: { duration: 15, mode: 'next_lesson_preview' },
			},
		],
		[
			'other Boost modes cannot preview grammar',
			{
				...canonicalBoost,
				previewGrammar: [
					{ topicId: 'd8-grammar', title: 'Next grammar', noteJa: '予習', status: 'previewed' },
				],
			},
		],
		[
			'valid Next Lesson Preview',
			{
				...canonicalBoost,
				boost: { duration: 15, mode: 'next_lesson_preview' },
				previewGrammar: [
					{ topicId: 'd8-grammar', title: 'Next grammar', noteJa: '予習', status: 'previewed' },
				],
			},
		],
	])('%s', (_label, fixture) => {
		const runtimeAccepted = ChatGptSessionSchema.safeParse(fixture).success;
		const publishedAccepted = validatePublishedSchema(fixture) as boolean;
		expect(publishedAccepted, JSON.stringify(validatePublishedSchema.errors)).toBe(runtimeAccepted);
	});

	it('separates the structural contract from runtime ACTIVE and bundle availability', () => {
		expect(AVAILABLE_CURRICULUM_TOTAL_DAYS).toBe(365);
		expect(SUPPORTED_CURRICULUM_DAY_MAX).toBe(540);
		expect(
			ChatGptSessionSchema.safeParse({
				...canonicalBoost,
				curriculumDay: AVAILABLE_CURRICULUM_TOTAL_DAYS,
			}).success,
		).toBe(true);
		expect(
			ChatGptSessionSchema.safeParse({
				...canonicalBoost,
				curriculumDay: AVAILABLE_CURRICULUM_TOTAL_DAYS + 1,
			}).success,
		).toBe(true);
		expect(
			ChatGptSessionSchema.safeParse({
				...canonicalBoost,
				curriculumDay: SUPPORTED_CURRICULUM_DAY_MAX + 1,
			}).success,
		).toBe(false);
	});

	it('documents runtime-only cross-array reference validation', () => {
		const fixture = {
			...canonicalBoost,
			reviewCards: [{ front: 'Try again', back: 'Correction', sourceMistakeIndex: 0 }],
		};
		expect(validatePublishedSchema(fixture)).toBe(true);
		expect(ChatGptSessionSchema.safeParse(fixture).success).toBe(false);
	});
});
