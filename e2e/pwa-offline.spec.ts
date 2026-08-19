import { expect, test } from '@playwright/test';
import { completeDayOneGrammarPractice } from './practice-helpers';

test('production service worker reloads cached routes and preserves offline learning writes', async ({
	context,
	page,
}) => {
	await page.goto('/onboarding');
	await page.getByLabel('呼ばれたい名前').fill('Offline Learner');
	await page.getByRole('button', { name: /ベースラインへ/ }).click();
	await page.getByRole('button', { name: /Day 1を始める/ }).click();
	await page.evaluate(async () => navigator.serviceWorker.ready);
	if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
		await page.reload();
	}
	await expect
		.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
		.toBe(true);
	for (const route of [
		'/today',
		'/curriculum',
		'/reviews',
		'/grammar',
		'/voice',
		'/import',
		'/sessions',
	]) {
		await page.goto(route);
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	}

	await page.goto('/import');
	await context.setOffline(true);
	try {
		await page.reload();
		await expect(page.getByText('オフライン', { exact: true })).toBeVisible();
		await expect(page.getByRole('heading', { name: '会話結果JSONを取込' })).toBeVisible();
		for (const [route, heading] of [
			['/today', 'はじめまして'],
			['/curriculum', '365日の地図'],
			['/reviews', '期限が来た復習'],
			['/voice', '会話AIへ持っていく'],
			['/import', '会話結果JSONを取込'],
			['/sessions', 'セッション履歴'],
		] as const) {
			await page.goto(route);
			await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
		}
		await page.goto('/grammar');
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
		await completeDayOneGrammarPractice(page);
		await page.reload();
		await page.goto('/today');
		await expect(page.getByRole('button', { name: /今日の文法.*完了/ })).toBeVisible();
		await page.goto('/not-yet-cached');
		await expect(page.getByRole('heading', { name: 'オフラインで開けないとき' })).toBeVisible();
		await expect(page.getByRole('link', { name: '今日のCoreへ戻る' })).toBeVisible();
	} finally {
		await context.setOffline(false);
	}
});
