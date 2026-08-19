import { BaselineAssessmentSchema, type BaselineAssessment } from './schemas';
import { extractSingleJsonCandidate, MAX_SESSION_SOURCE_BYTES } from './sessionImport';
import { parseStrictJson } from './strictJson';

export interface BaselineParseResult {
	source: string;
	assessment?: BaselineAssessment;
	errors: string[];
	warnings: string[];
}

export function parseBaselineAssessment(source: string): BaselineParseResult {
	if (new TextEncoder().encode(source).byteLength > MAX_SESSION_SOURCE_BYTES) {
		return {
			source,
			errors: ['貼り付け内容が1 MBを超えています。ベースラインJSONだけを貼り付けてください。'],
			warnings: [],
		};
	}
	const extraction = extractSingleJsonCandidate(source, 'ベースラインJSON');
	if (extraction.candidate === undefined || extraction.candidate === '') {
		return {
			source,
			errors: extraction.errors.length ? extraction.errors : ['ベースラインJSONが空です。'],
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
	const result = BaselineAssessmentSchema.safeParse(parsed);
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
