# Post-v1.8 reliability and governance audit

Audit date: 2026-08-20
Scope: public `main` after the security/privacy and OSS discovery stages. This
document records source and local-test evidence only; it does not authorize a
production action.

## Result

| Area                       | Result                                           | Evidence                                                                                                                                                                                                                       |
| -------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P0/P1 rescan               | No open public-source P0/P1                      | Strict Zod boundaries, bound D1 statements, public-tree scan, and existing recovery tests reviewed.                                                                                                                            |
| Dependency security        | Fixed                                            | The `miniflare`-only `undici` override is pinned to patched 7.29.0. It does not downgrade jsdom's separate 8.x dependency.                                                                                                     |
| Sync and Core monotonicity | Covered                                          | Sync service tests cover restore floors, tombstones, replay, partial pulls, conflicts, and preservation of completed Core evidence.                                                                                            |
| Backup boundary            | Covered                                          | Backup v2 tests cover repeated attempts, invalid duplicate completed progress, Day 365 round trip, Day 366 rejection, and atomic ACTIVE recheck.                                                                               |
| SRS ordering               | Deterministic                                    | Due batches order by due time, lapses, source type, then ID; reconstruction ties use event ID.                                                                                                                                 |
| Long-history performance   | Measured, not budget-gated                       | Playwright records 1/7/30/90/365-day hydration timing and DOM/heap metrics without an unapproved machine-dependent threshold.                                                                                                  |
| Accessibility and reflow   | Covered in JA and risk-based EN routes           | Axe blocks serious/critical findings; keyboard, 305-1280px reflow, and 200/400% text zoom are exercised.                                                                                                                       |
| Repository governance      | Appropriate for a public solo-maintainer project | Protected `main` requires the six release checks and one review; secret scanning, push protection, and Dependabot security updates are enabled. No CODEOWNERS rule was added because it would not add an independent reviewer. |

## Reliability matrix

The existing regression suite covers local writes, repeated sends, response
loss, interrupted pull/reconciliation, stale conflicts, idempotency keys,
out-of-order review reconstruction, restore tombstones, and remote partial
daily-progress records. The worker/D1 verifier exercises transactions, write
guards, foreign keys, migrations, and replay rejection. This review did not
change the CAS, version, tombstone, sync-protocol, backup-v2, or Core/Boost
contracts.

## Backup and capacity boundaries

Backup imports are strict, previewed, checksum-verified, and atomically
applied. The retained normal/retry history model is lossless: two studies of a
curriculum day are valid when their study dates differ, while two completed
attempts for the same curriculum day are rejected rather than silently
deduplicated. The normal-history performance fixture now includes all 365
days. Very-large browser quota and low-tier device limits remain manual
performance evidence, not an excuse to loosen validation or discard data.

## Documentation and public hygiene

The audit removed the obsolete remediation link and historical release backlog
items. Public-tree checking rejects personal identifiers, personal local paths,
credentials, literal D1 identifiers, ignored local configuration copies, and
stale public branding. The handoff bundle and any local machine paths are not
repository artifacts.

## Follow-up classification

- **READY WITH MANUAL FOLLOW-UP**: public-source quality and release gates are
  ready after all automated checks pass. A deployment still requires explicit
  maintainer approval and the manual checks listed in `BACKLOG.md`.
- **Not in scope**: timezone product controls, local notification policy,
  diagnostics export, and performance virtualization without measured need.
- **No P0/P1 deferred**: a future high-severity production dependency,
  data-integrity fault, or broken release check reopens the gate immediately.
