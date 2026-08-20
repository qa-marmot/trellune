# First contribution

Trellune welcomes small contributions. You do not need to understand the sync
engine or the 365-day curriculum to improve a document, test an accessibility
path, or review a provider workflow.

## Five small steps

1. Choose a labelled Issue, or start with a documentation improvement.
2. Fork `qa-marmot/trellune`, clone your fork, and create a short topic branch.
3. Change one thing with a clear learner or contributor benefit.
4. Run the smallest relevant check.
5. Open a pull request and say what changed, why, and what you ran.

```bash
git clone https://github.com/YOUR-USER/trellune.git
cd trellune
corepack enable
pnpm install --frozen-lockfile
git switch -c docs/clearer-local-setup
pnpm docs:check-links
```

For a small application change, use:

```bash
pnpm check:quick
```

Do not run a full D1, PWA, and cross-browser release gate for a docs-only change
unless the pull request changes a runtime boundary.

## Good first contributions

- Clarify a local-setup or troubleshooting sentence.
- Improve a Japanese or English UI string without changing stored values.
- Follow a provider-acceptance checklist and add only reproducible evidence.
- Test a real Safari or iPhone path and report a concrete result.
- Review a small curriculum range for unclear, unnatural, or repetitive English.

Use [Discussions](https://github.com/qa-marmot/trellune/discussions) for a
question or an idea. Use an [Issue](https://github.com/qa-marmot/trellune/issues)
for concrete, reproducible work. Never include learner exports, pasted JSON,
audio, credentials, or local databases in either place.

See [Contributing](../CONTRIBUTING.md) for paths, files, difficulty, and safety
boundaries.
