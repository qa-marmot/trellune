# Localization

Trellune currently supports two **UI locales**: Japanese (`ja`) and English
(`en`). The user interface is deliberately separate from the curriculum’s
support language.

## Support matrix

| Area                                                           | Japanese                                   | English                             |
| -------------------------------------------------------------- | ------------------------------------------ | ----------------------------------- |
| Navigation, settings, and onboarding                           | Full                                       | Full                                |
| Validation, import, backup, sync, and offline UI               | Full                                       | Full                                |
| Conversation-AI controls and provider capability labels        | Full                                       | Full                                |
| Dates, numbers, document language, title, and description      | Full                                       | Full                                |
| OSS documentation                                              | Japanese README and English primary README | English primary README              |
| Curriculum support explanations and Japanese glosses           | Full                                       | Japanese-first; not fully localized |
| Authored lesson themes, grammar notes, and learner scaffolding | Japanese-first                             | Partial / future work               |

Trellune does **not** claim to be a fully multilingual curriculum. Selecting
English changes product UI, not the language-learning contract, lesson IDs,
`SESSION_JSON`, `ASSESSMENT_JSON`, or the Japanese-first support content.

## Device preference and compatibility

The UI locale is a device-only local preference stored as
`trellune.uiLocale.v1`. It is never written to IndexedDB learner records, D1,
sync payloads, backups, or JSON contracts.

- A fresh install uses the browser language: a language starting with `ja`
  selects Japanese; all other languages select English.
- A learner upgrading from pre-i18n Trellune without a stored preference keeps
  Japanese UI, even when the browser is English.
- An unsupported or malformed stored locale falls back safely.
- Changing language updates immediately; a reload is not required.

## Architecture

`src/i18n/` is intentionally small:

- `types.ts` owns the supported locale union and complete translation-key set.
- `locales/ja.ts` and `locales/en.ts` are typed dictionaries with exact key
  parity.
- `index.tsx` provides `useLocale()`, `t()`, device preference handling, and
  locale-aware date and number formatting.

Missing keys are a compile/test failure, rather than a silent runtime fallback.
The production fallback for an unexpected localized display error is a clear,
safe generic message, never an internal key.

## Adding a UI locale

1. Add its BCP-47 language code to `SUPPORTED_LOCALES`.
2. Add a typed dictionary that implements every `TranslationKey`.
3. Decide the browser-language detection rule and update its tests.
4. Use concise, natural product language; preserve accessibility labels and
   interpolation placeholders exactly.
5. Run `pnpm i18n:check`, then the relevant UI and Playwright tests.
6. Do not translate curriculum content, prompt contracts, or stored learner
   values as part of a UI-only contribution without a separate compatibility
   design.

Translation values may use `{name}`-style interpolation. Do not concatenate
translated fragments when a full sentence can be a single key.

## Accessibility and testing

Every locale must supply labels for navigation, controls, status messages, and
error presentation. Test a fresh journey, a language switch plus reload,
document `lang`, keyboard use, and responsive layouts. The public demo uses
the same locale layer and synthetic-only storage.
