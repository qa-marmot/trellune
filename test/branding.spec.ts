import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(resolve(path), 'utf8').replace(/\r\n/g, '\n');

describe('public Trellune brand with legacy data compatibility', () => {
	it('uses Trellune in public application and PWA identity', () => {
		expect(readSource('vite.config.ts')).toContain(
			"name: isDemoMode ? 'Trellune Demo' : 'Trellune'",
		);
		expect(readSource('index.html')).toContain('<title>Trellune</title>');
		expect(readSource('src/components/AppShell.tsx')).toContain("t('home.aria')");
		expect(readSource('src/i18n/locales/ja.ts')).toContain("'home.aria': 'Trellune ホーム'");
	});

	it('preserves the existing browser persistence identifiers', () => {
		const database = readSource('src/storage/db.ts');
		const demo = readSource('src/demo.ts');
		expect(database).toContain('super(persistenceDatabaseName)');
		expect(demo).toContain("isDemoMode ? 'trellune-demo' : 'english-os'");
		expect(demo).toContain("isDemoMode\n\t? 'trellune-demo-state-v1'\n\t: 'english-os-state-v1'");
	});
});

