# Offline synchronization

## Ownership

IndexedDB is the UI working store and outbox. D1 is the authenticated recovery and cross-device store. The client may read and study without a network connection. Server-only invariants—duplicate import keys and cumulative daily acquisition limits—remain authoritative.

## Outbox flow

1. Validate external input with the shared Zod contract before creating any domain command.
2. In one local Dexie transaction, apply the optimistic local change and append an outbox entry with a globally unique `clientMutationId` or import `idempotencyKey`.
3. When online, send entries in creation order. Do not remove an entry until the server acknowledges it.
4. Retry timeouts and `5xx` with the same identifier and payload. Never generate a new identifier for a retry.
5. On `409`, retain the local entry and show reconciliation data. On `422`, retain the original pasted text and structured draft; let the learner remove/defer excess acquisitions. Do not silently truncate.
6. After push acknowledgement, pull `/sync/changes` from the saved cursor until `hasMore` is false. Apply each page and cursor in one Dexie transaction.

## Merge rules

| Data           | Rule                                                                                                                                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Session import | Immutable after acceptance. Exact key replay is idempotent; partial key collision is a conflict. A tombstoned session is restored only against its current version, and parent/child versions remain monotonic. |
| Daily progress | Exact optimistic CAS. Restore allocates above physical, mirror/tombstone, payload and history maxima; clients cannot write `coreCompleted` or `coreVoiceImported`.                                              |
| Acquisitions   | Server accepts or rejects the full atomic import. No partial daily-limit merge.                                                                                                                                 |
| `previewed`    | Preserve across synchronization. It changes only through an explicit later activation workflow, never because the related future date arrived.                                                                  |
| Change feed    | Server sequence orders accepted server changes; it does not replace per-record optimistic versions.                                                                                                             |

Core state is monotonic for accepted evidence within a day: a later Boost import cannot clear or set Core evidence. A Boost JSON's `curriculumDay` is context only; it never advances or satisfies that Core day.

## First sync and reset

A new device starts with cursor 0 and pulls pages. Confirmed device deletion clears local learner data and outbox records, never emits a D1 deletion mutation, and stores a local marker that prevents automatic remote rehydration until onboarding explicitly creates a new local profile. Push acknowledgements, pull batches and the Today read model recheck the marker inside their local transaction, so a response that was already in flight cannot repopulate the device after deletion. It does not delete synchronized D1 data; that requires a separate identity-checked production operation and explicit human approval. If a cursor is lost during normal synchronization, repeat from zero and upsert by stable entity ID. Change application must be idempotent.

Bootstrap also returns server `activeTotalDays`. The browser compares it with bundle availability 365 and supported maximum 540 before applying entities, then stores the last compatible value in existing metadata. Offline startup reuses that value and falls back to availability 365 only when no server value has ever been stored. A newer server curriculum than the installed bundle fails closed through the existing startup error UI; no partial hydration, outbox rewrite or protocol-version change occurs.

After a confirmed backup restore, stale cursor/version/outbox state is discarded and a durable reconciliation marker records the restored entity-key inventory. Before reseeding, synchronization obtains the authoritative remote bootstrap inventory and versions. Restored entities are pushed against those versions; daily progress also carries its validated backup version as a separate source floor. The Worker keeps `expectedVersion` as the exact predecessor, allocates the accepted version above every authoritative physical/mirror/tombstone/payload/history observation for that learner and date, and atomically applies the same version to the physical row, sync mirror, payload and change feed. Any remote entity absent from the restored/current inventory is queued as a deletion with its remote version. A successful local upsert created after that fixed inventory is added to the marker under its true remote identity (including review-event IDs), so its own pull cannot be mistaken for remote-only data. Server tombstones remove matching physical domain rows, tombstone dependent mirrors/change-feed entries, preserve later-session mistake aggregates and recompute Core progress when the last Core session is removed. The marker remains through all pushes and every paginated pull, converts remote extras encountered later into tombstones, and clears only after the final page with no pending outbox item or open conflict. An interrupted cycle resumes from durable state rather than declaring the restore reconciled.

Backup remains envelope version 2.0. Day-bearing fields have structural capacity through Day 540, but preview and confirmed apply both recheck the effective ACTIVE before any table clear/write. ACTIVE is deployment configuration and is not embedded in the backup. A backup containing a Day above the installed bundle or effective ACTIVE is rejected non-destructively.

Stage Assessment uses the existing `assessment` sync entity under protocol version 1. A local attempt and its outbox record commit together, and the Worker stores its physical row, mirror, change and processed-mutation acknowledgement in the existing CAS-guarded batch. Backup v2 accepts the additive `stage` record variant; older v2 backups remain valid. Restore and remote hydration validate the Stage curriculum range against effective ACTIVE before changing local records.

## Time and connectivity edge cases

- Study date is captured in the learner timezone at activity time and sent explicitly.
- A retry after midnight keeps the original study date and therefore the original day's limits.
- Network status is only a hint. A successful fetch is the connectivity proof.
- Multiple tabs coordinate one outbox leader (for example with Web Locks) and still rely on server idempotency.
- Service-worker upgrades must finish existing IndexedDB migrations before draining the outbox.

## Privacy

The original pasted text may remain in a local draft so invalid input is not lost, but is not sent to D1. The API receives only validated structured JSON plus a SHA-256 hash used for duplicate prevention. Never place pasted learner data, IndexedDB exports, or local D1 files in Git.

