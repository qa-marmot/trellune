import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { build } from 'vite';

let origin = 'http://127.0.0.1';
const clientRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'..',
	'dist',
	'client',
);
const contentTypes = new Map([
	['.css', 'text/css; charset=utf-8'],
	['.html', 'text/html; charset=utf-8'],
	['.js', 'text/javascript; charset=utf-8'],
	['.json', 'application/json; charset=utf-8'],
	['.png', 'image/png'],
	['.svg', 'image/svg+xml'],
	['.webmanifest', 'application/manifest+json'],
	['.woff2', 'font/woff2'],
]);
let browser;
let server;

async function buildVersion(marker) {
	await build({
		clearScreen: false,
		logLevel: 'warn',
		define: { 'import.meta.env.VITE_BUILD_MARKER': JSON.stringify(marker) },
	});
}

async function serveCurrentBuild(request, response) {
	const pathname = decodeURIComponent(new URL(request.url ?? '/', origin).pathname);
	let target = path.resolve(clientRoot, `.${pathname}`);
	if (!target.startsWith(clientRoot)) {
		response.writeHead(400).end();
		return;
	}
	try {
		if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html');
	} catch {
		target = path.join(clientRoot, 'index.html');
	}
	try {
		const body = await readFile(target);
		response.writeHead(200, {
			'content-type': contentTypes.get(path.extname(target)) ?? 'application/octet-stream',
			'cache-control': target.endsWith('sw.js')
				? 'no-cache, no-store, must-revalidate'
				: 'no-cache',
		});
		response.end(body);
	} catch {
		response.writeHead(404).end();
	}
}

async function setActiveCurriculumTotalDays(page, value) {
	await page.evaluate(async (activeTotalDays) => {
		const database = await new Promise((resolve, reject) => {
			const request = globalThis.indexedDB.open('english-os');
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result);
		});
		await new Promise((resolve, reject) => {
			const transaction = database.transaction('metadata', 'readwrite');
			transaction.objectStore('metadata').put({
				key: 'activeCurriculumTotalDays',
				value: activeTotalDays,
				updatedAt: '2026-08-14T00:00:00.000Z',
			});
			transaction.onerror = () => reject(transaction.error);
			transaction.oncomplete = () => resolve();
		});
		database.close();
	}, value);
}

async function readPreservedState(page) {
	return page.evaluate(async () => {
		const database = await new Promise((resolve, reject) => {
			const request = globalThis.indexedDB.open('english-os');
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result);
		});
		const read = (storeName, key) =>
			new Promise((resolve, reject) => {
				const request = database.transaction(storeName).objectStore(storeName).get(key);
				request.onerror = () => reject(request.error);
				request.onsuccess = () => resolve(request.result);
			});
		const readAll = (storeName) =>
			new Promise((resolve, reject) => {
				const request = database.transaction(storeName).objectStore(storeName).getAll();
				request.onerror = () => reject(request.error);
				request.onsuccess = () => resolve(request.result);
			});
		const state = {
			profile: await read('learnerProfiles', 'current'),
			settings: await read('settings', 'current'),
			dailyProgress: await readAll('dailyProgress'),
			activeTotalDays: await read('metadata', 'activeCurriculumTotalDays'),
		};
		database.close();
		return state;
	});
}

try {
	await buildVersion('pwa-build-a');
	server = createServer((request, response) => void serveCurrentBuild(request, response));
	await new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			if (!address || typeof address === 'string') {
				reject(new Error('PWA test server did not receive a TCP port'));
				return;
			}
			origin = `http://127.0.0.1:${address.port}`;
			resolve();
		});
	});
	browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome' });
	const context = await browser.newContext({ baseURL: origin });
	const page = await context.newPage();
	await page.goto('/onboarding');
	await page.getByLabel('呼ばれたい名前').fill('PWA Update Learner');
	await page.getByRole('button', { name: /ベースラインへ/ }).click();
	await page.getByRole('button', { name: /Day 1を始める/ }).click();
	await page.evaluate(async () => navigator.serviceWorker.ready);
	if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))))
		await page.reload();
	await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
	assert.equal(
		await page.evaluate(() => globalThis.document.documentElement.dataset.buildMarker),
		'pwa-build-a',
	);
	await setActiveCurriculumTotalDays(page, 270);
	const preservedBeforeUpdate = await readPreservedState(page);

	await page.goto('/import');
	const editor = page.getByLabel('会話AIが返したJSON');
	await editor.fill('UNSAVED_PWA_UPDATE_INPUT');
	await buildVersion('pwa-build-b');
	await page.evaluate(() => globalThis.dispatchEvent(new globalThis.Event('online')));
	const updateButton = page.getByRole('button', { name: '確認して更新' });
	await updateButton.waitFor({ state: 'visible', timeout: 20_000 });
	await page.waitForTimeout(500);
	assert.equal(
		await page.evaluate(() => globalThis.document.documentElement.dataset.buildMarker),
		'pwa-build-a',
	);
	assert.equal(await editor.inputValue(), 'UNSAVED_PWA_UPDATE_INPUT');

	page.once('dialog', (dialog) => dialog.dismiss());
	await updateButton.click();
	assert.equal(await editor.inputValue(), 'UNSAVED_PWA_UPDATE_INPUT');
	assert.equal(
		await page.evaluate(() => globalThis.document.documentElement.dataset.buildMarker),
		'pwa-build-a',
	);

	page.once('dialog', (dialog) => dialog.accept());
	await updateButton.click();
	await page.waitForFunction(
		() => globalThis.document.documentElement.dataset.buildMarker === 'pwa-build-b',
		undefined,
		{ timeout: 20_000 },
	);
	assert.deepEqual(await readPreservedState(page), preservedBeforeUpdate);
	assert.equal(preservedBeforeUpdate.activeTotalDays?.value, 270);
	await page.goto('/curriculum');
	await page.getByRole('heading', { name: '365日の地図' }).waitFor({ state: 'visible' });
	assert.equal(await page.getByRole('alert').count(), 0);
	process.stdout.write(
		'PWA build A→B proactive update, consent, IndexedDB preservation, and ACTIVE 270 / AVAILABLE 365 compatibility test passed.\n',
	);
	await context.close();
} finally {
	await browser?.close();
	if (server) await new Promise((resolve) => server.close(resolve));
	await build({ clearScreen: false, logLevel: 'warn' });
}
