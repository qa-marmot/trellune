import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const shouldCapture = process.env.CAPTURE_README_SCREENSHOTS === 'true';
const outputRoot = resolve(process.cwd(), 'docs', 'assets', 'demo');

async function selectLocale(page: Page, locale: 'ja' | 'en') {
	await page.addInitScript((value) => {
		window.localStorage.setItem('trellune.uiLocale.v1', value);
	}, locale);
	await page.goto('/today');
	await expect(page.locator('.app-shell')).toBeVisible();
	await expect(page.locator('html')).toHaveAttribute('lang', locale);
}

test.describe('README screenshots', () => {
	test.skip(!shouldCapture, 'Capture only through pnpm screenshots.');
	test.describe.configure({ mode: 'serial' });

	for (const locale of ['en', 'ja'] as const) {
		test(`captures synthetic ${locale} product evidence`, async ({ page }) => {
			mkdirSync(resolve(outputRoot, locale), { recursive: true });
			await page.setViewportSize({ width: 390, height: 844 });
			await selectLocale(page, locale);

			for (const [route, filename] of [
				['/today', 'today-day1.png'],
				['/grammar', 'grammar-practice.png'],
				['/voice', 'conversation-prompt.png'],
				['/analytics', 'progress-srs.png'],
			] as const) {
				await page.goto(route);
				await expect(page.locator('.app-shell')).toBeVisible();
				await page.screenshot({
					path: resolve(outputRoot, locale, filename),
					fullPage: false,
				});
			}
		});
	}
});
