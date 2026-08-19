import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { buildHistoryFixture, seedHistoryFixture, type HistoryFixture } from './history-fixtures';

test.describe.configure({ mode: 'serial' });
test.beforeEach(({ page }, testInfo) => {
	void page;
	test.skip(
		testInfo.project.name !== 'desktop-chromium',
		'The fixed visual matrix is generated once by the desktop project.',
	);
});

const PHASE = process.env.UI_AUDIT_PHASE === 'before' ? 'before' : 'after';
const OUTPUT_ROOT = join(process.cwd(), 'test-results', 'visual-audit', PHASE);

const viewports = [
	{ key: '320x568', width: 320, height: 568 },
	{ key: '360x640', width: 360, height: 640 },
	{ key: '375x667', width: 375, height: 667 },
	{ key: '390x844', width: 390, height: 844 },
	{ key: '414x896', width: 414, height: 896 },
	{ key: '768x1024', width: 768, height: 1024 },
	{ key: '1024x768', width: 1024, height: 768 },
	{ key: '1280x720', width: 1280, height: 720 },
	{ key: '1440x900', width: 1440, height: 900 },
	{ key: '1920x1080', width: 1920, height: 1080 },
] as const;

const stressViewports = [
	{ key: 'landscape-568x320', width: 568, height: 320 },
	{ key: 'landscape-844x390', width: 844, height: 390 },
	{ key: 'keyboard-390x320', width: 390, height: 320 },
	// A 1280x900 display at 200% browser zoom exposes roughly a 640x450 CSS viewport.
	{ key: 'zoom200-640x450', width: 640, height: 450 },
	{ key: 'text400-1280x900', width: 1280, height: 900, rootFontPercent: 400 },
] as const;

interface AuditRoute {
	name: string;
	path: string | ((fixture: HistoryFixture) => string);
}

const routes: AuditRoute[] = [
	{ name: 'onboarding', path: '/onboarding' },
	{ name: 'baseline', path: '/baseline' },
	{ name: 'today', path: '/today' },
	{ name: 'curriculum', path: '/curriculum' },
	{ name: 'curriculum-detail', path: '/curriculum/365' },
	{ name: 'grammar', path: '/grammar' },
	{ name: 'vocabulary', path: '/vocabulary' },
	{ name: 'phrases', path: '/phrases' },
	{ name: 'reviews', path: '/reviews' },
	{ name: 'mistakes', path: '/mistakes' },
	{ name: 'voice-preparation', path: '/voice' },
	{ name: 'session-import', path: '/import' },
	{ name: 'sessions', path: '/sessions' },
	{
		name: 'session-detail',
		path: (fixture) =>
			`/sessions/${encodeURIComponent(String(fixture.stores.sessions[0]?.sessionId ?? 'missing'))}`,
	},
	{ name: 'analytics', path: '/analytics' },
	{ name: 'boost', path: '/boost' },
	{ name: 'backup', path: '/backup' },
	{ name: 'assessment', path: '/assessment' },
	{ name: 'settings', path: '/settings' },
	{ name: 'offline-recovery', path: '/offline' },
	{ name: 'unknown-route', path: '/this-route-does-not-exist' },
];

interface ElementCandidate {
	selector: string;
	tag: string;
	text: string;
	kind: 'horizontal-outside' | 'internal-clipping' | 'focus-outline-clipping';
	detail: string;
}

interface OverlapCandidate {
	overlay: string;
	target: string;
	overlapWidth: number;
	overlapHeight: number;
}

interface AuditResult {
	phase: string;
	route: string;
	path: string;
	viewport: string;
	rootFontPercent: number;
	document: {
		clientWidth: number;
		scrollWidth: number;
		horizontalOverflow: number;
	};
	candidates: ElementCandidate[];
	overlaps: OverlapCandidate[];
	screenshot: string;
}

function record(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== 'object') throw new Error('Expected fixture record');
	return value as Record<string, unknown>;
}

function makeStressFixture(): HistoryFixture {
	const fixture = buildHistoryFixture(30);
	const now = new Date();
	const dueAt = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();
	for (let index = 1; index <= 12; index += 1) {
		fixture.stores.reviewCards.unshift({
			id: `visual-due-card-${index}`,
			front: `Due review question ${index}`,
			back: `期限が来た復習カード ${index}`,
			dueAt,
			state: 'new',
			sourceType: 'mistake',
			sourceId: `mistake-${index}`,
			stabilityLevel: 0,
			lapses: 0,
			algorithmVersion: 1,
			version: 1,
			updatedAt: now.toISOString(),
		});
	}
	if (process.env.UI_AUDIT_STRESS === 'base') return fixture;
	const longJapanese =
		'これは狭い画面と文字拡大で折り返し、操作領域、余白、整列を確認するための非常に長い日本語説明文です。重要な情報と操作ボタンが重ならず、最後まで読める必要があります。';
	const longEnglish =
		'pneumonoultramicroscopicsilicovolcanoconiosis_without_any_optional_break_opportunity';
	const profile = record(fixture.stores.learnerProfiles[0]);
	profile.learnerName = '表示確認用のとても長い学習者名 Trellune Responsive Learner';
	profile.goal = longJapanese;
	if (process.env.UI_AUDIT_STRESS === 'profile') return fixture;

	const session = record(fixture.stores.sessions[0]);
	session.summary = `${longJapanese} ${longEnglish}`;
	const payload = record(session.payload);
	payload.summaryJa = session.summary;
	const evaluation = record(payload.evaluation);
	evaluation.commentJa = `${longJapanese}${longJapanese}`;
	if (process.env.UI_AUDIT_STRESS === 'session') return fixture;

	const mistake = record(fixture.stores.mistakes[0]);
	mistake.original = longEnglish;
	mistake.correction = `${longJapanese} ${longEnglish}`;
	if (process.env.UI_AUDIT_STRESS === 'mistake') return fixture;

	const vocabulary = record(
		fixture.stores.learningItems.find((item) => record(item).kind === 'vocabulary'),
	);
	vocabulary.displayText = longEnglish;
	vocabulary.canonicalText = longEnglish;
	vocabulary.meaningJa = longJapanese;
	if (process.env.UI_AUDIT_STRESS === 'vocabulary') return fixture;

	const phrase = record(
		fixture.stores.learningItems.find((item) => record(item).kind === 'phrase'),
	);
	phrase.displayText = `CouldYouPleaseExplainWhether${longEnglish}`;
	phrase.canonicalText = String(phrase.displayText)
		.normalize('NFKC')
		.trim()
		.toLocaleLowerCase('en-US');
	phrase.meaningJa = longJapanese;
	if (process.env.UI_AUDIT_STRESS === 'phrase') return fixture;

	const review = record(fixture.stores.reviewCards[0]);
	review.front = longEnglish;
	review.back = longJapanese;
	return fixture;
}

async function waitForStablePage(page: Page): Promise<void> {
	await page.locator('h1').first().waitFor({ state: 'visible' });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.evaluate(async () => {
		if ('fonts' in document) await document.fonts.ready;
	});
	await page.waitForTimeout(40);
}

async function navigateForAudit(page: Page, path: string): Promise<void> {
	await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 15_000 });
}

async function inspectLayout(
	page: Page,
): Promise<
	Omit<AuditResult, 'phase' | 'route' | 'path' | 'viewport' | 'rootFontPercent' | 'screenshot'>
> {
	return page.evaluate(() => {
		const viewportWidth = document.documentElement.clientWidth;
		const viewportHeight = window.innerHeight;
		const ignored = (element: Element) =>
			element.closest('.visually-hidden,[hidden],[aria-hidden="true"]') !== null;
		const visible = (element: Element, rect: DOMRect) => {
			const style = getComputedStyle(element);
			return (
				!ignored(element) &&
				style.display !== 'none' &&
				style.visibility !== 'hidden' &&
				Number(style.opacity) !== 0 &&
				rect.width > 0 &&
				rect.height > 0
			);
		};
		const selectorFor = (element: Element) => {
			if (element.id) return `#${CSS.escape(element.id)}`;
			const classes = [...element.classList]
				.slice(0, 3)
				.map((name) => `.${CSS.escape(name)}`)
				.join('');
			const parent = element.parentElement;
			const index = parent ? [...parent.children].indexOf(element) + 1 : 1;
			return `${element.tagName.toLowerCase()}${classes}:nth-child(${index})`;
		};
		const horizontalScrollAncestor = (element: Element) => {
			let parent = element.parentElement;
			while (parent) {
				const style = getComputedStyle(parent);
				if (
					(style.overflowX === 'auto' || style.overflowX === 'scroll') &&
					parent.scrollWidth > parent.clientWidth + 1
				)
					return parent;
				parent = parent.parentElement;
			}
			return null;
		};
		const candidates: ElementCandidate[] = [];
		const elements = [...document.querySelectorAll('*')];
		for (const element of elements) {
			const rect = element.getBoundingClientRect();
			if (!visible(element, rect)) continue;
			const style = getComputedStyle(element);
			const selector = selectorFor(element);
			const text = (element.textContent ?? '').replace(/\s+/gu, ' ').trim().slice(0, 140);
			if (
				(rect.left < -1 || rect.right > viewportWidth + 1) &&
				!horizontalScrollAncestor(element) &&
				style.position !== 'fixed'
			) {
				candidates.push({
					selector,
					tag: element.tagName.toLowerCase(),
					text,
					kind: 'horizontal-outside',
					detail: `left=${rect.left.toFixed(1)}, right=${rect.right.toFixed(1)}, viewport=${viewportWidth}`,
				});
			}
			const clipsX = ['hidden', 'clip'].includes(style.overflowX);
			const clipsY = ['hidden', 'clip'].includes(style.overflowY);
			if (
				text &&
				((clipsX && element.scrollWidth > element.clientWidth + 1) ||
					(clipsY && element.scrollHeight > element.clientHeight + 1))
			) {
				candidates.push({
					selector,
					tag: element.tagName.toLowerCase(),
					text,
					kind: 'internal-clipping',
					detail: `client=${element.clientWidth}x${element.clientHeight}, scroll=${element.scrollWidth}x${element.scrollHeight}, overflow=${style.overflowX}/${style.overflowY}`,
				});
			}
		}

		const focusables = elements.filter(
			(element): element is HTMLElement =>
				element instanceof HTMLElement &&
				element.matches('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])') &&
				!element.matches(':disabled'),
		);
		for (const element of focusables) {
			const rect = element.getBoundingClientRect();
			if (!visible(element, rect)) continue;
			let ancestor = element.parentElement;
			while (ancestor) {
				const style = getComputedStyle(ancestor);
				if (
					['hidden', 'clip'].includes(style.overflowX) ||
					['hidden', 'clip'].includes(style.overflowY)
				) {
					const bounds = ancestor.getBoundingClientRect();
					if (
						rect.left - 5 < bounds.left ||
						rect.right + 5 > bounds.right ||
						rect.top - 5 < bounds.top ||
						rect.bottom + 5 > bounds.bottom
					) {
						candidates.push({
							selector: selectorFor(element),
							tag: element.tagName.toLowerCase(),
							text: (element.textContent ?? '').replace(/\s+/gu, ' ').trim().slice(0, 140),
							kind: 'focus-outline-clipping',
							detail: `clipping ancestor ${selectorFor(ancestor)}`,
						});
						break;
					}
				}
				ancestor = ancestor.parentElement;
			}
		}

		const overlays = elements
			.map((element) => ({
				element,
				rect: element.getBoundingClientRect(),
				style: getComputedStyle(element),
			}))
			.filter(
				(item) =>
					['fixed', 'sticky'].includes(item.style.position) &&
					visible(item.element, item.rect) &&
					item.rect.bottom > 0 &&
					item.rect.top < viewportHeight,
			);
		const overlapTargets = [
			...document.querySelectorAll(
				'main button,main a,main input,main select,main textarea,main h1,main h2',
			),
		];
		const overlaps: OverlapCandidate[] = [];
		for (const overlay of overlays) {
			for (const target of overlapTargets) {
				if (overlay.element.contains(target) || target.contains(overlay.element)) continue;
				const rect = target.getBoundingClientRect();
				if (!visible(target, rect) || rect.bottom <= 0 || rect.top >= viewportHeight) continue;
				const width =
					Math.min(overlay.rect.right, rect.right) - Math.max(overlay.rect.left, rect.left);
				const height =
					Math.min(overlay.rect.bottom, rect.bottom) - Math.max(overlay.rect.top, rect.top);
				if (width > 2 && height > 2) {
					overlaps.push({
						overlay: selectorFor(overlay.element),
						target: selectorFor(target),
						overlapWidth: Math.round(width),
						overlapHeight: Math.round(height),
					});
				}
			}
		}
		return {
			document: {
				clientWidth: viewportWidth,
				scrollWidth: document.documentElement.scrollWidth,
				horizontalOverflow: document.documentElement.scrollWidth - viewportWidth,
			},
			candidates: candidates.slice(0, 250),
			overlaps: overlaps.slice(0, 100),
		};
	});
}

async function capture(
	page: Page,
	fixture: HistoryFixture,
	route: AuditRoute,
	viewport: (typeof viewports)[number] | (typeof stressViewports)[number],
): Promise<AuditResult> {
	await page.setViewportSize({ width: viewport.width, height: viewport.height });
	const path = typeof route.path === 'function' ? route.path(fixture) : route.path;
	await page.goto(path);
	await waitForStablePage(page);
	const renderedHeading = await page.locator('h1').first().innerText();
	if (renderedHeading === '保存データの確認が必要です') {
		throw new Error(`${route.name} rendered the startup recovery error instead of its route`);
	}
	if (new URL(page.url()).pathname !== path) {
		throw new Error(`${route.name} redirected from ${path} to ${new URL(page.url()).pathname}`);
	}
	const rootFontPercent = 'rootFontPercent' in viewport ? viewport.rootFontPercent : 100;
	if (rootFontPercent !== 100) {
		await page.evaluate((percentage) => {
			document.documentElement.style.fontSize = `${percentage}%`;
		}, rootFontPercent);
		await page.waitForTimeout(20);
	}
	const screenshotName = `${route.name}-${viewport.key}.png`;
	const screenshot = join(OUTPUT_ROOT, screenshotName);
	await page.screenshot({
		path: screenshot,
		fullPage: rootFontPercent === 100,
		animations: 'disabled',
	});
	return {
		phase: PHASE,
		route: route.name,
		path,
		viewport: viewport.key,
		rootFontPercent,
		...(await inspectLayout(page)),
		screenshot: screenshotName,
	};
}

async function seedConflict(page: Page): Promise<void> {
	await page.evaluate(async () => {
		const database = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open('english-os');
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result);
		});
		const transaction = database.transaction(['outbox', 'conflicts', 'syncState'], 'readwrite');
		const now = new Date().toISOString();
		const operationId = '77777777-7777-4777-8777-777777777777';
		const entityId = 'study:2026-08-12:curriculum:30';
		transaction.objectStore('outbox').put({
			operationId,
			schemaVersion: 1,
			deviceId: '88888888-8888-4888-8888-888888888888',
			entityType: 'daily-progress',
			entityId,
			operationType: 'upsert',
			payload: { id: entityId, version: 2 },
			baseVersion: 1,
			createdAt: now,
			attempts: 1,
			nextAttemptAt: now,
			status: 'blocked',
			lastErrorCode: 'version_conflict',
		});
		transaction.objectStore('conflicts').put({
			id: `push:${operationId}`,
			operationId,
			entityType: 'daily-progress-with-an-extremely-long-entity-type-label',
			entityId: `${entityId}:with-a-very-long-unbroken-identifier-segment`,
			status: 'open',
			serverValue: { current: { id: entityId }, version: 9 },
			localValue: { id: entityId, version: 2 },
			createdAt: now,
		});
		transaction.objectStore('syncState').put({
			id: 'current',
			cursor: 7,
			lastErrorCode: 'version_conflict_with_a_long_diagnostic_code',
			updatedAt: now,
		});
		await new Promise<void>((resolve, reject) => {
			transaction.oncomplete = () => resolve();
			transaction.onerror = () => reject(transaction.error);
			transaction.onabort = () => reject(transaction.error);
		});
		database.close();
	});
}

test('captures the exhaustive responsive audit matrix', async ({ page }) => {
	test.setTimeout(30 * 60_000);
	await mkdir(OUTPUT_ROOT, { recursive: true });
	await page.route('**/api/v1/health', (route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"ok"}' }),
	);
	const fixture = makeStressFixture();
	await seedHistoryFixture(page, fixture);
	const results: AuditResult[] = [];
	for (const viewport of [...viewports, ...stressViewports]) {
		for (const route of routes) results.push(await capture(page, fixture, route, viewport));
		await writeFile(join(OUTPUT_ROOT, 'audit-results.json'), JSON.stringify(results, null, 2));
	}
	expect(results).toHaveLength((viewports.length + stressViewports.length) * routes.length);
	const failures = results.flatMap((result) => {
		const unexpectedOverlaps = result.overlaps.filter(
			(candidate) => !candidate.overlay.includes('.mobile-nav'),
		);
		if (
			result.document.horizontalOverflow <= 1 &&
			result.candidates.length === 0 &&
			unexpectedOverlaps.length === 0
		)
			return [];
		return [
			{
				route: result.route,
				viewport: result.viewport,
				horizontalOverflow: result.document.horizontalOverflow,
				candidates: result.candidates,
				unexpectedOverlaps,
			},
		];
	});
	expect(
		failures,
		'Visual audit found document overflow, clipped/outside content, focus clipping, or an unexpected fixed/sticky overlap. Initial intersections with the fixed mobile nav are reviewed separately because the shell reserves scrollable bottom padding.',
	).toEqual([]);
});

test('captures empty, error, conflict, offline, restore, focus and Boost states', async ({
	page,
}) => {
	test.setTimeout(10 * 60_000);
	page.setDefaultTimeout(10_000);
	await mkdir(OUTPUT_ROOT, { recursive: true });
	const mark = (value: string) => writeFile(join(OUTPUT_ROOT, 'state-progress.txt'), value);
	await mark('started');
	await page.route('**/api/v1/health', (route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"ok"}' }),
	);
	const fixture = makeStressFixture();
	await mark('fixture-created');
	await seedHistoryFixture(page, fixture);
	await mark('fixture-seeded');
	await page.setViewportSize({ width: 320, height: 568 });
	await mark('viewport-set');

	await navigateForAudit(page, '/import');
	await mark('import-navigated');
	await waitForStablePage(page);
	await mark('import-stable');
	await page.getByLabel('会話AIが返したJSON').evaluate((element, value) => {
		const textarea = element as HTMLTextAreaElement;
		const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
		setter?.call(textarea, value);
		textarea.dispatchEvent(new Event('input', { bubbles: true }));
	}, '{"not":"valid session json"}');
	await mark('import-filled');
	await page.getByRole('button', { name: '検証してプレビュー' }).click();
	await mark('import-clicked');
	await expect(page.getByText('保存できません')).toBeVisible();
	await page.screenshot({
		path: join(OUTPUT_ROOT, 'session-import-error-320x568.png'),
		fullPage: true,
	});
	await mark('import-error');

	await seedConflict(page);
	await navigateForAudit(page, '/settings');
	await expect(page.getByRole('heading', { name: '同期競合' })).toBeVisible();
	await page.screenshot({
		path: join(OUTPUT_ROOT, 'settings-sync-conflict-320x568.png'),
		fullPage: true,
	});
	await mark('sync-conflict');

	await navigateForAudit(page, '/today');
	await page.unroute('**/api/v1/health');
	await page.context().setOffline(true);
	await page.reload({ waitUntil: 'domcontentloaded', timeout: 15_000 });
	await expect(page.getByText('オフライン').first()).toBeVisible();
	await page.screenshot({ path: join(OUTPUT_ROOT, 'today-offline-320x568.png'), fullPage: true });
	await page.context().setOffline(false);
	await page.route('**/api/v1/health', (route) =>
		route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"ok"}' }),
	);
	await mark('offline');

	await navigateForAudit(page, '/backup');
	await waitForStablePage(page);
	const downloadPending = page.waitForEvent('download');
	await page.getByRole('button', { name: 'JSONを保存' }).click();
	const download = await downloadPending;
	const downloadPath = await download.path();
	if (!downloadPath) throw new Error('Backup download did not have a local path');
	await page.getByLabel('Trelluneバックアップ（JSON）').setInputFiles(downloadPath);
	await expect(page.getByRole('heading', { name: '復元プレビュー' })).toBeVisible();
	await page.screenshot({
		path: join(OUTPUT_ROOT, 'backup-restore-preview-320x568.png'),
		fullPage: true,
	});
	await mark('restore-preview');

	await navigateForAudit(page, '/reviews');
	await page.getByRole('button', { name: /答えを見る/ }).click();
	await page.getByRole('button', { name: 'もう一度' }).focus();
	await page.screenshot({
		path: join(OUTPUT_ROOT, 'reviews-focus-grade-320x568.png'),
		fullPage: true,
	});
	await mark('focus');

	await navigateForAudit(page, '/boost');
	for (const label of [
		'Review Rescue',
		'Speaking Sprint',
		'Grammar Deep Dive',
		'Scenario Challenge',
		'Weakness Attack',
		'Next Lesson Preview',
		'Free Talk',
	]) {
		const button = page.getByRole('button', { name: new RegExp(label, 'u') });
		if (await button.isEnabled()) await button.click();
		await page.screenshot({
			path: join(OUTPUT_ROOT, `boost-${label.toLowerCase().replaceAll(' ', '-')}-320x568.png`),
			fullPage: true,
		});
	}
	await mark('boost-modes');

	const empty = buildHistoryFixture(1);
	for (const store of [
		'dailyProgress',
		'learningEvents',
		'sessions',
		'mistakes',
		'learningItems',
		'acquisitionEvents',
		'reviewCards',
		'reviewEvents',
		'grammarProgress',
		'assessments',
	])
		empty.stores[store] = [];
	const emptyProfile = record(empty.stores.learnerProfiles[0]);
	emptyProfile.currentDay = 1;
	emptyProfile.streak = 0;
	await seedHistoryFixture(page, empty);
	for (const [name, path] of [
		['reviews-empty', '/reviews'],
		['mistakes-empty', '/mistakes'],
		['vocabulary-empty', '/vocabulary'],
		['phrases-empty', '/phrases'],
		['sessions-empty', '/sessions'],
	] as const) {
		await navigateForAudit(page, path);
		await waitForStablePage(page);
		await page.screenshot({ path: join(OUTPUT_ROOT, `${name}-320x568.png`), fullPage: true });
	}
	await mark('empty-states-complete');
});

test('captures the startup recovery error in a fresh context', async ({ page }) => {
	await mkdir(OUTPUT_ROOT, { recursive: true });
	await page.addInitScript(() => {
		localStorage.setItem('english-os-state-v1', '{"onboarded":"corrupt"}');
	});
	await navigateForAudit(page, '/onboarding');
	await expect(page.getByRole('heading', { name: '保存データの確認が必要です' })).toBeVisible();
	await page.screenshot({ path: join(OUTPUT_ROOT, 'startup-error-320x568.png'), fullPage: true });
});
