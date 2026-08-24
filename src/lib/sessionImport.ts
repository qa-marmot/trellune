import type { ImportedSession } from '../domain/appData';
import { ExternalSessionJsonSchema, normalizeExternalSession } from './schemas';
import { parseStrictJson } from './strictJson';

export const MAX_SESSION_SOURCE_BYTES = 1_000_000;

export interface ParseResult {
	source: string;
	session?: ImportedSession;
	errors: string[];
	warnings: string[];
}

export function extractSingleJsonCandidate(
	source: string,
	candidateLabel = 'SESSION_JSON',
	supportLanguage: 'ja' | 'en' = 'ja',
): {
	candidate?: string;
	errors: string[];
	warnings: string[];
} {
	const fences = [...source.matchAll(/```(?:json)?\s*([\s\S]*?)```/giu)];
	if (fences.length > 1) {
		return {
			errors: [
				supportLanguage === 'en'
					? `Multiple JSON candidates found. Keep exactly one ${candidateLabel} to import.`
					: `JSON候補が複数あります。取り込む${candidateLabel}を1つだけ残してください。`,
			],
			warnings: [],
		};
	}
	if (fences.length === 1) {
		const match = fences[0];
		const outside = `${source.slice(0, match.index)}${source.slice((match.index ?? 0) + match[0].length)}`;
		return {
			candidate: match[1].trim(),
			errors: [],
			warnings: outside.trim()
				? [
						supportLanguage === 'en'
							? 'There is text outside the JSON code block. Only the JSON will be saved.'
							: 'JSONコードブロックの外側に説明文があります。JSONだけが保存対象です。',
					]
				: [],
		};
	}
	return { candidate: source.trim(), errors: [], warnings: [] };
}

export function extractJson(source: string): string {
	const result = extractSingleJsonCandidate(source);
	if (result.errors.length || result.candidate === undefined) {
		throw new Error(result.errors[0] ?? 'SESSION_JSONがありません。');
	}
	return result.candidate;
}

export function parseSession(source: string, supportLanguage: 'ja' | 'en' = 'ja'): ParseResult {
	if (new TextEncoder().encode(source).byteLength > MAX_SESSION_SOURCE_BYTES) {
		return {
			source,
			errors: [
				supportLanguage === 'en'
					? 'The pasted content exceeds 1 MB. Paste only SESSION_JSON.'
					: '貼り付け内容が1 MBを超えています。SESSION_JSONだけを貼り付けてください。',
			],
			warnings: [],
		};
	}
	const extraction = extractSingleJsonCandidate(source, 'SESSION_JSON', supportLanguage);
	if (extraction.candidate === undefined || extraction.candidate === '') {
		return {
			source,
			errors: extraction.errors.length
				? extraction.errors
				: [supportLanguage === 'en' ? 'SESSION_JSON is empty.' : 'SESSION_JSONが空です。'],
			warnings: extraction.warnings,
		};
	}
	let parsed: unknown;
	try {
		parsed = parseStrictJson(extraction.candidate);
	} catch (error) {
		return {
			source,
			errors: [
				supportLanguage === 'en'
					? `Could not parse JSON: ${error instanceof Error ? error.message : 'format error'}`
					: `JSONを解析できませんでした: ${error instanceof Error ? error.message : '形式エラー'}`,
			],
			warnings: extraction.warnings,
		};
	}
	const result = ExternalSessionJsonSchema.safeParse(parsed);
	if (!result.success) {
		return {
			source,
			errors: result.error.issues.map(
				(issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`,
			),
			warnings: extraction.warnings,
		};
	}
	const value = normalizeExternalSession(result.data);
	const evaluationValues = [
		value.evaluation.taskCompletion,
		value.evaluation.grammar,
		value.evaluation.vocabulary,
		value.evaluation.fluency,
		value.evaluation.interaction,
	];
	return {
		source,
		errors: [],
		warnings: extraction.warnings,
		session: {
			sessionId: value.sessionId,
			kind: value.sessionType,
			completedAt: value.occurredAt,
			durationMinutes: value.durationMinutes,
			summary: value.summary,
			score: Math.round(
				(evaluationValues.reduce((sum, score) => sum + score, 0) / evaluationValues.length) * 20,
			),
			mistakes: value.mistakes.map((item) => `${item.learnerSaid} → ${item.suggested}`),
			payload: result.data,
		},
	};
}

export const SAMPLE_SESSION_JSON = JSON.stringify(
	{
		schemaVersion: '1.0',
		sessionId: 'cc174f90-bbe8-48b7-9692-db693acd27e3',
		sessionType: 'core',
		curriculumDay: 1,
		occurredAt: '2026-08-06T12:00:00+09:00',
		durationMinutes: 10,
		boost: null,
		summaryJa: '自己紹介と聞き返し表現を練習した。',
		evaluation: {
			taskCompletion: 4,
			grammar: 3,
			vocabulary: 4,
			fluency: 3,
			interaction: 4,
			commentJa: '短い文で会話を続けられました。',
		},
		mistakes: [
			{
				category: 'grammar_word_order',
				learnerSaid: 'I am live in Tokyo.',
				suggested: 'I live in Tokyo.',
				explanationJa: 'liveは一般動詞なのでamを置きません。',
				severity: 'medium',
			},
		],
		newVocabulary: [],
		newPhrases: [],
		previewGrammar: [],
		reviewCards: [
			{ front: '東京に住んでいます。', back: 'I live in Tokyo.', sourceMistakeIndex: 0 },
		],
	},
	null,
	2,
);

export const SAMPLE_SESSION_JSON_EN = JSON.stringify(
	{
		schemaVersion: '1.1',
		supportLanguage: 'en',
		sessionId: 'cc174f90-bbe8-48b7-9692-db693acd27e3',
		sessionType: 'core',
		curriculumDay: 1,
		occurredAt: '2026-08-06T12:00:00+09:00',
		durationMinutes: 10,
		boost: null,
		summary: 'Practised introductions and clarification phrases.',
		evaluation: {
			taskCompletion: 4,
			grammar: 3,
			vocabulary: 4,
			fluency: 3,
			interaction: 4,
			comment: 'The learner kept the conversation moving with short sentences.',
		},
		mistakes: [
			{
				category: 'grammar_word_order',
				learnerSaid: 'I am live in Tokyo.',
				suggested: 'I live in Tokyo.',
				explanation: 'Live is the main verb here, so am is not used.',
				severity: 'medium',
			},
		],
		newVocabulary: [],
		newPhrases: [],
		previewGrammar: [],
		reviewCards: [
			{ front: 'I am live in Tokyo.', back: 'I live in Tokyo.', sourceMistakeIndex: 0 },
		],
	},
	null,
	2,
);
