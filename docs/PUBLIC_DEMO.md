# Public demo specification

Do not point a public demo at a personal deployment, Access policy, D1 database,
or learner account.

## Implemented boundary

- `VITE_DEMO_MODE=true` selects an isolated `trellune-demo` IndexedDB database
  and a distinct legacy-storage key/BroadcastChannel. The normal `english-os`
  identifiers are unchanged.
- The demo creates only a resettable synthetic Day 1 learner and can open an
  authored Day 6 Reading/Writing sample without changing that learner's progress.
- Sync is disabled before first render and the demo never requests the health,
  bootstrap, or D1 sync routes.
- It has no production D1, Cloudflare Access configuration, hostname, secrets,
  analytics identity, learner audio, learner paste, backup, session, or profile.

## Minimal demo journey

1. Start a synthetic Day 1 learner.
2. Complete a sample Grammar and productive practice task.
3. Open one sample Reading/Writing Lab.
4. Copy a conversation request; no provider browser automation is involved.
5. Preview a fixture `SESSION_JSON` import with strict validation.
6. Reset the synthetic local state.

## Run or build

```bash
pnpm dev:demo
pnpm build:demo
```

The separate `trellune-demo` Cloudflare Pages deployment publishes only the
static `dist/client` output. It has no Worker or D1 binding. The banner labels
the boundary and exposes reset plus the Reading/Writing sample; the Import route
can load a synthetic `SESSION_JSON` fixture for strict preview/import testing.
