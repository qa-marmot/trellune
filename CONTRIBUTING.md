# Contributing to Trellune

Thanks for helping improve a local-first learning product. Contributions should
make the learner experience, curriculum quality, accessibility, reliability, or
maintainability demonstrably better.

## Before you start

1. Read [`AGENTS.md`](AGENTS.md), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md),
   and [`docs/SECURITY.md`](docs/SECURITY.md).
2. Use a `codex/`-prefixed or descriptive topic branch; do not push directly to
   `main`.
3. Never commit learner data, pasted content, audio, exports, local databases,
   access tokens, `.dev.vars`, or `wrangler.local.jsonc`.

## Product invariants

- Core learning and optional Boost are distinct. Boost never completes a future
  Core day.
- Stable lesson IDs and Day 1–365 curriculum content are compatibility data.
- `SESSION_JSON` 1.0, `ASSESSMENT_JSON` 1.0, backup v2, sync v1, and Dexie v5
  must not change without a documented compatibility decision.
- All external input is strict-Zod validated before persistence; SQL uses bound
  parameters; migrations are numbered and backward compatible.
- Conversation-AI integration is manual copy/paste only. Do not add any AI API,
  browser automation, stored audio, or provider-specific core-domain contract.

## Curriculum contributions

Do not mass-generate lessons. Preserve continuity, acquisition limits (8 words,
3 phrases, 1 preview grammar topic), natural English, skill progression, task
variety, and assessment semantics. Add focused curriculum QA and tests for any
edited range.

## Verification

Run focused tests while developing. Before requesting review, run the relevant
release gate:

```bash
pnpm prompts:check
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm audit --prod
pnpm test:d1:local
pnpm test:pwa:update
pnpm playwright test
```

Explain learner-facing behavior, compatibility impact, test evidence, and any
manual acceptance still needed in the pull request.
