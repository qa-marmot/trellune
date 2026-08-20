# Security

## Trust boundaries

All browser, clipboard, URL, backup, and conversation-AI JSON input is untrusted. The UI and Worker validate with strict Zod schemas. Validation failures are displayed and retained as drafts; the application does not repair or infer missing values. D1 receives parsed schema output only.

Conversation-AI integration is manual copy/paste. Trellune has no OpenAI API, Realtime API, Agents SDK, Workers AI, other AI API, automated posting, browser automation, or stored audio.

## Authentication and exposure

Remote `/api/v1/*` routes must be protected by a Cloudflare Access application before deployment. The Worker verifies the assertion with the configured team-domain JWKS, pins RS256, and checks issuer, audience, expiry, not-before and a non-empty subject before storing only a SHA-256-derived pseudonymous identity. A per-isolate application cache is bounded to 128 KiB/32 unique RSA keys and a maximum one-hour TTL, honors shorter cache headers and deduplicates concurrent fetches. An unknown `kid` forces one refresh for rotation; expired, unavailable, malformed, duplicate-key or oversized JWKS data fails closed and authentication failures are not negatively cached.

Deployment requirements:

- protect both development and production hostnames with explicit allow policies;
- disable the public `workers.dev` route and previews unless separately protected;
- `ALLOW_LOCAL_AUTH=true` is accepted only for loopback (`localhost`, `127.0.0.1`, or `::1`) requests; never set it in a remote environment;
- restrict Access and DNS changes to explicit human-approved actions;
- test unauthenticated `401` and authorized access before declaring a release gate complete.

If an unprotected direct Worker route exists, release is blocked (P0) even though the Worker also verifies Access assertions in depth.

## Data protection

- Do not commit secrets, learner exports, pasted text, audio, or local D1/IndexedDB files.
- Do not log payloads, email, Access assertions, corrections, or learner content. Unexpected errors log only a generic message.
- D1 stores validated learning records and a source hash, not the original paste.
- Use HTTPS-only Cloudflare hostnames. Security headers are applied by Hono.
- Backups require explicit user action, schema validation, checksum verification, and clear destination handling.

## Injection and integrity

All application SQL is fixed text with bound `?` parameters. Identifier arrays are bound as JSON and read with `json_each`; closed table variants select complete reviewed statements, never learner-provided identifiers or SQL fragments. D1 constraints, unique indexes, and triggers enforce import kind, Core evidence, `previewed` grammar, and daily limits even if clients are modified. Session imports use three duplicate keys and D1 batches to prevent partial persistence.

The API limits JSON to 1 MB, caps all arrays/text through Zod, rejects unknown fields, and returns sanitized errors. The UI must render learner content as text; do not inject pasted HTML.

## Operational controls

No production deploy, remote D1 creation/migration, Access/DNS change, production data mutation, GitHub remote creation, or push occurs without explicit approval. Production backups precede approved migrations. Rollback favors code rollback and forward-compatible migrations; never destroy production D1 to recover.

## Security verification checklist

- No AI/API credentials or AI SDK dependencies.
- Unauthenticated API requests fail; health reveals no private state.
- Invalid/oversized/unknown JSON is rejected before persistence.
- SQL parameters are bound and migrations are numbered.
- Duplicate replay is idempotent; collision is `409`.
- Database triggers reject the ninth word, fourth phrase, and second preview grammar item.
- Boost cannot set Core Voice or complete a future Core day.
- Logs, repository, generated assets, and backups contain no forbidden learner data.
