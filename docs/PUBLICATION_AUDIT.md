# Publication audit

Scope: the tracked current tree only. Git history is intentionally out of scope
for automatic modification and remains a maintainer decision.

## Findings and disposition

| Path / area                                          | Finding                                                                                       | Classification                      | Public risk | Disposition                                                                |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------- | ----------- | -------------------------------------------------------------------------- |
| Historical release, remediation and UI-audit records | Environment-specific acceptance evidence and operational history were not needed for OSS use. | private-environment                 | Medium      | Removed from the current public tree; private history is unchanged.        |
| Historical visual-review assets                      | Screenshots were operational evidence rather than public documentation.                       | personal-data / private-environment | Medium      | Removed from the current public tree.                                      |
| Tracked Worker configuration                         | Local-only binding with a local database name; no real remote configuration.                  | safe-public                         | Low         | Retained with an explicit legacy-identifier note.                          |
| `wrangler.local.jsonc` and `.dev.vars`               | May contain deployer-controlled remote values.                                                | secret / private-environment        | High        | Ignored; the checked-in examples use placeholders only.                    |
| IndexedDB, localStorage, D1 and sync identifiers     | Historical names are required for compatibility.                                              | historical compatibility reference  | Low         | Retained and documented in [LEGACY_IDENTIFIERS.md](LEGACY_IDENTIFIERS.md). |
| External AI/provider integration                     | Static manual presets only; no API key, direct provider request or browser automation.        | safe-public                         | Low         | Retained and tested.                                                       |
| Local databases, backups, learner exports and audio  | Must never be tracked.                                                                        | personal-data                       | High        | Ignored and checked by `pnpm public:check`.                                |

## Automated current-tree checks

`pnpm public:check` rejects tracked local configuration, credential-like material,
literal remote D1 UUIDs, database/backup artefacts and public-brand drift. When
an ignored local configuration is present, it also checks that its route, Access
domain and remote identifiers have not been copied into a tracked text file.

`pnpm docs:check-links` verifies all public-candidate relative Markdown links without
performing network requests.

## Remaining history risk

The private history may contain historical operational identifiers and author
metadata. It was not rewritten. Before public visibility, a maintainer must
approve either a sanitized clean public snapshot or a separately reviewed
history-redaction strategy. This is the remaining public-exposure decision, not
a current-tree engineering defect.
