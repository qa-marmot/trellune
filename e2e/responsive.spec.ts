import { expect, test } from '@playwright/test';

const widths = [320, 375, 414, 768] as const;

for (const width of widths) {
	test(`Today fits ${width}px without horizontal scroll`, async ({ page }) => {
		await page.setViewportSize({ width, height: width < 600 ? 820 : 960 });
		await page.addInitScript(() => {
			localStorage.setItem(
				'english-os-state-v1',
				JSON.stringify({
					onboarded: true,
					learnerName: 'Alex',
					goal: '身近な話題で10分話す',
					dailyMinutes: 20,
					currentDay: 1,
					streak: 3,
					core: { reviews: true, grammar: false, voice: false, import: false },
					completedDays: [],
					previewedDays: [],
					reviewCount: 7,
					sessions: [],
					mistakes: [],
					syncEnabled: false,
					reduceMotion: false,
				}),
			);
		});
		await page.goto('/today');
		await expect(page.getByRole('heading', { name: 'はじめまして' })).toBeVisible();
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth,
		);
		expect(overflow).toBeLessThanOrEqual(0);
	});
}
