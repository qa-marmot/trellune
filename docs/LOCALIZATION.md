# Localization

Trellune supports Japanese (`ja`) and English (`en`) for both product UI and
bundled learner support. UI locale and support language remain separate
concepts: Stage B follows the device UI locale by default, while stable
curriculum data and learner state remain language-neutral.

## Support matrix

| Area                                                             | Japanese                                   | English                |
| ---------------------------------------------------------------- | ------------------------------------------ | ---------------------- |
| Navigation, settings, and onboarding                             | Full                                       | Full                   |
| Validation, import, backup, sync, and offline UI                 | Full                                       | Full                   |
| Conversation-AI controls and provider capability labels          | Full                                       | Full                   |
| Dates, numbers, document language, title, and description        | Full                                       | Full                   |
| OSS documentation                                                | Japanese README and English primary README | English primary README |
| Day 1–365 themes, objectives, grammar, vocabulary, and phrases   | Full                                       | Full                   |
| Practice, feedback, Reading/Writing guidance, and Voice tasks    | Full                                       | Full                   |
| Conversation-AI, baseline, Study Mode, Boost, and weekly prompts | Full                                       | Full                   |
| New session-result meanings, explanations, and summaries         | `SESSION_JSON` 1.0                         | `SESSION_JSON` 1.1     |

English completeness is enforced over all 365 resolved lessons, 801 practice
blocks, 879 prompts, 1,725 vocabulary occurrences, and 730 phrase occurrences.
Vocabulary must resolve to a concise definition or composed collocation gloss;
phrases receive an English communicative-usage note rather than a placeholder
that repeats the target. A Japanese-script leak detector rejects unintended
fallback in bundled English learner support and generated English prompt
artifacts. The intentional language-selector option `日本語` and learner-authored
historical content are outside that bundled-content assertion.

## Device preference and compatibility

The UI locale is a device-only local preference stored as
`trellune.uiLocale.v1`. The support-language resolver currently follows this
preference but has its own typed boundary. Neither is written to IndexedDB
learner records, D1, sync payloads, or backups.

- A fresh install uses the browser language: a language starting with `ja`
  selects Japanese; all other languages select English.
- A learner upgrading from pre-i18n Trellune without a stored preference keeps
  Japanese UI, even when the browser is English.
- An unsupported or malformed stored locale falls back safely.
- Changing language updates immediately; a reload is not required.

## Architecture

`src/i18n/` keeps localization separate from stable curriculum identity:

- `types.ts` owns the supported locale union and complete translation-key set.
- `locales/ja.ts` and `locales/en.ts` are typed dictionaries with exact key
  parity.
- `index.tsx` provides `useLocale()`, `t()`, device preference handling, and
  locale-aware date and number formatting. `useLearningSupport()` resolves the
  matching learner-support catalog.
- `learningSupport.ts` overlays English support on the canonical Japanese
  curriculum by stable IDs without changing lesson, item, practice, or prompt
  identity. Japanese resolution returns the exact canonical objects.
- `generatedEnglishGlosses.ts` contains static English dictionary glosses for
  useful target words; no runtime dictionary service or translation API is
  called.

English `SESSION_JSON` 1.1 uses language-neutral fields and a required
`supportLanguage`. Strict validation resolves both versions to one neutral
in-memory model while preserving the original validated payload. D1 migration
`0013` adds neutral text columns and backfills legacy Japanese rows without
dropping or rewriting their `*_ja` values. Dexie v5 stores neutral, non-indexed
fields without a version bump. Version 1.0 remains strictly valid and
importable forever; no historical session or review card is rewritten. Stored
historical text is displayed verbatim so its language boundary stays honest.

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
6. Keep UI-only contributions separate from curriculum support and never
   translate stored learner values in place.

For a small first contribution, see the [localization path in
Contributing](../CONTRIBUTING.md#i-want-to) and run `pnpm i18n:check`. Screenshots
for a locale contribution must use only the resettable synthetic demo.

Translation values may use `{name}`-style interpolation. Do not concatenate
translated fragments when a full sentence can be a single key.

## Accessibility and testing

Every locale must supply labels for navigation, controls, status messages, and
error presentation. Test a fresh journey, a language switch plus reload,
document `lang`, keyboard use, and responsive layouts. The public demo uses
the same locale layer and synthetic-only storage.
