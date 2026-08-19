# Handoff for contributors and coding agents

## Product boundary

Trellune is a local-first 365-day language-learning PWA. Its conversation-AI
bridge is manual copy/paste only. Do not add OpenAI, Anthropic, Google, Workers
AI, or any other direct AI API; do not automate provider websites.

## Stable contracts

- Keep required Core separate from optional Boost.
- Preserve Day 1–365 stable curriculum IDs and content unless an explicitly
  scoped, tested editorial change requires otherwise.
- Keep `SESSION_JSON` 1.0, `ASSESSMENT_JSON` 1.0, backup v2, sync protocol v1,
  and Dexie v5 compatible.
- Do not alter CAS, monotonic version allocation, tombstone precedence,
  mutation idempotency, or Core evidence semantics without a focused regression
  matrix and compatibility rationale.
- Validate every external boundary with strict Zod before domain/persistence code.

## Architecture landmarks

- `src/agents/contract.ts`: provider-neutral conversation request and static
  capability metadata. ChatGPT is manually verified; Claude, Gemini and Generic
  presets remain unverified unless acceptance evidence changes that fact.
- `src/storage/` and `src/sync/`: local-first state, backup and protocol v1.
- `src/worker/`: optional self-hosted Worker/D1 boundary.
- `docs/LEGACY_IDENTIFIERS.md`: identifiers intentionally preserved across the
  public rebrand.

## Safe contribution workflow

1. Start with `git status --short --branch` and read the directly relevant code,
   contract and tests.
2. Add or adjust focused tests before behavioural changes.
3. Run focused tests while working; use the full gate once before a PR.
4. Use a focused branch and PR. Do not force-push or push directly to `main`.
5. Never commit learner data, audio, local databases, `.dev.vars`, backups, or
   `wrangler.local.jsonc`.

Production operations, migration application, Access/DNS changes and repository
visibility changes require explicit human approval.
