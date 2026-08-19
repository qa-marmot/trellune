# Trellune v1.6 final Learning Mastery audit

Audit date: 2026-08-14
Scope: Day 1–365, all practice metadata, 71 reading blocks, four Stage coaching policies, the current integrated Graduation definition, and the learner-facing Today/Grammar/Curriculum/Assessment flows.

## Outcome

The release closes every P1 and P2 recorded in the v1.5 baseline without changing a curriculum day ID, completed Core evidence, acquisition limit, SRS rule, persistence schema, sync protocol, backup version, or JSON protocol. “365 days = B2” is still explicitly rejected. Learning quality is supported by authored tasks and human-readable review, not inferred from test counts.

## Measured coverage

- 365 lessons and 879 authored practice prompts
- Daily Grammar transfer, Vocabulary production, and short Writing
- 64 standard Reading/Writing Labs plus seven 408–457-word long-form challenges
- Four multi-text challenges with comparison or synthesis
- Vocabulary curriculum reuse: D+1 on 364 days, D+3 on 121, D+7 on 119, D+21 on 115
- 12 Grammar target categories with category-compatible operations and curated learner errors
- Stage-average added practice: Foundation 10.7, Independent 14.8, Fluency 17.4, B2 Challenge 20.2 minutes
- Maximum added practice on a long-form day: 43 minutes; long tasks rotate instead of appearing daily

## Human-readable quality review

All 365 rows were audited programmatically. Direct task/content review covered Day 1, 6, 18, 30, 54, 72, 90, 91, 120, 150, 180, 181, 210, 240, 270, 271, 285, 300, 315, 330, 345, 350, 360, and 365, plus samples across each Grammar category. Six mismatches were corrected locally: polite request/repair, adjective order, `need + noun / need to`, partial agreement, conditional integration, and narrative-to-recommendation cohesion. The Day, Stage, Unit, and stable lesson IDs did not change.

## Learner loop

The bundled loop is now input → retrieval → production → authored feedback → self-review → retry → spaced curriculum reuse → authentic Voice. Reading feedback exposes key points, rationale, evidence clues, and common misunderstanding after the learner responds. Writing and open production use Stage-appropriate rubrics rather than fake semantic auto-grading. A learner can revise once in the current page session; the optional ChatGPT correction route only copies a bounded prompt and never gates Core.

## CEFR and Graduation semantics

The current integrated Graduation definition requires speaking, interaction, fluency, grammar, vocabulary, listening, reading, and writing. Every skill uses explicit 1–5 anchors and requires a concrete evidence note. B2-entry requires every required skill at least 3/5. B2 requires `pass` and every required skill at least 4/5. A weak mode cannot be hidden by an average. The label is an evidence-based estimate, not certification; completion and `pass` alone never award B2. Legacy integrated and spoken/listening attempts retain their original definition and scope.

## Dependency and realistic expectation

Core completion intentionally still includes Voice on 365/365 days. The Voice-primary skill-family share remains 5/9 (55.6%): listening, speaking, fluency, interaction, and pronunciation need live/human evidence, while Grammar, Vocabulary, Reading, and Writing have bundle-native practice. v1.6 improves Voice coaching and fallback but cannot guarantee ChatGPT’s current speaker, accent, latency, or audio delivery.

Estimated guided workload is approximately 364–455 hours before optional retry or ChatGPT text feedback. The realistic outcome for a consistent learner is:

- A2: strong expectation
- B1: realistic expectation
- B1+: realistic with sustained completion, correction, and reuse
- spoken B2-entry: plausible challenge outcome, not guaranteed
- full CEFR B2: possible only when the integrated eight-skill evidence profile satisfies the guardrail; never inferred from elapsed days

## Strict final scorecard

| Area                      | Score | Evidence / limitation                                                         |
| ------------------------- | ----: | ----------------------------------------------------------------------------- |
| Curriculum coherence      |   9.4 | Stable 365-day progression, rotations, Stage load, and boundary QA            |
| Grammar instruction       |   9.2 | Explanation, example, bounded check, transfer, feedback, and retry            |
| Grammar practice          |   9.2 | 12 target categories; curated errors; operation/content regression checks     |
| Vocabulary acquisition    |   9.2 | Bounded high-value items, chunks, productive use, and existing SRS            |
| Vocabulary retention      |   9.1 | SRS plus D+1/D+3/D+7/D+21 curricular reuse                                    |
| Reading                   |   9.1 | 64 graded Labs, seven long-form tasks, genre/synthesis progression            |
| Writing                   |   9.1 | Daily output, 64 checkpoints, calibrated length, rubric feedback and retry    |
| Listening design          |   9.0 | Stage speed/inference/stance/once-only policy; delivery remains external      |
| Speaking / Voice design   |   9.2 | 365-day duration, interaction, repair, and authentic task progression         |
| Interaction / repair      |   9.2 | Clarification, paraphrase, follow-up, repair, and fallback across Stages      |
| Feedback quality          |   9.2 | Authored rationale/evidence/rubrics, honest self-review, retry, optional copy |
| Retention / retrieval     |   9.2 | SRS preserved and long-distance productive curriculum retrieval added         |
| Assessment                |   9.2 | Eight rubrics, evidence-per-skill, profile guardrails, legacy compatibility   |
| CEFR progression          |   9.1 | Explicit modes and honest estimate semantics; no completion-based B2 claim    |
| UI / UX                   |   9.1 | Next action, staged Grammar, disclosures, mobile/desktop and 400% reflow      |
| Accessibility             |   9.0 | Semantic controls, focus/reflow automation; physical NVDA remains manual      |
| Daily learning experience |   9.1 | Clear next task, balanced rotation, feedback/retry and bounded heavy days     |
| Product completeness      |   9.1 | Local-first learning loop plus manual ChatGPT bridge and recovery contracts   |

No scored area is below 9.0. These are product-design scores, not measured learner attainment. Physical-device accessibility, live Voice delivery, and longitudinal CEFR outcome research remain manual/external limitations.
