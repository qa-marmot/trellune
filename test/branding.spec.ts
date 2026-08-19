import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('public Trellune brand with legacy data compatibility', () => {
	it('uses Trellune in public application and PWA identity', () => {
		expect(readFileSync(resolve('vite.config.ts'), 'utf8')).toContain(
			"name: isDemoMode ? 'Trellune Demo' : 'Trellune'",
		);
		expect(readFileSync(resolve('index.html'), 'utf8')).toContain('<title>Trellune</title>');
		expect(readFileSync(resolve('src/components/AppShell.tsx'), 'utf8')).toContain(
			"t('home.aria')",
		);
		expect(readFileSync(resolve('src/i18n/locales/ja.ts'), 'utf8')).toContain(
			"'home.aria': 'Trellune ホーム'",
		);
	});

	it('preserves the existing browser persistence identifiers', () => {
		const database = readFileSync(resolve('src/storage/db.ts'), 'utf8');
		const demo = readFileSync(resolve('src/demo.ts'), 'utf8');
		expect(database).toContain('super(persistenceDatabaseName)');
		expect(demo).toContain("isDemoMode ? 'trellune-demo' : 'english-os'");
		expect(demo).toContain("isDemoMode\n\t? 'trellune-demo-state-v1'\n\t: 'english-os-state-v1'");
	});
});
