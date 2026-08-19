import { expect, test, type Page, type Route } from '@playwright/test';

async function onboard(page: Page): Promise<void> {
	await page.goto('/onboarding');
	await page.getByLabel('呼ばれたい名前').fill('Sync Learner');
	await page.getByRole('button', { name: /ベースラインへ/ }).click();
	await page.getByRole('button', { name: /Day 1を始める/ }).click();
	await expect(page).toHaveURL(/\/today$/);
}

async function indexedDbState(page: Page) {
	return page.evaluate(
		() =>
			new Promise<{ outbox: number; conflicts: number; lastSuccessAt: string | null }>(
				(resolve, reject) => {
					const request = indexedDB.open('english-os');
					request.onerror = () => reject(request.error);
					request.onsuccess = () => {
						const database = request.result;
						const transaction = database.transaction(
							['outbox', 'conflicts', 'syncState'],
							'readonly',
						);
						const outbox = transaction.objectStore('outbox').count();
						const conflicts = transaction.objectStore('conflicts').count();
						const syncState = transaction.objectStore('syncState').get('current');
						transaction.oncomplete = () => {
							database.close();
							resolve({
								outbox: outbox.result,
								conflicts: conflicts.result,
								lastSuccessAt:
									typeof syncState.result?.lastSuccessAt === 'string'
										? syncState.result.lastSuccessAt
										: null,
							});
						};
						transaction.onerror = () => reject(transaction.error);
					};
				},
			),
	);
}

async function fulfillEmptyPull(route: Route): Promise<void> {
	await route.fulfill({
		status: 200,
		contentType: 'application/json',
		body: JSON.stringify({ data: { changes: [], cursor: 0, hasMore: false } }),
	});
}

async function fulfillToday(route: Route): Promise<void> {
	const date = new URL(route.request().url()).searchParams.get('date') ?? '2026-08-10';
	await route.fulfill({
		status: 200,
		contentType: 'application/json',
		body: JSON.stringify({
			data: {
				studyDate: date,
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
		}),
	});
}

async function fulfillDailyProgress(route: Route): Promise<void> {
	const request = route.request().postDataJSON() as {
		clientMutationId: string;
		reviewCompleted?: true;
		grammarCompleted?: true;
		expectedVersion?: number;
	};
	await route.fulfill({
		status: 200,
		contentType: 'application/json',
		body: JSON.stringify({
			data: {
				operationId: request.clientMutationId,
				progress: {
					reviewCompleted: request.reviewCompleted === true,
					grammarCompleted: request.grammarCompleted === true,
					coreVoiceImported: false,
					coreCompleted: false,
				},
				version: (request.expectedVersion ?? 0) + 1,
				replayed: false,
				changedAt: '2026-08-10T00:00:02.000Z',
			},
		}),
	});
}

test('keeps an operation until a retry succeeds after a 503 response', async ({ page }) => {
	let mutationCalls = 0;
	await page.route('**/api/v1/sync/bootstrap', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ data: { entities: [], cursor: 0, activeTotalDays: 90 } }),
		}),
	);
	await page.route('**/api/v1/sync/changes**', fulfillEmptyPull);
	await page.route('**/api/v1/today**', fulfillToday);
	await page.route('**/api/v1/daily-progress/**', fulfillDailyProgress);
	await page.route('**/api/v1/sync/mutations', async (route) => {
		mutationCalls += 1;
		const request = route.request().postDataJSON() as {
			operationId: string;
			entityType: string;
			entityId: string;
			operationType: string;
			payload: unknown;
			baseVersion: number;
		};
		if (mutationCalls === 1) {
			await route.fulfill({
				status: 503,
				headers: { 'retry-after': '0' },
				contentType: 'application/json',
				body: JSON.stringify({ error: { code: 'temporary', message: 'Synthetic retry' } }),
			});
			return;
		}
		await route.fulfill({
			status: 201,
			contentType: 'application/json',
			body: JSON.stringify({
				data: {
					operationId: request.operationId,
					entityType: request.entityType,
					entityId: request.entityId,
					operation: request.operationType,
					payload: request.payload,
					version: request.baseVersion + 1,
					sequence: 0,
					replayed: false,
					changedAt: '2026-08-10T00:00:01.000Z',
				},
			}),
		});
	});

	await onboard(page);
	await page.goto('/settings');
	await page.getByRole('checkbox', { name: '同期' }).click();
	await expect(page.getByRole('checkbox', { name: '同期' })).toBeChecked();
	await expect.poll(() => mutationCalls).toBe(2);
	await expect.poll(async () => (await indexedDbState(page)).outbox).toBe(0);
	const state = await indexedDbState(page);
	expect(state.conflicts).toBe(0);
	expect(state.lastSuccessAt).not.toBeNull();
});

test('keeps the outbox offline and drains it after reconnect', async ({ context, page }) => {
	let mutationCalls = 0;
	await page.route('**/api/v1/sync/bootstrap', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ data: { entities: [], cursor: 0, activeTotalDays: 90 } }),
		}),
	);
	await page.route('**/api/v1/sync/changes**', fulfillEmptyPull);
	await page.route('**/api/v1/today**', fulfillToday);
	await page.route('**/api/v1/daily-progress/**', fulfillDailyProgress);
	await page.route('**/api/v1/sync/mutations', async (route) => {
		mutationCalls += 1;
		const request = route.request().postDataJSON() as {
			operationId: string;
			entityType: string;
			entityId: string;
			operationType: string;
			payload: unknown;
			baseVersion: number;
		};
		await route.fulfill({
			status: 201,
			contentType: 'application/json',
			body: JSON.stringify({
				data: {
					operationId: request.operationId,
					entityType: request.entityType,
					entityId: request.entityId,
					operation: request.operationType,
					payload: request.payload,
					version: request.baseVersion + 1,
					sequence: 0,
					replayed: false,
					changedAt: '2026-08-10T00:00:01.000Z',
				},
			}),
		});
	});

	await onboard(page);
	await page.goto('/settings');
	await context.setOffline(true);
	await page.getByRole('checkbox', { name: '同期' }).click();
	await expect(page.getByRole('checkbox', { name: '同期' })).toBeChecked();
	await expect.poll(async () => (await indexedDbState(page)).outbox).toBeGreaterThan(0);
	expect(mutationCalls).toBe(0);

	await context.setOffline(false);
	await page.evaluate(() => window.dispatchEvent(new Event('online')));
	await expect.poll(() => mutationCalls).toBeGreaterThan(0);
	await expect.poll(async () => (await indexedDbState(page)).outbox).toBe(0);
});

test('blocks a conflicting operation and preserves both local and server values', async ({
	page,
}) => {
	await page.route('**/api/v1/sync/bootstrap', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ data: { entities: [], cursor: 0, activeTotalDays: 90 } }),
		}),
	);
	await page.route('**/api/v1/sync/mutations', (route) =>
		route.fulfill({
			status: 409,
			contentType: 'application/json',
			body: JSON.stringify({
				error: {
					code: 'sync_version_conflict',
					message: 'Synthetic conflict',
					current: { server: 'preserved' },
					version: 4,
				},
			}),
		}),
	);
	await page.route('**/api/v1/sync/changes**', fulfillEmptyPull);
	await page.route('**/api/v1/today**', fulfillToday);

	await onboard(page);
	await page.goto('/settings');
	await page.getByRole('checkbox', { name: '同期' }).click();
	await expect(page.getByRole('checkbox', { name: '同期' })).toBeChecked();
	await expect.poll(async () => (await indexedDbState(page)).conflicts).toBe(1);
	const state = await indexedDbState(page);
	// The conflicted profile is blocked and the later daily-progress operation remains pending.
	expect(state.outbox).toBe(2);
	expect(state.lastSuccessAt).toBeNull();
});

test('hydrates an empty device from the authenticated remote bootstrap', async ({ page }) => {
	const todayParts = new Intl.DateTimeFormat('en-US', {
		timeZone: 'Asia/Tokyo',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).formatToParts(new Date());
	const todayValues = Object.fromEntries(todayParts.map((part) => [part.type, part.value]));
	const studyDate = `${todayValues.year}-${todayValues.month}-${todayValues.day}`;
	const start = new Date(`${studyDate}T00:00:00.000Z`);
	start.setUTCDate(start.getUTCDate() - 6);
	const startDate = start.toISOString().slice(0, 10);
	const updatedAt = `${studyDate}T00:00:00.000Z`;
	await page.route('**/api/v1/sync/bootstrap', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				data: {
					activeTotalDays: 90,
					entities: [
						{
							operationId: '11111111-1111-4111-8111-111111111111',
							entityType: 'profile-settings',
							entityId: 'current',
							operation: 'upsert',
							payload: {
								profile: {
									id: 'current',
									onboarded: true,
									learnerName: 'Remote Learner',
									goal: 'Remote hydration',
									timeZone: 'Asia/Tokyo',
									startDate,
									currentDay: 7,
									streak: 2,
									updatedAt,
								},
								settings: {
									id: 'current',
									dailyMinutes: 20,
									syncEnabled: true,
									reduceMotion: false,
									updatedAt,
								},
							},
							version: 3,
							sequence: 5,
							changedAt: updatedAt,
						},
						{
							operationId: '22222222-2222-4222-8222-222222222222',
							entityType: 'daily-progress',
							entityId: `study:${studyDate}:curriculum:7`,
							operation: 'upsert',
							payload: {
								id: `study:${studyDate}:curriculum:7`,
								studyDate,
								curriculumDay: 7,
								reviewsCompleted: false,
								grammarCompleted: false,
								coreSessionImported: false,
								coreCompleted: false,
								version: 1,
								updatedAt,
							},
							version: 1,
							sequence: 5,
							changedAt: updatedAt,
						},
					],
					cursor: 5,
				},
			}),
		}),
	);
	await page.route('**/api/v1/sync/changes**', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ data: { changes: [], cursor: 5, hasMore: false } }),
		}),
	);
	await page.route('**/api/v1/today**', fulfillToday);

	await page.goto('/today');
	await expect(page.getByText(/DAY 07/)).toBeVisible();
	await expect(page).toHaveURL(/\/today$/);
	await page.goto('/settings');
	await expect(page.getByRole('checkbox', { name: '同期' })).toBeChecked();
});

test('fails closed before bootstrap hydration when server ACTIVE exceeds the bundle', async ({
	page,
}) => {
	await page.route('**/api/v1/sync/bootstrap', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				data: {
					activeTotalDays: 366,
					entities: [
						{
							operationId: '71717171-7171-4717-8717-717171717171',
							entityType: 'profile-settings',
							entityId: 'current',
							operation: 'upsert',
							payload: {
								profile: {
									id: 'current',
									onboarded: true,
									learnerName: 'Must not hydrate',
									goal: 'Incompatible curriculum',
									timeZone: 'Asia/Tokyo',
									startDate: '2026-08-13',
									currentDay: 366,
									streak: 0,
									updatedAt: '2026-08-13T00:00:00.000Z',
								},
								settings: {
									id: 'current',
									dailyMinutes: 20,
									syncEnabled: true,
									reduceMotion: false,
									updatedAt: '2026-08-13T00:00:00.000Z',
								},
							},
							version: 1,
							sequence: 1,
							changedAt: '2026-08-13T00:00:00.000Z',
						},
					],
					cursor: 1,
				},
			}),
		}),
	);

	await page.goto('/today');
	await expect(page.getByRole('heading', { name: '保存データの確認が必要です' })).toBeVisible();
	await expect(page.getByText(/アプリを更新してから再度開いてください/)).toBeVisible();
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					new Promise<number>((resolve, reject) => {
						const request = indexedDB.open('english-os');
						request.onerror = () => reject(request.error);
						request.onsuccess = () => {
							const database = request.result;
							const transaction = database.transaction('learnerProfiles', 'readonly');
							const count = transaction.objectStore('learnerProfiles').count();
							transaction.oncomplete = () => {
								database.close();
								resolve(count.result);
							};
							transaction.onerror = () => reject(transaction.error);
						};
					}),
			),
		)
		.toBe(0);
});
