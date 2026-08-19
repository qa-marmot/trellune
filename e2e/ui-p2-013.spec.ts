import { expect, test } from '@playwright/test';
import { buildHistoryFixture, seedHistoryFixture } from './history-fixtures';

const widths = [305, 320, 390, 414, 1280] as const;
const routes = [
	{ name: 'Today', path: '/today' },
	{ name: 'Grammar', path: '/grammar' },
	{ name: 'Voice', path: '/voice' },
	{ name: 'Import', path: '/import' },
	{ name: 'Sessions', path: '/sessions' },
	{ name: 'Settings', path: '/settings' },
] as const;

test('UI-P2-013 keeps target routes within the effective viewport width', async ({ page }) => {
	test.setTimeout(60_000);
	await page.route('**/api/v1/health', (route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"ok"}' }),
	);
	await seedHistoryFixture(page, buildHistoryFixture(30));

	const failures: Array<{
		width: number;
		route: string;
		clientWidth: number;
		scrollWidth: number;
	}> = [];

	for (const width of widths) {
		await page.setViewportSize({ width, height: width < 600 ? 568 : 720 });
		for (const route of routes) {
			await page.goto(route.path);
			await expect(page.locator('h1').first()).toBeVisible();
			const dimensions = await page.evaluate(() => ({
				clientWidth: document.documentElement.clientWidth,
				scrollWidth: document.documentElement.scrollWidth,
			}));
			if (dimensions.scrollWidth > dimensions.clientWidth) {
				failures.push({ width, route: route.name, ...dimensions });
			}
		}
	}

	expect(failures, 'Target routes must not overflow the effective viewport width.').toEqual([]);
});
