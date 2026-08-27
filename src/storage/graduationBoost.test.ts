import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addStudyDays, studyDateAt } from '../domain/calendar';
import { db, persistImportedSession } from './db';

const now = new Date().toISOString();
const today = studyDateAt(now, 'Asia/Tokyo');

beforeEach(async () => {
	await db.delete();
	await db.open();
	await db.learnerProfiles.put({
		id: 'current',
		onboarded: true,
		learnerName: 'Graduated Learner',
		goal: 'Keep practicing after Day 365',
		timeZone: 'Asia/Tokyo',
		startDate: addStudyDays(today, -364),
		entryDay: 1,
		currentDay: 365,
		streak: 365,
		updatedAt: now,
	});
	await db.settings.put({
		id: 'current',
		dailyMinutes: 20,
		syncEnabled: false,
		reduceMotion: false,
		updatedAt: now,
	});
	await db.dailyProgress.bulkPut(
		Array.from({ length: 365 }, (_, index) => {
			const curriculumDay = index + 1;
			const studyDate = addStudyDays(today, curriculumDay - 365);
			return {
				id: `study:${studyDate}:curriculum:${curriculumDay}`,
				studyDate,
				curriculumDay,
				reviewsCompleted: true,
				grammarCompleted: true,
				coreSessionImported: true,
				coreCompleted: true,
				version: 1,
				updatedAt: now,
			};
		}),
	);
});

afterEach(async () => {
	await db.delete();
});

describe('Day 365 graduation Boost', () => {
	it('accepts a same-day Boost after the final Core is complete', async () => {
		const sessionId = '90909090-9090-4090-8090-909090909090';
		const payload = {
			schemaVersion: '1.0' as const,
			sessionId,
			sessionType: 'boost' as const,
			curriculumDay: 365,
			occurredAt: `${today}T09:00:00+09:00`,
			durationMinutes: 5,
			boost: { duration: 5 as const, mode: 'free_talk' as const },
			summaryJa: 'Day 365修了日のBoostです。',
			evaluation: {
				taskCompletion: 4,
				grammar: 4,
				vocabulary: 4,
				fluency: 4,
				interaction: 4,
				commentJa: '修了後も会話練習を継続できました。',
			},
			mistakes: [],
			newVocabulary: [],
			newPhrases: [],
			previewGrammar: [],
			reviewCards: [],
		};

		await expect(
			persistImportedSession({
				sessionId,
				kind: 'boost',
				completedAt: now,
				durationMinutes: 5,
				summary: payload.summaryJa,
				score: 80,
				mistakes: [],
				payload,
			}),
		).resolves.toBe('created');
		expect(await db.sessions.get(sessionId)).toMatchObject({ kind: 'boost', studyDate: today });
	});
});
