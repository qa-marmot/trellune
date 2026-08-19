import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await page.goto('/onboarding');
	await page.getByLabel('呼ばれたい名前').fill('Yabu');
	await page.getByRole('button', { name: /ベースラインへ/ }).click();
	await page.getByRole('button', { name: /Day 1を始める/ }).click();
});

test('shows all Core steps and navigates to grammar', async ({ page }) => {
	await expect(page.getByRole('heading', { name: 'はじめまして' })).toBeVisible();
	await expect(page.getByRole('heading', { name: '今日のCore' })).toBeVisible();
	await page.getByRole('button', { name: '今日の文法 · 未完了' }).click();
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('has no serious accessibility violations on Today', async ({ page }) => {
	const results = await new AxeBuilder({ page }).analyze();
	expect(
		results.violations.filter((violation) =>
			['serious', 'critical'].includes(violation.impact ?? ''),
		),
	).toEqual([]);
});
