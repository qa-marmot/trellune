# Fluency / B2 Challenge learning enrichment

## Scope

This change completes the non-Voice practice layer for Day 181–365 without modifying any released
`CurriculumDay`, lesson ID, persisted Core field, SRS rule, backup v2 record, sync v1 message, or
Dexie v5 table.

## Delivered practice

- 185 daily grammar-transfer blocks. Fluency requires a connected 4–6 sentence explanation;
  B2 Challenge requires a readable 5–8 sentence position, example, qualification, or repair.
- 185 productive vocabulary blocks. Every Day 2–365 prompt combines current material with one
  deterministic previous-day item, so later retrieval is not left to an incidental exact-surface
  repeat in the authored vocabulary list.
- 15 authored Fluency Reading & Writing Labs, every six days from Day 186 through 270.
- 19 authored B2 Challenge Reading & Writing Labs, every five days from Day 275 through 365.
  Every B2 passage has two paragraphs and 150–260 words; tasks cover writer stance, evidence,
  limitations, inference, trade-offs, counterpoint, synthesis, accessible explanation, report and
  professional-message writing.
- Practice responses remain ephemeral. Only the existing Grammar Core flag is written after all
  authored response ranges are satisfied.

## Progression and time

| Range       | Reading                                                    | Writing                                                     | Added practice time |
| ----------- | ---------------------------------------------------------- | ----------------------------------------------------------- | ------------------: |
| Day 181–270 | reports, retelling, perspective, cautious inference        | summary, explanation, message, opinion and self-review      | 1,515 min / 25.25 h |
| Day 271–365 | two-paragraph reports/opinions with stance and implication | 140–250 word opinion, report, synthesis, email and evidence | 1,805 min / 30.08 h |

Across Day 1–365, the enrichment adds 5,585 minutes (93.08 hours), or 15.3 minutes per day on
average. Checkpoints rotate instead of requiring a long article or essay every day. The resulting
estimated total is approximately 360.6–451.8 guided hours when added to the original manifest
range; this remains below the general 500–600 hour beginner-to-B2 guide and does not guarantee B2.

## Integrated Graduation Assessment

The app now offers `english-os-stage-assessment-graduation-integrated-v1`. It keeps
ASSESSMENT_JSON v1.0 and requires direct scores for listening, reading, spoken interaction,
spoken production, writing, grammar and vocabulary. Its bundled task contains a reading passage,
inference/evidence questions and a 180–250 word recommendation. A `B1+`, `B2-entry`, or `B2`
result is an integrated evidence-based estimate, never certification.

The older `english-os-stage-assessment-graduation-v1` remains valid for stored attempts and backup
restore. Its missing/`spoken` scope continues to display as a narrower spoken/listening estimate;
it is not silently upgraded.

## Curriculum QA

- All 185 generated daily practice records and all 34 authored lab records were inspected.
- All authored titles and source texts are unique.
- Fluency moves from detailed experience through summary, decision, perspective, paraphrase,
  inference and evidence review.
- B2 Challenge moves from supported stance through hypotheticals, trade-offs, layered explanation,
  counterargument, implication, synthesis and a graduation evidence task.
- The 19 B2 passages are multi-paragraph and stay within the tested 150–260 word band.
- B2 writing checkpoints stay within 140–250 words; Day 365 requires 180–250 words.
- No remaining curriculum P1/P2 was found. Natural-speed listening quality and real speaking
  feedback remain dependent on ChatGPT Voice and require human use.
