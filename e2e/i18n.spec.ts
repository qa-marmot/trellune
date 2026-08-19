import { expect, test } from '@playwright/test';

test('a fresh English browser can switch UI language and keeps that device preference', async ({
	page,
}) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'languages', { configurable: true, get: () => ['en-US'] });
		Object.defineProperty(navigator, 'language', { configurable: true, get: () => 'en-US' });
	});
	await page.goto('/onboarding');
	await expect(
		page.getByRole('heading', { name: 'Keep speaking, one day at a time.' }),
	).toBeVisible();
	await expect(page.getByLabel('Display language')).toHaveValue('en');
	await page.getByLabel('What should we call you?').fill('English learner');
	await page.getByRole('button', { name: 'Continue to baseline' }).click();
	// Onboarding persists the profile before it redirects. Wait for that async
	// transaction instead of navigating away while IndexedDB is still committing.
	await page.waitForURL('**/baseline');
	await page.goto('/today');
	await expect(page.getByRole('heading', { name: "Today's Core" })).toBeVisible();
	await page.getByLabel('Display language').selectOption('ja');
	await expect(page.getByRole('heading', { name: '今日のCore' })).toBeVisible();
	await page.reload();
	await expect(page.getByRole('heading', { name: '今日のCore' })).toBeVisible();
	await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
	await expect
		.poll(() =>
			page.evaluate(
				() => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
			),
		)
		.toBe(true);
});
