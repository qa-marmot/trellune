# Contributing to Trellune

Thank you for helping make a local-first learning product more useful. Small,
well-scoped contributions are welcome. Start with
[your first contribution](docs/FIRST_CONTRIBUTION.md) if this is your first
open-source pull request.

## I want to…

| Goal                                  | Good starting files                               | Helpful knowledge                     | Focused check                          | Difficulty   |
| ------------------------------------- | ------------------------------------------------- | ------------------------------------- | -------------------------------------- | ------------ |
| Improve documentation                 | `README*`, `docs/`, `docs/community/`             | Clear technical writing               | `pnpm docs:check-links`                | Starter      |
| Help with UI localization             | `src/i18n/`, `docs/LOCALIZATION.md`               | Natural target-language UI copy       | `pnpm i18n:check`                      | Starter      |
| Verify Claude or Gemini               | `docs/provider-acceptance/`, relevant Issue       | The provider’s normal UI              | Follow the acceptance checklist        | Starter      |
| Test Safari, iPhone, or accessibility | `e2e/`, Issue templates, acceptance docs          | A real device or assistive technology | Record reproducible evidence           | Starter      |
| Review curriculum quality             | `src/data/`, `docs/CURRICULUM.md`                 | English-learning or CEFR experience   | Focused curriculum tests and QA notes  | Intermediate |
| Change application code               | `src/`, nearby tests                              | TypeScript, React, strict validation  | `pnpm check:quick` plus affected tests | Intermediate |
| Work on sync, storage, or security    | `src/sync/`, `src/storage/`, `src/worker/`, `db/` | CAS, migrations, privacy boundaries   | Maintainer-aligned release checks      | Advanced     |

UI localization changes the product interface only. It does **not** mean
translating the Japanese-first curriculum, prompt contracts, or stored learner
values. Provider verification is manual and must never add provider automation,
credentials, or an AI API.

## A safe default workflow

1. Pick a clear Issue or a small documentation task. Questions and broad ideas
   belong in [GitHub Discussions](https://github.com/qa-marmot/trellune/discussions).
2. Fork and clone the repository, then create a descriptive topic branch.
3. Make one focused change; do not mix unrelated refactors.
4. Run the focused check in the table, then `pnpm check:quick` for application
   changes.
5. Open a pull request with learner impact, compatibility, tests, and synthetic
   screenshots or curriculum QA when relevant.

Documentation-only changes do not require the D1, PWA-update, or full browser
release gate. A maintainer will request wider validation when a change touches
runtime behavior, persistence, sync, or a release boundary.

## Non-negotiable safety boundaries

- Never commit learner data, pasted content, audio, exports, local databases,
  access tokens, `.dev.vars`, or `wrangler.local.jsonc`.
- Keep conversation-AI integration manual copy/paste only. Do not add any AI
  API, browser automation, stored audio, or provider-specific core contract.
- Core learning and optional Boost are distinct. Boost never completes a future
  Core day.
- Stable lesson IDs and Day 1–365 curriculum content are compatibility data.
- `SESSION_JSON` 1.0, `ASSESSMENT_JSON` 1.0, backup v2, sync v1, and Dexie v5
  need a documented compatibility decision before change.

For application code, read the nearby tests and the relevant architecture
section. Read [`AGENTS.md`](AGENTS.md), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md),
and [`docs/SECURITY.md`](docs/SECURITY.md) before working on a sensitive
boundary—not before making a typo fix in documentation.

## Curriculum contributions

Do not mass-generate lessons. Preserve continuity, acquisition limits (8 words,
3 phrases, 1 preview grammar topic), natural English, skill progression, task
variety, and assessment semantics. Add focused curriculum QA and tests for any
edited range.

## Pull requests

Use the short PR template. Explain the learner-facing effect, compatibility
impact, test evidence, and any manual acceptance still needed. Include only
synthetic/public-safe screenshots.
