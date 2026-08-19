import { describe, expect, it } from 'vitest';
import { parseBaselineAssessment } from './baselineImport';

const valid = {
	confidence: 3,
	taskCompletion: 4,
	grammar: 3,
	vocabulary: 4,
	fluency: 3,
	interaction: 4,
	strengths: ['短い文で答えられる'],
	priorities: ['聞き返しを増やす'],
};

describe('baseline assessment import', () => {
	it('strictly validates one JSON candidate and keeps the source in memory', () => {
		const source = `説明\n\`\`\`json\n${JSON.stringify(valid)}\n\`\`\``;
		const result = parseBaselineAssessment(source);
		expect(result.assessment).toEqual(valid);
		expect(result.source).toBe(source);
		expect(result.warnings).toHaveLength(1);
	});

	it('rejects ambiguous, duplicate-key and oversized input', () => {
		expect(parseBaselineAssessment('```json\n{}\n```\n```json\n{}\n```').errors).toHaveLength(1);
		expect(parseBaselineAssessment('{"confidence":2,"confidence":3}').errors[0]).toMatch(
			/同じJSONキー/,
		);
		expect(parseBaselineAssessment('x'.repeat(1_000_001)).errors[0]).toMatch(/1 MB/);
	});
});
