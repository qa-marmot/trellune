import { describe, expect, it } from 'vitest';
import { FOUNDATION_STAGE_ASSESSMENT } from '../domain/assessment';
import { parseStageAssessment } from './assessmentImport';

const valid = {
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

describe('ASSESSMENT_JSON import', () => {
	it('strictly validates one candidate and keeps optional skills optional', () => {
		const source = `説明\n\`\`\`json\n${JSON.stringify(valid)}\n\`\`\``;
		const result = parseStageAssessment(source);
		expect(result.assessment).toEqual(valid);
		expect(result.warnings).toHaveLength(1);
	});

	it('rejects missing required skills, duplicate keys, ambiguous and oversized input', () => {
		expect(
			parseStageAssessment(JSON.stringify({ ...valid, scores: { grammar: 4 } })).errors,
		).not.toHaveLength(0);
		expect(parseStageAssessment('{"schemaVersion":"1.0","schemaVersion":"1.0"}').errors[0]).toMatch(
			/同じJSONキー/,
		);
		expect(parseStageAssessment('```json\n{}\n```\n```json\n{}\n```').errors).toHaveLength(1);
		expect(parseStageAssessment('x'.repeat(1_000_001)).errors[0]).toMatch(/1 MB/);
	});
});
