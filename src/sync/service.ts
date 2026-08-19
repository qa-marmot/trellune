import { z } from 'zod';
import {
	db,
	effectiveActiveCurriculumTotalDays,
	persistActiveCurriculumTotalDays,
	type ConflictRecord,
	type OutboxRecord,
	type SyncStateRecord,
} from '../storage/db';
import {
	CurriculumCompatibilityError,
	assertBundledCurriculumCompatibility,
	assertCurriculumDayWithinActive,
} from '../curriculum/availability';
import {
	BaselineAssessmentSchema,
	ChatGptSessionSchema,
	WeeklyAssessmentSchema,
} from '../lib/schemas';
import { StageAssessmentSchema } from '../domain/assessment';
import { studyDateAt } from '../domain/calendar';
import { deriveCoreState } from '../domain/core';
import {
	fetchBootstrap,
	fetchChanges,
	fetchToday,
	pushBaselineAssessment,
	pushDailyProgress,
	pushDeletion,
	pushMutation,
	previewSessionImport,
	pushReviewEvent,
	pushSessionImport,
	pushStageAssessment,
	SyncClientError,
} from './client';
import {
	AcquisitionEventPayloadSchema,
	AssessmentPayloadSchema,
	DailyProgressPayloadSchema,
	GrammarProgressPayloadSchema,
	LearningEventPayloadSchema,
	LearningItemPayloadSchema,
	MistakePayloadSchema,
	ProfileSettingsPayloadSchema,
	ReviewCardPayloadSchema,
	ReviewEventPayloadSchema,
	SessionPayloadSchema,
	SyncEntityTypeSchema,
	SyncMutationSchema,
	SyncPayloadSchemas,
	type RemoteEntity,
	type SyncEntityType,
	type SyncMutation,
} from './contracts';

const CURRENT_ID = 'current' as const;
const MAX_PUSH_PER_CYCLE = 100;
const IN_FLIGHT_LEASE_MS = 30_000;
const SYNC_CYCLE_LEASE_MS = 60_000;
const LOCAL_DATA_DELETED_KEY = 'localDataDeleted';

const BackupRestoreMarkerSchema = z
	.object({
		restoredAt: z.iso.datetime({ offset: true }),
		sha256: z.string().regex(/^[0-9a-f]{64}$/u),
		requiresRemoteReconciliation: z.literal(true),
		incomingEntityKeys: z.array(z.string().min(1).max(256)).max(250_000).optional(),
		inventoryCursor: z.number().int().nonnegative().optional(),
		inventoryCapturedAt: z.iso.datetime({ offset: true }).optional(),
	})
	.strict();

type BackupRestoreMarker = z.infer<typeof BackupRestoreMarkerSchema>;

const syncTables = () => [
	db.metadata,
	db.learnerProfiles,
	db.settings,
	db.dailyProgress,
	db.learningEvents,
	db.sessions,
	db.mistakes,
	db.learningItems,
	db.acquisitionEvents,
	db.reviewCards,
	db.reviewEvents,
	db.grammarProgress,
	db.assessments,
	db.outbox,
	db.conflicts,
	db.syncState,
];

function nowIso(): string {
	return new Date().toISOString();
}

async function localRevision(now: string): Promise<void> {
	const record = await db.metadata.get('localRevision');
	const parsed = z.number().int().nonnegative().safeParse(record?.value);
	await db.metadata.put({
		key: 'localRevision',
		value: (parsed.success ? parsed.data : 0) + 1,
		updatedAt: now,
	});
}

async function deviceId(now: string): Promise<string> {
	const record = await db.metadata.get('deviceId');
	const parsed = z.string().uuid().safeParse(record?.value);
	if (parsed.success) return parsed.data;
	const value = crypto.randomUUID();
	await db.metadata.put({ key: 'deviceId', value, updatedAt: now });
	return value;
}

function operation(
	device: string,
	entityType: SyncEntityType,
	entityId: string,
	payload: unknown,
	baseVersion: number | null,
	now: string,
	sourceVersion?: number,
): OutboxRecord {
	return {
		operationId: crypto.randomUUID(),
		schemaVersion: 1,
		deviceId: device,
		entityType,
		entityId,
		operationType: 'upsert',
		payload,
		baseVersion,
		...(sourceVersion === undefined ? {} : { sourceVersion }),
		createdAt: now,
		attempts: 0,
		nextAttemptAt: now,
		status: 'pending',
	};
}

function outboxIdentity(record: OutboxRecord): string {
	return `${record.entityType}:${outboxRemoteEntityId(record)}`;
}

function outboxRemoteEntityId(record: OutboxRecord): string {
	if (record.entityType === 'review-event') {
		const event = ReviewEventPayloadSchema.safeParse(record.payload);
		if (event.success) return event.data.eventId;
	}
	return record.entityId;
}

function syncEntityKey(entityType: string, entityId: string): string {
	return `${entityType}:${entityId}`;
}

async function currentLocalEntityKeys(): Promise<Set<string>> {
	const [
		profile,
		dailyProgress,
		learningEvents,
		sessions,
		mistakes,
		learningItems,
		acquisitionEvents,
		reviewCards,
		reviewEvents,
		grammarProgress,
		assessments,
	] = await Promise.all([
		db.learnerProfiles.get(CURRENT_ID),
		db.dailyProgress.toArray(),
		db.learningEvents.toArray(),
		db.sessions.toArray(),
		db.mistakes.toArray(),
		db.learningItems.toArray(),
		db.acquisitionEvents.toArray(),
		db.reviewCards.toArray(),
		db.reviewEvents.toArray(),
		db.grammarProgress.toArray(),
		db.assessments.toArray(),
	]);
	return new Set([
		...(profile ? [syncEntityKey('profile-settings', CURRENT_ID)] : []),
		...dailyProgress.map(({ id }) => syncEntityKey('daily-progress', id)),
		...learningEvents.map(({ eventId }) => syncEntityKey('learning-event', eventId)),
		...sessions.map(({ sessionId }) => syncEntityKey('session', sessionId)),
		...mistakes.map(({ id }) => syncEntityKey('mistake', id)),
		...learningItems.map(({ id }) => syncEntityKey('learning-item', id)),
		...acquisitionEvents.map(({ eventId }) => syncEntityKey('acquisition-event', eventId)),
		...reviewCards.map(({ id }) => syncEntityKey('review-card', id)),
		...reviewEvents.map(({ eventId }) => syncEntityKey('review-event', eventId)),
		...grammarProgress.map(({ id }) => syncEntityKey('grammar-progress', id)),
		...assessments.map(({ id }) => syncEntityKey('assessment', id)),
	]);
}

async function prepareBackupRestoreReconciliation(): Promise<void> {
	const markerRecord = await db.metadata.get('lastBackupRestore');
	if (!markerRecord) return;
	const marker = BackupRestoreMarkerSchema.parse(markerRecord.value);
	if (marker.inventoryCursor !== undefined) return;

	const localKeys = await currentLocalEntityKeys();
	for (const key of marker.incomingEntityKeys ?? []) localKeys.add(key);
	const response = await fetchBootstrap();
	const activeTotalDays = await persistActiveCurriculumTotalDays(response.data.activeTotalDays);
	for (const entity of response.data.entities) {
		const payload = parsePayload(entity);
		if (payload !== null) {
			assertRemotePayloadWithinActiveCurriculum(entity.entityType, payload, activeTotalDays);
		}
	}
	const now = nowIso();
	await db.transaction('rw', [db.metadata, db.outbox, db.syncState], async () => {
		if (await db.metadata.get(LOCAL_DATA_DELETED_KEY)) return;
		const current = BackupRestoreMarkerSchema.parse(
			(await db.metadata.get('lastBackupRestore'))?.value,
		);
		if (current.sha256 !== marker.sha256 || current.inventoryCursor !== undefined) return;

		const device = await deviceId(now);
		const outbox = await db.outbox.toArray();
		for (const entity of response.data.entities) {
			await db.metadata.put({
				key: `remoteVersion:${entity.entityType}:${entity.entityId}`,
				value: entity.version,
				updatedAt: entity.changedAt,
			});
			if (
				entity.operation === 'delete' ||
				entity.entityType === 'profile-settings' ||
				localKeys.has(syncEntityKey(entity.entityType, entity.entityId))
			) {
				continue;
			}
			const existing = outbox.find(
				(item) => item.entityType === entity.entityType && item.entityId === entity.entityId,
			);
			if (existing?.operationType === 'delete') {
				await db.outbox.update(existing.operationId, {
					baseVersion: entity.version,
					status: 'pending',
					nextAttemptAt: now,
					lastErrorCode: undefined,
				});
			} else if (!existing) {
				await db.outbox.add({
					operationId: crypto.randomUUID(),
					schemaVersion: 1,
					deviceId: device,
					entityType: entity.entityType,
					entityId: entity.entityId,
					operationType: 'delete',
					payload: null,
					baseVersion: entity.version,
					createdAt: now,
					attempts: 0,
					nextAttemptAt: now,
					status: 'pending',
				});
			}
		}
		await db.syncState.put({ id: CURRENT_ID, cursor: response.data.cursor, updatedAt: now });
		const updated: BackupRestoreMarker = {
			...current,
			incomingEntityKeys: [...localKeys].sort(),
			inventoryCursor: response.data.cursor,
			inventoryCapturedAt: now,
		};
		await db.metadata.put({ key: 'lastBackupRestore', value: updated, updatedAt: now });
	});
}

function operationPriority(record: OutboxRecord): number {
	if (record.entityType === 'profile-settings') return 0;
	return 1;
}

export async function ensureInitialSyncOutbox(): Promise<void> {
	const now = nowIso();
	await db.transaction('rw', syncTables(), async () => {
		if (await db.metadata.get(LOCAL_DATA_DELETED_KEY)) return;
		if (await db.metadata.get('syncSeeded')) return;
		const profile = await db.learnerProfiles.get(CURRENT_ID);
		const settings = await db.settings.get(CURRENT_ID);
		if (!profile || !settings || !settings.syncEnabled) return;
		const restoreMarker = await db.metadata.get('lastBackupRestore');
		const device = await deviceId(now);
		const [dailyProgress, sessions, reviewEvents, assessments, remoteVersions] = await Promise.all([
			db.dailyProgress.toArray(),
			db.sessions.toArray(),
			db.reviewEvents.toArray(),
			db.assessments.toArray(),
			db.metadata.where('key').startsWith('remoteVersion:').toArray(),
		]);
		const remoteVersionByEntity = new Map(
			remoteVersions.flatMap((record) => {
				const parsed = z.number().int().nonnegative().safeParse(record.value);
				return parsed.success
					? [[record.key.slice('remoteVersion:'.length), parsed.data] as const]
					: [];
			}),
		);
		const remoteVersion = (entityType: string, entityId: string): number =>
			remoteVersionByEntity.get(syncEntityKey(entityType, entityId)) ?? 0;

		// Only the profile uses the generic endpoint. Progress and sessions are replayed
		// through their invariant-enforcing domain endpoints.
		const records: OutboxRecord[] = [
			operation(
				device,
				'profile-settings',
				CURRENT_ID,
				{ profile, settings },
				remoteVersion('profile-settings', CURRENT_ID),
				profile.updatedAt,
			),
			...dailyProgress
				.filter((item) => item.reviewsCompleted || item.grammarCompleted)
				.map((item) =>
					operation(
						device,
						'daily-progress',
						item.id,
						item,
						remoteVersion('daily-progress', item.id) || Math.max(0, item.version - 1),
						item.updatedAt,
						restoreMarker ? item.version : undefined,
					),
				),
			...sessions.map((item) =>
				operation(
					device,
					'session',
					item.sessionId,
					item,
					remoteVersion('session', item.sessionId),
					item.completedAt,
				),
			),
			...reviewEvents.map((item) =>
				operation(device, 'review-event', item.cardId, item, item.before.version, item.occurredAt),
			),
			...assessments.map((item) =>
				operation(
					device,
					'assessment',
					item.id,
					item,
					remoteVersion('assessment', item.id),
					item.completedAt,
				),
			),
		];
		const existing = await db.outbox.toArray();
		const existingKeys = new Set(existing.map(outboxIdentity));
		const missing = records.filter((record) => !existingKeys.has(outboxIdentity(record)));
		if (missing.length) await db.outbox.bulkAdd(missing);
		await db.metadata.put({ key: 'syncSeeded', value: true, updatedAt: now });
	});
}

function asMutation(record: OutboxRecord): SyncMutation {
	return SyncMutationSchema.parse({
		operationId: record.operationId,
		schemaVersion: record.schemaVersion,
		deviceId: record.deviceId,
		entityType: record.entityType,
		entityId: record.entityId,
		operationType: record.operationType,
		payload: record.payload,
		baseVersion: record.baseVersion,
		createdAt: record.createdAt,
	});
}

async function claimNextOperation(): Promise<OutboxRecord | undefined> {
	const now = nowIso();
	const leaseExpiry = new Date(Date.now() + IN_FLIGHT_LEASE_MS).toISOString();
	return db.transaction('rw', [db.outbox, db.metadata], async () => {
		if (await db.metadata.get(LOCAL_DATA_DELETED_KEY)) return undefined;
		const expired = await db.outbox
			.where('status')
			.equals('in_flight')
			.and((item) => item.nextAttemptAt <= now)
			.toArray();
		for (const item of expired) {
			await db.outbox.update(item.operationId, { status: 'pending' });
		}
		const all = await db.outbox.toArray();
		const candidates = all
			.filter((item) => item.status === 'pending' && item.nextAttemptAt <= now)
			.sort((left, right) => {
				const priority = operationPriority(left) - operationPriority(right);
				if (priority !== 0) return priority;
				if (
					left.entityType === 'review-event' &&
					right.entityType === 'review-event' &&
					left.entityId === right.entityId &&
					left.baseVersion !== null &&
					right.baseVersion !== null &&
					left.baseVersion !== right.baseVersion
				) {
					return left.baseVersion - right.baseVersion;
				}
				return left.createdAt === right.createdAt
					? left.operationId.localeCompare(right.operationId)
					: left.createdAt.localeCompare(right.createdAt);
			});
		const candidate = candidates.find(
			(item) =>
				!all.some(
					(other) =>
						other.operationId !== item.operationId &&
						other.entityType === item.entityType &&
						other.entityId === item.entityId &&
						(other.createdAt < item.createdAt ||
							(other.createdAt === item.createdAt && other.operationId < item.operationId)),
				),
		);
		if (!candidate) return undefined;
		await db.outbox.update(candidate.operationId, {
			status: 'in_flight',
			nextAttemptAt: leaseExpiry,
		});
		return { ...candidate, status: 'in_flight', nextAttemptAt: leaseExpiry };
	});
}

async function markSuccess(
	record: OutboxRecord,
	version: number,
	changedAt: string,
): Promise<void> {
	await db.transaction('rw', [db.outbox, db.metadata, db.syncState], async () => {
		if (await db.metadata.get(LOCAL_DATA_DELETED_KEY)) return;
		const current = await db.outbox.get(record.operationId);
		if (current?.status === 'in_flight') await db.outbox.delete(record.operationId);
		const remoteEntityId = outboxRemoteEntityId(record);
		await db.metadata.put({
			key: `remoteVersion:${record.entityType}:${remoteEntityId}`,
			value: version,
			updatedAt: changedAt,
		});
		await db.metadata.put({
			key: `entityVersion:${record.entityType}`,
			value: version,
			updatedAt: changedAt,
		});
		await db.metadata.put({
			key: `entityVersion:${record.entityType}:${remoteEntityId}`,
			value: version,
			updatedAt: changedAt,
		});
		if (record.operationType === 'upsert') {
			const restoreRecord = await db.metadata.get('lastBackupRestore');
			const restoreMarker = restoreRecord
				? BackupRestoreMarkerSchema.parse(restoreRecord.value)
				: undefined;
			if (restoreMarker?.inventoryCapturedAt) {
				const key = outboxIdentity(record);
				if (!(restoreMarker.incomingEntityKeys ?? []).includes(key)) {
					await db.metadata.put({
						key: 'lastBackupRestore',
						value: {
							...restoreMarker,
							incomingEntityKeys: [...(restoreMarker.incomingEntityKeys ?? []), key].sort(),
						},
						updatedAt: changedAt,
					});
				}
			}
		}
		await db.syncState.put({
			id: CURRENT_ID,
			cursor: (await db.syncState.get(CURRENT_ID))?.cursor ?? 0,
			lastSuccessAt: changedAt,
			updatedAt: changedAt,
		});
	});
}

function retryDelay(attempts: number, retryAfterMs?: number): number {
	if (retryAfterMs !== undefined) return Math.min(retryAfterMs, 60 * 60 * 1_000);
	const exponential = Math.min(1_000 * 2 ** Math.min(attempts, 12), 60 * 60 * 1_000);
	return exponential + Math.floor(Math.random() * 500);
}

async function markFailure(record: OutboxRecord, error: SyncClientError): Promise<void> {
	const now = nowIso();
	const blocked = error.kind === 'auth' || error.kind === 'conflict' || error.kind === 'validation';
	const attempts = record.attempts + 1;
	const nextAttemptAt = blocked
		? record.nextAttemptAt
		: new Date(Date.now() + retryDelay(attempts, error.retryAfterMs)).toISOString();
	await db.transaction('rw', [db.outbox, db.conflicts, db.syncState, db.metadata], async () => {
		if (await db.metadata.get(LOCAL_DATA_DELETED_KEY)) return;
		await db.outbox.update(record.operationId, {
			status: blocked ? 'blocked' : 'pending',
			attempts,
			nextAttemptAt,
			lastErrorCode: error.code ?? error.kind,
		});
		const conflictDetails = z
			.object({
				version: z.number().int().nonnegative(),
				current: z.unknown().nullable().optional(),
			})
			.passthrough()
			.safeParse(error.details);
		if (error.kind === 'conflict' && conflictDetails.success) {
			const conflict: ConflictRecord = {
				id: `push:${record.operationId}`,
				operationId: record.operationId,
				entityType: record.entityType,
				entityId: record.entityId,
				status: 'open',
				serverValue: error.details ?? null,
				localValue: record.payload,
				createdAt: now,
			};
			await db.conflicts.put(conflict);
		}
		const state = await db.syncState.get(CURRENT_ID);
		await db.syncState.put({
			id: CURRENT_ID,
			cursor: state?.cursor ?? 0,
			lastSuccessAt: state?.lastSuccessAt,
			lastErrorCode: error.code ?? error.kind,
			updatedAt: now,
		});
	});
}

function parsePayload(entity: RemoteEntity): unknown {
	if (entity.operation === 'delete') return null;
	return SyncPayloadSchemas[entity.entityType].parse(entity.payload);
}

function assertRemotePayloadWithinActiveCurriculum(
	entityType: SyncEntityType,
	payload: unknown,
	activeTotalDays: number,
): void {
	const assertDay = (day: number) => assertCurriculumDayWithinActive(day, activeTotalDays);
	if (entityType === 'profile-settings') {
		assertDay(ProfileSettingsPayloadSchema.parse(payload).profile.currentDay);
	} else if (entityType === 'daily-progress') {
		assertDay(DailyProgressPayloadSchema.parse(payload).curriculumDay);
	} else if (entityType === 'learning-event') {
		assertDay(LearningEventPayloadSchema.parse(payload).curriculumDay);
	} else if (entityType === 'session') {
		const session = SessionPayloadSchema.parse(payload);
		if (session.payload) assertDay(ChatGptSessionSchema.parse(session.payload).curriculumDay);
	} else if (entityType === 'review-event') {
		assertDay(ReviewEventPayloadSchema.parse(payload).curriculumDay);
	} else if (entityType === 'grammar-progress') {
		assertDay(GrammarProgressPayloadSchema.parse(payload).curriculumDay);
	} else if (entityType === 'assessment') {
		const assessment = AssessmentPayloadSchema.parse(payload);
		if (assessment.type === 'weekly') {
			const weekly = WeeklyAssessmentSchema.parse(assessment.payload);
			assertDay(weekly.startDay);
			assertDay(weekly.endDay);
		} else if (assessment.type === 'stage') {
			const stage = StageAssessmentSchema.parse(assessment.payload);
			assertDay(stage.curriculumRange.startDay);
			assertDay(stage.curriculumRange.endDay);
		}
	}
}

async function applyRemoteBatch(
	entities: RemoteEntity[],
	cursor: number,
	options: { bootstrap: boolean },
): Promise<void> {
	const now = nowIso();
	const activeTotalDays = await effectiveActiveCurriculumTotalDays();
	const applied = await db.transaction('rw', syncTables(), async () => {
		if (await db.metadata.get(LOCAL_DATA_DELETED_KEY)) return false;
		const restoreRecord = await db.metadata.get('lastBackupRestore');
		const restoreMarker = restoreRecord
			? BackupRestoreMarkerSchema.parse(restoreRecord.value)
			: undefined;
		const restoreKeys = restoreMarker?.inventoryCapturedAt
			? new Set(restoreMarker.incomingEntityKeys ?? [])
			: undefined;
		for (const entity of entities) {
			const payload = parsePayload(entity);
			if (payload !== null) {
				assertRemotePayloadWithinActiveCurriculum(entity.entityType, payload, activeTotalDays);
			}
			const pending = await db.outbox
				.where('entityType')
				.equals(entity.entityType)
				.and((item) => item.entityId === entity.entityId)
				.first();
			if (pending?.operationId === entity.operationId) {
				await applyRemoteEntity(entity, payload);
				await db.outbox.delete(pending.operationId);
			} else if (
				restoreKeys &&
				entity.operation === 'upsert' &&
				entity.entityType !== 'profile-settings' &&
				!restoreKeys.has(syncEntityKey(entity.entityType, entity.entityId)) &&
				!pending
			) {
				const device = await deviceId(now);
				await db.outbox.add({
					operationId: crypto.randomUUID(),
					schemaVersion: 1,
					deviceId: device,
					entityType: entity.entityType,
					entityId: entity.entityId,
					operationType: 'delete',
					payload: null,
					baseVersion: entity.version,
					createdAt: now,
					attempts: 0,
					nextAttemptAt: now,
					status: 'pending',
				});
				await db.metadata.put({
					key: `remoteVersion:${entity.entityType}:${entity.entityId}`,
					value: entity.version,
					updatedAt: entity.changedAt,
				});
				continue;
			} else if (pending && !options.bootstrap) {
				await db.conflicts.put({
					id: `pull:${entity.sequence}:${entity.entityType}:${entity.entityId}`,
					operationId: pending.operationId,
					entityType: entity.entityType,
					entityId: entity.entityId,
					status: 'open',
					serverValue: {
						current: payload,
						version: entity.version,
						changedAt: entity.changedAt,
						operationId: entity.operationId,
					},
					localValue: pending.payload,
					createdAt: now,
				});
				await db.outbox.update(pending.operationId, {
					status: 'blocked',
					lastErrorCode: 'pull_conflict',
				});
				continue;
			} else {
				await applyRemoteEntity(entity, payload);
			}
			await db.metadata.put({
				key: `remoteVersion:${entity.entityType}:${entity.entityId}`,
				value: entity.version,
				updatedAt: entity.changedAt,
			});
		}
		const previous = await db.syncState.get(CURRENT_ID);
		const state: SyncStateRecord = {
			id: CURRENT_ID,
			cursor,
			lastSuccessAt: now,
			lastErrorCode: undefined,
			updatedAt: now,
		};
		await db.syncState.put(state);
		await db.metadata.put({
			key: 'bootstrapComplete',
			value: { schemaVersion: 5, migration: false },
			updatedAt: now,
		});
		await db.metadata.put({ key: 'syncSeeded', value: true, updatedAt: now });
		if (entities.length || previous?.cursor !== cursor) await localRevision(now);
		return true;
	});
	if (applied && entities.length) broadcastCommit();
}

async function applyRemoteEntity(
	entity: RemoteEntity,
	payload: unknown,
	options: { preserveLocalCoreEvidence?: boolean } = {},
): Promise<void> {
	if (entity.operation === 'delete') {
		if (entity.entityType === 'profile-settings') {
			await db.learnerProfiles.delete(CURRENT_ID);
			await db.settings.delete(CURRENT_ID);
		} else if (entity.entityType === 'daily-progress')
			await db.dailyProgress.delete(entity.entityId);
		else if (entity.entityType === 'learning-event')
			await db.learningEvents.delete(entity.entityId);
		else if (entity.entityType === 'session') await db.sessions.delete(entity.entityId);
		else if (entity.entityType === 'mistake') await db.mistakes.delete(entity.entityId);
		else if (entity.entityType === 'learning-item') await db.learningItems.delete(entity.entityId);
		else if (entity.entityType === 'acquisition-event')
			await db.acquisitionEvents.delete(entity.entityId);
		else if (entity.entityType === 'review-card') await db.reviewCards.delete(entity.entityId);
		else if (entity.entityType === 'review-event') await db.reviewEvents.delete(entity.entityId);
		else if (entity.entityType === 'grammar-progress')
			await db.grammarProgress.delete(entity.entityId);
		else if (entity.entityType === 'assessment') await db.assessments.delete(entity.entityId);
		return;
	}

	if (entity.entityType === 'profile-settings') {
		const value = ProfileSettingsPayloadSchema.parse(payload);
		await db.learnerProfiles.put(value.profile);
		await db.settings.put(value.settings);
	} else if (entity.entityType === 'daily-progress') {
		const remote = DailyProgressPayloadSchema.parse(payload);
		const local =
			options.preserveLocalCoreEvidence === false
				? undefined
				: await db.dailyProgress.get(remote.id);
		if (!local) {
			await db.dailyProgress.put(remote);
			return;
		}
		const core = deriveCoreState({
			reviewsCompleted: local.reviewsCompleted || remote.reviewsCompleted,
			grammarCompleted: local.grammarCompleted || remote.grammarCompleted,
			coreSessionImported: local.coreSessionImported || remote.coreSessionImported,
		});
		await db.dailyProgress.put({ ...remote, ...core });
	} else if (entity.entityType === 'learning-event') {
		await db.learningEvents.put(LearningEventPayloadSchema.parse(payload));
	} else if (entity.entityType === 'session') {
		await db.sessions.put(SessionPayloadSchema.parse(payload));
	} else if (entity.entityType === 'mistake') {
		await db.mistakes.put(MistakePayloadSchema.parse(payload));
	} else if (entity.entityType === 'learning-item') {
		await db.learningItems.put(LearningItemPayloadSchema.parse(payload));
	} else if (entity.entityType === 'acquisition-event') {
		await db.acquisitionEvents.put(AcquisitionEventPayloadSchema.parse(payload));
	} else if (entity.entityType === 'review-card') {
		await db.reviewCards.put(ReviewCardPayloadSchema.parse(payload));
	} else if (entity.entityType === 'review-event') {
		await db.reviewEvents.put(ReviewEventPayloadSchema.parse(payload));
	} else if (entity.entityType === 'grammar-progress') {
		await db.grammarProgress.put(GrammarProgressPayloadSchema.parse(payload));
	} else if (entity.entityType === 'assessment') {
		await db.assessments.put(AssessmentPayloadSchema.parse(payload));
	}
}

async function pushPending(): Promise<boolean> {
	for (let index = 0; index < MAX_PUSH_PER_CYCLE; index += 1) {
		const record = await claimNextOperation();
		if (!record) return true;
		try {
			const response = await pushOutboxRecord(record);
			if (response.operationId !== record.operationId) {
				throw new SyncClientError(
					'protocol',
					'同期APIの応答が送信した操作IDと一致しません。',
					undefined,
					'operation_id_mismatch',
				);
			}
			await markSuccess(record, response.version, response.changedAt);
		} catch (error) {
			const safeError =
				error instanceof SyncClientError
					? error
					: new SyncClientError(
							'protocol',
							'同期処理を継続できません。',
							undefined,
							'client_error',
						);
			await markFailure(record, safeError);
			if (safeError.kind === 'auth') return false;
		}
	}
	return true;
}

async function sha256(value: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function canonicalize(value: unknown): unknown {
	if (typeof value === 'string') return value.normalize('NFKC');
	if (Array.isArray(value)) return value.map(canonicalize);
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.keys(value)
				.filter((key) => key !== 'sessionId')
				.sort()
				.map((key) => [key, canonicalize((value as Record<string, unknown>)[key])]),
		);
	}
	return value;
}

async function pushOutboxRecord(
	record: OutboxRecord,
): Promise<{ operationId: string; version: number; changedAt: string }> {
	if (record.operationType === 'delete') {
		const response = await pushDeletion({
			operationId: record.operationId,
			schemaVersion: 1,
			deviceId: record.deviceId,
			entityType: SyncEntityTypeSchema.exclude(['profile-settings']).parse(record.entityType),
			entityId: record.entityId,
			expectedVersion: record.baseVersion ?? 0,
			createdAt: record.createdAt,
		});
		return response.data;
	}
	if (record.entityType === 'profile-settings') {
		const response = await pushMutation(asMutation(record));
		return response.data;
	}
	if (record.entityType === 'daily-progress') {
		const progress = DailyProgressPayloadSchema.parse(record.payload);
		const response = await pushDailyProgress(progress.studyDate, {
			curriculumDay: progress.curriculumDay,
			...(progress.reviewsCompleted ? { reviewCompleted: true as const } : {}),
			...(progress.grammarCompleted ? { grammarCompleted: true as const } : {}),
			expectedVersion: record.baseVersion ?? 0,
			...(record.sourceVersion === undefined ? {} : { sourceVersion: record.sourceVersion }),
			clientMutationId: record.operationId,
			updatedAt: record.createdAt,
		});
		return response.data;
	}
	if (record.entityType === 'session') {
		const session = SessionPayloadSchema.parse(record.payload);
		const payload = ChatGptSessionSchema.parse(session.payload);
		const profile = ProfileSettingsPayloadSchema.shape.profile.parse(
			await db.learnerProfiles.get(CURRENT_ID),
		);
		const canonical = JSON.stringify(canonicalize(payload));
		const requestBody = {
			payload,
			studyDate: session.studyDate ?? studyDateAt(payload.occurredAt, profile.timeZone),
			idempotencyKey: record.operationId,
			sourceTextHash: await sha256(canonical),
			reviewedCardIds: [],
			expectedVersion: record.baseVersion ?? 0,
		};
		const preview = await previewSessionImport(requestBody);
		if (!preview.data.limits.accepted) {
			throw new SyncClientError(
				'validation',
				'サーバー側の日次獲得上限を超えるため、セッションを同期できません。',
				422,
				'daily_acquisition_limit',
				undefined,
				preview.data.limits,
			);
		}
		const response = await pushSessionImport(requestBody);
		return response.data;
	}
	if (record.entityType === 'review-event') {
		const event = ReviewEventPayloadSchema.parse(record.payload);
		const response = await pushReviewEvent({
			operationId: record.operationId,
			eventId: event.eventId,
			cardId: event.cardId,
			grade: event.grade,
			occurredAt: event.occurredAt,
			studyDate: event.studyDate,
			curriculumDay: event.curriculumDay,
			expectedVersion: record.baseVersion ?? event.before.version,
		});
		return {
			operationId: response.data.operationId,
			version: 1,
			changedAt: response.data.changedAt,
		};
	}
	if (record.entityType === 'assessment') {
		const assessment = AssessmentPayloadSchema.parse(record.payload);
		if (assessment.type === 'stage') {
			const payload = StageAssessmentSchema.parse(assessment.payload);
			const response = await pushStageAssessment({
				operationId: record.operationId,
				assessment: {
					id: assessment.id,
					type: 'stage',
					completedAt: assessment.completedAt,
					payload,
				},
				expectedVersion: record.baseVersion ?? 0,
			});
			return {
				operationId: response.data.operationId,
				version: response.data.version,
				changedAt: response.data.changedAt,
			};
		}
		if (assessment.type === 'weekly') {
			throw new SyncClientError(
				'validation',
				'Weekly assessment synchronization is not available in this release.',
				undefined,
				'unsupported_assessment_type',
			);
		}
		const response = await pushBaselineAssessment({
			operationId: record.operationId,
			assessment: {
				id: 'baseline:current',
				type: 'baseline',
				completedAt: assessment.completedAt,
				payload: BaselineAssessmentSchema.parse(assessment.payload),
			},
			expectedVersion: record.baseVersion ?? 0,
		});
		return response.data;
	}
	throw new SyncClientError(
		'validation',
		'このデータは正式な同期経路を持たないため送信できません。',
		undefined,
		'unsupported_outbox_entity',
	);
}

async function pullAll(): Promise<void> {
	let cursor = (await db.syncState.get(CURRENT_ID))?.cursor ?? 0;
	for (let page = 0; page < 100; page += 1) {
		const response = await fetchChanges(cursor);
		await applyRemoteBatch(response.data.changes, response.data.cursor, { bootstrap: false });
		if (await db.metadata.get(LOCAL_DATA_DELETED_KEY)) return;
		cursor = response.data.cursor;
		if (!response.data.hasMore) return;
	}
	throw new SyncClientError(
		'protocol',
		'同期差分が多すぎるため一度に取得できませんでした。',
		undefined,
		'change_page_limit',
	);
}

async function completeBackupRestoreReconciliation(): Promise<void> {
	await db.transaction('rw', [db.metadata, db.outbox, db.conflicts], async () => {
		const markerRecord = await db.metadata.get('lastBackupRestore');
		if (!markerRecord) return;
		const marker = BackupRestoreMarkerSchema.parse(markerRecord.value);
		if (marker.inventoryCursor === undefined || !marker.inventoryCapturedAt) return;
		if ((await db.outbox.count()) > 0) return;
		if ((await db.conflicts.where('status').equals('open').count()) > 0) return;
		await db.metadata.delete('lastBackupRestore');
	});
}

async function refreshTodayReadModel(): Promise<void> {
	const profile = await db.learnerProfiles.get(CURRENT_ID);
	if (!profile) return;
	const studyDate = studyDateAt(nowIso(), profile.timeZone);
	const response = await fetchToday(studyDate);
	await db.transaction('rw', db.metadata, async () => {
		if (await db.metadata.get(LOCAL_DATA_DELETED_KEY)) return;
		await db.metadata.put({
			key: 'serverToday',
			value: response.data,
			updatedAt: nowIso(),
		});
	});
}

export type SyncRunStatus = 'completed' | 'busy' | 'offline' | 'blocked' | 'failed';

export interface SyncRunResult {
	status: SyncRunStatus;
	startedAt: string;
	finishedAt: string;
	pending: number;
	blocked: number;
	conflicts: number;
	lastErrorCode?: string;
}

let fallbackCycle: Promise<SyncRunResult> | null = null;

interface SyncLeaseValue {
	owner: string;
	expiresAt: string;
}

const SyncLeaseSchema = z
	.object({ owner: z.string().uuid(), expiresAt: z.iso.datetime({ offset: true }) })
	.strict();

async function acquireSyncLease(owner: string): Promise<boolean> {
	const now = nowIso();
	return db.transaction('rw', db.metadata, async () => {
		if (await db.metadata.get(LOCAL_DATA_DELETED_KEY)) return false;
		const current = SyncLeaseSchema.safeParse((await db.metadata.get('syncLease'))?.value);
		if (current.success && current.data.expiresAt > now && current.data.owner !== owner)
			return false;
		const value: SyncLeaseValue = {
			owner,
			expiresAt: new Date(Date.now() + SYNC_CYCLE_LEASE_MS).toISOString(),
		};
		await db.metadata.put({ key: 'syncLease', value, updatedAt: now });
		return true;
	});
}

async function releaseSyncLease(owner: string): Promise<void> {
	await db.transaction('rw', db.metadata, async () => {
		const current = SyncLeaseSchema.safeParse((await db.metadata.get('syncLease'))?.value);
		if (current.success && current.data.owner === owner) await db.metadata.delete('syncLease');
	});
}

async function unblockRecoverableOperations(): Promise<void> {
	const blocked = await db.outbox.where('status').equals('blocked').toArray();
	for (const item of blocked) {
		if (item.lastErrorCode === 'unauthorized' || item.lastErrorCode === 'auth') {
			await db.outbox.update(item.operationId, {
				status: 'pending',
				nextAttemptAt: nowIso(),
			});
		}
	}
}

async function runCycle(): Promise<Exclude<SyncRunStatus, 'busy' | 'failed'>> {
	if (await db.metadata.get(LOCAL_DATA_DELETED_KEY)) return 'blocked';
	if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline';
	await unblockRecoverableOperations();
	await prepareBackupRestoreReconciliation();
	await ensureInitialSyncOutbox();
	if (!(await pushPending())) return 'blocked';
	if (await db.metadata.get(LOCAL_DATA_DELETED_KEY)) return 'blocked';
	await pullAll();
	if (await db.metadata.get(LOCAL_DATA_DELETED_KEY)) return 'blocked';
	await completeBackupRestoreReconciliation();
	await refreshTodayReadModel();
	const status = await getSyncStatus();
	return status.blocked || status.conflicts.length ? 'blocked' : 'completed';
}

async function finalizeSyncRun(
	status: SyncRunStatus,
	startedAt: string,
	lastErrorCode?: string,
): Promise<SyncRunResult> {
	const finishedAt = nowIso();
	const [summary, state] = await Promise.all([getSyncStatus(), db.syncState.get(CURRENT_ID)]);
	const result: SyncRunResult = {
		status,
		startedAt,
		finishedAt,
		pending: summary.pending,
		blocked: summary.blocked,
		conflicts: summary.conflicts.length,
		lastErrorCode: lastErrorCode ?? summary.lastErrorCode,
	};
	await db.syncState.put({
		id: CURRENT_ID,
		cursor: state?.cursor ?? 0,
		lastSuccessAt: status === 'completed' ? finishedAt : state?.lastSuccessAt,
		lastErrorCode: status === 'completed' ? undefined : (lastErrorCode ?? state?.lastErrorCode),
		lastAttemptAt: finishedAt,
		lastAttemptStatus: status,
		updatedAt: finishedAt,
	});
	return result;
}

export function syncNow(): Promise<SyncRunResult> {
	const startedAt = nowIso();
	if (fallbackCycle) return finalizeSyncRun('busy', startedAt);
	const owner = crypto.randomUUID();
	fallbackCycle = (async () => {
		let leaseAcquired = false;
		try {
			if (!(await acquireSyncLease(owner))) return await finalizeSyncRun('busy', startedAt);
			leaseAcquired = true;
			let outcome: Exclude<SyncRunStatus, 'busy' | 'failed'> = 'blocked';
			if (typeof navigator !== 'undefined' && 'locks' in navigator) {
				let lockAcquired = false;
				await navigator.locks.request(
					'english-os-sync-v1',
					{ ifAvailable: true, mode: 'exclusive' },
					async (lock) => {
						if (!lock) return;
						lockAcquired = true;
						outcome = await runCycle();
					},
				);
				if (!lockAcquired) return await finalizeSyncRun('busy', startedAt);
			} else {
				outcome = await runCycle();
			}
			return await finalizeSyncRun(outcome, startedAt);
		} catch (error) {
			const lastErrorCode =
				error instanceof SyncClientError ? (error.code ?? error.kind) : 'client_error';
			await finalizeSyncRun('failed', startedAt, lastErrorCode);
			throw error;
		} finally {
			if (leaseAcquired) await releaseSyncLease(owner);
		}
	})().finally(() => {
		fallbackCycle = null;
	});
	return fallbackCycle;
}

export async function hydrateFromRemoteIfEmpty(force = false): Promise<boolean> {
	if (!force && (await db.learnerProfiles.get(CURRENT_ID))) return false;
	if (!force && (await db.metadata.get(LOCAL_DATA_DELETED_KEY))) return false;
	try {
		const response = await fetchBootstrap();
		await persistActiveCurriculumTotalDays(
			assertBundledCurriculumCompatibility(response.data.activeTotalDays),
		);
		if (!response.data.entities.length) return false;
		await applyRemoteBatch(response.data.entities, response.data.cursor, { bootstrap: true });
		return Boolean(
			(await db.learnerProfiles.get(CURRENT_ID)) && (await db.settings.get(CURRENT_ID)),
		);
	} catch (error) {
		if (
			error instanceof CurriculumCompatibilityError ||
			(error instanceof SyncClientError &&
				error.kind === 'protocol' &&
				error.code === 'invalid_response_schema')
		) {
			throw error;
		}
		// Remote hydration is opportunistic. Authentication, malformed responses,
		// timeouts and server outages must never prevent local-first onboarding.
		void error;
		return false;
	}
}

export async function verifyRemoteCurriculumCompatibility(): Promise<number> {
	const localActive = await effectiveActiveCurriculumTotalDays();
	if (typeof navigator !== 'undefined' && !navigator.onLine) return localActive;
	try {
		const response = await fetchBootstrap();
		return persistActiveCurriculumTotalDays(response.data.activeTotalDays);
	} catch (error) {
		if (
			error instanceof CurriculumCompatibilityError ||
			(error instanceof SyncClientError &&
				error.kind === 'protocol' &&
				error.code === 'invalid_response_schema')
		) {
			throw error;
		}
		return localActive;
	}
}

function broadcastCommit(): void {
	if (typeof BroadcastChannel === 'undefined') return;
	const channel = new BroadcastChannel('english-os-database-v2');
	channel.postMessage({ type: 'committed' });
	channel.close();
}

export interface SyncStatusSummary {
	pending: number;
	syncing: number;
	blocked: number;
	conflicts: ConflictRecord[];
	lastSuccessAt?: string;
	lastErrorCode?: string;
	lastAttemptAt?: string;
	lastAttemptStatus?: SyncRunStatus;
}

export async function getSyncStatus(): Promise<SyncStatusSummary> {
	const [outbox, conflicts, state] = await Promise.all([
		db.outbox.toArray(),
		db.conflicts.where('status').equals('open').toArray(),
		db.syncState.get(CURRENT_ID),
	]);
	return {
		pending: outbox.filter((item) => item.status === 'pending').length,
		syncing: outbox.filter((item) => item.status === 'in_flight').length,
		blocked: outbox.filter((item) => item.status === 'blocked').length,
		conflicts,
		lastSuccessAt: state?.lastSuccessAt,
		lastErrorCode: state?.lastErrorCode,
		lastAttemptAt: state?.lastAttemptAt,
		lastAttemptStatus: state?.lastAttemptStatus,
	};
}

export async function retryBlockedSync(): Promise<void> {
	const now = nowIso();
	await db.transaction('rw', [db.outbox, db.metadata], async () => {
		if (await db.metadata.get(LOCAL_DATA_DELETED_KEY)) return;
		for (const item of await db.outbox.where('status').equals('blocked').toArray()) {
			if (item.lastErrorCode === 'pull_conflict' || item.lastErrorCode?.includes('conflict'))
				continue;
			await db.outbox.update(item.operationId, {
				status: 'pending',
				nextAttemptAt: now,
				lastErrorCode: undefined,
			});
		}
	});
	await syncNow();
}

export async function discardUnresolvableBlockedSync(): Promise<void> {
	await db.transaction('rw', [db.outbox, db.conflicts, db.syncState, db.metadata], async () => {
		if (await db.metadata.get(LOCAL_DATA_DELETED_KEY)) return;
		const openConflictOperations = new Set(
			(await db.conflicts.where('status').equals('open').toArray()).map((item) => item.operationId),
		);
		for (const item of await db.outbox.where('status').equals('blocked').toArray()) {
			if (!openConflictOperations.has(item.operationId)) await db.outbox.delete(item.operationId);
		}
		const state = await db.syncState.get(CURRENT_ID);
		if (state) {
			await db.syncState.put({
				...state,
				lastErrorCode: undefined,
				updatedAt: nowIso(),
			});
		}
	});
}

const ConflictServerSchema = z
	.object({
		current: z.unknown().nullable().optional(),
		version: z.number().int().nonnegative(),
		changedAt: z.iso.datetime({ offset: true }).optional(),
		operationId: z.string().uuid().nullable().optional(),
	})
	.passthrough();

async function authoritativeConflictEntity(
	conflict: ConflictRecord,
	operation: OutboxRecord | undefined,
): Promise<RemoteEntity> {
	let entityType = SyncEntityTypeSchema.parse(conflict.entityType);
	let entityId = conflict.entityId;
	if (operation?.entityType === 'review-event' && operation.operationType === 'upsert') {
		const event = ReviewEventPayloadSchema.parse(operation.payload);
		entityType = 'review-card';
		entityId = event.cardId;
	}
	const response = await fetchBootstrap();
	const activeTotalDays = await persistActiveCurriculumTotalDays(response.data.activeTotalDays);
	for (const entity of response.data.entities) {
		const payload = parsePayload(entity);
		if (payload !== null) {
			assertRemotePayloadWithinActiveCurriculum(entity.entityType, payload, activeTotalDays);
		}
	}
	const remote = response.data.entities.find(
		(entity) => entity.entityType === entityType && entity.entityId === entityId,
	);
	if (!remote) throw new Error('The authoritative remote entity is missing from the bootstrap.');
	return remote;
}

export async function resolveSyncConflict(
	conflictId: string,
	resolution: 'keep-local' | 'use-server',
): Promise<void> {
	const now = nowIso();
	const pendingConflict = await db.conflicts.get(conflictId);
	const pendingOperation = pendingConflict
		? await db.outbox.get(pendingConflict.operationId)
		: undefined;
	const authoritativeRemote =
		resolution === 'use-server' && pendingConflict?.status === 'open'
			? await authoritativeConflictEntity(pendingConflict, pendingOperation)
			: undefined;
	await db.transaction('rw', syncTables(), async () => {
		if (await db.metadata.get(LOCAL_DATA_DELETED_KEY)) return;
		const conflict = await db.conflicts.get(conflictId);
		if (!conflict || conflict.status !== 'open') return;
		const server = ConflictServerSchema.parse(conflict.serverValue);
		const operation = await db.outbox.get(conflict.operationId);
		if (resolution === 'keep-local') {
			if (!operation) throw new Error('The local operation no longer exists.');
			const operations = (await db.outbox.toArray())
				.filter(
					(item) =>
						item.entityType === operation.entityType && item.entityId === operation.entityId,
				)
				.sort((left, right) =>
					left.createdAt === right.createdAt
						? left.operationId.localeCompare(right.operationId)
						: left.createdAt.localeCompare(right.createdAt),
				);
			for (const [index, item] of operations.entries()) {
				await db.outbox.update(item.operationId, {
					baseVersion: server.version + index,
					status: 'pending',
					nextAttemptAt: now,
					lastErrorCode: undefined,
				});
			}
			await db.metadata.put({
				key: `entityVersion:${operation.entityType}`,
				value: server.version + operations.length,
				updatedAt: now,
			});
			await db.metadata.put({
				key: `entityVersion:${operation.entityType}:${operation.entityId}`,
				value: server.version + operations.length,
				updatedAt: now,
			});
		} else {
			if (!authoritativeRemote) throw new Error('The authoritative remote entity is unavailable.');
			const remote = authoritativeRemote;
			await applyRemoteEntity(remote, parsePayload(remote), {
				preserveLocalCoreEvidence: false,
			});
			if (operation?.entityType === 'review-event' && operation.operationType === 'upsert') {
				const event = ReviewEventPayloadSchema.parse(operation.payload);
				await db.reviewEvents.delete(event.eventId);
			}
			if (operation) await db.outbox.delete(operation.operationId);
			await db.metadata.put({
				key: `remoteVersion:${remote.entityType}:${remote.entityId}`,
				value: server.version,
				updatedAt: now,
			});
			await db.metadata.put({
				key: `entityVersion:${remote.entityType}`,
				value: server.version,
				updatedAt: now,
			});
			await db.metadata.put({
				key: `entityVersion:${remote.entityType}:${remote.entityId}`,
				value: server.version,
				updatedAt: now,
			});
		}
		await db.conflicts.update(conflictId, { status: 'resolved' });
		const remainingOpen = await db.conflicts.where('status').equals('open').count();
		const remainingBlocked = await db.outbox.where('status').equals('blocked').count();
		if (remainingOpen === 0 && remainingBlocked === 0) {
			const state = await db.syncState.get(CURRENT_ID);
			if (state) {
				await db.syncState.put({ ...state, lastErrorCode: undefined, updatedAt: now });
			}
		}
		await localRevision(now);
	});
	broadcastCommit();
}
