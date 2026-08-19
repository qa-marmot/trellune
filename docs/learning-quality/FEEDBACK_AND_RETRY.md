# Feedback and retry contract

Open production is not automatically marked correct. Each bundle-authored prompt provides a compact comparison contract:

- Reading: meaning-bearing key points, a text clue, rationale, and a common misunderstanding
- Grammar/Vocabulary/Writing: rationale, target features, common errors, and a Stage-calibrated learner checklist
- Optional ChatGPT text feedback: a copy-only prompt that asks for task achievement, language feedback, one priority correction, then an improved version

The learner answers before feedback is revealed, compares the answer, checks the rubric, and may revise the same response. The first answer is retained only in React state for comparison; responses, check state, and feedback prompts are not added to IndexedDB, sync, or backup. Existing Grammar Core completion remains the single persisted evidence flag and is saved only after the bounded answer plus open-practice self-review for a new day. Existing completed days are not reopened.

Reading key points are never exact-match answer keys. Writing is never assigned a false semantic correctness result. Optional ChatGPT feedback cannot complete Core and is separate from Voice and SESSION_JSON.
