import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { CURRICULUM } from '../src/data/curriculum';

test.beforeEach(async ({ page }) => {
	await page.goto('/onboarding');
	await page.getByLabel('呼ばれたい名前').fill('Practice Learner');
	await page.getByRole('button', { name: /ベースラインへ/ }).click();
	await page.getByRole('button', { name: /Day 1を始める/ }).click();
});

test('requires open production before the existing grammar Core flag is saved', async ({
	page,
}) => {
	await page.goto('/grammar');
	await page.locator('.practice-card input').fill(CURRICULUM[0].grammar.expectedAnswer);
	await page.getByRole('button', { name: '答えを確認' }).click();

	const responses = page.locator('[data-practice-response]');
	await expect(responses).toHaveCount(2);
	await page.getByRole('button', { name: '自己点検を完了して保存' }).click();
	await expect(page.getByText(/未入力の欄、または語数/)).toBeVisible();

	for (let index = 0; index < (await responses.count()); index += 1) {
		await responses.nth(index).fill('I use this English sentence in a real situation today.');
		await page
			.locator('.practice-block')
			.nth(index)
			.getByRole('button', { name: 'フィードバックを見る' })
			.click();
	}
	const checks = page.locator('.practice-checklist input');
	for (let index = 0; index < (await checks.count()); index += 1) await checks.nth(index).check();
	await page.getByRole('button', { name: '自己点検を完了して保存' }).click();
	await expect(page.getByText('正解です。次は声に出して3回。')).toBeVisible();

	await page.goto('/today');
	await expect(page.getByRole('button', { name: /今日の文法.*完了/ })).toBeVisible();
});

test('reveals authored reading evidence and keeps the first response for retry comparison', async ({
	page,
}) => {
	await page.goto('/grammar');
	await page.locator('.practice-card input').fill(CURRICULUM[0].grammar.expectedAnswer);
	await page.getByRole('button', { name: '答えを確認' }).click();
	const firstResponse = page.locator('[data-practice-response]').first();
	await firstResponse.fill('I use this English sentence in a real situation today.');
	await page.getByRole('button', { name: 'フィードバックを見る' }).first().click();
	await expect(page.getByRole('heading', { name: '要点と自分の回答を照合' }).first()).toBeVisible();
	await firstResponse.fill('I use this sentence in a real situation because it is useful today.');
	await expect(page.getByText('最初の回答と修正版を比較').first()).toBeVisible();
});

test('restores a language-scoped local practice draft and clears it explicitly', async ({
	page,
}) => {
	await page.goto('/grammar');
	await page.locator('.practice-card input').fill(CURRICULUM[0].grammar.expectedAnswer);
	await page.getByRole('button', { name: '答えを確認' }).click();
	const firstResponse = page.locator('[data-practice-response]').first();
	await firstResponse.fill('This local draft should survive an ordinary reload.');
	await page.waitForTimeout(650);

	await page.reload();
	await page.locator('.practice-card input').fill(CURRICULUM[0].grammar.expectedAnswer);
	await page.getByRole('button', { name: '答えを確認' }).click();
	await expect(page.getByText('端末内の下書きを復元しました。')).toBeVisible();
	await expect(page.locator('[data-practice-response]').first()).toHaveValue(
		'This local draft should survive an ordinary reload.',
	);

	await page.getByRole('button', { name: '端末内の下書きを破棄' }).click();
	await expect(page.locator('[data-practice-response]').first()).toHaveValue('');
	await page.reload();
	await page.locator('.practice-card input').fill(CURRICULUM[0].grammar.expectedAnswer);
	await page.getByRole('button', { name: '答えを確認' }).click();
	await expect(page.locator('[data-practice-response]').first()).toHaveValue('');
});

test('shows the Day 90 reading-writing checkpoint without horizontal overflow', async ({
	page,
}) => {
	await page.goto('/curriculum/90');
	await expect(page.getByRole('heading', { name: '読む・書く・使い直す' })).toBeVisible();
	await expect(page.getByText('A 90-day reflection')).toBeVisible();
	await expect(page.getByText(/When Rina started learning English/)).toBeVisible();
	await expect
		.poll(() =>
			page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth,
			),
		)
		.toBeLessThanOrEqual(0);
});

test('keeps the Day 365 integrated reading-writing checkpoint readable on mobile and desktop', async ({
	page,
}) => {
	for (const viewport of [
		{ width: 320, height: 568 },
		{ width: 1280, height: 720 },
	]) {
		await page.setViewportSize(viewport);
		await page.goto('/curriculum/365');
		await expect(page.getByText('Graduation evidence task')).toBeVisible();
		await expect(page.getByText(/After one year, an English learner/)).toBeVisible();
		await expect(page.getByText(/英語 180〜250語/)).toBeVisible();
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth,
			),
		).toBeLessThanOrEqual(0);
	}
});

test('keeps a multi-text long-form challenge readable on mobile and desktop', async ({ page }) => {
	for (const viewport of [
		{ width: 320, height: 568 },
		{ width: 1280, height: 720 },
	]) {
		await page.setViewportSize(viewport);
		await page.goto('/curriculum/359');
		await expect(page.getByText('What should a news feed optimise?')).toBeVisible();
		await expect(page.getByText(/Text A — A personalisation researcher/)).toBeVisible();
		await expect(page.getByText(/英語 170〜250語/)).toBeVisible();
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth,
			),
		).toBeLessThanOrEqual(0);
	}
});

test('keeps the revealed non-Voice practice accessible', async ({ page }) => {
	await page.goto('/grammar');
	await page.locator('.practice-card input').fill(CURRICULUM[0].grammar.expectedAnswer);
	await page.getByRole('button', { name: '答えを確認' }).click();
	const results = await new AxeBuilder({ page }).analyze();
	expect(
		results.violations.filter((violation) =>
			['serious', 'critical'].includes(violation.impact ?? ''),
		),
	).toEqual([]);
});
