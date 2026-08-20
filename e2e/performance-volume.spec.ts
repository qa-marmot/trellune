import { expect, test, type Page } from '@playwright/test';
import {
	buildHistoryFixture,
	readHistoryStoreEvidence,
	seedHistoryFixture,
} from './history-fixtures';

interface LoadMeasurement {
	days: number;
	records: number;
	wallToReadyMs: number;
	domContentLoadedMs: number;
	loadEventMs: number;
	firstPaintMs: number | null;
	firstContentfulPaintMs: number | null;
	domNodes: number;
	usedHeapBytes: number | null;
}

function metricValue(page: Page, label: string) {
	return page.locator('.metric').filter({ hasText: label }).locator('strong');
}

test('measures real loadAppData hydration at 1/7/30/90/365-day volume without an arbitrary time threshold', async ({
	page,
}, testInfo) => {
	const measurements: LoadMeasurement[] = [];

	for (const days of [1, 7, 30, 90, 365] as const) {
		await test.step(`${days}-day normalized history`, async () => {
			const fixture = buildHistoryFixture(days);
			await seedHistoryFixture(page, fixture);
			const startedAt = performance.now();
			await page.goto('/analytics');
			await expect(page.getByRole('heading', { name: '進捗' })).toBeVisible();
			await expect(metricValue(page, 'Voice')).toContainText(`${days * 2}回`);
			await expect(metricValue(page, 'Core / Boost')).toContainText(`${days} / ${days}`);
			await expect(metricValue(page, '復習イベント')).toHaveText(String(days));
			await expect(metricValue(page, '獲得 単語 / 表現')).toContainText(`${days} / ${days}`);

			const wallToReadyMs = performance.now() - startedAt;
			const browserMetrics = await page.evaluate(() => {
				const navigation = performance.getEntriesByType('navigation')[0] as
					PerformanceNavigationTiming | undefined;
				const paints = Object.fromEntries(
					performance.getEntriesByType('paint').map((entry) => [entry.name, entry.startTime]),
				);
				const memory = (performance as Performance & { memory?: { usedJSHeapSize?: number } })
					.memory;
				return {
					domContentLoadedMs: navigation?.domContentLoadedEventEnd ?? 0,
					loadEventMs: navigation?.loadEventEnd ?? 0,
					firstPaintMs: paints['first-paint'] ?? null,
					firstContentfulPaintMs: paints['first-contentful-paint'] ?? null,
					domNodes: document.querySelectorAll('*').length,
					usedHeapBytes: memory?.usedJSHeapSize ?? null,
				};
			});
			const evidence = await readHistoryStoreEvidence(page);
			const records = Object.values(evidence.counts).reduce((total, count) => total + count, 0);
			const measurement = { days, records, wallToReadyMs, ...browserMetrics };
			measurements.push(measurement);

			expect(evidence.completedProgressDays).toHaveLength(days);
			expect(evidence.counts.sessions).toBe(days * 2);
			expect(evidence.counts.reviewEvents).toBe(days);
			expect(evidence.counts.mistakes).toBe(days);
			expect(evidence.counts.grammarProgress).toBe(fixture.expected.grammarProgress);
			expect(Number.isFinite(measurement.wallToReadyMs)).toBe(true);
			expect(measurement.wallToReadyMs).toBeGreaterThanOrEqual(0);
			expect(measurement.domContentLoadedMs).toBeGreaterThanOrEqual(0);
			expect(measurement.loadEventMs).toBeGreaterThanOrEqual(0);
			expect(measurement.domNodes).toBeGreaterThan(0);
		});
	}

	console.info(`TRELLUNE_HISTORY_LOAD_METRICS ${JSON.stringify(measurements)}`);
	await testInfo.attach('history-load-measurements.json', {
		body: Buffer.from(JSON.stringify(measurements, null, 2)),
		contentType: 'application/json',
	});
});
