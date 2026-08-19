import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function onboard(page: Page): Promise<void> {
	await page.goto('/onboarding');
	await page.getByLabel('呼ばれたい名前').fill('Accessibility Learner');
	await page.getByRole('button', { name: /ベースラインへ/ }).click();
	await page.getByRole('button', { name: /Day 1を始める/ }).click();
	await expect(page).toHaveURL(/\/today$/);
}

async function completeCoreFixture(page: Page): Promise<void> {
	await page.evaluate(
		() =>
			new Promise<void>((resolve, reject) => {
				const date = new Intl.DateTimeFormat('en-CA', {
					timeZone: 'Asia/Tokyo',
					year: 'numeric',
					month: '2-digit',
					day: '2-digit',
				}).format(new Date());
				const request = indexedDB.open('english-os');
				request.onerror = () => reject(request.error);
				request.onsuccess = () => {
					const database = request.result;
					const transaction = database.transaction('dailyProgress', 'readwrite');
					transaction.objectStore('dailyProgress').put({
						id: `study:${date}:curriculum:1`,
						studyDate: date,
						curriculumDay: 1,
						reviewsCompleted: true,
						grammarCompleted: true,
						coreSessionImported: true,
						coreCompleted: true,
						version: 1,
						updatedAt: new Date().toISOString(),
					});
					transaction.oncomplete = () => {
						database.close();
						resolve();
					};
					transaction.onerror = () => reject(transaction.error);
				};
			}),
	);
	await page.reload();
}

test('principal routes have no serious or critical axe violations', async ({ page }) => {
	test.setTimeout(120_000);
	await onboard(page);
	await completeCoreFixture(page);
	const routes = [
		'/today',
		'/curriculum',
		'/grammar',
		'/vocabulary',
		'/phrases',
		'/reviews',
		'/mistakes',
		'/voice',
		'/import',
		'/sessions',
		'/analytics',
		'/boost',
		'/backup',
		'/settings',
		'/offline',
	];
	for (const route of routes) {
		await page.goto(route);
		const results = await new AxeBuilder({ page }).analyze();
		const blockers = results.violations.filter((item) =>
			['serious', 'critical'].includes(item.impact ?? ''),
		);
		expect(blockers, `${route}: ${blockers.map((item) => item.id).join(', ')}`).toEqual([]);
	}
});

test('keyboard selection, skip navigation, route focus and completion names are exposed', async ({
	page,
}) => {
	await page.goto('/onboarding');
	await page.getByRole('radio', { name: '20分' }).focus();
	await expect(
		page.locator('.choice').filter({ has: page.getByRole('radio', { name: '20分' }) }),
	).toHaveCSS('outline-style', 'solid');
	await onboard(page);
	await completeCoreFixture(page);
	await page.goto('/curriculum');
	const skipLink = page.getByRole('link', { name: '本文へ移動' });
	await expect(
		page.locator('a,button,input,select,textarea,[tabindex]:not([tabindex="-1"])').first(),
	).toHaveAttribute('class', 'skip-link');
	await skipLink.focus();
	await page.keyboard.press('Enter');
	await expect(page.locator('#main-content')).toBeFocused();
	await page.getByRole('tab', { name: /Foundation/ }).focus();
	await page.keyboard.press('ArrowRight');
	await expect(page.getByRole('tab', { name: /Independent/ })).toHaveAttribute(
		'aria-selected',
		'true',
	);
	await page.getByRole('link', { name: '今日' }).first().click();
	await expect(page.locator('main h1')).toBeFocused();
	await expect(page.getByRole('button', { name: /完了/ }).first()).toBeVisible();
});

test('learning routes reflow across mastery release acceptance widths', async ({ page }) => {
	test.setTimeout(180_000);
	await onboard(page);
	for (const width of [305, 320, 375, 390, 414, 768, 1280]) {
		await page.setViewportSize({ width, height: width < 600 ? 900 : 1_000 });
		for (const route of [
			'/baseline',
			'/today',
			'/grammar',
			'/curriculum',
			'/assessment',
			'/voice',
			'/import',
			'/settings',
		]) {
			await page.goto(route);
			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth,
			);
			expect(overflow, `${route} at ${width}px horizontal overflow`).toBeLessThanOrEqual(1);
		}
	}
});

test('principal controls reflow at 200% and 400% text zoom', async ({ page }) => {
	test.setTimeout(120_000);
	await page.setViewportSize({ width: 1280, height: 1000 });
	await onboard(page);
	await completeCoreFixture(page);
	for (const percentage of [200, 400]) {
		for (const route of [
			'/today',
			'/grammar',
			'/curriculum',
			'/assessment',
			'/voice',
			'/import',
			'/boost',
			'/backup',
			'/settings',
		]) {
			await page.goto(route);
			await page.evaluate((size) => {
				document.documentElement.style.fontSize = `${size}%`;
			}, percentage);
			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth,
			);
			expect(overflow, `${route} at ${percentage}% text zoom`).toBeLessThanOrEqual(1);
		}
	}
});

test('current learning action and Unit disclosure reduce the long-route journey', async ({
	page,
}) => {
	await onboard(page);
	await expect(page.getByRole('button', { name: /次へ ·/ })).toBeVisible();
	await page.goto('/curriculum');
	await expect(page.getByRole('button', { name: 'Day 1へ戻る' })).toBeVisible();
	await expect(page.locator('.curriculum-unit[open]')).toHaveCount(1);
	expect(await page.locator('.curriculum-unit[open] .curriculum-row').count()).toBeLessThan(31);
});
