import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyBackupPreview, createBackupText, previewBackupText } from './backup';
import { db } from './db';
import {
	GRADUATION_STAGE_ASSESSMENT,
	INTEGRATED_GRADUATION_STAGE_ASSESSMENT,
} from '../domain/assessment';

const now = '2026-08-13T00:00:00.000Z';

function canonicalize(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonicalize);
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, entry]) => [key, canonicalize(entry)]),
		);
	}
	return value;
}

async function integrityHash(value: unknown): Promise<string> {
	const bytes = new TextEncoder().encode(JSON.stringify(canonicalize(value)));
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

beforeEach(async () => {
	await db.delete();
	await db.open();
	await db.learnerProfiles.put({
		id: 'current',
		onboarded: true,
		learnerName: 'Existing learner',
		goal: 'Keep local data safe',
		timeZone: 'Asia/Tokyo',
		startDate: '2026-08-12',
		entryDay: 1,
		currentDay: 2,
		streak: 1,
		updatedAt: now,
	});
	await db.settings.put({
		id: 'current',
		dailyMinutes: 20,
		syncEnabled: false,
		reduceMotion: false,
		updatedAt: now,
	});
	await db.metadata.bulkPut([
		{ key: 'bootstrapComplete', value: { schemaVersion: 5, migration: false }, updatedAt: now },
		{ key: 'localRevision', value: 1, updatedAt: now },
	]);
});

afterEach(async () => {
	await db.delete();
});

describe('backup v2 curriculum compatibility', () => {
	it('restores a pre-entryDay backup v2 as a Day 1 learner', async () => {
		const envelope = JSON.parse(await createBackupText()) as {
			integrity: { sha256: string };
			data: { profile: Record<string, unknown> };
		};
		delete envelope.data.profile.entryDay;
		envelope.integrity.sha256 = await integrityHash(envelope.data);

		const preview = await previewBackupText(JSON.stringify(envelope));
		expect(preview.envelope.data.profile.entryDay).toBe(1);
	});

	it('round-trips an experienced learner entry without synthetic history', async () => {
		await db.learnerProfiles.update('current', { entryDay: 271, currentDay: 271 });
		const source = await createBackupText();
		const preview = await previewBackupText(source);
		expect(preview.envelope.data.profile).toMatchObject({ entryDay: 271, currentDay: 271 });
		expect(preview.envelope.data.dailyProgress).toEqual([]);
		await applyBackupPreview(preview);
		await expect(db.learnerProfiles.get('current')).resolves.toMatchObject({
			entryDay: 271,
			currentDay: 271,
		});
	});

	it('losslessly exports repeated attempts for one curriculum day from production-shaped v1.2 data', async () => {
		const attempts = [
			{
				id: 'study:2026-08-12:curriculum:1',
				studyDate: '2026-08-12',
				curriculumDay: 1,
				reviewsCompleted: true,
				grammarCompleted: true,
				coreSessionImported: false,
				coreCompleted: false,
				version: 2,
				updatedAt: '2026-08-12T12:00:00.000Z',
			},
			{
				id: 'study:2026-08-13:curriculum:1',
				studyDate: '2026-08-13',
				curriculumDay: 1,
				reviewsCompleted: true,
				grammarCompleted: true,
				coreSessionImported: true,
				coreCompleted: true,
				version: 4,
				updatedAt: '2026-08-13T12:00:00.000Z',
			},
		];
		await db.metadata.put({ key: 'activeCurriculumTotalDays', value: 180, updatedAt: now });
		await db.dailyProgress.bulkPut(attempts);

		const source = await createBackupText();
		const envelope = JSON.parse(source) as {
			schemaVersion: string;
			data: { dailyProgress: typeof attempts };
		};
		expect(envelope.schemaVersion).toBe('2.0');
		expect(envelope.data.dailyProgress).toEqual(attempts);

		await db.dailyProgress.clear();
		await applyBackupPreview(await previewBackupText(source));
		await expect(db.dailyProgress.orderBy('id').toArray()).resolves.toEqual(attempts);
	});

	it('still rejects two completed attempts for the same curriculum day', async () => {
		await db.dailyProgress.bulkPut([
			{
				id: 'study:2026-08-12:curriculum:1',
				studyDate: '2026-08-12',
				curriculumDay: 1,
				reviewsCompleted: true,
				grammarCompleted: true,
				coreSessionImported: true,
				coreCompleted: true,
				version: 2,
				updatedAt: '2026-08-12T12:00:00.000Z',
			},
			{
				id: 'study:2026-08-13:curriculum:1',
				studyDate: '2026-08-13',
				curriculumDay: 1,
				reviewsCompleted: true,
				grammarCompleted: true,
				coreSessionImported: true,
				coreCompleted: true,
				version: 3,
				updatedAt: '2026-08-13T12:00:00.000Z',
			},
		]);

		await expect(createBackupText()).rejects.toThrow(
			'カリキュラム日「1」に完了済みの日次進捗が複数あります。',
		);
		await expect(db.dailyProgress.count()).resolves.toBe(2);
	});

	it('keeps schema v2 and round-trips data within ACTIVE 365', async () => {
		const source = await createBackupText();
		const envelope = JSON.parse(source) as { schemaVersion: string };
		expect(envelope.schemaVersion).toBe('2.0');
		await expect(previewBackupText(source)).resolves.toMatchObject({
			envelope: { schemaVersion: '2.0' },
		});
	});

	it('losslessly round-trips Stage Assessments without changing backup v2', async () => {
		const attemptId = '12345678-1234-4234-8234-123456789abc';
		const assessment = {
			schemaVersion: '1.0' as const,
			assessmentId: GRADUATION_STAGE_ASSESSMENT.assessmentId,
			attemptId,
			assessmentType: 'stage' as const,
			stageId: GRADUATION_STAGE_ASSESSMENT.stageId,
			curriculumRange: { startDay: 271, endDay: 365 },
			completedAt: now,
			result: 'reinforcement-recommended' as const,
			cefrEstimate: 'B1+' as const,
			scores: {
				grammar: 3,
				vocabulary: 4,
				speaking: 3,
				interaction: 3,
				listening: 3,
				fluency: 3,
			},
			strengths: ['語彙を使える'],
			reinforcementTargets: ['やり取り'],
			evidence: [{ skill: 'vocabulary' as const, note: '具体語を使えた。' }],
			nextTargets: ['聞き返しを増やす'],
		};
		await db.assessments.put({
			id: attemptId,
			type: 'stage',
			completedAt: now,
			payload: assessment,
		});
		const integratedAttemptId = '22345678-1234-4234-8234-123456789abc';
		const integratedAssessment = {
			...assessment,
			assessmentId: INTEGRATED_GRADUATION_STAGE_ASSESSMENT.assessmentId,
			attemptId: integratedAttemptId,
			cefrEstimateScope: 'integrated' as const,
			scores: { ...assessment.scores, reading: 4, writing: 3 },
			evidence: INTEGRATED_GRADUATION_STAGE_ASSESSMENT.requiredSkills.map((skill) => ({
				skill,
				note: `${skill}の具体的task evidenceを保持した。`,
			})),
		};
		await db.assessments.put({
			id: integratedAttemptId,
			type: 'stage',
			completedAt: now,
			payload: integratedAssessment,
		});
		const source = await createBackupText();
		expect((JSON.parse(source) as { schemaVersion: string }).schemaVersion).toBe('2.0');
		await db.assessments.clear();
		await applyBackupPreview(await previewBackupText(source));
		await expect(db.assessments.get(attemptId)).resolves.toEqual({
			id: attemptId,
			type: 'stage',
			completedAt: now,
			payload: assessment,
		});
		await expect(db.assessments.get(integratedAttemptId)).resolves.toEqual({
			id: integratedAttemptId,
			type: 'stage',
			completedAt: now,
			payload: integratedAssessment,
		});
	});

	it('round-trips Day 365 and rejects a structurally supported Day 366 non-destructively', async () => {
		await db.learnerProfiles.update('current', { currentDay: 365 });
		const day365Progress = {
			id: 'study:2026-08-13:curriculum:365',
			studyDate: '2026-08-13',
			curriculumDay: 365,
			reviewsCompleted: true,
			grammarCompleted: true,
			coreSessionImported: false,
			coreCompleted: false,
			version: 1,
			updatedAt: now,
		};
		await db.dailyProgress.put(day365Progress);
		const day365Source = await createBackupText();
		const day365Preview = await previewBackupText(day365Source);
		await expect(Promise.resolve(day365Preview)).resolves.toMatchObject({
			envelope: { schemaVersion: '2.0' },
		});
		await db.dailyProgress.clear();
		await applyBackupPreview(day365Preview);
		await expect(db.dailyProgress.get(day365Progress.id)).resolves.toEqual(day365Progress);
		const envelope = JSON.parse(day365Source) as {
			data: { profile: { currentDay: number } };
			integrity: { sha256: string };
		};
		envelope.data.profile.currentDay = 366;
		envelope.integrity.sha256 = await integrityHash(envelope.data);
		const day366Backup = JSON.stringify(envelope);
		await db.learnerProfiles.update('current', { currentDay: 2 });
		await expect(previewBackupText(day366Backup)).rejects.toThrow(
			'現在有効なDay 365を超えています',
		);
		await expect(db.learnerProfiles.get('current')).resolves.toMatchObject({
			learnerName: 'Existing learner',
			currentDay: 2,
		});
	});

	it('rechecks ACTIVE inside the restore transaction before clearing tables', async () => {
		const preview = await previewBackupText(await createBackupText());
		await db.metadata.put({ key: 'activeCurriculumTotalDays', value: 1, updatedAt: now });
		await expect(applyBackupPreview(preview)).rejects.toThrow('現在有効なDay 1を超えています');
		await expect(db.learnerProfiles.get('current')).resolves.toMatchObject({
			learnerName: 'Existing learner',
			currentDay: 2,
		});
	});
});
