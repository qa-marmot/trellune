import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { studyDateAt } from '../domain/calendar';
import { db, persistImportedSession } from './db';

const now = new Date().toISOString();
const today = studyDateAt(now, 'Asia/Tokyo');

beforeEach(async () => {
	await db.delete();
	await db.open();
	await db.learnerProfiles.put({
		id: 'current',
		onboarded: true,
		learnerName: 'Session Import Learner',
		goal: 'Verify mistake-backed review cards',
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
	await db.dailyProgress.put({
		id: `study:${today}:curriculum:1`,
		studyDate: today,
		curriculumDay: 1,
		reviewsCompleted: true,
		grammarCompleted: true,
		coreSessionImported: false,
		coreCompleted: false,
		version: 2,
		updatedAt: now,
	});
});

afterEach(async () => {
	await db.delete();
});

describe('session import review cards', () => {
	it('stores English 1.1 content only in neutral local fields', async () => {
		const sessionId = 'c440bec0-4444-4aaa-8aaa-000000000003';
		const payload = {
			schemaVersion: '1.1' as const,
			supportLanguage: 'en' as const,
			sessionId,
			sessionType: 'core' as const,
			curriculumDay: 1,
			occurredAt: `${today}T09:00:00+09:00`,
			durationMinutes: 10,
			boost: null,
			summary: 'Practised a clear introduction.',
			evaluation: {
				taskCompletion: 4,
				grammar: 4,
				vocabulary: 4,
				fluency: 4,
				interaction: 4,
				comment: 'Clear and concise.',
			},
			mistakes: [],
			newVocabulary: [
				{
					text: 'clarify',
					meaning: 'to make something easier to understand',
					example: 'Could you clarify that point?',
				},
			],
			newPhrases: [],
			previewGrammar: [],
			reviewCards: [],
		};
		await expect(
			persistImportedSession({
				sessionId,
				kind: 'core',
				completedAt: now,
				durationMinutes: 10,
				summary: payload.summary,
				score: 80,
				mistakes: [],
				payload,
			}),
		).resolves.toBe('created');
		const stored = await db.sessions.get(sessionId);
		expect(stored?.payload).toEqual(payload);
		expect(JSON.stringify(stored?.payload)).not.toMatch(/"\w+Ja"/u);
		await expect(db.learningItems.get(`${sessionId}:vocabulary:0`)).resolves.toMatchObject({
			meaning: 'to make something easier to understand',
			supportLanguage: 'en',
		});
	});

	it('stores a review card linked to an imported mistake', async () => {
		const sessionId = 'c440bec0-4444-4aaa-8aaa-000000000002';
		const payload = {
			schemaVersion: '1.0' as const,
			sessionId,
			sessionType: 'core' as const,
			curriculumDay: 1,
			occurredAt: `${today}T09:00:00+09:00`,
			durationMinutes: 10,
			boost: null,
			summaryJa: '間違い由来の復習カードを保存する回帰テストです。',
			evaluation: {
				taskCompletion: 4,
				grammar: 4,
				vocabulary: 4,
				fluency: 4,
				interaction: 4,
				commentJa: '合成データによる保存経路の確認です。',
			},
			mistakes: [
				{
					category: 'grammar_preposition' as const,
					learnerSaid: 'I live Tokyo.',
					suggested: 'I live in Tokyo.',
					explanationJa: '都市の前にはinを使います。',
					severity: 'medium' as const,
				},
			],
			newVocabulary: [],
			newPhrases: [],
			previewGrammar: [],
			reviewCards: [
				{
					front: 'I live ___ Tokyo.',
					back: 'I live in Tokyo.',
					sourceMistakeIndex: 0,
				},
			],
		};

		await expect(
			persistImportedSession({
				sessionId,
				kind: 'core',
				completedAt: now,
				durationMinutes: 10,
				summary: payload.summaryJa,
				score: 80,
				mistakes: [],
				payload,
			}),
		).resolves.toBe('created');

		await expect(db.reviewCards.get(`${sessionId}:card:candidate:0`)).resolves.toMatchObject({
			sourceType: 'mistake',
			sourceId: `${sessionId}:mistake:0`,
		});
	});
});
