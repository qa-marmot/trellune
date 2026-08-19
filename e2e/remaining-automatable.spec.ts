import { expect, test, type Page } from '@playwright/test';

function todayInTokyo(): string {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: 'Asia/Tokyo',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).formatToParts(new Date());
	const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
	return `${value.year}-${value.month}-${value.day}`;
}

async function onboard(page: Page): Promise<void> {
	await page.goto('/onboarding');
	await page.getByLabel('呼ばれたい名前').fill('Remaining Work Learner');
	await page.getByRole('button', { name: /ベースラインへ/ }).click();
	await page.getByRole('button', { name: /Day 1を始める/ }).click();
	await expect(page).toHaveURL(/\/today$/u);
}

async function importCoreSession(page: Page): Promise<{ sessionId: string; studyDate: string }> {
	const sessionId = crypto.randomUUID();
	const studyDate = todayInTokyo();
	const payload = {
		schemaVersion: '1.0',
		sessionId,
		sessionType: 'core',
		curriculumDay: 1,
		occurredAt: `${studyDate}T09:00:00+09:00`,
		durationMinutes: 10,
		boost: null,
		summaryJa: '履歴詳細の回帰テスト',
		evaluation: {
			taskCompletion: 4,
			grammar: 4,
			vocabulary: 4,
			fluency: 4,
			interaction: 4,
			commentJa: '履歴のURLとフィルターを確認します。',
		},
		mistakes: [],
		newVocabulary: [],
		newPhrases: [],
		previewGrammar: [],
		reviewCards: [],
	};
	await page.goto('/import');
	await page.getByLabel('会話AIが返したJSON').fill(JSON.stringify(payload));
	await page.getByRole('button', { name: '検証してプレビュー' }).click();
	await page.getByRole('button', { name: 'この内容を保存' }).click();
	await expect(page.getByText('セッションを保存しました。')).toBeVisible();
	return { sessionId, studyDate };
}

test('onboarding explains data boundaries and rejects blank or invalid fields', async ({
	page,
}) => {
	await page.goto('/onboarding');
	await expect(page.getByText('音声と、貼り付けたJSONの原文は保存しません。')).toBeVisible();
	await expect(page.getByText(/外部AI APIを使いません/u)).toBeVisible();

	await page.getByRole('button', { name: /ベースラインへ/ }).click();
	await expect(page.getByText('呼ばれたい名前を入力してください。')).toBeVisible();
	await expect(page.getByLabel('呼ばれたい名前')).toHaveAttribute('aria-invalid', 'true');
	await expect(page).toHaveURL(/\/onboarding$/u);

	await page.getByLabel('呼ばれたい名前').fill('Valid Learner');
	await page.getByLabel('学習タイムゾーン（IANA）').fill('invalid/time-zone');
	await page.getByRole('button', { name: /ベースラインへ/ }).click();
	await expect(page.getByText('有効なIANAタイムゾーンを入力してください。')).toBeVisible();
	await expect(page).toHaveURL(/\/onboarding$/u);
});

test('session filters persist in the URL and details have a direct route', async ({ page }) => {
	await onboard(page);
	const { sessionId, studyDate } = await importCoreSession(page);

	await page.goto('/sessions');
	await page.getByLabel('種類').selectOption('core');
	await page.getByLabel('実施日').fill(studyDate);
	await expect(page).toHaveURL(
		new RegExp(`kind=core.*date=${studyDate}|date=${studyDate}.*kind=core`, 'u'),
	);
	await expect(page.getByRole('heading', { name: '履歴詳細の回帰テスト' })).toBeVisible();
	await page.getByRole('link', { name: '詳細' }).click();
	await expect(page).toHaveURL(new RegExp(`/sessions/${sessionId}$`, 'u'));
	await expect(page.getByText('履歴のURLとフィルターを確認します。')).toBeVisible();

	await page.goto('/sessions?kind=boost');
	await expect(
		page.getByRole('heading', { name: '条件に一致するセッションがありません' }),
	).toBeVisible();
	await page.getByRole('button', { name: '絞り込みを解除' }).click();
	await expect(page.getByRole('heading', { name: '履歴詳細の回帰テスト' })).toBeVisible();
});

test('reduced motion is applied and device deletion requires two confirmations', async ({
	page,
}) => {
	await onboard(page);
	await page.goto('/settings');
	const reduceMotion = page.getByRole('checkbox', { name: '低減' });
	await reduceMotion.click();
	await expect(reduceMotion).toBeChecked();
	await expect(page.locator('html')).toHaveAttribute('data-reduce-motion', 'true');

	const deleteButton = page.getByRole('button', { name: 'この端末のデータを削除' });
	await expect(deleteButton).toBeDisabled();
	await page.getByRole('checkbox', { name: '対象と不可逆性を確認しました' }).check();
	await page.getByLabel(/確認のため/u).fill('間違った確認');
	await expect(deleteButton).toBeDisabled();
	await page.getByLabel(/確認のため/u).fill('端末データを削除');
	await expect(deleteButton).toBeEnabled();
	const secondTab = await page.context().newPage();
	await secondTab.goto('/settings');
	await expect(secondTab.getByRole('heading', { name: '設定' })).toBeVisible();
	await deleteButton.click();
	await expect(page).toHaveURL(/\/onboarding$/u);
	await expect(secondTab).toHaveURL(/\/onboarding$/u);

	const state = await page.evaluate(
		() =>
			new Promise<{ profileCount: number; outboxCount: number; deletionMarked: boolean }>(
				(resolve, reject) => {
					const request = indexedDB.open('english-os');
					request.onerror = () => reject(request.error);
					request.onsuccess = () => {
						const database = request.result;
						const transaction = database.transaction(
							['learnerProfiles', 'outbox', 'metadata'],
							'readonly',
						);
						const profile = transaction.objectStore('learnerProfiles').count();
						const outbox = transaction.objectStore('outbox').count();
						const marker = transaction.objectStore('metadata').get('localDataDeleted');
						transaction.oncomplete = () => {
							database.close();
							resolve({
								profileCount: profile.result,
								outboxCount: outbox.result,
								deletionMarked: Boolean(marker.result),
							});
						};
						transaction.onerror = () => reject(transaction.error);
					};
				},
			),
	);
	expect(state).toEqual({ profileCount: 0, outboxCount: 0, deletionMarked: true });
	expect(await page.evaluate(() => localStorage.getItem('english-os-state-v1'))).toBeNull();
	await page.reload();
	await expect(page.getByRole('heading', { name: '話す日を、365日つづける。' })).toBeVisible();
});

test('device deletion wins over a remote pull already in flight', async ({ page }) => {
	let announcePull: (() => void) | undefined;
	let releasePull: (() => void) | undefined;
	const pullStarted = new Promise<void>((resolve) => {
		announcePull = resolve;
	});
	const pullGate = new Promise<void>((resolve) => {
		releasePull = resolve;
	});
	const studyDate = todayInTokyo();
	const updatedAt = `${studyDate}T00:00:00.000Z`;

	await page.route('**/api/v1/sync/bootstrap', (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ data: { entities: [], cursor: 0, activeTotalDays: 90 } }),
		}),
	);
	await page.route('**/api/v1/sync/mutations', async (route) => {
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
					sequence: 1,
					replayed: false,
					changedAt: updatedAt,
				},
			}),
		});
	});
	await page.route('**/api/v1/daily-progress/**', async (route) => {
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
					changedAt: updatedAt,
				},
			}),
		});
	});
	await page.route('**/api/v1/sync/changes**', async (route) => {
		announcePull?.();
		await pullGate;
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				data: {
					changes: [
						{
							operationId: '11111111-1111-4111-8111-111111111111',
							entityType: 'profile-settings',
							entityId: 'current',
							operation: 'upsert',
							payload: {
								profile: {
									id: 'current',
									onboarded: true,
									learnerName: 'Should Not Rehydrate',
									goal: 'Remote race fixture',
									timeZone: 'Asia/Tokyo',
									startDate: studyDate,
									currentDay: 1,
									streak: 0,
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
							version: 2,
							sequence: 2,
							changedAt: updatedAt,
						},
					],
					cursor: 2,
					hasMore: false,
				},
			}),
		});
	});

	await onboard(page);
	await page.goto('/settings');
	await page.getByRole('checkbox', { name: '同期' }).click();
	await pullStarted;
	await page.getByRole('checkbox', { name: '対象と不可逆性を確認しました' }).check();
	await page.getByLabel(/確認のため/u).fill('端末データを削除');
	await page.getByRole('button', { name: 'この端末のデータを削除' }).click();
	await expect(page).toHaveURL(/\/onboarding$/u);
	releasePull?.();

	await expect
		.poll(() =>
			page.evaluate(
				() =>
					new Promise<{ profileCount: number; deletionMarked: boolean }>((resolve, reject) => {
						const request = indexedDB.open('english-os');
						request.onerror = () => reject(request.error);
						request.onsuccess = () => {
							const database = request.result;
							const transaction = database.transaction(['learnerProfiles', 'metadata'], 'readonly');
							const profile = transaction.objectStore('learnerProfiles').count();
							const marker = transaction.objectStore('metadata').get('localDataDeleted');
							transaction.oncomplete = () => {
								database.close();
								resolve({
									profileCount: profile.result,
									deletionMarked: Boolean(marker.result),
								});
							};
							transaction.onerror = () => reject(transaction.error);
						};
					}),
			),
		)
		.toEqual({ profileCount: 0, deletionMarked: true });
});
