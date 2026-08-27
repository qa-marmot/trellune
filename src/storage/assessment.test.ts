import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FOUNDATION_STAGE_ASSESSMENT } from '../domain/assessment';
import { db, loadAppData, persistStageAssessment } from './db';

const now = '2026-08-13T01:00:00.000Z';
const assessment = {
	schemaVersion: '1.0' as const,
	assessmentId: FOUNDATION_STAGE_ASSESSMENT.assessmentId,
	attemptId: '12345678-1234-4234-8234-123456789abc',
	assessmentType: 'stage' as const,
	stageId: FOUNDATION_STAGE_ASSESSMENT.stageId,
	curriculumRange: { startDay: 1, endDay: 90 },
	completedAt: now,
	result: 'provisional' as const,
	scores: { grammar: 4, vocabulary: 3, speaking: 4, interaction: 3 },
	strengths: ['会話を継続できた'],
	reinforcementTargets: ['過去形'],
	evidence: [{ skill: 'grammar' as const, note: '過去形を使った。' }],
	nextTargets: ['理由を加える'],
};

beforeEach(async () => {
	await db.delete();
	await db.open();
	await db.learnerProfiles.put({
		id: 'current',
		onboarded: true,
		learnerName: 'Assessment learner',
		goal: 'Stage assessment storage',
		timeZone: 'Asia/Tokyo',
		startDate: '2026-08-13',
		entryDay: 1,
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
});

afterEach(async () => {
	await db.delete();
});

describe('Stage Assessment persistence', () => {
	it('persists an immutable attempt and queues the existing assessment sync entity', async () => {
		await expect(persistStageAssessment(assessment)).resolves.toBe('created');
		await expect(persistStageAssessment(assessment)).resolves.toBe('duplicate');
		await expect(db.assessments.get(assessment.attemptId)).resolves.toMatchObject({
			type: 'stage',
			payload: assessment,
		});
		await expect(db.outbox.toArray()).resolves.toEqual([
			expect.objectContaining({
				entityType: 'assessment',
				entityId: assessment.attemptId,
				operationType: 'upsert',
				baseVersion: 0,
			}),
		]);
		await expect(loadAppData()).resolves.toMatchObject({ stageAssessments: [assessment] });
	});

	it('rejects a different payload with the same attemptId without replacing it', async () => {
		await persistStageAssessment(assessment);
		await expect(
			persistStageAssessment({ ...assessment, strengths: ['差し替え'] }),
		).rejects.toThrow('同じattemptId');
		await expect(db.assessments.get(assessment.attemptId)).resolves.toMatchObject({
			payload: assessment,
		});
	});
});
