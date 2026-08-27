import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
	fetchBootstrap: vi.fn(),
	fetchChanges: vi.fn(),
	fetchToday: vi.fn(),
	pushDailyProgress: vi.fn(),
	pushDeletion: vi.fn(),
	pushMutation: vi.fn(),
	pushReviewEvent: vi.fn(),
	previewSessionImport: vi.fn(),
	pushSessionImport: vi.fn(),
	pushStageAssessment: vi.fn(),
}));

vi.mock('./client', async (importOriginal) => {
	const original = await importOriginal<typeof import('./client')>();
	return {
		...original,
		fetchBootstrap: api.fetchBootstrap,
		fetchChanges: api.fetchChanges,
		fetchToday: api.fetchToday,
		pushDailyProgress: api.pushDailyProgress,
		pushDeletion: api.pushDeletion,
		pushMutation: api.pushMutation,
		pushReviewEvent: api.pushReviewEvent,
		previewSessionImport: api.previewSessionImport,
		pushSessionImport: api.pushSessionImport,
		pushStageAssessment: api.pushStageAssessment,
	};
});

import { db } from '../storage/db';
import { CurriculumCompatibilityError } from '../curriculum/availability';
import { SyncClientError } from './client';
import {
	getSyncStatus,
	hydrateFromRemoteIfEmpty,
	resolveSyncConflict,
	syncNow,
	verifyRemoteCurriculumCompatibility,
} from './service';

const now = '2026-08-10T09:00:00.000Z';
const remoteOnlySessionId = '12121212-1212-4121-8121-121212121212';

const remoteSession = {
	operationId: '34343434-3434-4343-8343-343434343434',
	entityType: 'session' as const,
	entityId: remoteOnlySessionId,
	operation: 'upsert' as const,
	payload: {
		sessionId: remoteOnlySessionId,
		kind: 'core' as const,
		completedAt: now,
		durationMinutes: 10,
		summary: 'remote-only synthetic session',
		score: 80,
		mistakes: [],
	},
	version: 3,
	sequence: 7,
	changedAt: now,
};

async function seedRestoredDevice(): Promise<void> {
	await db.learnerProfiles.put({
		id: 'current',
		onboarded: true,
		learnerName: 'Restored Learner',
		goal: 'restore reconciliation test',
		timeZone: 'Asia/Tokyo',
		startDate: '2026-08-10',
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
	await db.metadata.bulkPut([
		{
			key: 'deviceId',
			value: '56565656-5656-4565-8565-565656565656',
			updatedAt: now,
		},
		{
			key: 'lastBackupRestore',
			value: {
				restoredAt: now,
				sha256: 'a'.repeat(64),
				requiresRemoteReconciliation: true,
				incomingEntityKeys: ['profile-settings:current'],
			},
			updatedAt: now,
		},
	]);
}

function configureSuccessfulApi(): void {
	api.fetchBootstrap.mockResolvedValue({
		data: { entities: [remoteSession], cursor: 7, activeTotalDays: 90 },
	});
	api.fetchChanges.mockResolvedValue({ data: { changes: [], cursor: 9, hasMore: false } });
	api.fetchToday.mockResolvedValue({
		data: {
			studyDate: '2026-08-10',
			progress: {
				reviewCompleted: false,
				grammarCompleted: false,
				coreVoiceImported: false,
				coreCompleted: false,
			},
			version: 0,
			acquisitionCounts: { words: 0, phrases: 0, previewGrammar: 0 },
			overdueReviewCount: 0,
		},
	});
	api.pushDeletion.mockImplementation(
		async (request: {
			operationId: string;
			entityType: string;
			entityId: string;
			expectedVersion: number;
		}) => ({
			data: {
				operationId: request.operationId,
				entityType: request.entityType,
				entityId: request.entityId,
				operation: 'delete',
				payload: null,
				version: request.expectedVersion + 1,
				sequence: 8,
				replayed: false,
				changedAt: '2026-08-10T09:01:00.000Z',
			},
		}),
	);
	api.pushMutation.mockImplementation(async (request: { operationId: string }) => ({
		data: {
			operationId: request.operationId,
			version: 1,
			changedAt: now,
		},
	}));
	api.previewSessionImport.mockResolvedValue({
		data: {
			duplicate: null,
			countsBefore: { words: 0, phrases: 0, previewGrammar: 0 },
			countsIncoming: { words: 0, phrases: 0, previewGrammar: 0 },
			limits: {
				accepted: true,
				remaining: { words: 8, phrases: 3, previewGrammar: 1 },
				violations: [],
			},
		},
	});
}

beforeEach(async () => {
	vi.clearAllMocks();
	await db.delete();
	await db.open();
	await seedRestoredDevice();
	configureSuccessfulApi();
});

afterEach(async () => {
	await db.delete();
});

describe('backup restore remote reconciliation', () => {
	it('sends restored daily progress with tombstone CAS and a separate source version floor', async () => {
		const entityId = 'study:2026-08-10:curriculum:1';
		await db.settings.update('current', { syncEnabled: true });
		await db.dailyProgress.put({
			id: entityId,
			studyDate: '2026-08-10',
			curriculumDay: 1,
			reviewsCompleted: true,
			grammarCompleted: false,
			coreSessionImported: false,
			coreCompleted: false,
			version: 1,
			updatedAt: now,
		});
		await db.metadata.put({
			key: 'lastBackupRestore',
			value: {
				restoredAt: now,
				sha256: 'a'.repeat(64),
				requiresRemoteReconciliation: true,
				incomingEntityKeys: ['profile-settings:current', `daily-progress:${entityId}`],
			},
			updatedAt: now,
		});
		api.fetchBootstrap.mockResolvedValue({
			data: {
				entities: [
					{
						operationId: '99999999-9999-4999-8999-999999999999',
						entityType: 'daily-progress',
						entityId,
						operation: 'delete',
						payload: null,
						version: 6,
						sequence: 7,
						changedAt: now,
					},
				],
				cursor: 7,
				activeTotalDays: 90,
			},
		});
		api.pushDailyProgress.mockImplementation(async (_studyDate: string, patch: unknown) => ({
			data: {
				operationId: (patch as { clientMutationId: string }).clientMutationId,
				version: 7,
				changedAt: now,
			},
		}));

		await syncNow();

		expect(api.pushDailyProgress).toHaveBeenCalledWith('2026-08-10', {
			curriculumDay: 1,
			reviewCompleted: true,
			expectedVersion: 6,
			sourceVersion: 1,
			clientMutationId: expect.any(String),
			updatedAt: now,
		});
	});

	it('seeds a restored session with the remote tombstone version', async () => {
		const sessionId = '67676767-6767-4767-8767-676767676767';
		const payload = {
			schemaVersion: '1.0' as const,
			sessionId,
			sessionType: 'boost' as const,
			curriculumDay: 1,
			occurredAt: now,
			durationMinutes: 5,
			boost: { duration: 5 as const, mode: 'speaking_sprint' as const },
			summaryJa: '復元セッション',
			evaluation: {
				taskCompletion: 3,
				grammar: 3,
				vocabulary: 3,
				fluency: 3,
				interaction: 3,
				commentJa: '復元テスト',
			},
			mistakes: [],
			newVocabulary: [],
			newPhrases: [],
			previewGrammar: [],
			reviewCards: [],
		};
		await db.settings.update('current', { syncEnabled: true });
		await db.sessions.put({
			sessionId,
			kind: 'boost',
			completedAt: now,
			durationMinutes: 5,
			summary: '復元セッション',
			score: 60,
			mistakes: [],
			payload,
			studyDate: '2026-08-10',
		});
		await db.metadata.put({
			key: 'lastBackupRestore',
			value: {
				restoredAt: now,
				sha256: 'a'.repeat(64),
				requiresRemoteReconciliation: true,
				incomingEntityKeys: ['profile-settings:current', `session:${sessionId}`],
			},
			updatedAt: now,
		});
		api.fetchBootstrap.mockResolvedValue({
			data: {
				entities: [
					{
						operationId: '68686868-6868-4868-8868-686868686868',
						entityType: 'session',
						entityId: sessionId,
						operation: 'delete',
						payload: null,
						version: 3,
						sequence: 7,
						changedAt: now,
					},
				],
				cursor: 7,
				activeTotalDays: 90,
			},
		});
		api.pushSessionImport.mockImplementation(
			async (request: { idempotencyKey: string; expectedVersion: number }) => ({
				data: {
					operationId: request.idempotencyKey,
					importId: '69696969-6969-4969-8969-696969696969',
					replayed: false,
					version: request.expectedVersion + 1,
					changedAt: now,
					coreProgress: {
						reviewCompleted: false,
						grammarCompleted: false,
						coreVoiceImported: false,
						coreCompleted: false,
					},
				},
			}),
		);

		await syncNow();

		expect(api.previewSessionImport).toHaveBeenCalledWith(
			expect.objectContaining({ expectedVersion: 3 }),
		);
		expect(api.pushSessionImport).toHaveBeenCalledWith(
			expect.objectContaining({ expectedVersion: 3 }),
		);
		expect(await db.outbox.count()).toBe(0);
	});

	it('deletes a remote-only entity even when the restored device has no remoteVersion metadata', async () => {
		await syncNow();

		expect(api.fetchBootstrap).toHaveBeenCalledTimes(1);
		expect(api.pushDeletion).toHaveBeenCalledWith(
			expect.objectContaining({
				entityType: 'session',
				entityId: remoteOnlySessionId,
				expectedVersion: 3,
			}),
		);
		expect(await db.sessions.get(remoteOnlySessionId)).toBeUndefined();
		expect(await db.outbox.count()).toBe(0);
		expect(await db.conflicts.count()).toBe(0);
		expect(await db.syncState.get('current')).toMatchObject({ cursor: 9 });
		expect(await db.metadata.get('lastBackupRestore')).toBeUndefined();
	});

	it('keeps the restore marker when the final paginated pull does not finish', async () => {
		api.fetchChanges
			.mockResolvedValueOnce({ data: { changes: [], cursor: 8, hasMore: true } })
			.mockRejectedValueOnce(
				new SyncClientError('network', 'Synthetic second-page outage', undefined, 'network_error'),
			);

		await expect(syncNow()).rejects.toThrow('Synthetic second-page outage');
		expect(api.fetchChanges).toHaveBeenCalledTimes(2);
		expect(await db.metadata.get('lastBackupRestore')).toBeDefined();
		expect(await db.syncState.get('current')).toMatchObject({ cursor: 8 });
		expect(await getSyncStatus()).toMatchObject({
			lastAttemptStatus: 'failed',
			lastErrorCode: 'network_error',
		});
	});

	it('keeps a local upsert created after the fixed restore inventory', async () => {
		const operationId = '78787878-7878-4787-8787-787878787878';
		const entityId = 'study:2026-08-10:curriculum:1';
		const progress = {
			id: entityId,
			studyDate: '2026-08-10',
			curriculumDay: 1,
			reviewsCompleted: true,
			grammarCompleted: false,
			coreSessionImported: false,
			coreCompleted: false,
			version: 1,
			updatedAt: now,
		};
		await db.metadata.bulkPut([
			{
				key: 'lastBackupRestore',
				value: {
					restoredAt: now,
					sha256: 'a'.repeat(64),
					requiresRemoteReconciliation: true,
					incomingEntityKeys: ['profile-settings:current'],
					inventoryCursor: 7,
					inventoryCapturedAt: now,
				},
				updatedAt: now,
			},
			{ key: 'syncSeeded', value: true, updatedAt: now },
		]);
		await db.syncState.put({ id: 'current', cursor: 7, updatedAt: now });
		await db.dailyProgress.put(progress);
		await db.outbox.put({
			operationId,
			schemaVersion: 1,
			deviceId: '56565656-5656-4565-8565-565656565656',
			entityType: 'daily-progress',
			entityId,
			operationType: 'upsert',
			payload: progress,
			baseVersion: 0,
			createdAt: now,
			attempts: 0,
			nextAttemptAt: now,
			status: 'pending',
		});
		api.pushDailyProgress.mockResolvedValue({
			data: { operationId, version: 1, changedAt: now },
		});
		api.fetchChanges.mockResolvedValue({
			data: {
				changes: [
					{
						operationId,
						entityType: 'daily-progress',
						entityId,
						operation: 'upsert',
						payload: progress,
						version: 1,
						sequence: 8,
						changedAt: now,
					},
				],
				cursor: 8,
				hasMore: false,
			},
		});

		await syncNow();

		expect(api.fetchBootstrap).not.toHaveBeenCalled();
		expect(api.pushDailyProgress).toHaveBeenCalledTimes(1);
		expect(api.pushDeletion).not.toHaveBeenCalled();
		expect(await db.dailyProgress.get(entityId)).toEqual(progress);
		expect(await db.outbox.count()).toBe(0);
		expect(await db.metadata.get('lastBackupRestore')).toBeUndefined();
	});

	it('uses the event ID when protecting a post-inventory review event', async () => {
		const operationId = '89898989-8989-4898-8989-898989898989';
		const eventId = '91919191-9191-4191-8191-919191919191';
		const cardId = 'card:restore-review';
		const cardState = {
			id: cardId,
			front: 'I go yesterday.',
			back: 'I went yesterday.',
			dueAt: now,
			state: 'review' as const,
			stabilityLevel: 2,
			lapses: 0,
			version: 1,
		};
		const event = {
			eventId,
			cardId,
			grade: 'good' as const,
			occurredAt: now,
			studyDate: '2026-08-10',
			curriculumDay: 1,
			algorithmVersion: 1 as const,
			before: cardState,
			after: { ...cardState, version: 2, stabilityLevel: 3 },
		};
		await db.metadata.bulkPut([
			{
				key: 'lastBackupRestore',
				value: {
					restoredAt: now,
					sha256: 'a'.repeat(64),
					requiresRemoteReconciliation: true,
					incomingEntityKeys: ['profile-settings:current'],
					inventoryCursor: 7,
					inventoryCapturedAt: now,
				},
				updatedAt: now,
			},
			{ key: 'syncSeeded', value: true, updatedAt: now },
		]);
		await db.syncState.put({ id: 'current', cursor: 7, updatedAt: now });
		await db.reviewEvents.put(event);
		await db.outbox.put({
			operationId,
			schemaVersion: 1,
			deviceId: '56565656-5656-4565-8565-565656565656',
			entityType: 'review-event',
			entityId: cardId,
			operationType: 'upsert',
			payload: event,
			baseVersion: 1,
			createdAt: now,
			attempts: 0,
			nextAttemptAt: now,
			status: 'pending',
		});
		api.pushReviewEvent.mockResolvedValue({
			data: { operationId, eventId, cardId, version: 2, changedAt: now },
		});
		api.fetchChanges.mockResolvedValue({
			data: {
				changes: [
					{
						operationId,
						entityType: 'review-event',
						entityId: eventId,
						operation: 'upsert',
						payload: event,
						version: 1,
						sequence: 8,
						changedAt: now,
					},
				],
				cursor: 8,
				hasMore: false,
			},
		});

		await syncNow();

		expect(api.pushReviewEvent).toHaveBeenCalledTimes(1);
		expect(api.pushDeletion).not.toHaveBeenCalled();
		expect(await db.reviewEvents.get(eventId)).toEqual(event);
		expect(await db.outbox.count()).toBe(0);
		expect(await db.metadata.get(`remoteVersion:review-event:${eventId}`)).toMatchObject({
			value: 1,
		});
		expect(await db.metadata.get(`remoteVersion:review-event:${cardId}`)).toBeUndefined();
		expect(await db.metadata.get('lastBackupRestore')).toBeUndefined();
	});
});

describe('curriculum compatibility bootstrap', () => {
	it('persists the last compatible server ACTIVE total', async () => {
		await expect(verifyRemoteCurriculumCompatibility()).resolves.toBe(90);
		await expect(db.metadata.get('activeCurriculumTotalDays')).resolves.toMatchObject({
			value: 90,
		});
	});

	it('uses AVAILABLE 365 offline when no server ACTIVE was stored', async () => {
		await db.metadata.delete('activeCurriculumTotalDays');
		const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
		try {
			await expect(verifyRemoteCurriculumCompatibility()).resolves.toBe(365);
			expect(api.fetchBootstrap).not.toHaveBeenCalled();
		} finally {
			online.mockRestore();
		}
	});

	it('fails before applying bootstrap entities when server ACTIVE exceeds AVAILABLE', async () => {
		api.fetchBootstrap.mockResolvedValue({
			data: { entities: [remoteSession], cursor: 7, activeTotalDays: 366 },
		});
		await expect(hydrateFromRemoteIfEmpty(true)).rejects.toBeInstanceOf(
			CurriculumCompatibilityError,
		);
		await expect(db.sessions.get(remoteOnlySessionId)).resolves.toBeUndefined();
		await expect(db.metadata.get('activeCurriculumTotalDays')).resolves.toBeUndefined();
	});
});

describe('Core daily-progress synchronization', () => {
	it('does not let a remote partial progress update erase completed Core evidence while its session is blocked', async () => {
		const entityId = 'study:2026-08-10:curriculum:1';
		const sessionOperationId = '56565656-5656-4565-8565-565656565657';
		const localCompleted = {
			id: entityId,
			studyDate: '2026-08-10',
			curriculumDay: 1,
			reviewsCompleted: true,
			grammarCompleted: true,
			coreSessionImported: true,
			coreCompleted: true,
			version: 3,
			updatedAt: '2026-08-10T09:03:00.000Z',
		};
		const remotePartial = {
			...localCompleted,
			grammarCompleted: false,
			coreSessionImported: false,
			coreCompleted: false,
			version: 4,
			updatedAt: '2026-08-10T09:04:00.000Z',
		};
		await db.settings.update('current', { syncEnabled: true });
		await db.dailyProgress.put(localCompleted);
		await db.metadata.put({ key: 'syncSeeded', value: true, updatedAt: now });
		await db.outbox.put({
			operationId: sessionOperationId,
			schemaVersion: 1,
			deviceId: '56565656-5656-4565-8565-565656565656',
			entityType: 'session',
			entityId: '78787878-7878-4787-8787-787878787878',
			operationType: 'upsert',
			payload: { blocked: 'core session remains the recovery path' },
			baseVersion: 0,
			createdAt: now,
			attempts: 1,
			nextAttemptAt: now,
			status: 'blocked',
			lastErrorCode: 'pull_conflict',
		});
		api.fetchChanges.mockResolvedValue({
			data: {
				changes: [
					{
						operationId: '67676767-6767-4767-8767-676767676767',
						entityType: 'daily-progress',
						entityId,
						operation: 'upsert',
						payload: remotePartial,
						version: 4,
						sequence: 4,
						changedAt: remotePartial.updatedAt,
					},
				],
				cursor: 4,
				hasMore: false,
			},
		});

		await syncNow();

		expect(await db.dailyProgress.get(entityId)).toMatchObject({
			version: 4,
			reviewsCompleted: true,
			grammarCompleted: true,
			coreSessionImported: true,
			coreCompleted: true,
		});
		expect(await db.outbox.get(sessionOperationId)).toMatchObject({ status: 'blocked' });
		expect(await getSyncStatus()).toMatchObject({ blocked: 1 });
	});
});

describe('manual sync outcomes', () => {
	it('reports an offline attempt instead of silently succeeding without a sync cycle', async () => {
		const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
		try {
			await expect(syncNow()).resolves.toMatchObject({ status: 'offline' });
			expect(await getSyncStatus()).toMatchObject({
				lastAttemptStatus: 'offline',
			});
		} finally {
			online.mockRestore();
		}
	});

	it('reports a busy attempt when another context owns the sync lease', async () => {
		await db.metadata.put({
			key: 'syncLease',
			value: {
				owner: '99999999-9999-4999-8999-999999999999',
				expiresAt: '2099-01-01T00:00:00.000Z',
			},
			updatedAt: now,
		});

		await expect(syncNow()).resolves.toMatchObject({ status: 'busy' });
		expect(await getSyncStatus()).toMatchObject({ lastAttemptStatus: 'busy' });
	});
});

describe('Stage Assessment synchronization', () => {
	it('uses the existing assessment entity CAS path and protocol version', async () => {
		const attemptId = '12345678-1234-4234-8234-123456789abc';
		const operationId = '87654321-4321-4321-8321-cba987654321';
		const payload = {
			schemaVersion: '1.0' as const,
			assessmentId: 'english-os-stage-assessment-graduation-integrated-v1',
			attemptId,
			assessmentType: 'stage' as const,
			stageId: 'english-os-core-stage-b2-challenge-b1-plus-b2',
			curriculumRange: { startDay: 271, endDay: 365 },
			completedAt: now,
			result: 'pass' as const,
			cefrEstimate: 'B2-entry' as const,
			cefrEstimateScope: 'integrated' as const,
			scores: {
				grammar: 4,
				vocabulary: 4,
				speaking: 3,
				interaction: 4,
				fluency: 3,
				listening: 3,
				reading: 4,
				writing: 3,
			},
			strengths: ['会話を継続できた'],
			reinforcementTargets: [],
			evidence: [{ skill: 'interaction' as const, note: '聞き返しを使えた。' }],
			nextTargets: ['説明を詳しくする'],
		};
		await db.settings.update('current', { syncEnabled: true });
		await db.metadata.bulkPut([
			{ key: 'syncSeeded', value: true, updatedAt: now },
			{ key: 'activeCurriculumTotalDays', value: 365, updatedAt: now },
		]);
		await db.metadata.delete('lastBackupRestore');
		await db.syncState.put({ id: 'current', cursor: 0, updatedAt: now });
		await db.assessments.put({ id: attemptId, type: 'stage', completedAt: now, payload });
		await db.outbox.put({
			operationId,
			schemaVersion: 1,
			deviceId: '56565656-5656-4565-8565-565656565656',
			entityType: 'assessment',
			entityId: attemptId,
			operationType: 'upsert',
			payload: { id: attemptId, type: 'stage', completedAt: now, payload },
			baseVersion: 0,
			createdAt: now,
			attempts: 0,
			nextAttemptAt: now,
			status: 'pending',
		});
		api.pushStageAssessment.mockResolvedValue({
			data: {
				operationId,
				assessmentId: payload.assessmentId,
				attemptId,
				version: 1,
				replayed: false,
				changedAt: now,
			},
		});
		api.fetchChanges.mockResolvedValue({ data: { changes: [], cursor: 0, hasMore: false } });

		await syncNow();

		expect(api.pushStageAssessment).toHaveBeenCalledWith({
			operationId,
			assessment: { id: attemptId, type: 'stage', completedAt: now, payload },
			expectedVersion: 0,
		});
		expect(await db.outbox.count()).toBe(0);
		expect(await db.metadata.get(`remoteVersion:assessment:${attemptId}`)).toMatchObject({
			value: 1,
		});
	});
});

describe('conflict resolution', () => {
	it('uses the authoritative sync payload when accepting a domain-endpoint conflict', async () => {
		const entityId = 'study:2026-08-10:curriculum:1';
		const operationId = 'abababab-abab-4bab-8bab-abababababab';
		const localProgress = {
			id: entityId,
			studyDate: '2026-08-10',
			curriculumDay: 1,
			reviewsCompleted: true,
			grammarCompleted: false,
			coreSessionImported: false,
			coreCompleted: false,
			version: 1,
			updatedAt: now,
		};
		const remoteProgress = {
			...localProgress,
			grammarCompleted: true,
			coreSessionImported: true,
			coreCompleted: true,
			version: 3,
			updatedAt: '2026-08-10T09:05:00.000Z',
		};
		await db.dailyProgress.put(localProgress);
		await db.outbox.put({
			operationId,
			schemaVersion: 1,
			deviceId: '56565656-5656-4565-8565-565656565656',
			entityType: 'daily-progress',
			entityId,
			operationType: 'upsert',
			payload: localProgress,
			baseVersion: 0,
			createdAt: now,
			attempts: 1,
			nextAttemptAt: now,
			status: 'blocked',
			lastErrorCode: 'version_conflict',
		});
		await db.conflicts.put({
			id: `push:${operationId}`,
			operationId,
			entityType: 'daily-progress',
			entityId,
			status: 'open',
			serverValue: {
				code: 'version_conflict',
				current: {
					reviewCompleted: true,
					grammarCompleted: true,
					coreVoiceImported: true,
					coreCompleted: true,
				},
				version: 3,
			},
			localValue: localProgress,
			createdAt: now,
		});
		api.fetchBootstrap.mockResolvedValue({
			data: {
				entities: [
					{
						operationId: 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd',
						entityType: 'daily-progress',
						entityId,
						operation: 'upsert',
						payload: remoteProgress,
						version: 3,
						sequence: 7,
						changedAt: remoteProgress.updatedAt,
					},
				],
				cursor: 7,
				activeTotalDays: 90,
			},
		});

		await resolveSyncConflict(`push:${operationId}`, 'use-server');

		expect(api.fetchBootstrap).toHaveBeenCalledTimes(1);
		expect(await db.dailyProgress.get(entityId)).toEqual(remoteProgress);
		expect(await db.outbox.get(operationId)).toBeUndefined();
		expect(await db.conflicts.get(`push:${operationId}`)).toMatchObject({ status: 'resolved' });
		expect(await db.metadata.get(`remoteVersion:daily-progress:${entityId}`)).toMatchObject({
			value: 3,
		});
	});

	it('discards a conflicting local review event and restores the authoritative card', async () => {
		const cardId = 'card:conflict-review';
		const eventId = 'efefefef-efef-4fef-8fef-efefefefefef';
		const operationId = '12121212-3434-4567-8567-121212121212';
		const remoteCard = {
			id: cardId,
			front: 'I go yesterday.',
			back: 'I went yesterday.',
			dueAt: now,
			state: 'review' as const,
			sourceType: 'mistake' as const,
			sourceId: 'mistake:review-conflict',
			stabilityLevel: 2,
			lapses: 0,
			algorithmVersion: 1 as const,
			version: 1,
			updatedAt: now,
		};
		const localCard = {
			...remoteCard,
			dueAt: '2026-08-12T09:00:00.000Z',
			stabilityLevel: 3,
			version: 2,
			updatedAt: '2026-08-10T09:01:00.000Z',
		};
		const event = {
			eventId,
			cardId,
			grade: 'good' as const,
			occurredAt: '2026-08-10T09:01:00.000Z',
			studyDate: '2026-08-10',
			curriculumDay: 1,
			algorithmVersion: 1 as const,
			before: {
				id: remoteCard.id,
				front: remoteCard.front,
				back: remoteCard.back,
				dueAt: remoteCard.dueAt,
				state: remoteCard.state,
				stabilityLevel: remoteCard.stabilityLevel,
				lapses: remoteCard.lapses,
				version: remoteCard.version,
			},
			after: {
				id: localCard.id,
				front: localCard.front,
				back: localCard.back,
				dueAt: localCard.dueAt,
				state: localCard.state,
				stabilityLevel: localCard.stabilityLevel,
				lapses: localCard.lapses,
				version: localCard.version,
			},
		};
		await db.reviewCards.put(localCard);
		await db.reviewEvents.put(event);
		await db.outbox.put({
			operationId,
			schemaVersion: 1,
			deviceId: '56565656-5656-4565-8565-565656565656',
			entityType: 'review-event',
			entityId: cardId,
			operationType: 'upsert',
			payload: event,
			baseVersion: 1,
			createdAt: event.occurredAt,
			attempts: 1,
			nextAttemptAt: event.occurredAt,
			status: 'blocked',
			lastErrorCode: 'review_version_conflict',
		});
		await db.conflicts.put({
			id: `push:${operationId}`,
			operationId,
			entityType: 'review-event',
			entityId: cardId,
			status: 'open',
			serverValue: { current: remoteCard, version: 1 },
			localValue: event,
			createdAt: now,
		});
		api.fetchBootstrap.mockResolvedValue({
			data: {
				entities: [
					{
						operationId: '34343434-5656-4789-8789-343434343434',
						entityType: 'review-card',
						entityId: cardId,
						operation: 'upsert',
						payload: remoteCard,
						version: 1,
						sequence: 8,
						changedAt: now,
					},
				],
				cursor: 8,
				activeTotalDays: 90,
			},
		});

		await resolveSyncConflict(`push:${operationId}`, 'use-server');

		expect(await db.reviewCards.get(cardId)).toEqual(remoteCard);
		expect(await db.reviewEvents.get(eventId)).toBeUndefined();
		expect(await db.outbox.get(operationId)).toBeUndefined();
		expect(await db.metadata.get(`remoteVersion:review-card:${cardId}`)).toMatchObject({
			value: 1,
		});
	});
});
