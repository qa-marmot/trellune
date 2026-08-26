import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { studyDateAt } from '../domain/calendar';
import { db, loadAppData, persistReviewGrade } from './db';

const now = new Date().toISOString();
const today = studyDateAt(now, 'Asia/Tokyo');

beforeEach(async () => {
	await db.delete();
	await db.open();
	await db.learnerProfiles.put({
		id: 'current',
		onboarded: true,
		learnerName: 'Recovery learner',
		goal: 'Resume a frozen review batch safely',
		timeZone: 'Asia/Tokyo',
		startDate: today,
		currentDay: 1,
		streak: 0,
		updatedAt: now,
	});
	await db.settings.put({
		id: 'current',
		dailyMinutes: 20,
		syncEnabled: false,
		reduceMotion: false,
		updatedAt: now,
	});
	await db.sessions.put({
		sessionId: 'recovery-source',
		kind: 'boost',
		completedAt: now,
		durationMinutes: 5,
		summary: 'Synthetic source for a frozen review batch.',
		score: 80,
		mistakes: [],
	});
	await db.reviewCards.bulkPut(
		Array.from({ length: 12 }, (_, index) => ({
			id: `recovery-card-${String(index).padStart(2, '0')}`,
			front: `Question ${index + 1}`,
			back: `Answer ${index + 1}`,
			sourceType: 'session' as const,
			sourceId: 'recovery-source',
			state: 'review' as const,
			dueAt: new Date(Date.now() - 86_400_000).toISOString(),
			stabilityLevel: 2,
			lapses: 0,
			algorithmVersion: 1 as const,
			version: 1,
			updatedAt: now,
		})),
	);
});

afterEach(async () => {
	await db.delete();
});

describe('frozen review Recovery', () => {
	it('persists partial progress across reopen without advancing or completing Core early', async () => {
		const initial = await loadAppData();
		expect(initial.reviewBatchTotal).toBe(12);
		expect(initial.reviewBatchCompleted).toBe(0);
		expect(initial.currentDay).toBe(1);

		for (const card of initial.reviewCards.slice(0, 5)) {
			await persistReviewGrade(card.id, 'good');
		}
		const partial = await loadAppData();
		expect(partial.reviewBatchTotal).toBe(12);
		expect(partial.reviewBatchCompleted).toBe(5);
		expect(partial.reviewCount).toBe(7);
		expect(partial.core.reviews).toBe(false);
		expect(partial.currentDay).toBe(1);
		expect(partial.streak).toBe(0);

		db.close();
		await db.open();
		const reopened = await loadAppData();
		expect(reopened.reviewBatchCompleted).toBe(5);
		expect(reopened.reviewCards.map((card) => card.id)).toEqual(
			partial.reviewCards.map((card) => card.id),
		);

		for (const card of reopened.reviewCards) {
			await persistReviewGrade(card.id, 'good');
		}
		const completed = await loadAppData();
		expect(completed.reviewBatchCompleted).toBe(12);
		expect(completed.reviewCount).toBe(0);
		expect(completed.core).toEqual({ reviews: true, grammar: false, import: false });
		expect(completed.completedDays).toEqual([]);
		expect(completed.currentDay).toBe(1);
		expect(await db.reviewEvents.count()).toBe(12);
	}, 15_000);
});
