# Public release checklist

This is the reproducible checklist for the separate public repository. It never
authorizes a private-production deploy, history rewrite, D1 migration, Access
change, DNS change, or learner-data action.

## Recommended public export strategy

Prefer a **sanitized clean snapshot in a new public repository** over rewriting
the private operational repository history. Keep the private repository as the
internal archive. This gives OSS contributors a clean history and reduces the
risk of exposing historical operations or identity metadata.

Recommended public target: `qa-marmot/trellune`.

If a history rewrite is considered instead, have a maintainer perform a complete
history, author-metadata, secret and asset review first. Rotate any
credential-like values before exposure.

## Launch steps

1. Run `pnpm public:check`, `pnpm docs:check-links`, and the release gate.
2. Generate a clean snapshot with `pnpm public:export <outside-source-directory>`.
3. Review every public image and tracked asset for synthetic, non-personal data.
4. Create a new public repository from that snapshot, never from the private
   repository or its history.
5. Add the public repository description: **Local-first 365-day language
   learning PWA with spaced retrieval and bring-your-own conversation AI.**
6. Suggested topics: `language-learning`, `english-learning`, `pwa`,
   `typescript`, `react`, `spaced-repetition`, `cefr`, `local-first`,
   `cloudflare`, `ai`.
7. Deploy the separate synthetic demo following [PUBLIC_DEMO.md](PUBLIC_DEMO.md).

## Recommended GitHub ruleset

- Require pull requests to the default branch.
- Require the CI workflow before merge.
- Prevent force pushes and branch deletion.
- Restrict bypass rights to explicitly approved maintainers.

## Recommended GitHub security settings

Enable private vulnerability reporting, security advisories, Dependabot alerts,
Dependabot security updates, secret scanning and push protection where available.
Review workflow permissions and repository collaborators before changing
visibility.
