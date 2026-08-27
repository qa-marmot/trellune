import { describe, expect, it } from 'vitest';
import { RemoteEntitySchema, SyncBootstrapResponseSchema, SyncMutationSchema } from './contracts';

const payload = {
	id: 'study:2026-08-10:curriculum:1',
	studyDate: '2026-08-10',
	curriculumDay: 1,
	reviewsCompleted: true,
	grammarCompleted: false,
	coreSessionImported: false,
	coreCompleted: false,
	version: 2,
	updatedAt: '2026-08-10T00:00:00.000Z',
};

const mutation = {
	operationId: '11111111-1111-4111-8111-111111111111',
	schemaVersion: 1,
	deviceId: '22222222-2222-4222-8222-222222222222',
	entityType: 'profile-settings',
	entityId: 'current',
	operationType: 'upsert',
	payload: {
		profile: {
			id: 'current',
			onboarded: true,
			learnerName: 'Learner',
			goal: 'Speak',
			timeZone: 'Asia/Tokyo',
			startDate: '2026-08-10',
			currentDay: 1,
			streak: 0,
			updatedAt: '2026-08-10T00:00:00.000Z',
		},
		settings: {
			id: 'current',
			dailyMinutes: 20,
			syncEnabled: true,
			reduceMotion: false,
			updatedAt: '2026-08-10T00:00:00.000Z',
		},
	},
	baseVersion: 1,
	createdAt: '2026-08-10T00:00:00.000Z',
};

describe('sync contracts', () => {
	it('accepts the only generic mutation: profile and settings', () => {
		const legacy = SyncMutationSchema.parse(mutation);
		expect(legacy.payload.profile.entryDay).toBe(1);
		expect(
			SyncMutationSchema.safeParse({
				...mutation,
				payload: {
					...mutation.payload,
					profile: { ...mutation.payload.profile, entryDay: 181, currentDay: 181 },
				},
			}).success,
		).toBe(true);
		expect(
			SyncMutationSchema.safeParse({
				...mutation,
				payload: {
					...mutation.payload,
					profile: { ...mutation.payload.profile, currentDay: 540 },
				},
			}).success,
		).toBe(true);
	});

	it('adds a structurally bounded active curriculum total to bootstrap v1', () => {
		expect(
			SyncBootstrapResponseSchema.safeParse({
				data: { entities: [], cursor: 0, activeTotalDays: 90 },
			}).success,
		).toBe(true);
		expect(
			SyncBootstrapResponseSchema.safeParse({
				data: { entities: [], cursor: 0, activeTotalDays: 541 },
			}).success,
		).toBe(false);
	});

	it('rejects domain data that attempts to bypass a formal endpoint', () => {
		expect(
			SyncMutationSchema.safeParse({
				...mutation,
				entityType: 'daily-progress',
				entityId: payload.id,
				payload,
			}).success,
		).toBe(false);
	});

	it('rejects a remote payload whose embedded version differs from the server version', () => {
		expect(
			RemoteEntitySchema.safeParse({
				operationId: null,
				entityType: 'daily-progress',
				entityId: payload.id,
				operation: 'upsert',
				payload,
				version: 3,
				sequence: 9,
				changedAt: '2026-08-10T00:00:01.000Z',
			}).success,
		).toBe(false);
	});
});
