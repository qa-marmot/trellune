# Foundation / Independent learning enrichment

## Scope

This change adds non-Voice practice to Day 1–180 without modifying the released
`CurriculumDay` content, catalog lesson IDs, Core evidence fields, persistence schema, backup v2,
or sync v1.

## Daily pattern

- 180 grammar transfer blocks: controlled production, transformation, guided/contextual
  production, cumulative retrieval, paraphrase, and learner-created error correction are rotated
  by stage.
- 180 productive vocabulary blocks: target words are recalled, placed in context, combined, or
  explained in simpler English.
- 30 authored Reading & Writing Labs: one approximately every six days. Each has a unique bundled
  passage, a comprehension/inference question, and a connected written response.
- Practice responses stay ephemeral. Completion writes only the existing grammar Core flag after
  the bounded check and all open-production fields meet their authored word range.

## Progression

| Range      | Reading                                                              | Writing                                                    | Additional practice time |
| ---------- | -------------------------------------------------------------------- | ---------------------------------------------------------- | -----------------------: |
| Day 1–90   | short messages and narratives grow into short opinions/reflections   | one sentence grows to a 60–125 word checkpoint response    |           960 min / 16 h |
| Day 91–180 | paragraph-length narratives, choices, reports, stance, and inference | structured paragraph/message/summary grows to 95–175 words |      1,305 min / 21.75 h |

The added average is 12.6 minutes per lesson. Longer labs are rotated instead of required every
day, preserving a sustainable daily load.

## Quality controls

- Every Day 1–180 lesson has grammar transfer and productive vocabulary practice.
- Exactly 30 deterministic checkpoints cover reading and writing.
- Passage titles and texts are unique.
- Reading length and output expectations rise across the two stages.
- Foundation and Independent each exercise at least five grammar operations.
- Day 1–180 authored content remains deep-equal to the released curriculum.
- Day 181–365 is intentionally unchanged for the next enrichment PR.

## Product boundary

This materially reduces Voice-only dependence for grammar, vocabulary, reading, and writing.
Speaking, listening, pronunciation, and spontaneous interaction still depend primarily on the
copy/paste ChatGPT Voice workflow. Full CEFR B2 is therefore not claimed by this PR.
