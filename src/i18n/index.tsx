import {
	createContext,
	type PropsWithChildren,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from 'react';
import { useAppState } from '../state/AppState';
import { en } from './locales/en';
import { ja } from './locales/ja';
import {
	SUPPORTED_LOCALES,
	type LocaleContextValue,
	type SupportedLocale,
	type TranslationKey,
	type TranslationParams,
} from './types';
import { getLearningSupportCatalog, type LearningSupportCatalog } from './learningSupport';

export { SUPPORTED_LOCALES, type SupportedLocale, type TranslationKey } from './types';

export const UI_LOCALE_STORAGE_KEY = 'trellune.uiLocale.v1';
const dictionaries = { ja, en } as const;
const LocaleContext = createContext<LocaleContextValue | null>(null);

export function detectLocale(languages: readonly string[] | undefined): SupportedLocale {
	return languages?.some((language) => language.toLowerCase().startsWith('ja')) ? 'ja' : 'en';
}

export function readStoredLocale(
	storage: Pick<Storage, 'getItem'> | undefined,
): SupportedLocale | undefined {
	const value = storage?.getItem(UI_LOCALE_STORAGE_KEY);
	return SUPPORTED_LOCALES.includes(value as SupportedLocale)
		? (value as SupportedLocale)
		: undefined;
}

export function resolveInitialLocale({
	hasExistingLearner,
	storedLocale,
	languages,
}: {
	hasExistingLearner: boolean;
	storedLocale?: SupportedLocale;
	languages?: readonly string[];
}): SupportedLocale {
	if (storedLocale) return storedLocale;
	return hasExistingLearner ? 'ja' : detectLocale(languages);
}

export function interpolate(value: string, params?: TranslationParams): string {
	if (!params) return value;
	return value.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/gu, (match, name: string) =>
		params[name] === undefined ? match : String(params[name]),
	);
}

export function localizeUiMessage(message: string, locale: SupportedLocale): string {
	if (locale === 'ja' || !/[ぁ-んァ-ン一-龯]/u.test(message)) return message;
	const known: Record<string, TranslationKey> = {
		'端末へ保存しました。': 'status.saved',
		'学習状況を保存しました。': 'status.learningSaved',
		'セッションを保存しました。': 'status.sessionSaved',
		'Stage Assessmentを保存しました。': 'status.assessmentSaved',
	};
	return known[message] ? en[known[message]] : en['error.generic'];
}

export function LocaleProvider({ children }: PropsWithChildren) {
	const { data } = useAppState();
	const [locale, setLocaleState] = useState<SupportedLocale>(
		() => readStoredLocale(typeof window === 'undefined' ? undefined : window.localStorage) ?? 'ja',
	);
	const [defaultResolved, setDefaultResolved] = useState(() =>
		Boolean(readStoredLocale(typeof window === 'undefined' ? undefined : window.localStorage)),
	);

	useEffect(() => {
		if (defaultResolved) return;
		const detected = resolveInitialLocale({
			hasExistingLearner: data.onboarded,
			languages: navigator.languages,
		});
		setLocaleState(detected);
		// Only a brand-new learner receives and stores browser detection. Existing
		// pre-i18n learner records deliberately retain the historic Japanese UI.
		if (!data.onboarded) window.localStorage.setItem(UI_LOCALE_STORAGE_KEY, detected);
		setDefaultResolved(true);
	}, [data.onboarded, defaultResolved]);

	const setLocale = useCallback((next: SupportedLocale) => {
		setLocaleState(next);
		window.localStorage.setItem(UI_LOCALE_STORAGE_KEY, next);
		setDefaultResolved(true);
	}, []);
	const t = useCallback(
		(key: TranslationKey, params?: TranslationParams) =>
			interpolate(dictionaries[locale][key], params),
		[locale],
	);
	const value = useMemo<LocaleContextValue>(
		() => ({
			locale,
			setLocale,
			t,
			formatDateTime: (input, options) =>
				new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-US', {
					dateStyle: 'medium',
					timeStyle: 'short',
					...options,
				}).format(new Date(input)),
			formatNumber: (input) =>
				new Intl.NumberFormat(locale === 'ja' ? 'ja-JP' : 'en-US').format(input),
		}),
		[locale, setLocale, t],
	);

	useEffect(() => {
		document.documentElement.lang = locale;
		document.documentElement.dir = 'ltr';
		document.title = `Trellune${locale === 'ja' ? ' · 英語学習' : ' · English learning'}`;
		document
			.querySelector('meta[name="description"]')
			?.setAttribute(
				'content',
				locale === 'ja'
					? '365日で英語を積み上げる、ローカル優先の学習PWA'
					: 'A local-first PWA for building English practice across 365 days.',
			);
	}, [locale]);

	return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
	const value = useContext(LocaleContext);
	if (!value) throw new Error('useLocale must be used inside LocaleProvider');
	return value;
}

/**
 * Stage B intentionally follows the device UI language while keeping learner
 * support as a separate concept from synchronized application state.
 */
export function useLearningSupport(): LearningSupportCatalog {
	const { locale } = useLocale();
	return useMemo(() => getLearningSupportCatalog(locale), [locale]);
}
