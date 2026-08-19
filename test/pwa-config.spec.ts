import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function pngDimensions(path: string): [number, number] {
	const value = readFileSync(path);
	return [value.readUInt32BE(16), value.readUInt32BE(20)];
}

describe('PWA release configuration', () => {
	it('ships exact 192, 512 and maskable raster icons', () => {
		expect(pngDimensions(resolve('public/icon-192.png'))).toEqual([192, 192]);
		expect(pngDimensions(resolve('public/icon-512.png'))).toEqual([512, 512]);
		expect(pngDimensions(resolve('public/icon-maskable-512.png'))).toEqual([512, 512]);
	});

	it('uses consent-based updates and never runtime-caches API responses', () => {
		const config = readFileSync(resolve('vite.config.ts'), 'utf8');
		expect(config).toContain("registerType: 'prompt'");
		expect(config).toContain('skipWaiting: false');
		expect(config).toContain('clientsClaim: false');
		expect(config).not.toMatch(/runtimeCaching[\s\S]*\/api\//u);
	});

	it('does not depend on third-party web fonts', () => {
		const html = readFileSync(resolve('index.html'), 'utf8');
		expect(html).not.toMatch(/fonts\.(?:googleapis|gstatic)\.com/u);
	});

	it('keeps the tracked Wrangler configuration local-only', () => {
		const config = readFileSync(resolve('wrangler.jsonc'), 'utf8');
		expect(config).toContain('english-os-local');
		expect(config).not.toContain('ACCESS_TEAM_DOMAIN');
		expect(config).not.toContain('"env"');
	});
});
