import { describe, expect, it } from 'vitest';
import { parseSession, SAMPLE_SESSION_JSON, SAMPLE_SESSION_JSON_EN } from './sessionImport';

describe('parseSession', () => {
	it('accepts the provider-neutral formal SESSION_JSON contract', () => {
		const result = parseSession(`\`\`\`json\n${SAMPLE_SESSION_JSON}\n\`\`\``);
		expect(result.errors).toEqual([]);
		expect(result.warnings).toEqual([]);
		expect(result.session?.kind).toBe('core');
		expect(result.session?.mistakes).toEqual(['I am live in Tokyo. → I live in Tokyo.']);
		expect(result.source).toContain('schemaVersion');
		expect(result.session).not.toHaveProperty('sourceText');
	});

	it('keeps invalid source and does not fabricate fields', () => {
		const result = parseSession('{"summaryJa":"missing identity"}');
		expect(result.source).toBe('{"summaryJa":"missing identity"}');
		expect(result.session).toBeUndefined();
		expect(result.errors.length).toBeGreaterThan(0);
	});

	it('accepts SESSION_JSON 1.1 and preserves its language-neutral payload', () => {
		const result = parseSession(SAMPLE_SESSION_JSON_EN, 'en');
		expect(result.errors).toEqual([]);
		expect(result.session?.summary).toBe('Practised introductions and clarification phrases.');
		expect(result.session?.payload).toMatchObject({
			schemaVersion: '1.1',
			supportLanguage: 'en',
			summary: 'Practised introductions and clarification phrases.',
			evaluation: {
				comment: 'The learner kept the conversation moving with short sentences.',
			},
		});
		expect(Object.keys(result.session?.payload ?? {}).some((key) => key.endsWith('Ja'))).toBe(
			false,
		);
	});

	it('returns English extraction errors in English support mode', () => {
		const result = parseSession('```json\n{}\n```\n```json\n{}\n```', 'en');
		expect(result.errors[0]).toContain('Multiple JSON candidates');
		expect(result.errors[0]).not.toMatch(/[ぁ-んァ-ン一-龯]/u);
	});

	it('rejects multiple candidates, duplicate keys, oversized input and non-v4 UUIDs', () => {
		expect(
			parseSession(
				`\`\`\`json\n${SAMPLE_SESSION_JSON}\n\`\`\`\n\`\`\`json\n${SAMPLE_SESSION_JSON}\n\`\`\``,
			).errors[0],
		).toMatch(/複数/);
		expect(parseSession('{"schemaVersion":"1.0","schemaVersion":"1.0"}').errors[0]).toMatch(
			/同じJSONキー/,
		);
		expect(parseSession('x'.repeat(1_000_001)).errors[0]).toMatch(/1 MB/);
		const invalidUuid = SAMPLE_SESSION_JSON.replace(
			'cc174f90-bbe8-48b7-9692-db693acd27e3',
			'cc174f90-bbe8-18b7-9692-db693acd27e3',
		);
		expect(parseSession(invalidUuid).errors.join(' ')).toMatch(/sessionId/);
	});

	it('warns about prose around one fenced candidate without persisting it', () => {
		const result = parseSession(`説明です。\n\`\`\`json\n${SAMPLE_SESSION_JSON}\n\`\`\``);
		expect(result.errors).toEqual([]);
		expect(result.warnings).toHaveLength(1);
		expect(result.session).not.toHaveProperty('sourceText');
	});

	it('keeps the strict import boundary when a provider adds explanatory output', () => {
		const withUnknownField = SAMPLE_SESSION_JSON.replace(
			'"schemaVersion": "1.0",',
			'"schemaVersion": "1.0", "providerClaim": "completed",',
		);
		const result = parseSession(`Provider explanation\n\`\`\`json\n${withUnknownField}\n\`\`\``);
		expect(result.session).toBeUndefined();
		expect(result.errors.join(' ')).toContain('providerClaim');
	});
});
