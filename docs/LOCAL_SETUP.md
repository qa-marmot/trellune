# Local setup

Trellune works locally without a Cloudflare account, remote database, or AI API
key. Browser learning data is stored in IndexedDB. Cloudflare D1 sync is an
optional advanced deployment path.

## Prerequisites

- Node.js 22
- Corepack-enabled pnpm (the repository pins the version)

## Run locally

```bash
git clone https://github.com/qa-marmot/trellune.git
cd trellune
corepack enable
pnpm install --frozen-lockfile
pnpm db:migrate:local
pnpm db:seed:local
pnpm dev
```

Until the repository rename is approved, use the private clone URL supplied by
the maintainer instead. Open the Vite URL, normally `http://localhost:5173`,
and complete onboarding to start Day 1.

## Local data and safe reset

- Browser learning data stays in IndexedDB for the local origin.
- Local Wrangler D1 state stays under `.wrangler/state/`.
- Neither location is committed.

For a local reset, remove only local browser site data and, if needed, this
repository's `.wrangler/state/`. Never apply that procedure to a remote database.

## Optional self-hosted sync

Copy `wrangler.local.example.jsonc` to `wrangler.local.jsonc` and replace every
placeholder with resources you control. The resulting file is ignored by Git.
Configure Access credentials in private `.dev.vars` or Worker secrets. Review
[deployment](DEPLOYMENT.md) before any remote operation.

## Verify a change

```bash
pnpm prompts:check
pnpm docs:check-links
pnpm public:check
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm audit --prod
pnpm test:d1:local
pnpm test:pwa:update
pnpm playwright test
```
