# Legacy technical identifiers

Trellune is the public product name. The following identifiers deliberately keep
their historical `english-os` value because changing them as a rebrand would
create an unintended data or protocol migration.

| Identifier family                                    | Reason to preserve                                                          | Boundary                                                            |
| ---------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| IndexedDB database and BroadcastChannel names        | Existing browser learner data and cross-tab coordination depend on them.    | `src/storage/db.ts`, `src/sync/service.ts`, `src/storage/backup.ts` |
| Legacy localStorage key                              | Old local data must remain discoverable for safe migration/recovery.        | `src/storage/db.ts`                                                 |
| Curriculum, stage, unit and assessment IDs           | Stable curriculum and persisted assessment references must not change.      | `src/curriculum/`, `src/domain/assessment.ts`                       |
| Local D1 database and Worker development identifiers | Local migration commands and existing development tooling use these values. | `wrangler.jsonc`, package scripts, local tests                      |
| Sync header/channel/service identifiers              | Existing clients and Worker contracts rely on protocol v1 names.            | `src/sync/`, `src/worker/`                                          |

These values are not public branding. Do not rename them without an explicit,
versioned compatibility and learner-data migration plan.
