import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { completeDayOneGrammarPractice } from './practice-helpers';

async function onboard(page: Page): Promise<void> {
	await page.goto('/onboarding');
	await page.getByLabel('呼ばれたい名前').fill('WebKit Learner');
	await page.getByRole('button', { name: /ベースラインへ/ }).click();
	await page.getByRole('button', { name: /Day 1を始める/ }).click();
	await expect(page).toHaveURL(/\/today$/u);
}

function coreSession() {
	return {
		schemaVersion: '1.0',
		sessionId: crypto.randomUUID(),
		sessionType: 'core',
		curriculumDay: 1,
		occurredAt: new Date().toISOString(),
		durationMinutes: 10,
		boost: null,
		summaryJa: 'WebKit合成Coreセッション',
		evaluation: {
			taskCompletion: 4,
			grammar: 4,
			vocabulary: 4,
			fluency: 4,
			interaction: 4,
			commentJa: 'WebKit回帰テスト用の合成評価です。',
		},
		mistakes: [],
		newVocabulary: [],
		newPhrases: [],
		previewGrammar: [],
		reviewCards: [],
	};
}

test.describe('WebKit mobile release coverage', () => {
	test.skip(({ browserName }) => browserName !== 'webkit', 'Runs only in the WebKit project.');
	// WebKit runs all four PWA onboarding flows in one browser process. Keep the
	// isolated IndexedDB/service-worker setup serial so a slow browser startup
	// cannot make a later flow time out before its onboarding transition.
	test.describe.configure({ mode: 'serial' });
	test.setTimeout(60_000);

	test('onboards at 390px, persists Day 1, and keeps learning routes readable', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await onboard(page);
		await expect(page.getByRole('heading', { name: 'はじめまして' })).toBeVisible();
		await page.reload();
		await expect(page.getByRole('heading', { name: 'はじめまして' })).toBeVisible();
		await page.goto('/grammar');
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
		for (const [route, heading] of [
			['/voice', '会話AIへ持っていく'],
			['/import', '会話結果JSONを取込'],
			['/backup', 'バックアップ'],
		] as const) {
			await page.goto(route);
			await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
			expect(
				await page.evaluate(
					() => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
				),
			).toBe(true);
		}
	});

	test('switches the mobile learner UI to English and preserves the choice after reload', async ({
		page,
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await onboard(page);
		await page.getByLabel('表示言語').selectOption('en');
		await expect(page.getByRole('heading', { name: "Today's Core" })).toBeVisible();
		await expect(page.locator('html')).toHaveAttribute('lang', 'en');
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
			),
		).toBe(true);
		await page.reload();
		await expect(page.getByRole('heading', { name: "Today's Core" })).toBeVisible();
	});

	test('renders provider selection, offline state, and strict SESSION_JSON preview', async ({
		context,
		page,
	}) => {
		await onboard(page);
		await page.goto('/voice');
		await page.getByLabel('会話AIプリセット').selectOption('claude');
		await expect(page.getByText('このプリセットのVoice対応は未検証です。')).toBeVisible();
		await page.goto('/import');
		await page.getByLabel('会話AIが返したJSON').fill('{"schemaVersion":"1.0"}');
		await page.getByRole('button', { name: '検証してプレビュー' }).click();
		await expect(page.getByText('保存できません')).toBeVisible();
		await context.setOffline(true);
		try {
			await page.evaluate(() => window.dispatchEvent(new Event('offline')));
			await expect(page.getByText('オフライン', { exact: true })).toBeVisible();
		} finally {
			await context.setOffline(false);
		}
	});

	test('persists a Core completion, permits backup export/preview, and derives Day 2 after Tokyo rollover', async ({
		page,
	}) => {
		await onboard(page);
		await page.goto('/grammar');
		await completeDayOneGrammarPractice(page);
		await page.goto('/import');
		await page.getByLabel('会話AIが返したJSON').fill(JSON.stringify(coreSession()));
		await page.getByRole('button', { name: '検証してプレビュー' }).click();
		await page.getByRole('button', { name: 'この内容を保存' }).click();
		await expect(page.getByRole('status')).toContainText('セッションを保存しました');
		await page.reload();
		await page.goto('/today');
		await expect(page.getByLabel('Core 3/3 完了')).toBeVisible();

		await page.goto('/backup');
		const downloadPromise = page.waitForEvent('download');
		await page.getByRole('button', { name: 'バックアップを書き出す' }).click();
		const download = await downloadPromise;
		const backupPath = await download.path();
		if (!backupPath) throw new Error('WebKit did not provide the synthetic backup path.');
		await page.getByLabel('Trelluneバックアップ（JSON）').setInputFiles({
			name: 'webkit-synthetic-backup.json',
			mimeType: 'application/json',
			buffer: await readFile(backupPath),
		});
		await expect(page.getByRole('heading', { name: '復元プレビュー' })).toBeVisible();

		await page.evaluate(() => {
			const tokyoDate = new Intl.DateTimeFormat('en-CA', {
				timeZone: 'Asia/Tokyo',
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
			}).formatToParts(new Date());
			const parts = Object.fromEntries(tokyoDate.map((part) => [part.type, part.value]));
			const today = `${parts.year}-${parts.month}-${parts.day}`;
			const yesterday = new Date(`${today}T00:00:00.000Z`);
			yesterday.setUTCDate(yesterday.getUTCDate() - 1);
			const studyDate = yesterday.toISOString().slice(0, 10);
			return new Promise<void>((resolve, reject) => {
				const request = indexedDB.open('english-os');
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction(
						['dailyProgress', 'learnerProfiles'],
						'readwrite',
					);
					const progress = transaction.objectStore('dailyProgress');
					const current = progress.getAll();
					current.onsuccess = () => {
						const dayOne = (current.result as Array<Record<string, unknown>>).find(
							(record) => record.curriculumDay === 1,
						);
						if (!dayOne) return reject(new Error('Synthetic Day 1 progress is missing.'));
						progress.delete(dayOne.id as IDBValidKey);
						progress.put({ ...dayOne, id: `study:${studyDate}:curriculum:1`, studyDate });
						const profile = transaction.objectStore('learnerProfiles').get('current');
						profile.onsuccess = () =>
							transaction
								.objectStore('learnerProfiles')
								.put({ ...profile.result, startDate: studyDate, currentDay: 2 });
					};
					transaction.oncomplete = () => {
						database.close();
						resolve();
					};
					transaction.onerror = () => reject(transaction.error);
				};
			});
		});
		await page.goto('/today');
		await expect(page.getByText('DAY 02 · WEEK 1')).toBeVisible();
	});
});
