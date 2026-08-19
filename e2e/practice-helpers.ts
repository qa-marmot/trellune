import { expect, type Page } from '@playwright/test';

export async function completeDayOneGrammarPractice(page: Page): Promise<void> {
	await page.locator('.practice-card input').fill('I am from Tokyo.');
	await page.getByRole('button', { name: '答えを確認' }).click();
	await expect(page.getByRole('button', { name: '自己点検を完了して保存' })).toBeVisible();
	const responses = page.locator('[data-practice-response]');
	for (let index = 0; index < (await responses.count()); index += 1) {
		await responses.nth(index).fill('I use this English sentence in a real situation today.');
		const reveal = page
			.locator('.practice-block')
			.nth(index)
			.getByRole('button', { name: 'フィードバックを見る' });
		await reveal.evaluate((element) => element.scrollIntoView({ block: 'center' }));
		await reveal.click();
	}
	const reviews = page.locator('.practice-checklist input');
	for (let index = 0; index < (await reviews.count()); index += 1) {
		await reviews.nth(index).evaluate((element: HTMLInputElement) => element.click());
	}
	const save = page.getByRole('button', { name: '自己点検を完了して保存' });
	await save.evaluate((element) => element.scrollIntoView({ block: 'center' }));
	await save.click();
	await expect(page.getByText('正解です。次は声に出して3回。')).toBeVisible();
}
