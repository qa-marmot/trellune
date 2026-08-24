# Backlog

Status date: 2026-08-20. The post-v1.8 reliability review found no open P0 or
P1 in the public source tree. Evidence and scope are recorded in
[`docs/POST_V18_RELIABILITY_AUDIT.md`](docs/POST_V18_RELIABILITY_AUDIT.md).

## Deferred product work

These are product choices, not release blockers. They need a concrete learner
need and acceptance criteria before implementation.

- Editable timezone/display preferences, local-notification policy, and a
  privacy-preserving diagnostics export.
- Measured pagination or virtualization only if a real device measurement shows
  that the current Unit disclosure is insufficient for a long library/history.
- A product decision on additional self-assessment workflows beyond the
  existing stage assessments.

## Manual-only verification

The public test suite cannot replace these checks. Do not record learner data,
tokens, or pasted conversation content as evidence.

- Current third-party conversation-AI UI and copy/paste behavior.
- Physical iOS and Android install/update/offline behavior.
- NVDA or VoiceOver screen-reader walkthrough, manual contrast, and low-tier
  device Web Vitals.
- Approved authenticated deployment and recovery drill when a maintainer
  authorizes a production release.

## Completed through v1.8 / post-v1.8 review

- Versioned releases replaced the historical `0.0.0` placeholder.
- Core workload is computed from the current state and visible in Today.
- Current-unit disclosure limits the 365-day curriculum journey without hiding
  any lessons.
- Equal-due SRS ordering is deterministic: due time, lapses, source type, then
  card ID. Replay ordering uses timestamp then event ID.
- Public-tree scanning, local-auth loopback hardening, i18n checks, public demo
  coverage, and contributor documentation are maintained by automated checks.
- Day 1–365 learner support, practice feedback, vocabulary/phrase glosses, and
  conversation prompts resolve completely in Japanese or English without
  changing stable curriculum IDs or learner state.
