# Trellune v1.6 Learning Mastery audit

- Audit baseline: v1.5.0 `main` at `7b1bd760d644d4b3f1e1b8ab97a80a342dc528db`
- Scope: all 365 lessons, 64 Reading/Writing Labs, open-practice completion, Graduation semantics, Voice prompts and learning UI
- Method: full catalog aggregation plus direct review of the learner tasks. Counts are not treated as proof of learning quality.

## Baseline conclusion

v1.5.0 materially closed the former reading/writing absence: every day includes Grammar transfer and productive Vocabulary work, 64 scheduled Labs provide authored input/output, and Graduation requires evidence across eight modes. The remaining weakness is the learning loop. Open answers can be completed from presence and word count, Grammar operation is selected by day rotation, lexical curriculum reuse stops at D+1, and the UI does not help a learner compare, correct, and retry. These are learning-effectiveness defects, not coverage-only gaps.

## Ranked findings

### LM-P1-001 — Open production has no meaningful feedback loop

- Actual: Reading, Grammar transfer, Vocabulary production, and Writing are accepted when a response exists and its word count is in range. Only bounded Grammar uses an exact answer.
- Risk: an off-task, incorrect, or mechanically padded response can complete Core. Learners do not see why a reading answer is supported or which feature to revise.
- Required fix: authored Reading key points/evidence, stage rubrics for open production, self-judgement, one in-session retry, and an optional copy-only ChatGPT feedback prompt. Do not invent automated semantic grading.

### LM-P1-002 — Graduation estimate lacks a score-profile guardrail

- Actual: all eight integrated skills are required, but `cefrEstimate: B2` is not checked against a documented 1–5 skill profile.
- Risk: one aggregate label can conceal a weak critical mode and look more authoritative than the evidence.
- Required fix: explicit skill rubrics and profile criteria. Day completion and Assessment `pass` remain independent from CEFR estimation and certification.

### LM-P2-003 — Grammar operation is unrelated to the target language function

- Actual: operations rotate by day index. Hedging, interaction, tense, and discourse lessons can receive the same transformation wording. Error correction asks the learner to create a deliberate error.
- Risk: practice tests compliance with a template rather than the operation the lesson is meant to teach.
- Required fix: inventory-driven categories, compatible operation sets, and curated Japanese-learner error patterns.

### LM-P2-004 — Curriculum lexical recycling ends at D+1

- Actual: SRS remains sound, but the authored production layer retrieves one previous-day item only.
- Risk: high-value chunks are not deliberately reused after a longer interval or across Stage boundaries.
- Required fix: bounded D+1/D+3/D+7/D+21 curricular reuse with different operations. Reuse is not a new acquisition and does not change SRS.

### LM-P2-005 — Foundation output length sometimes rewards padding

- Actual: several short request/question tasks inherit a rising minimum word count. Day 6 asks for one polite sentence with 8 words; Day 18 asks for one ingredient question with 16.
- Risk: communicative efficiency is penalised and beginners learn to add irrelevant material.
- Required fix: task-specific ranges for all 15 Foundation Labs while keeping Stage progression in task complexity.

### LM-P2-006 — Advanced reading has narrow genres and insufficient endurance/synthesis

- Actual: B2 texts are strong in evidence, policy, work, and decision reasoning but overrepresent those genres. Reading checkpoints are short enough for daily work; no deliberate 400–700 word endurance sequence exists.
- Risk: a learner can practise argument analysis without enough exposure to culture, biography, narrative nonfiction, reviews, popular science, or multi-text synthesis.
- Required fix: local diversification plus six to eight scheduled long-form/multi-text challenges, balanced against daily load.

### LM-P2-007 — Listening quality is specified unevenly

- Actual: Voice tasks mention listening/inference increasingly, but normal/near-natural speed, once-only input, limited repetition, stance, implication, and role variation are not consistently carried in the generated Core prompt.
- Risk: learner experience depends on ad-hoc model behaviour rather than Stage coaching policy.
- Required fix: Stage-calibrated Voice instructions with fallback scaffolding. Trellune still does not claim to control ChatGPT voice quality.

### LM-P2-008 — Learning UI exposes tasks but not current learning state

- Actual: the Grammar route is one long vertical form; feedback/retry is absent; Reading, Writing, and rubric content compete visually; Curriculum can expose 95 rows.
- Risk: the next action and return-to-current-task become costly, especially at 400% text.
- Required fix: staged reveal, concise current-task status, collapsible rubric/details, readable long-form measure, and current Unit/Day affordances without redesigning the product.

### LM-P3-009 — Local Hallmark preflight evidence is stale

- Actual: the stored preflight describes font choices that differ from current tokens, although existing responsive evidence reports zero horizontal overflow.
- Required fix: refresh evidence during final UI acceptance; visual token churn is not a learning-quality substitute.

## Baseline dependency and time

- Core completion still intentionally requires Voice on 365/365 days.
- Bundle-native Grammar, Vocabulary, Reading, and Writing exist; spontaneous speaking, listening, interaction, and pronunciation still require Voice/human evidence.
- Voice-primary skill-family dependency is 5/9 (`55.6%`), unchanged at this baseline; v1.6 improves the quality of the non-Voice loop rather than removing authentic Voice.
- v1.5.0 estimated guided workload is approximately `360.6–451.8` hours. It supports a realistic B1/B1+ centre and a B2-entry challenge for consistent learners, but remains below the broad 500–600 guided-hour beginner-to-B2 reference and never guarantees full B2.

## Fixed constraints

No remediation may change stable Day 1–365 IDs, completed progress, Core/Boost evidence, acquisition limits, SRS, backup v2, sync v1, Dexie v5, SESSION_JSON 1.0, ASSESSMENT_JSON 1.0 compatibility, CAS, tombstones, ACTIVE/AVAILABLE 365, or the copy/paste-only ChatGPT boundary.

## v1.6 remediation status

| Finding   | Resolution                                                                                          |
| --------- | --------------------------------------------------------------------------------------------------- |
| LM-P1-001 | Authored feedback, self-review, one in-session retry, and optional copy-only ChatGPT feedback       |
| LM-P1-002 | Eight explicit 1–5 rubrics, evidence per skill, and B2-entry/B2 score-profile guardrails            |
| LM-P2-003 | Twelve target categories, compatible operations, and curated Japanese-learner errors                |
| LM-P2-004 | Bounded D+1/D+3/D+7/D+21 curriculum reuse without changing SRS or acquisition counts                |
| LM-P2-005 | All 15 Foundation Lab word ranges calibrated to communicative task size                             |
| LM-P2-006 | Broader advanced genres and seven 408–457-word long-form/multi-text challenges                      |
| LM-P2-007 | Stage-calibrated speed, once-only listening, inference/stance, repair, variation, and fallback      |
| LM-P2-008 | Direct next action, explicit Grammar steps, collapsible Unit/rubric content, and zoom/reflow checks |
| LM-P3-009 | Hallmark evidence refreshed against the final responsive implementation                             |

The final evidence and strict scorecard are recorded in `FINAL_MASTERY_AUDIT.md`.
