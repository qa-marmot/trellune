import type { ImportedSession } from '../domain/appData';
import { SessionJsonSchema } from './schemas';
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
): {
	candidate?: string;
	errors: string[];
	warnings: string[];
} {
	const fences = [...source.matchAll(/```(?:json)?\s*([\s\S]*?)```/giu)];
	if (fences.length > 1) {
		return {
			errors: [`JSON候補が複数あります。取り込む${candidateLabel}を1つだけ残してください。`],
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
				? ['JSONコードブロックの外側に説明文があります。JSONだけが保存対象です。']
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

export function parseSession(source: string): ParseResult {
	if (new TextEncoder().encode(source).byteLength > MAX_SESSION_SOURCE_BYTES) {
		return {
			source,
			errors: ['貼り付け内容が1 MBを超えています。SESSION_JSONだけを貼り付けてください。'],
			warnings: [],
		};
	}
	const extraction = extractSingleJsonCandidate(source);
	if (extraction.candidate === undefined || extraction.candidate === '') {
		return {
			source,
			errors: extraction.errors.length ? extraction.errors : ['SESSION_JSONが空です。'],
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
				`JSONを解析できませんでした: ${error instanceof Error ? error.message : '形式エラー'}`,
			],
			warnings: extraction.warnings,
		};
	}
	const result = SessionJsonSchema.safeParse(parsed);
	if (!result.success) {
		return {
			source,
			errors: result.error.issues.map(
				(issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`,
			),
			warnings: extraction.warnings,
		};
	}
	const value = result.data;
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
			summary: value.summaryJa,
			score: Math.round(
				(evaluationValues.reduce((sum, score) => sum + score, 0) / evaluationValues.length) * 20,
			),
			mistakes: value.mistakes.map((item) => `${item.learnerSaid} → ${item.suggested}`),
			payload: value,
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
