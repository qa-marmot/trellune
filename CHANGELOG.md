# Changelog

All notable changes are recorded here. Trellune follows semantic versioning
when a release is made.

## v1.8.1 — Reliable installed-PWA updates

- Added a consent-safe in-app update check that uses only the standard
  service-worker update lifecycle
- Made update-check completion and failures visible with redacted, safe status
  text; no cache, IndexedDB, or learner data is cleared
- Added a realistic legacy-installed-shell regression: close/reopen, waiting
  worker detection, explicit consent, data preservation, and offline reopen

## v1.8.0 — Japanese and English UI

- Added a lightweight, type-safe Japanese/English UI locale layer
- Added browser-language detection for fresh installs and Japanese-compatible
  fallback for pre-i18n learners
- Kept locale preference device-only, without a schema, sync, backup, or JSON
  contract change
- Added localized navigation, onboarding, learning, import, assessment, backup,
  sync, and offline surfaces plus locale-aware document metadata
- Documented the Japanese-first curriculum support boundary and locale
  contribution workflow

## v1.7.0 — Initial public OSS release

- Provider-neutral manual conversation-AI contract and capability presets
- Generic UI wording for prompts and validated JSON import
- English-first OSS onboarding, local setup, contribution, and security docs
- Private remote-Wrangler configuration split from the tracked local config
- MIT license, clean public snapshot tooling, synthetic local-only demo, public
  launch documentation, and mobile WebKit regression coverage

## v1.6.1

- Preserved completed Core evidence during partial daily-progress sync hydration
- Made foreground manual sync results explicit and persisted observable status

## v1.6.0

- Added learning-mastery feedback, retry, retrieval, Reading/Writing, and
  integrated graduation evidence improvements without changing stable data
  contracts
