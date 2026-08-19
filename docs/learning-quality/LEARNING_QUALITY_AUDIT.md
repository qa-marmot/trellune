# Trellune v1.4.0 learning-quality audit

- Audit date: 2026-08-14
- Source: `main` at `c4f8f7c10629048972dab9f2fca8b7ff976725c9`
- Scope: Day 1–365 curriculum, Core learning UX, Stage Assessments and ChatGPT Project Sources

## Product conclusion before remediation

The spoken curriculum is strongest from Day 181 onward and gives a motivated learner substantial practice in sustained answers, repair, paraphrase, summary, inference, stance and counterpoint. It does not, however, provide enough non-Voice production or any formal reading/writing sequence to support a claim of full CEFR B2.

The realistic centre of the released v1.4.0 curriculum is strong B1+ with a spoken B2-entry challenge for a learner who completes the work consistently and receives useful Voice feedback. Day 365 completion is not evidence of full B2. The current 267.5–358.75 recommended Core hours are also below Cambridge English's approximate 500–600 guided-hour guideline from complete beginner to B2; the guide is not an individual guarantee, but it is a strong reason not to overclaim.

Primary references:

- [Council of Europe CEFR self-assessment grid](https://www.coe.int/en/web/common-european-framework-reference-languages/table-2-cefr-3.3-common-reference-levels-self-assessment-grid) profiles listening, reading, spoken interaction, spoken production and writing separately.
- [Council of Europe CEFR Companion Volume](https://rm.coe.int/cefr-companion-volume-with-new-descriptors-2020/16809ea0d4) includes separate reception, spoken/written production and interaction scales. Its B2 writing examples include developed arguments, advantages/disadvantages and synthesis.
- [Council of Europe CEFR reading descriptors](https://rm.coe.int/cefrcompanion%E2%80%90volume%E2%80%90with%E2%80%90new%E2%80%90descriptors%E2%80%902018/1680787989) include understanding articles/reports with stances, argument structure and cause/effect at B2.
- [Cambridge English guided learning hours](https://support.cambridgeenglish.org/hc/en-gb/articles/202838506-Guided-learning-hours) gives an approximate cumulative guideline of 500–600 hours from beginner to B2 and explicitly notes learner variation.

## Ranked findings

### LQ-P1-001 — A single exact answer completes Grammar at every level

- Tell: `365/365` days use two examples, one bounded exercise and one `expectedAnswer`. Median expected output rises from 6 words in Foundation to 17 words in B2 Challenge, but no day requires paragraph production.
- Where: `src/data/grammarPractice.ts`, extended stage lesson files and `src/App.tsx` Grammar.
- Actual: exact normalized string equality immediately records the existing Grammar Core flag. Recognition, correction, transformation, cumulative retrieval and transfer are only sporadic wording inside one answer.
- Risk: B1/B2 learners can complete the non-Voice production step without demonstrating multi-sentence transfer.
- Fix: preserve the existing exercise and Core flag, then add bundle-authored rotating practice blocks. Grammar completion for a not-yet-completed day follows bounded retrieval with stage-appropriate transfer/self-check work. Existing completed progress remains complete.

### LQ-P1-002 — `B2` can be shown without reading or writing evidence

- Tell: Graduation requires speaking, interaction, fluency, grammar, vocabulary and listening only; `reading` and `writing` do not exist in the assessment skill enum.
- Where: `src/domain/assessment.ts`, public ASSESSMENT_JSON schema and Assessment UI.
- Actual: a `cefrEstimate: "B2"` is labelled only as “CEFR estimate (not certification)”. A reasonable reader can still interpret it as a full CEFR profile.
- Risk: overstates the meaning of the evidence.
- Fix: immediately label existing results as a spoken/listening estimate. Add reading/writing as optional backward-compatible skill keys. A later integrated Graduation definition will require both before an integrated estimate is displayed; legacy attempts remain valid.

### LQ-P2-003 — Reading and writing practice are absent

- Tell: `0/365` lessons contain a reading passage, comprehension question, writing prompt or writing-length target. There are no `reading`/`writing` skill targets.
- Where: `CurriculumLesson`, all four Stage data sets and Curriculum Detail/Grammar UI.
- Risk: full CEFR B2 is structurally untestable and reading/writing transfer is left to the learner.
- Fix: add a small generic practice layer, then author rotating reading/writing tasks. Do not require a long essay every day.

### LQ-P2-004 — Core completion and five declared skills depend on Voice

- Tell: every Core day requires a Core session import. Speaking, fluency, interaction, listening and pronunciation have no equivalent bundle-native practice path. Reading and writing are absent.
- Where: Core evidence model, Voice task data and prompt contract.
- Actual: Trellune alone provides review cards, a bounded grammar response and libraries. ChatGPT text/Study Mode can supplement understanding, but only the Voice path observes interactive spoken performance and listening.
- Risk: without Voice, most communicative outcomes cannot be practised or evidenced.
- Fix: retain Voice for authentic speaking/listening/interaction, while moving reading, writing, transfer grammar and productive vocabulary into the app. Browser SpeechSynthesis was available in the audit Chromium (`4` voices), but OS voice inventory, offline availability, quality and speaker variety are not stable enough for required Core evidence; it is not adopted as a substitute.

### LQ-P2-005 — B2 Challenge vocabulary has little exact later reuse

- Tell: B2 Challenge has `285` vocabulary items and `279` unique surfaces, but only `18.6%` of introduced surfaces recur on a later day. Earlier stages are `63.9%–76.7%` by the same exact-surface heuristic.
- Where: Day 271–365 vocabulary arrays.
- Risk: high-value stance, hedging and inference language may be seen once rather than retrieved productively.
- Fix: practice blocks recycle earlier chunks through cloze, contextual choice, paraphrase and productive sentences. Exact-surface counts are not treated as lemma coverage or proof of CEFR level.

### LQ-P2-006 — ChatGPT Project Sources describe the old 270-day product

- Tell: learner profile, curriculum map, Project instructions and Boost final-day rule still say 270 days.
- Where: `chatgpt-project-sources/01-learner-profile.md`, `03-curriculum.md`, `06-boost-study-policy.md`, `PROJECT_INSTRUCTIONS.txt`.
- Risk: coaching goals, final-day preview behaviour and CEFR claims drift from the app source of truth.
- Fix: update Stage rules through Day 365 without duplicating 365 lesson records. Keep the app curriculum authoritative.

### LQ-P2-007 — Learning UX exposes structure but not enough learning work

- Tell: Today clearly prioritises three Core cards, but Grammar offers one answer field; Curriculum Detail shows Grammar, vocabulary, phrases and Voice only. Assessment was omitted from the 20-route visual matrix.
- Where: Today, Grammar, Curriculum Detail, Curriculum and Assessment routes.
- Risk: users can see what topic exists but cannot complete substantial non-Voice transfer in the same workflow.
- Fix: present practice blocks inside the existing Grammar/detail hierarchy, add clear estimated time and response criteria, and include Assessment in the visual matrix. Avoid a dashboard redesign.

### LQ-P3-008 — Long-route and 400% text journeys increase cognitive travel

- Tell: automated layout inspection found zero horizontal overflow/clipping across 300 route-condition combinations, but at 400% text Today and Grammar place the first learning control several screens below large shell/headline content. A selected Curriculum Stage still exposes up to 95 rows.
- Where: `test-results/visual-audit/after`, Curriculum list and 400% screenshots.
- Risk: orientation and return-to-current-task take longer even though controls remain reachable.
- Fix: keep the current visual system, add concise practice summaries/current-unit affordances and avoid oversized new cards. This is secondary to the learning P1/P2 work.

## Baseline quantitative evidence

| Stage        | Days | Grammar exact-answer days | Median answer words | Reading | Writing | Voice tasks mentioning listening | Vocabulary total / unique | Exact later reuse |
| ------------ | ---: | ------------------------: | ------------------: | ------: | ------: | -------------------------------: | ------------------------: | ----------------: |
| Foundation   |   90 |                        90 |                   6 |       0 |       0 |                                4 |                 630 / 600 |             73.8% |
| Independent  |   90 |                        90 |                   9 |       0 |       0 |                               21 |                 450 / 355 |             76.7% |
| Fluency      |   90 |                        90 |                  15 |       0 |       0 |                               35 |                 360 / 281 |             63.9% |
| B2 Challenge |   95 |                        95 |                  17 |       0 |       0 |                               48 |                 285 / 279 |             18.6% |

The regex-based activity counts above were checked against boundary lessons and all 365 structured records. They are coverage indicators, not automatic judgements of naturalness or CEFR attainment.

## Voice dependency baseline

| Outcome                | Trellune alone           | ChatGPT text / Study Mode    | ChatGPT Voice                  |
| ---------------------- | ------------------------ | ---------------------------- | ------------------------------ |
| SRS recall             | Yes                      | Optional explanation         | No                             |
| Bounded grammar answer | Yes                      | Optional support             | No                             |
| Productive vocabulary  | Incidental only          | Possible, not tracked        | Common path                    |
| Reading                | No authored task         | Possible, outside curriculum | No                             |
| Writing                | No authored task         | Possible, outside curriculum | No                             |
| Spoken production      | No                       | Limited typed proxy          | Required for intended evidence |
| Listening              | No stable bundled source | No                           | Required                       |
| Interaction / repair   | No                       | Typed proxy                  | Required                       |

Before remediation, `365/365` Core completions require a ChatGPT session import and five of the seven declared curriculum skill families rely on Voice for observable practice. The target is not to remove Voice; it is to ensure that reading, writing, grammar transfer and vocabulary retrieval have a complete non-Voice path.

## Learning-time estimate

Manifest recommended Core time totals:

- Foundation: 30–45 hours
- Independent: 67.5–90 hours
- Fluency: 75–105 hours
- B2 Challenge: 95–118.75 hours
- Total: 267.5–358.75 hours

The enrichment target adds short rotating labs within the existing stage guidance rather than adding a long daily essay. Final estimates must report the authored lab minutes separately and continue to avoid a “365 days = B2” claim.

## Remediation sequence

1. Learning-quality foundation: this audit, practice schema, explicit spoken-estimate semantics, Project Source parity and regression tests.
2. Foundation + Independent enrichment: Day 1–180 reading/writing/grammar/vocabulary practice and learning UI.
3. Fluency + B2 Challenge enrichment: Day 181–365 extended input/output and a new integrated Graduation assessment while retaining legacy attempts.

No step changes stable lesson/content IDs, existing completion rows, SRS, acquisition limits, Core/Boost separation, backup v2, sync v1, Dexie v5, CAS or tombstone semantics.

## Post-remediation acceptance

| Finding   | Result                     | Evidence                                                                                                                                     |
| --------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| LQ-P1-001 | Closed                     | 365 stage-graded grammar transfer blocks require open production before a new Grammar Core flag is saved.                                    |
| LQ-P1-002 | Closed                     | Legacy attempts remain spoken-scoped; the offered integrated Graduation requires Reading and Writing scores and direct tasks.                |
| LQ-P2-003 | Closed                     | 365 daily writing paths and 64 authored Reading/Writing checkpoints are bundled.                                                             |
| LQ-P2-004 | Reduced / product boundary | Grammar, vocabulary, reading and writing no longer depend on Voice. Spontaneous speaking, listening, interaction and pronunciation still do. |
| LQ-P2-005 | Closed for practice        | Day 2–365 performs deterministic previous-day lexical retrieval; this does not claim lemma-level CEFR coverage.                              |
| LQ-P2-006 | Closed                     | Project Sources describe Day 365, app-authored non-Voice tasks and integrated/legacy Graduation scope.                                       |
| LQ-P2-007 | Closed                     | Grammar and Curriculum Detail expose the authored tasks, time, response range and ephemeral-data boundary.                                   |
| LQ-P3-008 | Open, non-blocking         | Very long routes and 400% text require substantial vertical travel; content remains reachable and responsive.                                |

The implemented target is full-skill evidence, not a guaranteed full-B2 outcome. A consistent learner
can realistically expect A2 and B1, can reasonably target B1+, and can challenge spoken B2-entry.
Full CEFR B2 is possible only when the integrated assessment actually demonstrates listening,
reading, spoken interaction/production and writing at that level. Day 365 completion or `pass` alone
never grants it.
