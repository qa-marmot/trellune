import { describe, expect, it } from 'vitest';
import { extractJson, parseSession, SAMPLE_SESSION_JSON } from '../src/lib/sessionImport';

describe('session import boundary', () => {
	it('extracts JSON from a Markdown code fence', () => {
		expect(extractJson('```json\n{"ok":true}\n```')).toBe('{"ok":true}');
	});

	it('rejects acquisition above the daily vocabulary limit', () => {
		const payload = JSON.parse(SAMPLE_SESSION_JSON) as Record<string, unknown>;
		payload.sessionId = 'cc174f90-bbe8-48b7-9692-db693acd27e4';
		payload.sessionType = 'boost';
		payload.durationMinutes = 5;
		payload.boost = { duration: 5, mode: 'speaking_sprint' };
		payload.newVocabulary = Array.from({ length: 9 }, (_, index) => ({
			text: `word-${index}`,
			meaningJa: '語',
			example: 'Example.',
		}));
		const result = parseSession(JSON.stringify(payload));
		expect(result.session).toBeUndefined();
		expect(result.errors.join(' ')).toContain('8');
	});
});
