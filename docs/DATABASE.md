# Database

## Migration policy

The current forward-only chain ends at `0013_language_neutral_session_support.sql`. Migration 0013 additively backfills neutral support-language columns while retaining the legacy `*_ja` columns and values for SESSION_JSON 1.0 and rollback readers. It does not change sync v1, backup v2, or Dexie v5.

`migrations/0001_initial.sql` is the first forward-only D1 migration. The current local candidate continues through `0012_activate_b2_challenge_curriculum.sql`. Every schema change uses the next zero-padded number, preserves readable existing rows and includes an application compatibility path. Destructive production migration or any remote migration requires explicit human approval. SQL issued by application code uses complete fixed statements, `?` placeholders and `.bind(...)`; identifier arrays use a bound JSON value with `json_each`, and table variants are selected from closed allowlists rather than concatenated.

## Model

| Table                     | Purpose and important constraints                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `learners`                | Pseudonymous learner keyed by a SHA-256-derived subject. Raw email is not stored.                                  |
| `curriculum_days`         | Curriculum metadata with structural Day 1–540 capacity; migrations `0010`–`0012` add Day 91–365 rows.              |
| `curriculum_catalog`      | Singleton curriculum ID/content version and server-authoritative `active_total_days` (`365` after `0012`).         |
| `daily_progress`          | Per-date Core flags and optimistic `version`; a check prevents false Core completion.                              |
| `session_imports`         | Validated Core/Boost imports and 1–5 evaluation scores; unique learner/session, idempotency, and source-hash keys. |
| `vocabulary`, `phrases`   | Acquisitions with normalized lookup text and `new`, `previewed`, `active`, or `mastered` state.                    |
| `grammar_previews`        | Boost preview topics; database state is always `previewed`.                                                        |
| `mistakes`                | Validated correction records used for weakness detection and review-card generation.                               |
| `review_cards`            | Scheduling state and front/back text; source is vocabulary, phrase, mistake, or a session-generated card.          |
| `reviewed_cards`          | Imported session-to-card acknowledgements.                                                                         |
| `processed_mutations`     | Mutation responses for offline retry idempotency.                                                                  |
| `change_log`              | Ordered per-learner synchronization feed.                                                                          |
| `sync_entities`           | Versioned normalized remote read model with upsert/delete operations and stable mutation identity.                 |
| `acquisition_identities`  | Canonical NFKC/case/space identity claims shared by vocabulary, phrase and grammar-preview inserts.                |
| `review_events`           | Immutable Again/Hard/Good/Easy scheduling history, including before/after state and algorithm version.             |
| `assessments`             | Versioned baseline, weekly and Stage Assessment results; stage rows use attempt ID as entity identity.             |
| `learner_data_migrations` | Per-learner data-backfill markers used for backward-compatible calendar initialization.                            |

The daily acquisition triggers count all items acquired on the date, including Boost items marked `previewed`. Canonical acquisition identity uses NFKC normalization, trim, English lowercase and whitespace folding. The triggers atomically claim that identity and abort the containing D1 batch with stable error names above 8 words, 3 phrases and 1 grammar preview. `boost_cannot_complete_core` protects updates, while `daily_progress_insert_guard` makes direct inserts derive `core_completed` from all three Core proofs and requires a matching Core session before `core_voice_imported` can be inserted.

## Dates and time

`study_date` and `due_date` are ISO local dates (`YYYY-MM-DD`) interpreted in the learner timezone. Instants use offset-bearing ISO 8601 text. The current default is `Asia/Tokyo`. The client decides the intended study date before upload; the server does not silently move an event across midnight.

## Seed data

`db/seed.sql` contains one synthetic local learner and 90 deterministic curriculum rows. Apply it only to local D1 after migrations. `db/remote-seed.sql` contains only the same 90 curriculum rows and is safe to apply idempotently to an approved remote environment after its migrations. Neither file contains pasted learner data, secrets, audio, or production identifiers. Local SQLite/D1 artifacts remain ignored by Git.

## Backup and retention

D1 is a sync/recovery store, not the only active copy. The browser's normalized IndexedDB schema version 5 is the local source of truth. Backup envelope 2.0 includes its schema/application metadata, normalized records, a SHA-256 integrity hash and explicit deletion tombstones. Restore validates size, strict JSON shape, semantics, references and integrity before preview and one atomic confirmed apply. Legacy backup 1.0 is converted through a validated compatibility path. Pasted raw text is intentionally not persisted in IndexedDB or D1; only validated structured results and trusted hashes are stored.

Migrations `0002`–`0012` are covered by fresh-database and old-`0001` local upgrade tests. Migration `0008` rebuilds only `curriculum_days` under deferred foreign-key enforcement, copies every existing value, widens its check to Day 540 and adds the ACTIVE=90 catalog singleton. Migration `0009` rebuilds only `assessments`, preserves baseline and weekly values, adds the `stage` discriminator, and recreates the existing assessment mutation guard. Migration `0010` activates deterministic Day 91–180 metadata and ACTIVE=180. Migration `0011` activates deterministic Day 181–270 metadata and ACTIVE=270. Migration `0012` accepts only `fluency-270-v1`/ACTIVE=270, inserts deterministic Day 271–365 metadata, checks continuity and FK integrity, then sets content version `b2-challenge-365-v1` and ACTIVE=365. It does not rewrite Day 1–270 or learner data and does not change CAS, triggers, sync, backup, or Dexie schemas. Deploy the AVAILABLE=365 application before applying `0012`; remote application remains a separately approved release action.
