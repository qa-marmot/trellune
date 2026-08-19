import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await page.goto('/onboarding');
	await page.getByLabel('呼ばれたい名前').fill('B2 Challenge Learner');
	await page.getByRole('button', { name: /ベースラインへ/ }).click();
	await page.getByRole('button', { name: /Day 1を始める/ }).click();
});

test('shows B2 Challenge Units and lesson boundaries through Day 365', async ({ page }) => {
	await page.goto('/curriculum');
	await page.getByRole('tab', { name: /B2 Challenge/ }).click();
	await expect(
		page.getByRole('heading', { name: 'Developing & Supporting Opinions' }),
	).toBeVisible();
	await expect(
		page.getByRole('heading', { name: 'Graduation Preparation & Assessment' }),
	).toBeVisible();
	await expect(
		page.getByRole('button', { name: /^271\s+働く場所の選択を支持する/u }),
	).toBeVisible();
	await page
		.locator('.curriculum-unit')
		.filter({ has: page.getByRole('heading', { name: 'Graduation Preparation & Assessment' }) })
		.getByText('開く')
		.click();
	await page.getByRole('button', { name: /^365\s+Trellune Graduation Challenge/u }).click();
	await expect(
		page.getByRole('heading', { name: 'Day 365 · Trellune Graduation Challenge' }),
	).toBeVisible();
	await expect(page.getByText('Completion is not the same as certification.')).toBeVisible();
});
