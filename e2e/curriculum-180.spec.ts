import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await page.goto('/onboarding');
	await page.getByLabel('呼ばれたい名前').fill('Independent Learner');
	await page.getByRole('button', { name: /ベースラインへ/ }).click();
	await page.getByRole('button', { name: /Day 1を始める/ }).click();
});

test('shows the Independent Stage and Unit boundaries through Day 180', async ({ page }) => {
	await page.goto('/curriculum');
	await page.getByRole('tab', { name: /Independent/ }).click();
	await expect(page.getByRole('heading', { name: 'Experiences & Recent Events' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'B1 Entry Integration' })).toBeVisible();
	await expect(page.getByRole('button', { name: /^91\s+最近の出来事/u })).toBeVisible();
	const finalUnit = page
		.locator('.curriculum-unit')
		.filter({ has: page.getByRole('heading', { name: 'B1 Entry Integration' }) });
	await finalUnit.locator('summary').click();
	await finalUnit.getByRole('button', { name: /^180\s+Independent Stage 統合会話/u }).click();
	await expect(
		page.getByRole('heading', { name: 'Day 180 · Independent Stage 統合会話' }),
	).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Voice課題' })).toBeVisible();
});
