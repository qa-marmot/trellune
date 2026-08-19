import { expect, test } from '@playwright/test';

test.skip(process.env.VITE_DEMO_MODE !== 'true', 'Runs only against the isolated demo build.');

test('the synthetic local-only demo seeds, previews a fixture import, and resets', async ({
	page,
}) => {
	await page.goto('/today');
	await expect(
		page.getByText('公開デモ: 合成データのみ・同期なし。保存先は通常版と分離されています。'),
	).toBeVisible();
	await expect(page.getByRole('heading', { name: 'はじめまして' })).toBeVisible();

	await page.getByRole('button', { name: 'Reading/Writing の例へ' }).click();
	await expect(page).toHaveURL(/\/curriculum\/6$/u);
	await expect(page.getByRole('heading', { name: '読む・書く・使い直す' })).toBeVisible();

	await page.goto('/import');
	await page.getByRole('button', { name: '合成サンプルを読み込む' }).click();
	await page.getByRole('button', { name: '検証してプレビュー' }).click();
	await expect(page.getByRole('heading', { name: '取込プレビュー' })).toBeVisible();

	await page.getByRole('button', { name: '合成データをリセット' }).click();
	await expect(page).toHaveURL(/\/today$/u);
	await expect(page.getByRole('heading', { name: 'はじめまして' })).toBeVisible();
});
