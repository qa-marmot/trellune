# OSS growth and contributor-experience audit

Date: 2026-08-20

This is a product-discovery and contributor-flow audit, not a claim about
learner data, production deployment, or provider verification.

## Findings before this change

| Persona                      | 5 seconds                                                            | 30 seconds                                            | 1 minute                                  | 5 minutes                                                         |
| ---------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------- |
| English learner              | The purpose was visible, but the first screenshots were Japanese UI. | Local-first and the conversation bridge were present. | Demo was discoverable.                    | A path to a small contribution was not obvious.                   |
| TypeScript / React developer | The stack was not the opening message.                               | Architecture was available lower in the README.       | Local setup was clear.                    | The contribution gate looked release-sized for all work.          |
| Beginner OSS contributor     | The project looked polished.                                         | The contribution surface was not explicit.            | No short first-contribution path.         | Sensitive docs appeared mandatory before a small docs change.     |
| Language-learning enthusiast | The 365-day path and caution about CEFR were clear.                  | The learning loop needed a sharper explanation.       | The synthetic demo was available.         | Curriculum QA and non-code contribution routes were hard to find. |
| Non-code contributor         | No obvious entry point.                                              | Provider/device evidence was not foregrounded.        | Issues existed but did not explain paths. | It was unclear which work needed code knowledge.                  |

## Changes made

- Reframed both READMEs around a five-second product statement and four ordered
  actions: demo, how it works, local run, contribution.
- Replaced shared screenshots with matching synthetic English and Japanese UI
  evidence. `pnpm screenshots` regenerates the exact assets.
- Added a light GitHub route from the public demo and a single, non-intrusive
  star invitation in each README.
- Added a path-based contribution guide and a short first-contribution guide;
  docs-only work no longer implies a full release gate.
- Added documentation and provider-evidence Issue Forms, a compact PR template,
  and Discussion routing for questions and early ideas.
- Added positioning, Show HN, Reddit, social, Japanese technical-article, and
  maintainer-policy material for human use only.

## Resulting funnel

| Time       | A visitor can now do                                                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 5 seconds  | Identify Trellune as a local-first 365-day English-learning PWA, not a generic AI chat wrapper.                                                |
| 30 seconds | See the learning loop, manual-provider boundary, offline/local-first value, and honest CEFR limit.                                             |
| 1 minute   | Open the resettable synthetic demo or run the project locally.                                                                                 |
| 5 minutes  | Choose documentation, localization, provider, device, accessibility, curriculum, app, or sync/security contribution work with a focused check. |

## Boundaries and manual follow-up

- Screenshots are synthetic; review them after regeneration before commit.
- The repository does not claim a fully translated curriculum or verified Claude
  / Gemini workflows without manual evidence.
- External launch posts and community moderation require a human to check
  current rules and post appropriately.
- A social-preview asset is maintained in `docs/assets/`; GitHub’s repository
  social-preview upload is a maintainer-console setting and is not automated by
  this repository.
