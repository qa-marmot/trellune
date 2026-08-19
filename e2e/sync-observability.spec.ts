import { expect, test } from '@playwright/test';

test('manual sync reports an offline result instead of appearing to do nothing', async ({
	page,
	context,
}) => {
	await page.goto('/onboarding');
	await page.getByLabel('呼ばれたい名前').fill('Sync Outcome Learner');
	await page.getByRole('button', { name: /ベースラインへ/ }).click();
	await page.getByRole('button', { name: /Day 1を始める/ }).click();
	await page.goto('/settings');
	await page.evaluate(
		() =>
			new Promise<void>((resolve, reject) => {
				const request = indexedDB.open('english-os');
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction('settings', 'readwrite');
					const settings = transaction.objectStore('settings');
					const current = settings.get('current');
					current.onerror = () => reject(current.error);
					current.onsuccess = () => settings.put({ ...current.result, syncEnabled: true });
					transaction.oncomplete = () => {
						database.close();
						resolve();
					};
					transaction.onerror = () => reject(transaction.error);
				};
			}),
	);
	await page.reload();
	await context.setOffline(true);

	await page.getByRole('button', { name: '今すぐ同期' }).click();

	await expect(
		page.getByText('オフラインのため同期していません。接続後にもう一度実行してください。'),
	).toBeVisible();
});
