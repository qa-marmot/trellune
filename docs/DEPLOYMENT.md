# Self-hosted deployment boundary

Trellune is fully usable in local-first mode. A remote Cloudflare Worker and D1
deployment is optional and must be owned and operated by the deployer.

## Separate environments

Keep local, development and production resources separate: Worker name, route,
D1 database, Access application and Access audience must never be shared. Put
real remote settings in the ignored `wrangler.local.jsonc`, copied from
`wrangler.local.example.jsonc`. Do not put remote IDs, hostnames or Access values
in the tracked `wrangler.jsonc`.

## Required safety checks

Before any remote migration or deploy:

1. Confirm the target environment, exact commit and database resource.
2. Run the complete local quality gate and review numbered migrations.
3. Take an operator-approved backup or recovery reference.
4. Verify the deployment uses only resources controlled by the deployer.
5. Keep Cloudflare Access protecting any personal deployment; do not use it as a
   public demo.

The deploy scripts upload Vite's generated Worker (`dist/english_os/index.js`)
and client assets (`dist/client`), not the source entry point. They also retain
remote variables so an operator-owned Access configuration is never removed as
a side effect of a runtime upgrade.

## Operational boundaries

- Never reset or recreate a remote learner database as a deployment shortcut.
- Apply migrations in order and confirm foreign-key integrity before deploy.
- Use forward-compatible fixes rather than destructive down migrations.
- Verify app startup, sync, backup/export and learner-data preservation after a
  deployment.
- Do not use a personal Worker, D1 database, route or Access policy for an OSS
  demo. Follow [PUBLIC_DEMO.md](PUBLIC_DEMO.md) for the intended demo boundary.

These actions intentionally require an operator's explicit approval and are not
part of the public launch candidate.
