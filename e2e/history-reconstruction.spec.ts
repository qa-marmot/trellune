import { expect, test, type Page } from '@playwright/test';
import {
	buildHistoryFixture,
	readHistoryStoreEvidence,
	seedHistoryFixture,
} from './history-fixtures';

function metricValue(page: Page, label: string) {
	return page.locator('.metric').filter({ hasText: label }).locator('strong');
}

test('loadAppData reconstructs skipped normalized history independent of insertion/replay order', async ({
	page,
}) => {
	const fixture = buildHistoryFixture(7, { skippedStudyDays: true });
	await seedHistoryFixture(page, fixture);

	await page.goto('/analytics');
	await expect(page.getByRole('heading', { name: '進捗' })).toBeVisible();
	await expect(metricValue(page, 'CORE完了率')).toContainText('100%');
	await expect(metricValue(page, '連続日数')).toContainText(`${fixture.expected.streak}日`);
	await expect(metricValue(page, 'Voice')).toContainText(
		`${fixture.expected.coreSessions + fixture.expected.boostSessions}回`,
	);
	await expect(metricValue(page, 'Core / Boost')).toContainText(
		`${fixture.expected.coreSessions} / ${fixture.expected.boostSessions}`,
	);
	await expect(metricValue(page, '復習イベント')).toHaveText(String(fixture.expected.reviewEvents));
	await expect(metricValue(page, '獲得 単語 / 表現')).toContainText(
		`${fixture.expected.acquiredWords} / ${fixture.expected.acquiredPhrases}`,
	);
	await expect(metricValue(page, '文法進捗')).toHaveText(String(fixture.expected.grammarProgress));

	await page.goto('/today');
	await expect(page.locator('.day-label')).toContainText('DAY 07');
	await expect(page.getByText(`${fixture.expected.streak}日連続`)).toBeVisible();

	await page.goto('/curriculum');
	await expect(
		page.locator('#curriculum-phase-panel .status-chip').filter({ hasText: /^完了$/u }),
	).toHaveCount(fixture.expected.days);

	await page.goto('/sessions');
	await expect(page.locator('.session-list article')).toHaveCount(
		fixture.expected.coreSessions + fixture.expected.boostSessions,
	);
	await expect(page.locator('.session-list h2').first()).toHaveText(fixture.expected.latestSummary);

	await page.goto('/mistakes');
	await expect(page.locator('.mistake-list article')).toHaveCount(fixture.expected.days);
	await expect(page.getByText('I go yesterday 7.')).toBeVisible();

	const firstRead = await readHistoryStoreEvidence(page);
	expect(firstRead.completedProgressDays).toEqual([1, 2, 3, 4, 5, 6, 7]);
	expect(firstRead.counts.sessions).toBe(
		fixture.expected.coreSessions + fixture.expected.boostSessions,
	);
	expect(firstRead.counts.mistakes).toBe(fixture.expected.days);
	expect(firstRead.counts.reviewEvents).toBe(fixture.expected.reviewEvents);
	expect(firstRead.counts.acquisitionEvents).toBe(
		fixture.expected.acquiredWords + fixture.expected.acquiredPhrases + 1,
	);
	expect(firstRead.counts.grammarProgress).toBe(fixture.expected.grammarProgress);
	expect(firstRead.counts.assessments).toBe(fixture.expected.assessments);
	expect(firstRead.assessmentTypes.sort()).toEqual(['baseline', 'weekly']);
	expect(new Set(firstRead.sessionIds).size).toBe(firstRead.counts.sessions);

	await page.reload();
	await expect(page.getByRole('heading', { name: '間違いノート' })).toBeVisible();
	const secondRead = await readHistoryStoreEvidence(page);
	expect(secondRead).toEqual(firstRead);
});
