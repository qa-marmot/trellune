# OSS readiness

The private source repository remains private. Trellune is published only from a
separate clean public snapshot, so public contributors never receive private
operational history.

## Current-tree position

- The application and public documentation use the Trellune name.
- Current production-specific acceptance logs, worker identifiers, dashboard
  material and historical UI artifacts have been removed from the public tree.
- Tracked configuration is local-only. Real remote configuration belongs in an
  ignored `wrangler.local.jsonc`; `.dev.vars`, local databases, backups and
  learner exports are ignored.
- The public tree is checked in CI for tracked private-environment artefacts,
  credential-like files, database exports and accidental local configuration.
- The app remains provider-neutral and uses manual copy/paste only.

## Public-release boundary

The private Git history can contain historical operational information and author
metadata. It is neither rewritten nor exposed. `pnpm public:export` copies only
the current public-safe tracked tree into a new Git history and verifies the
public-tree and Markdown-link checks.

The project is MIT-licensed; see [LICENSE](../LICENSE) and
[LICENSE_DECISION.md](LICENSE_DECISION.md).

## Ongoing public checks

Follow [PUBLIC_RELEASE_CHECKLIST.md](PUBLIC_RELEASE_CHECKLIST.md). Do not use a
personal deployment or its learner data as a public demo.
