# Reproducible public screenshots

README evidence is captured only from the resettable, local-only synthetic demo.
It must never contain a learner account, learner name, personal browser chrome,
production hostname, Access state, D1 data, or a real export.

```bash
pnpm screenshots
```

The command writes the matching synthetic state to:

- `docs/assets/demo/en/` for the English README
- `docs/assets/demo/ja/` for the Japanese README

It uses a 390 × 844 mobile viewport and captures Today, Grammar, Conversation
AI, and Progress. Review every image before committing it. The English README
uses only `en/` images; the Japanese README uses only `ja/` images. Keep the
same feature coverage in both unless a documented product boundary prevents it.

The language-neutral source for the repository social preview is
`docs/assets/trellune-social-preview.svg`. GitHub’s social-preview upload is a
repository-settings action, so keep that source public-safe and use it when a
maintainer updates the preview in the GitHub interface.
