import { describe, expect, it } from 'vitest';
import {
	applySessionToProgress,
	calculateCoreCompletion,
	checkDailyAcquisitionLimits,
} from './learning';
import { ChatGptSessionSchema, type SessionImport } from '../lib/schemas';

const canonicalBoost = {
	schemaVersion: '1.0',
	sessionId: '0198ba29-89b5-4000-8000-000000000001',
	sessionType: 'boost',
	curriculumDay: 1,
	occurredAt: '2026-08-06T12:00:00+09:00',
	durationMinutes: 5,
	boost: { duration: 5, mode: 'speaking_sprint' },
	summaryJa: '発話練習',
	evaluation: {
		taskCompletion: 3,
		grammar: 3,
		vocabulary: 3,
		fluency: 3,
		interaction: 3,
		commentJa: '継続する',
	},
	newVocabulary: [],
	newPhrases: [],
	mistakes: [],
	previewGrammar: [],
	reviewCards: [],
} satisfies SessionImport;

describe('Core and Boost invariants', () => {
	it('requires review, grammar, and imported Core Voice', () => {
		expect(
			calculateCoreCompletion({
				reviewCompleted: true,
				grammarCompleted: true,
				coreVoiceImported: false,
			}).coreCompleted,
		).toBe(false);
		expect(
			calculateCoreCompletion({
				reviewCompleted: true,
				grammarCompleted: true,
				coreVoiceImported: true,
			}).coreCompleted,
		).toBe(true);
	});

	it('does not let Boost complete Core', () => {
		const boost = canonicalBoost;
		const result = applySessionToProgress(
			{ reviewCompleted: true, grammarCompleted: true, coreVoiceImported: false },
			boost,
		);
		expect(result.coreCompleted).toBe(false);
		expect(result.coreVoiceImported).toBe(false);
	});

	it('validates the canonical ChatGPT contract and rejects unknown fields', () => {
		expect(ChatGptSessionSchema.safeParse(canonicalBoost).success).toBe(true);
		expect(ChatGptSessionSchema.safeParse({ ...canonicalBoost, fabricated: true }).success).toBe(
			false,
		);
	});

	it('applies cumulative daily acquisition limits', () => {
		const result = checkDailyAcquisitionLimits(
			{ words: 6, phrases: 2, previewGrammar: 1 },
			{ words: 3, phrases: 1, previewGrammar: 0 },
		);
		expect(result.accepted).toBe(false);
		expect(result.violations).toEqual([{ item: 'words', limit: 8, attemptedTotal: 9 }]);
	});
});
