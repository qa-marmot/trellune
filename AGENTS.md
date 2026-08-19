# Trellune contributor rules

These rules apply to the entire repository.

- Do not add OpenAI API, Realtime API, Agents SDK, Workers AI, or any other AI API. ChatGPT integration is copy/paste prompts and validated JSON only.
- Keep TypeScript in strict mode. Validate all external input with Zod before it reaches domain or persistence code.
- Never build SQL by string concatenation. Use bound parameters. Every database schema change requires a numbered migration and backward-compatible data handling.
- Preserve the distinction between required Core learning and optional Boost learning. Boost never completes a future Core day.
- Preserve `previewed` status and daily acquisition limits: at most 8 new words, 3 new phrases, and 1 preview grammar topic.
- Production actions require explicit human approval. Never destroy production data or push directly to `main` without approval.
- Add or update tests for behavior changes. Keep requirements, architecture, API, database, and operating docs synchronized with implementation.
- A Gate cannot be marked complete while a P0 or P1 finding remains open.
- Do not store audio, secrets, pasted learner data, or local database files in Git.
