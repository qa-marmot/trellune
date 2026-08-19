# Reproducible setup — Windows 11

This procedure rebuilds and verifies Trellune on a different Windows 11 PC. Run PowerShell 7 as a normal user unless the installer explicitly requests elevation.

## 1. Install exact prerequisites

1. Install Git for Windows 2.52 or newer from `https://git-scm.com/download/win`. Keep “Git from the command line and also from 3rd-party software”. Verify with `git --version`.
2. Install Node.js 22 LTS from `https://nodejs.org/`. Verify `node --version` prints `v22.x` and `npm --version` succeeds.
3. Corepack ships with this Node line. Verify `corepack --version`. If the command is absent, reinstall Node from the official MSI; do not install an unrelated pnpm executable.
4. Enable the repository-declared pnpm version:

   ```powershell
   corepack enable pnpm
   corepack prepare pnpm@11.20.0 --activate
   pnpm --version
   ```

   Expected pnpm output: `11.20.0`. If an older `%APPDATA%\npm\pnpm.ps1` wins, run `corepack enable pnpm --install-directory "$env:APPDATA\npm"`, open a new PowerShell, and verify again.

5. Install GitHub CLI only if preparing a remote: `winget install --id GitHub.cli`. GitHub authentication is not required for local development.

## 2. Obtain the repository

After the owner creates the approved private remote, clone it into a new directory:

```powershell
Set-Location "$env:USERPROFILE\Documents"
git clone https://github.com/qa-marmot/trellune.git
Set-Location .\trellune
```

Until the repository rename is approved, replace the URL with the private clone URL supplied by the maintainer. Confirm `Get-Location` ends in `trellune` and `Test-Path .\package.json` is `True`.

For an archive instead of Git, extract it once so `package.json` is directly inside `trellune`; do not create `trellune\trellune`.

## 3. Check the pnpm boundary

`pnpm-workspace.yaml` must contain `packages: ['.']` in YAML form. Run:

```powershell
Get-Content .\pnpm-workspace.yaml
pnpm --version
pnpm install --frozen-lockfile
```

The install must finish with no peer-dependency errors. If `ERROR packages field missing or empty` appears, confirm PowerShell is in this repository and that the project-local `pnpm-workspace.yaml` was not removed. Do not edit a parent directory's workspace file.

## 4. Create the local D1 database

The checked-in `wrangler.jsonc` binds `DB` to the local name `english-os-local`. No Cloudflare login is required for `--local` commands. Remote environments use the ignored `wrangler.local.jsonc` copied from `wrangler.local.example.jsonc`; never commit it.

```powershell
pnpm db:migrate:local
pnpm db:seed:local
pnpm exec wrangler d1 execute english-os-local --local --command "SELECT COUNT(*) AS count FROM curriculum_days;"
```

Expected: migrations succeed, seed succeeds, and the query returns a numeric `count`. If Wrangler reports that the database is not found, confirm the `d1_databases` entry uses binding `DB` and database name `english-os-local`.

## 5. Start and verify locally

```powershell
pnpm dev
```

Open the exact URL printed by Vite, normally `http://localhost:5173`. Complete onboarding, open Day 1, answer the grammar item with `am`, generate a Core Voice prompt, and preview the sample JSON on the import screen. Press `Ctrl+C` once to stop the server.

## 6. Run the complete quality gate

Install the browser once:

```powershell
pnpm exec playwright install chromium
```

Then run:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm playwright test
```

Every command must exit with code 0. Playwright starts and stops its own local server. A failed accessibility assertion is a release blocker, not a snapshot to update blindly.

## 7. Local data locations and reset

- Browser study data: Chromium DevTools → Application → IndexedDB → `english-os`.
- Wrangler local D1: `.wrangler/state/` inside this repository; Git ignores it.
- Build output: `dist/`; Git ignores it.

To reset only browser data, use Settings → browser site data → delete data for the local origin. To reset local D1 during development, remove only this repository's `.wrangler/state` after confirming no needed local study data exists, then rerun migrations and seed. Never apply this reset to a remote database.

## 8. Environment variables

Local learning works with no secrets. Access verification for an approved deployment uses `.dev.vars` locally and encrypted Worker secrets remotely:

```text
ACCESS_TEAM_DOMAIN=example.cloudflareaccess.com
ACCESS_AUD=32-character-or-longer-application-audience-tag
```

Do not commit `.dev.vars`. The values come from Cloudflare Zero Trust → Access → Applications → the approved Trellune application. If they are absent, local requests are treated according to the documented development boundary; production must fail closed.
