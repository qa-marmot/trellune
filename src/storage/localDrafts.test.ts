import { describe, expect, it } from 'vitest';
import {
	MAX_PRACTICE_DRAFT_BYTES,
	PRACTICE_DRAFT_MAX_AGE_MS,
	cleanupPracticeDrafts,
	clearPracticeDraft,
	loadPracticeDraft,
	savePracticeDraft,
} from './localDrafts';

const identity = {
	learnerKey: 'learner-a',
	curriculumDay: 181,
	promptId: 'practice-181-writing-1',
	supportLanguage: 'ja' as const,
};

describe('local practice drafts', () => {
	it('restores only the exact learner/day/prompt/language identity', () => {
		const storage = localStorage;
		storage.clear();
		expect(savePracticeDraft(storage, identity, 'My first response.', 1_000)).toBe(true);
		expect(loadPracticeDraft(storage, identity, 2_000)).toBe('My first response.');
		expect(loadPracticeDraft(storage, { ...identity, curriculumDay: 182 }, 2_000)).toBe('');
		expect(loadPracticeDraft(storage, { ...identity, promptId: 'other' }, 2_000)).toBe('');
		expect(loadPracticeDraft(storage, { ...identity, supportLanguage: 'en' }, 2_000)).toBe('');
	});

	it('clears explicitly and rejects oversized content without replacing the safe draft', () => {
		const storage = localStorage;
		storage.clear();
		savePracticeDraft(storage, identity, 'Safe', 1_000);
		expect(
			savePracticeDraft(storage, identity, 'x'.repeat(MAX_PRACTICE_DRAFT_BYTES + 1), 2_000),
		).toBe(false);
		expect(loadPracticeDraft(storage, identity, 2_000)).toBe('Safe');
		clearPracticeDraft(storage, identity);
		expect(loadPracticeDraft(storage, identity, 2_000)).toBe('');
	});

	it('drops malformed, stale, and excess drafts without touching other local storage', () => {
		const storage = localStorage;
		storage.clear();
		storage.setItem('unrelated', 'keep');
		storage.setItem('trellune:practice-draft:v1:broken', '{');
		savePracticeDraft(storage, identity, 'Old', 1_000);
		cleanupPracticeDrafts(storage, 1_000 + PRACTICE_DRAFT_MAX_AGE_MS + 1);
		expect(loadPracticeDraft(storage, identity, 1_000 + PRACTICE_DRAFT_MAX_AGE_MS + 1)).toBe('');
		expect(storage.getItem('trellune:practice-draft:v1:broken')).toBeNull();
		expect(storage.getItem('unrelated')).toBe('keep');
	});
});
