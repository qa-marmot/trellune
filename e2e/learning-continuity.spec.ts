import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await page.goto('/onboarding');
});

test('separates preferred study budget from manifest workload in Japanese and English', async ({
	page,
}) => {
	await expect(page.getByText(/希望する学習予算/)).toBeVisible();
	await expect(page.getByRole('radio', { name: '75分' })).toBeVisible();
	await page.getByLabel('呼ばれたい名前').fill('Continuity learner');
	await page.getByRole('button', { name: /ベースラインへ/ }).click();
	await page.getByRole('button', { name: /Day 1を始める/ }).click();
	await expect(page.getByText('希望時間: 20分')).toBeVisible();
	await expect(page.getByText('Core最低: 20分')).toBeVisible();
	await expect(page.getByText('推奨: 20–30分')).toBeVisible();

	await page.getByLabel('表示言語').selectOption('en');
	await expect(page.getByText('Preferred budget: 20 min')).toBeVisible();
	await expect(page.getByText('Core minimum: 20 min')).toBeVisible();
	await expect(page.getByText('Recommended: 20–30 min')).toBeVisible();
});

test('shows a provider-neutral five-step bridge and only official preset links', async ({
	page,
}) => {
	await page.getByLabel('呼ばれたい名前').fill('Bridge learner');
	await page.getByRole('button', { name: /ベースラインへ/ }).click();
	await page.getByRole('button', { name: /Day 1を始める/ }).click();
	await page.goto('/voice');
	await expect(page.getByRole('heading', { name: '手動の会話フロー' })).toBeVisible();
	await expect(page.locator('.bridge-steps li')).toHaveCount(5);
	await expect(page.getByRole('link', { name: 'ChatGPTを開く' })).toHaveAttribute(
		'href',
		'https://chatgpt.com/',
	);

	await page.getByLabel(/会話AIプリセット/).selectOption('generic');
	await expect(page.getByText(/Trelluneがpromptを投稿することはありません/)).toBeVisible();
	await expect(page.locator('.bridge-steps a')).toHaveCount(0);

	await page.getByLabel('表示言語').selectOption('en');
	await expect(page.getByRole('heading', { name: 'Manual conversation workflow' })).toBeVisible();
	await expect(page.locator('.bridge-steps li')).toHaveCount(5);
	await expect(page.getByText(/Trellune never posts the prompt/)).toBeVisible();
});

test('keeps the conversation bridge inside the viewport at 400% text size', async ({ page }) => {
	await page.getByLabel('呼ばれたい名前').fill('Zoom learner');
	await page.getByRole('button', { name: /ベースラインへ/ }).click();
	await page.getByRole('button', { name: /Day 1を始める/ }).click();
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.goto('/voice');
	await page.evaluate(() => {
		document.documentElement.style.fontSize = '400%';
	});

	await expect(page.getByRole('heading', { name: '手動の会話フロー' })).toBeVisible();
	await expect
		.poll(() =>
			page.evaluate(() => ({
				clientWidth: document.documentElement.clientWidth,
				scrollWidth: document.documentElement.scrollWidth,
			})),
		)
		.toEqual({ clientWidth: 1280, scrollWidth: 1280 });
});
