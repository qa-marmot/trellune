# Trellune public-release source report

## Product status

Trellune is a local-first, mobile-first 365-day language-learning PWA. It has a
CEFR-informed curriculum, required Core and optional Boost, SRS, Reading/Writing
Labs, feedback/retry, strict JSON import, backup v2 and optional self-hosted
sync. The client supports structural Day 540 expansion; Days 366–540 are not
active.

This source is prepared for a separate clean public snapshot. The private source
repository, production, Cloudflare configuration and learner data remain
deliberately untouched.

## Reliability and compatibility

The current architecture preserves completed Core evidence during partial
remote-progress hydration, exposes manual sync outcomes and retries safe sync
work after foreground resume. It retains `SESSION_JSON` 1.0,
`ASSESSMENT_JSON` 1.0, backup v2, sync v1, Dexie v5, CAS, monotonic versions,
tombstones and mutation idempotency.

## Learning and assessment position

The curriculum supports sustained A1-to-B1+ progress and a spoken B2-entry
challenge. Graduation evidence is an estimate, never certification. Day 365 and
an Assessment `pass` do not automatically award CEFR attainment.

## Public-release conclusion

The current tree is branded as Trellune and stripped of historical operational
evidence not needed by OSS users. The MIT license, clean-history export, isolated
synthetic demo, provider acceptance pack, and contributor materials make it
suitable for the separate public repository. See [OSS readiness](OSS_READINESS.md)
and [PUBLIC_RELEASE_CHECKLIST.md](PUBLIC_RELEASE_CHECKLIST.md).

## Final candidate evidence

The public-launch candidate was verified locally without touching production,
remote D1, Cloudflare Access, DNS, repository visibility, repository naming,
or private Git history.

| Check                              | Result                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| Prompt artifacts                   | Pass                                                                            |
| Public-tree safety scan            | Pass                                                                            |
| Relative Markdown links            | 62 files, pass                                                                  |
| Format, lint and strict TypeScript | Pass                                                                            |
| Vitest                             | 38 files / 285 tests, pass                                                      |
| Production dependency audit        | 0 known vulnerabilities                                                         |
| Local D1                           | Fresh migrations, API transactions, sync and legacy backfill pass               |
| PWA upgrade                        | Consented A→B update, IndexedDB preservation and curriculum compatibility pass  |
| Synthetic demo                     | Isolated persistence, fixture JSON preview/import, Reading/Writing sample reset |
| Playwright                         | 118 passed / 11 intentional skips, including three mobile WebKit checks         |

The public-tree safety scan rejects accidental local configuration, credential
patterns, database/backup artefacts, production values copied from ignored
local configuration, and stale public branding. The legacy identifiers that are
intentionally retained for learner-data compatibility are listed in
[LEGACY_IDENTIFIERS.md](LEGACY_IDENTIFIERS.md).
