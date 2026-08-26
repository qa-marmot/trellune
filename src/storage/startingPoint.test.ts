import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { studyDateAt } from '../domain/calendar';
import { applyAppPatch, db, loadAppData, persistCoreStep } from './db';

describe('experienced learner starting point', () => {
	beforeEach(async () => {
		await db.delete();
		await db.open();
	});

	afterEach(async () => {
		await db.delete();
	});

	it('normalizes an existing Dexie v5 profile without entryDay to Day 1', async () => {
		const today = studyDateAt(new Date(), 'Asia/Tokyo');
		await db.table('learnerProfiles').put({
			id: 'current',
			onboarded: true,
			learnerName: 'Existing learner',
			goal: 'Keep existing progress',
			timeZone: 'Asia/Tokyo',
			startDate: today,
			currentDay: 1,
			streak: 0,
			updatedAt: new Date().toISOString(),
		});
		await db.settings.put({
			id: 'current',
			dailyMinutes: 20,
			syncEnabled: false,
			reduceMotion: false,
			updatedAt: new Date().toISOString(),
		});

		const loaded = await loadAppData();
		expect(loaded.entryDay).toBe(1);
		expect(loaded.currentDay).toBe(1);
		expect(loaded.completedDays).toEqual([]);
	});

	it.each([1, 91, 181, 271] as const)(
		'starts at Day %i without inventing earlier learning evidence',
		async (entryDay) => {
			const startDate = studyDateAt(new Date(), 'Asia/Tokyo');
			await applyAppPatch({
				onboarded: true,
				learnerName: 'Experienced learner',
				goal: 'Continue from a stage boundary',
				timeZone: 'Asia/Tokyo',
				startDate,
				entryDay,
				currentDay: entryDay,
			});

			await expect(db.dailyProgress.count()).resolves.toBe(0);
			const loaded = await loadAppData();
			expect(loaded.entryDay).toBe(entryDay);
			expect(loaded.currentDay).toBe(entryDay);
			expect(loaded.completedDays).toEqual([]);
			expect(loaded.streak).toBe(0);
			await expect(db.reviewEvents.count()).resolves.toBe(0);
			await expect(db.learningItems.count()).resolves.toBe(0);
			await expect(db.acquisitionEvents.count()).resolves.toBe(0);
			await expect(db.sessions.count()).resolves.toBe(0);

			await persistCoreStep('reviews');
			const progress = await db.dailyProgress.toArray();
			expect(progress).toHaveLength(1);
			expect(progress[0]).toMatchObject({ curriculumDay: entryDay, coreCompleted: false });
		},
	);
});
