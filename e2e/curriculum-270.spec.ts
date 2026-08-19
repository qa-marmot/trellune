import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await page.goto('/onboarding');
	await page.getByLabel('呼ばれたい名前').fill('Fluency Learner');
	await page.getByRole('button', { name: /ベースラインへ/ }).click();
	await page.getByRole('button', { name: /Day 1を始める/ }).click();
});

test('shows the Fluency Stage and Unit boundaries through Day 270', async ({ page }) => {
	await page.goto('/curriculum');
	await page.getByRole('tab', { name: /Fluency/ }).click();
	await expect(
		page.getByRole('heading', { name: 'Explaining Experiences in Detail' }),
	).toBeVisible();
	await expect(page.getByRole('heading', { name: 'B1+ Integration' })).toBeVisible();
	await expect(
		page.getByRole('button', { name: /^181\s+印象に残った週末を詳しく語る/u }),
	).toBeVisible();
	const finalUnit = page
		.locator('.curriculum-unit')
		.filter({ has: page.getByRole('heading', { name: 'B1+ Integration' }) });
	await finalUnit.locator('summary').click();
	await finalUnit.getByRole('button', { name: /^270\s+Fluency Stage Integration/u }).click();
	await expect(
		page.getByRole('heading', { name: 'Day 270 · Fluency Stage Integration' }),
	).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Voice課題' })).toBeVisible();
});
