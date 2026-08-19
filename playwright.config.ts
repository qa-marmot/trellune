import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	retries: process.env.CI ? 2 : 0,
	reporter: [['list'], ['html', { open: 'never' }]],
	use: {
		baseURL: 'http://127.0.0.1:4173',
		locale: 'ja-JP',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
	},
	projects: [
		{
			name: 'mobile-chromium',
			use: { ...devices['Pixel 7'], channel: process.env.CI ? undefined : 'chrome' },
		},
		{
			name: 'desktop-chromium',
			use: { ...devices['Desktop Chrome'], channel: process.env.CI ? undefined : 'chrome' },
		},
		{
			name: 'webkit-mobile',
			testMatch: /webkit-mobile\.spec\.ts/u,
			use: { ...devices['iPhone 13'], browserName: 'webkit' },
		},
	],
	webServer: {
		command: 'pnpm build && pnpm preview --host 127.0.0.1 --port 4173',
		url: 'http://127.0.0.1:4173',
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
});
