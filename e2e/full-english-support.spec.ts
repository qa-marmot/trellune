import { expect, test } from '@playwright/test';
import { CURRICULUM } from '../src/data/curriculum';
import { SAMPLE_SESSION_JSON_EN } from '../src/lib/sessionImport';

const representativeDays = [1, 7, 30, 90, 91, 120, 180, 181, 224, 270, 271, 310, 359, 365];
const japaneseRegressionDays = [1, 90, 180, 270, 365];
const cjk = /[ぁ-んァ-ン一-龯]/u;

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'languages', { configurable: true, get: () => ['en-US'] });
		Object.defineProperty(navigator, 'language', { configurable: true, get: () => 'en-US' });
	});
	await page.goto('/onboarding');
	await page.getByLabel('What should we call you?').fill('English learner');
	await page.getByRole('button', { name: 'Continue to baseline' }).click();
	await page.getByRole('button', { name: 'Start Day 1 (skip for now)' }).click();
	await expect(page).toHaveURL(/\/today$/u);
});

test('English support renders representative Day 1–365 lessons without Japanese fallback', async ({
	page,
}) => {
	for (const day of representativeDays) {
		await page.goto(`/curriculum/${day}`);
		await expect(page.locator('html')).toHaveAttribute('lang', 'en');
		await expect(page.getByRole('heading', { level: 1 })).toContainText(`Day ${day}`);
		const mainText = await page.locator('main').innerText();
		expect(mainText, `Day ${day} contains Japanese learner support`).not.toMatch(cjk);
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
			await page.evaluate(() => document.documentElement.clientWidth),
		);
	}
});

test('English Voice prompt and SESSION_JSON 1.1 import remain English-only', async ({ page }) => {
	await page.goto('/voice');
	const prompt = page.getByLabel('Conversation AI prompt to copy');
	await expect(prompt).toContainText('supportLanguage: en');
	await expect(prompt).toContainText('SESSION_JSON 1.1');
	expect(await prompt.innerText()).not.toMatch(cjk);

	await page.goto('/import');
	await page.getByLabel('JSON returned by your Conversation AI').fill(SAMPLE_SESSION_JSON_EN);
	await page.getByRole('button', { name: 'Validate and preview' }).click();
	await expect(page.getByRole('heading', { name: 'Import preview' })).toBeVisible();
	await expect(
		page.getByText('Practised introductions and clarification phrases.', { exact: true }),
	).toBeVisible();
});

for (const textSize of [200, 400]) {
	test(`English support stays usable at 320px with ${textSize}% text size`, async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 568 });
		await page.goto('/grammar');
		await page.addStyleTag({ content: `html { font-size: ${textSize}%; }` });
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Check answer' })).toBeVisible();
		const layout = await page.evaluate(() => ({
			clientWidth: document.documentElement.clientWidth,
			scrollWidth: document.documentElement.scrollWidth,
			scrollContainers: [...document.querySelectorAll<HTMLElement>('body *')]
				.filter((element) => element.scrollWidth > element.clientWidth + 1)
				.slice(0, 10)
				.map(
					(element) =>
						`${element.tagName}.${element.className} client=${element.clientWidth} scroll=${element.scrollWidth}`,
				),
			offenders: [...document.querySelectorAll<HTMLElement>('body *')]
				.filter((element) => {
					const box = element.getBoundingClientRect();
					return box.right > document.documentElement.clientWidth + 1 || box.left < -1;
				})
				.slice(0, 10)
				.map((element) => {
					const box = element.getBoundingClientRect();
					const style = getComputedStyle(element);
					return `${element.tagName}.${element.className} text=${JSON.stringify(element.innerText?.slice(0, 40))} left=${box.left} right=${box.right} width=${box.width} min=${style.minWidth} white=${style.whiteSpace}`;
				}),
		}));
		expect(layout.scrollWidth, JSON.stringify(layout)).toBeLessThanOrEqual(layout.clientWidth);
	});
}

test('Japanese support keeps canonical Day 1–365 themes unchanged', async ({ page }) => {
	await page.getByLabel('Display language').selectOption('ja');
	await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
	for (const day of japaneseRegressionDays) {
		await page.goto(`/curriculum/${day}`);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText(
			`Day ${day} · ${CURRICULUM[day - 1]!.theme}`,
		);
	}
});
