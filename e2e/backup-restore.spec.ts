import { readFile } from 'node:fs/promises';
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
			commentJa: 'バックアップ回帰テスト用の合成データです。',
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
	await page.getByLabel('呼ばれたい名前').fill('Backup Learner');
	await page.getByRole('button', { name: /ベースラインへ/ }).click();
	await page.getByRole('button', { name: /Day 1を始める/ }).click();
	await expect(page).toHaveURL(/\/today$/);
}

async function importSession(page: Page, sessionId: string, summary: string): Promise<void> {
	await page.goto('/import');
	await page
		.getByLabel('会話AIが返したJSON')
		.fill(JSON.stringify(sessionPayload(sessionId, summary)));
	await page.getByRole('button', { name: '検証してプレビュー' }).click();
	await page.getByRole('button', { name: 'この内容を保存' }).click();
	await expect(page.getByText('セッションを保存しました。')).toBeVisible();
}

async function downloadBackup(page: Page): Promise<Buffer> {
	await page.goto('/backup');
	await expect(page.getByText(/JSONは暗号化されません/u)).toBeVisible();
	await expect(page.getByText(/共有フォルダーや公開リンクを避け/u)).toBeVisible();
	const pending = page.waitForEvent('download');
	await page.getByRole('button', { name: 'JSONを保存' }).click();
	const download = await pending;
	const path = await download.path();
	if (!path) throw new Error('Playwright did not provide a download path');
	return readFile(path);
}

async function sessionCount(page: Page): Promise<number> {
	return page.evaluate(
		() =>
			new Promise<number>((resolve, reject) => {
				const request = indexedDB.open('english-os');
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction('sessions', 'readonly');
					const countRequest = transaction.objectStore('sessions').count();
					countRequest.onsuccess = () => resolve(countRequest.result);
					countRequest.onerror = () => reject(countRequest.error);
					transaction.oncomplete = () => database.close();
				};
			}),
	);
}

async function pendingDeleteCount(page: Page): Promise<number> {
	return page.evaluate(
		() =>
			new Promise<number>((resolve, reject) => {
				const request = indexedDB.open('english-os');
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction('outbox', 'readonly');
					const all = transaction.objectStore('outbox').getAll();
					all.onsuccess = () =>
						resolve(
							(all.result as Array<{ operationType?: string }>).filter(
								(item) => item.operationType === 'delete',
							).length,
						);
					all.onerror = () => reject(all.error);
					transaction.oncomplete = () => database.close();
				};
			}),
	);
}

test('restore previews without mutation and requires explicit confirmation', async ({ page }) => {
	const first = 'backup baseline session';
	const second = 'session created after backup';
	await onboard(page);
	await importSession(page, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', first);
	const backup = await downloadBackup(page);
	await importSession(page, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', second);
	await expect.poll(() => sessionCount(page)).toBe(2);

	await page.goto('/backup');
	await page.getByLabel('Trelluneバックアップ（JSON）').setInputFiles({
		name: 'valid-backup.json',
		mimeType: 'application/json',
		buffer: backup,
	});
	await expect(page.getByRole('heading', { name: '復元プレビュー' })).toBeVisible();
	await expect(page.getByText(/まだ端末内データは変更していません/)).toBeVisible();
	await expect(page.getByRole('button', { name: '確認して復元' })).toBeDisabled();
	await expect.poll(() => sessionCount(page)).toBe(2);

	await page
		.getByRole('checkbox', { name: /現在の端末内データを、このプレビュー内容で置き換える/ })
		.check();
	await page.getByRole('button', { name: '確認して復元' }).click();
	await expect(page.getByText(/バックアップを復元し、保存後の件数も確認/)).toBeVisible();
	await expect.poll(() => sessionCount(page)).toBe(1);
	await page.goto('/sessions');
	await expect(page.getByRole('heading', { name: first })).toBeVisible();
	await expect(page.getByRole('heading', { name: second })).toHaveCount(0);
});

test('tampered hash is rejected without changing current data', async ({ page }) => {
	const current = 'current data survives tampered backup';
	await onboard(page);
	const backup = await downloadBackup(page);
	await importSession(page, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', current);
	const tampered = JSON.parse(backup.toString('utf8')) as {
		data: { profile: { goal: string } };
	};
	tampered.data.profile.goal = 'hashを更新していない改ざん';

	await page.goto('/backup');
	await page.getByLabel('Trelluneバックアップ（JSON）').setInputFiles({
		name: 'tampered-backup.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(tampered)),
	});
	await expect(page.getByRole('alert')).toContainText(/SHA-256が一致しません/);
	await expect(page.getByRole('heading', { name: '復元プレビュー' })).toHaveCount(0);
	await page.goto('/sessions');
	await expect(page.getByRole('heading', { name: current })).toBeVisible();
});

test('restore transaction rolls back all clears when an IndexedDB write fails', async ({
	page,
}) => {
	const current = 'current data survives restore fault';
	await onboard(page);
	const backup = await downloadBackup(page);
	await importSession(page, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', current);
	await page.goto('/backup');
	await page.getByLabel('Trelluneバックアップ（JSON）').setInputFiles({
		name: 'valid-backup.json',
		mimeType: 'application/json',
		buffer: backup,
	});
	await expect(page.getByRole('heading', { name: '復元プレビュー' })).toBeVisible();

	await page.evaluate(() => {
		const originalPut = IDBObjectStore.prototype.put;
		IDBObjectStore.prototype.put = function put(value: unknown, key?: IDBValidKey) {
			if (
				value &&
				typeof value === 'object' &&
				'learnerName' in value &&
				(value as { learnerName?: string }).learnerName === 'Backup Learner'
			) {
				throw new DOMException('Synthetic restore failure', 'QuotaExceededError');
			}
			return originalPut.call(this, value, key);
		};
	});
	await page
		.getByRole('checkbox', { name: /現在の端末内データを、このプレビュー内容で置き換える/ })
		.check();
	await page.getByRole('button', { name: '確認して復元' }).click();
	await expect(page.getByRole('alert')).toContainText(/元データは変更していません/);
	await expect.poll(() => sessionCount(page)).toBe(1);
	await page.goto('/sessions');
	await expect(page.getByRole('heading', { name: current })).toBeVisible();
});

test('restore queues a tombstone for a remote entity absent from the backup', async ({ page }) => {
	await onboard(page);
	const backup = await downloadBackup(page);
	await page.evaluate(
		() =>
			new Promise<void>((resolve, reject) => {
				const request = indexedDB.open('english-os');
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction('metadata', 'readwrite');
					transaction.objectStore('metadata').put({
						key: 'remoteVersion:session:eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
						value: 3,
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
	await page.goto('/backup');
	await page.getByLabel('Trelluneバックアップ（JSON）').setInputFiles({
		name: 'valid-backup.json',
		mimeType: 'application/json',
		buffer: backup,
	});
	await page
		.getByRole('checkbox', { name: /現在の端末内データを、このプレビュー内容で置き換える/ })
		.check();
	await page.getByRole('button', { name: '確認して復元' }).click();
	await expect.poll(() => pendingDeleteCount(page)).toBe(1);
});

test('accepts a complete legacy v1 backup and strips the raw ChatGPT source', async ({ page }) => {
	await onboard(page);
	const legacy = {
		onboarded: true,
		learnerName: 'Legacy Backup Learner',
		goal: 'legacy conversion',
		dailyMinutes: 20,
		currentDay: 1,
		streak: 0,
		core: { reviews: false, grammar: false, voice: false, import: false },
		completedDays: [],
		previewedDays: [],
		reviewCount: 0,
		sessions: [
			{
				sessionId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
				kind: 'core',
				completedAt: '2026-08-10T09:00:00+09:00',
				durationMinutes: 10,
				summary: 'legacy full backup session',
				score: 80,
				mistakes: [],
				sourceText: 'RAW_CHATGPT_SOURCE_MUST_NOT_SURVIVE',
			},
		],
		mistakes: [],
		syncEnabled: false,
		reduceMotion: false,
	};
	await page.goto('/backup');
	await page.getByLabel('Trelluneバックアップ（JSON）').setInputFiles({
		name: 'legacy-v1-backup.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(legacy)),
	});
	await expect(page.getByRole('heading', { name: '復元プレビュー' })).toBeVisible();
	await page
		.getByRole('checkbox', { name: /現在の端末内データを、このプレビュー内容で置き換える/ })
		.check();
	await page.getByRole('button', { name: '確認して復元' }).click();
	await expect(page.getByRole('status')).toContainText('バックアップを復元し');
	await page.goto('/sessions');
	await expect(page.getByRole('heading', { name: 'legacy full backup session' })).toBeVisible();
	const convertedBackup = await downloadBackup(page);
	expect(convertedBackup.toString('utf8')).not.toContain('RAW_CHATGPT_SOURCE_MUST_NOT_SURVIVE');
});
