import { expect, test } from '@playwright/test';

test('an experienced learner starts at Day 181 without fabricated earlier records', async ({
	page,
}) => {
	await page.goto('/onboarding');
	await page.getByLabel('呼ばれたい名前').fill('Alex');
	await page.getByLabel('Day 181').check();
	await page.getByRole('button', { name: 'ベースラインへ' }).click();
	await expect(page.getByText('開始地点Day 181は設定時の自己選択')).toBeVisible();
	await page.getByRole('button', { name: /Day 181を始める/ }).click();

	await expect(page).toHaveURL(/\/today$/u);
	await expect(page.getByText('Day 181')).toBeVisible();
	const evidenceCounts = await page.evaluate(async () => {
		const request = indexedDB.open('english-os');
		const database = await new Promise<IDBDatabase>((resolve, reject) => {
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		const stores = ['reviewEvents', 'learningItems', 'acquisitionEvents', 'sessions'];
		const transaction = database.transaction(stores, 'readonly');
		const counts = await Promise.all(
			stores.map(
				(store) =>
					new Promise<number>((resolve, reject) => {
						const count = transaction.objectStore(store).count();
						count.onsuccess = () => resolve(count.result);
						count.onerror = () => reject(count.error);
					}),
			),
		);
		database.close();
		return counts;
	});
	expect(evidenceCounts).toEqual([0, 0, 0, 0]);

	await page.goto('/curriculum');
	await page.getByRole('tab', { name: /Foundation/ }).click();
	await expect(page.getByRole('button', { name: /01/ })).toContainText('開始地点より前・未完了');
	await page.reload();
	await page.goto('/today');
	await expect(page.getByText('Day 181')).toBeVisible();
});

test('English onboarding supports the Day 271 boundary honestly', async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'languages', { configurable: true, get: () => ['en-US'] });
		Object.defineProperty(navigator, 'language', { configurable: true, get: () => 'en-US' });
	});
	await page.goto('/onboarding');
	await page.getByLabel('What should we call you?').fill('Alex');
	await page.getByLabel('Day 271').check();
	await expect(page.getByText(/Earlier days stay not completed/u)).toBeVisible();
	await page.getByRole('button', { name: 'Continue to baseline' }).click();
	await expect(page.getByText(/Day 271 is your self-selected starting point/u)).toBeVisible();
	await page.getByRole('button', { name: /Start Day 271/u }).click();
	await expect(page.getByText('Day 271')).toBeVisible();
});
