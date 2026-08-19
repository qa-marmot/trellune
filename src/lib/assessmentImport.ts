import type { StageAssessment } from '../domain/assessment';
import { StageAssessmentSchema } from '../domain/assessment';
import { extractSingleJsonCandidate } from './sessionImport';
import { parseStrictJson } from './strictJson';

export const MAX_ASSESSMENT_SOURCE_BYTES = 1_000_000;

export interface AssessmentParseResult {
	source: string;
	assessment?: StageAssessment;
	errors: string[];
	warnings: string[];
}

export function parseStageAssessment(source: string): AssessmentParseResult {
	if (new TextEncoder().encode(source).byteLength > MAX_ASSESSMENT_SOURCE_BYTES) {
		return {
			source,
			errors: ['貼り付け内容が1 MBを超えています。ASSESSMENT_JSONだけを貼り付けてください。'],
			warnings: [],
		};
	}
	const extraction = extractSingleJsonCandidate(source, 'ASSESSMENT_JSON');
	if (extraction.candidate === undefined || extraction.candidate === '') {
		return {
			source,
			errors: extraction.errors.length ? extraction.errors : ['ASSESSMENT_JSONが空です。'],
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
	const result = StageAssessmentSchema.safeParse(parsed);
	if (!result.success) {
		return {
			source,
			errors: result.error.issues.map(
				(issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`,
			),
			warnings: extraction.warnings,
		};
	}
	return { source, assessment: result.data, errors: [], warnings: extraction.warnings };
}
