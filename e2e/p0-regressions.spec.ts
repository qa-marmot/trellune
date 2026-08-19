import { expect, test, type Page } from '@playwright/test';
import { completeDayOneGrammarPractice } from './practice-helpers';

const STORAGE_KEY = 'english-os-state-v1';

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

function sessionPayload(sessionId: string, summaryJa: string) {
	const studyDate = todayInTokyo();
	return {
		schemaVersion: '1.0',
		sessionId,
		sessionType: 'core',
		curriculumDay: 1,
		occurredAt: `${studyDate}T09:00:00+09:00`,
		durationMinutes: 10,
		boost: null,
		summaryJa,
		evaluation: {
			taskCompletion: 4,
			grammar: 4,
			vocabulary: 4,
			fluency: 4,
			interaction: 4,
			commentJa: '回帰テスト用の合成データです。',
		},
		mistakes: [],
		newVocabulary: [],
		newPhrases: [],
		previewGrammar: [],
		reviewCards: [],
	};
}

async function onboard(page: Page): Promise<void> {
	await page.goto('/onboarding');
	await page.getByLabel('呼ばれたい名前').fill('Regression Learner');
	await page.getByRole('button', { name: /ベースラインへ/ }).click();
	await page.getByRole('button', { name: /Day 1を始める/ }).click();
	await expect(page).toHaveURL(/\/today$/);
}

async function importSession(page: Page, payload: unknown): Promise<void> {
	await page.goto('/import');
	await page.getByLabel('会話AIが返したJSON').fill(JSON.stringify(payload));
	await page.getByRole('button', { name: '検証してプレビュー' }).click();
	await page.getByRole('button', { name: 'この内容を保存' }).click();
	await expect(page.getByText('セッションを保存しました。')).toBeVisible();
}

test('P0-DATA-001 rejects a weak restore without destroying existing learning data', async ({
	page,
}) => {
	const summary = 'restore must preserve this synthetic session';
	await onboard(page);
	await importSession(page, sessionPayload('11111111-1111-4111-8111-111111111111', summary));
	await page.goto('/sessions');
	await expect(page.getByRole('heading', { name: summary })).toBeVisible();

	await page.goto('/backup');
	await page.locator('input[type="file"]').setInputFiles({
		name: 'invalid-partial-backup.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify({ currentDay: 1, sessions: [], core: {} })),
	});

	await expect(page.getByText(/復元できません|形式ではありません|確認が必要/)).toBeVisible();
	await page.goto('/sessions');
	await expect(page.getByRole('heading', { name: summary })).toBeVisible();
});

test('P0-DATA-002 hydrates a valid legacy IndexedDB snapshot when localStorage is absent', async ({
	page,
}) => {
	await page.goto('/onboarding');
	const legacyPayload = {
		onboarded: true,
		learnerName: 'Legacy Learner',
		goal: '合成移行テスト',
		dailyMinutes: 20,
		currentDay: 42,
		streak: 3,
		core: { reviews: false, grammar: false, voice: false, import: false },
		completedDays: [39, 40, 41],
		previewedDays: [],
		reviewCount: 0,
		sessions: [],
		mistakes: [],
		syncEnabled: false,
		reduceMotion: false,
	};

	await page.evaluate(
		async ({ key, payload }) => {
			await new Promise<void>((resolve, reject) => {
				const request = indexedDB.open('english-os');
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction('snapshots', 'readwrite');
					transaction.objectStore('snapshots').put({
						id: 'current',
						version: 1,
						updatedAt: new Date().toISOString(),
						payload,
					});
					transaction.oncomplete = () => {
						database.close();
						resolve();
					};
					transaction.onerror = () => reject(transaction.error);
				};
			});
			localStorage.removeItem(key);
		},
		{ key: STORAGE_KEY, payload: legacyPayload },
	);

	await page.goto('/today');
	await expect(page.getByText(/DAY 42/)).toBeVisible();
});

test('P0-DATA-003 preserves independent learning events across two tabs', async ({
	context,
	page,
}) => {
	test.setTimeout(60_000);
	await onboard(page);
	const secondTab = await context.newPage();
	await secondTab.goto('/settings');
	await expect(secondTab.getByRole('heading', { name: '設定' })).toBeVisible();

	await page.goto('/grammar');
	await completeDayOneGrammarPractice(page);
	await page.goto('/today');
	const grammarStep = page.getByRole('button', { name: /今日の文法/ });
	await expect(grammarStep).toHaveClass(/is-complete/);

	const reduceMotion = secondTab.getByRole('checkbox', { name: '低減' });
	await reduceMotion.click();
	await expect(reduceMotion).toBeChecked();
	await expect(secondTab.locator('html')).toHaveAttribute('data-reduce-motion', 'true');

	await page.reload();
	await expect(grammarStep).toHaveClass(/is-complete/, { timeout: 15_000 });
	await secondTab.reload();
	await expect(secondTab.getByRole('checkbox', { name: '低減' })).toBeChecked();
});

test('P0-DATA-002 keeps normalized IndexedDB authoritative over stale localStorage', async ({
	page,
}) => {
	await onboard(page);
	await page.evaluate((key) => {
		localStorage.setItem(
			key,
			JSON.stringify({
				onboarded: true,
				learnerName: 'Stale localStorage learner',
				goal: 'stale',
				dailyMinutes: 60,
				currentDay: 50,
				streak: 20,
				core: { reviews: true, grammar: true, voice: true, import: true },
				completedDays: [50],
				previewedDays: [],
				reviewCount: 0,
				sessions: [],
				mistakes: [],
				syncEnabled: false,
				reduceMotion: false,
			}),
		);
	}, STORAGE_KEY);
	await page.reload();
	await page.goto('/voice?mode=baseline');
	await expect(page.getByLabel('コピーする会話AIプロンプト')).toContainText('Regression Learner');
	await expect(page.getByLabel('コピーする会話AIプロンプト')).not.toContainText(
		'Stale localStorage learner',
	);
});

test('startup detects a missing normalized profile without writing defaults over remaining data', async ({
	page,
}) => {
	await onboard(page);
	await page.evaluate(
		() =>
			new Promise<void>((resolve, reject) => {
				const request = indexedDB.open('english-os');
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction('learnerProfiles', 'readwrite');
					transaction.objectStore('learnerProfiles').delete('current');
					transaction.oncomplete = () => {
						database.close();
						resolve();
					};
					transaction.onerror = () => reject(transaction.error);
				};
			}),
	);
	await page.reload();
	await expect(page.getByRole('heading', { name: '保存データの確認が必要です' })).toBeVisible();
	await expect(page.getByText(/元データは上書きしていません/)).toBeVisible();
});

test('a previewed grammar topic becomes completed when its Core day is completed', async ({
	page,
}) => {
	await onboard(page);
	await page.evaluate(
		() =>
			new Promise<void>((resolve, reject) => {
				const request = indexedDB.open('english-os');
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction('grammarProgress', 'readwrite');
					transaction.objectStore('grammarProgress').put({
						id: 'preview:d1-grammar',
						curriculumDay: 1,
						status: 'previewed',
						updatedAt: new Date().toISOString(),
					});
					transaction.oncomplete = () => {
						database.close();
						resolve();
					};
					transaction.onerror = () => reject(transaction.error);
				};
			}),
	);
	await page.goto('/grammar');
	await completeDayOneGrammarPractice(page);
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					new Promise<string | undefined>((resolve, reject) => {
						const request = indexedDB.open('english-os');
						request.onerror = () => reject(request.error);
						request.onsuccess = () => {
							const database = request.result;
							const transaction = database.transaction('grammarProgress', 'readonly');
							const get = transaction.objectStore('grammarProgress').get('preview:d1-grammar');
							get.onsuccess = () => resolve(get.result?.status);
							get.onerror = () => reject(get.error);
							transaction.oncomplete = () => database.close();
						};
					}),
			),
		)
		.toBe('completed');
});

test('SESSION_JSON larger than 1MB is rejected before save and remains editable', async ({
	page,
}) => {
	await onboard(page);
	await page.goto('/import');
	const oversized = 'a'.repeat(1_000_001);
	await page.getByLabel('会話AIが返したJSON').fill(oversized);
	await expect(page.getByText(/入力上限 1MB/)).toBeVisible();
	await page.getByRole('button', { name: '検証してプレビュー' }).click();
	await expect(page.getByText(/1\s?MBを超えています/)).toBeVisible();
	await expect
		.poll(() => page.getByLabel('会話AIが返したJSON').evaluate((element) => element.value.length))
		.toBe(oversized.length);
	await expect(page.getByRole('button', { name: 'この内容を保存' })).toHaveCount(0);
});

test('simultaneous identical session imports across two tabs persist one session', async ({
	context,
	page,
}) => {
	await onboard(page);
	const secondTab = await context.newPage();
	const payload = JSON.stringify(
		sessionPayload('abababab-abab-4bab-8bab-abababababab', 'two-tab idempotency session'),
	);
	await Promise.all([page.goto('/import'), secondTab.goto('/import')]);
	await Promise.all([
		page.getByLabel('会話AIが返したJSON').fill(payload),
		secondTab.getByLabel('会話AIが返したJSON').fill(payload),
	]);
	await Promise.all([
		page.getByRole('button', { name: '検証してプレビュー' }).click(),
		secondTab.getByRole('button', { name: '検証してプレビュー' }).click(),
	]);
	await Promise.all([
		page.getByRole('button', { name: 'この内容を保存' }).click(),
		secondTab.getByRole('button', { name: 'この内容を保存' }).click(),
	]);
	await expect
		.poll(
			async () =>
				Promise.all(
					[page, secondTab].map(async (tab) => {
						const feedback = await tab.locator('#session-import-feedback').innerText();
						if (feedback.includes('セッションを保存しました。')) return 'created';
						if (feedback.includes('同じsessionIdは取り込み済みです。')) return 'duplicate';
						return 'pending';
					}),
				).then((outcomes) => outcomes.sort()),
			{ timeout: 20_000 },
		)
		.toEqual(['created', 'duplicate']);
	await expect
		.poll(
			() =>
				page.evaluate(
					() =>
						new Promise<number>((resolve, reject) => {
							const request = indexedDB.open('english-os');
							request.onerror = () => reject(request.error);
							request.onsuccess = () => {
								const database = request.result;
								const transaction = database.transaction('sessions', 'readonly');
								const count = transaction.objectStore('sessions').count();
								transaction.oncomplete = () => {
									database.close();
									resolve(count.result);
								};
								transaction.onerror = () => reject(transaction.error);
							};
						}),
				),
			{ timeout: 20_000 },
		)
		.toBe(1);
	await page.goto('/sessions');
	await expect(page.getByRole('heading', { name: 'two-tab idempotency session' })).toHaveCount(1, {
		timeout: 15_000,
	});
});

test('P0-DATA-004 never reports success when the durable transaction fails', async ({ page }) => {
	const sessionId = '44444444-4444-4444-8444-444444444444';
	const summary = 'durability fault injection session';
	await onboard(page);
	await page.goto('/import');

	await page.evaluate(
		({ key, marker }) => {
			const originalSetItem = Storage.prototype.setItem;
			Storage.prototype.setItem = function setItem(name: string, value: string) {
				if (name === key && value.includes(marker)) {
					throw new DOMException('Synthetic quota failure', 'QuotaExceededError');
				}
				return originalSetItem.call(this, name, value);
			};

			const originalPut = IDBObjectStore.prototype.put;
			IDBObjectStore.prototype.put = function put(value: unknown, storageKey?: IDBValidKey) {
				if (JSON.stringify(value).includes(marker)) {
					throw new DOMException('Synthetic IndexedDB failure', 'QuotaExceededError');
				}
				return originalPut.call(this, value, storageKey);
			};
			const originalAdd = IDBObjectStore.prototype.add;
			IDBObjectStore.prototype.add = function add(value: unknown, storageKey?: IDBValidKey) {
				if (JSON.stringify(value).includes(marker)) {
					throw new DOMException('Synthetic IndexedDB failure', 'QuotaExceededError');
				}
				return originalAdd.call(this, value, storageKey);
			};
		},
		{ key: STORAGE_KEY, marker: sessionId },
	);

	await page
		.getByLabel('会話AIが返したJSON')
		.fill(JSON.stringify(sessionPayload(sessionId, summary)));
	await page.getByRole('button', { name: '検証してプレビュー' }).click();
	await page.getByRole('button', { name: 'この内容を保存' }).click();

	await expect(
		page.getByText(/保存に失敗|保存できません|端末への保存を完了できません/),
	).toBeVisible();
	await expect(page.getByText('セッションを保存しました。')).toHaveCount(0);
	await page.reload();
	await page.goto('/sessions');
	await expect(page.getByRole('heading', { name: summary })).toHaveCount(0);
});
