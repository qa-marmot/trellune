# Qiita / Zenn article outline

## Working title

AI APIを使わず、普段使っている会話AIと連携する365日英語学習PWAをOSS化した

## Outline

1. The learner problem: chat is useful, but not a complete learning loop.
2. Product boundary: curriculum, SRS, feedback, retry, assessment, and history
   live in Trellune; conversation stays in the learner’s chosen provider.
3. Local-first PWA: IndexedDB, offline use, synthetic demo, and data boundaries.
4. The strict JSON bridge: manual copy/paste, `SESSION_JSON`, validation, and
   why no API key or provider automation is required.
5. Optional self-hosted sync: Cloudflare Worker/D1 as an opt-in deployment, not
   a public demo dependency.
6. Testing and OSS safety: public-tree checks, PWA update tests, D1 tests, and
   the contributor path.
7. Honest limitations: Japanese-first curriculum support, manual provider
   verification, physical-device evidence, and no CEFR certification claim.
8. Demo, source, and a focused request for feedback.

Avoid an advertisement-only article. Include concrete architecture decisions,
trade-offs, and reproducible commands.
