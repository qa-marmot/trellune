import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	{
		ignores: ['dist', 'coverage', 'playwright-report', 'test-results', 'worker-configuration.d.ts'],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ['src/**/*.{ts,tsx}', 'test/**/*.ts'],
		languageOptions: {
			ecmaVersion: 2022,
			globals: { ...globals.browser, ...globals.worker },
		},
	},
	{
		files: ['*.config.{js,ts,mts}'],
		languageOptions: { globals: globals.node },
	},
	{
		files: ['scripts/**/*.mjs'],
		languageOptions: { globals: globals.node },
	},
);
