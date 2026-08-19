import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: {
			'virtual:pwa-register': fileURLToPath(
				new URL('./src/test/pwa-register-stub.ts', import.meta.url),
			),
		},
	},
	test: {
		environment: 'jsdom',
		setupFiles: ['./src/test/setup.ts'],
		include: ['src/**/*.test.{ts,tsx}', 'test/**/*.spec.ts'],
		exclude: ['e2e/**', 'node_modules/**'],
	},
});
