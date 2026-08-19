import { describe, expect, it } from 'vitest';
import { en } from './locales/en';
import { ja } from './locales/ja';
import {
	detectLocale,
	interpolate,
	readStoredLocale,
	resolveInitialLocale,
	UI_LOCALE_STORAGE_KEY,
} from './index';

describe('i18n', () => {
	it('keeps Japanese and English dictionary keys in exact parity', () => {
		expect(Object.keys(en).sort()).toEqual(Object.keys(ja).sort());
	});

	it('detects a fresh browser locale and falls back to English', () => {
		expect(detectLocale(['ja-JP', 'en-US'])).toBe('ja');
		expect(detectLocale(['en-GB'])).toBe('en');
		expect(detectLocale(['fr-FR'])).toBe('en');
		expect(detectLocale(undefined)).toBe('en');
	});

	it('uses only a valid stored device locale', () => {
		expect(
			readStoredLocale({ getItem: (key) => (key === UI_LOCALE_STORAGE_KEY ? 'en' : null) }),
		).toBe('en');
		expect(readStoredLocale({ getItem: () => 'fr' })).toBeUndefined();
	});

	it('keeps a pre-i18n learner on Japanese unless they choose a locale', () => {
		expect(resolveInitialLocale({ hasExistingLearner: true, languages: ['en-US'] })).toBe('ja');
		expect(
			resolveInitialLocale({ hasExistingLearner: true, storedLocale: 'en', languages: ['ja-JP'] }),
		).toBe('en');
		expect(resolveInitialLocale({ hasExistingLearner: false, languages: ['en-US'] })).toBe('en');
	});

	it('interpolates values without silently dropping unknown placeholders', () => {
		expect(interpolate('Day {day}: {name}', { day: 1, name: 'Aki' })).toBe('Day 1: Aki');
		expect(interpolate('Day {day}: {name}', { day: 1 })).toBe('Day 1: {name}');
	});
});
