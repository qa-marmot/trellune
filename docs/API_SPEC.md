# API specification

Base path: `/api/v1`. All responses are JSON and all endpoints except health require Cloudflare Access. Request bodies must use the `application/json` media type (parameters such as `charset=utf-8` are accepted) and are limited to 1,000,000 bytes. Lookalike and structured-suffix types such as `application/jsonp` and `application/json-patch+json` are rejected. Unknown object properties are rejected by strict Zod schemas.

## Error envelope

```json
{
	"error": {
		"code": "validation_error",
		"message": "External input did not match the required schema.",
		"issues": [{ "path": ["payload", "studyDate"], "message": "Invalid string" }]
	}
}
```

Status meanings: `400` malformed JSON/schema/query, `401` missing Access identity, `409` version or import-key conflict, `413` body too large, `415` wrong media type, `422` domain or daily-acquisition rejection, and `500` sanitized unexpected failure. Every API response includes `x-correlation-id`; unexpected-error logs and the returned error expose that identifier, not the request body, raw pasted text, stack or internal error message.

## Endpoints

### `GET /api/v1/health`

Unauthenticated liveness response. It does not query D1.

### `GET /api/v1/today?date=YYYY-MM-DD`

Returns Core flags/version, daily acquisition counts, and overdue review count for the authenticated learner.

### `POST /api/v1/session-imports/preview`

Validates the exact same request accepted by the save endpoint, then returns duplicate status, counts before/incoming, remaining capacity, and violations. It never writes the import. A preview is advisory; save repeats all checks.

### `POST /api/v1/session-imports`

Atomically saves a validated import. New save is `201`; an exact replay is `200` with `replayed: true`. Conflicting reuse of any duplicate key is `409`.

The `payload` member is the unmodified object defined by `chatgpt-project-sources/05-session-schema.json`. The remaining members are application metadata added after the learner pastes the JSON. Core example:

```json
{
	"payload": {
		"schemaVersion": "1.0",
		"sessionId": "0198ba29-89b5-7000-8000-000000000001",
		"sessionType": "core",
		"curriculumDay": 1,
		"occurredAt": "2026-08-06T12:30:00+09:00",
		"durationMinutes": 10,
		"boost": null,
		"summaryJa": "自己紹介を練習した。",
		"evaluation": {
			"taskCompletion": 3,
			"grammar": 3,
			"vocabulary": 3,
			"fluency": 3,
			"interaction": 3,
			"commentJa": "短い文で伝えられた。"
		},
		"mistakes": [],
		"newVocabulary": [{ "text": "usually", "meaningJa": "たいてい", "example": "I usually walk." }],
		"newPhrases": [],
		"previewGrammar": [],
		"reviewCards": []
	},
	"studyDate": "2026-08-06",
	"idempotencyKey": "device-a:mutation-42",
	"sourceTextHash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
	"reviewedCardIds": [],
	"expectedVersion": 0
}
```

`expectedVersion` defaults to `0` for a new session. Restoring a previously deleted session must send the current session tombstone version. A stale value returns `409` without writing the session, its dependent entities, a change-log acknowledgement or processed-mutation record.

For Boost, `sessionType` is `boost`, and `boost` is an object containing the selected `duration` (`5|15|30|60`) and `mode`. Modes are `review_rescue`, `speaking_sprint`, `grammar_deep_dive`, `scenario_challenge`, `weakness_attack`, `next_lesson_preview`, and `free_talk`. `next_lesson_preview` requires exactly one `previewGrammar` item whose topic matches the next curriculum day supplied by Trellune; all other modes require `previewGrammar: []`. Day 365 has no next-lesson preview target while ACTIVE=365. `curriculumDay` identifies context only: Boost acquisitions persist as `previewed` and do not advance or complete that Core day.

Arrays are capped at 8 `newVocabulary`, 3 `newPhrases`, 1 Boost `previewGrammar`, 20 `mistakes`, 20 generated `reviewCards`, and 500 wrapper `reviewedCardIds`. Cumulative daily totals are also enforced. A review card's non-null `sourceMistakeIndex` must reference an item in the same `mistakes` array.

Day-bearing request schemas can represent Day 1–540 without changing protocol version 1. The Worker separately reads `activeTotalDays` from D1 and, after migration `0012`, rejects Day 366–540 with `422 curriculum_day_unavailable` before any physical row, mirror, change-log entry or processed mutation is written.

### `PATCH /api/v1/daily-progress/:date`

Updates only learner-performed review and grammar flags. It cannot set Core Voice or Core complete directly.

```json
{
	"reviewCompleted": true,
	"expectedVersion": 2,
	"sourceVersion": 1,
	"clientMutationId": "device-a:progress-17",
	"updatedAt": "2026-08-06T13:00:00+09:00"
}
```

At least one of `reviewCompleted` and `grammarCompleted` is required. `expectedVersion` is the exact compare-and-swap predecessor. `sourceVersion` is optional and is sent only by the formal backup-restore reconciliation path as a validated local version floor; it never replaces the CAS predecessor. The server allocates the next version above both that floor and the maximum version already recorded for the same learner/date in the physical row, active mirror or tombstone, mirror payload, change log, or processed-mutation history. Physical, mirror, payload, response and change-feed versions use the same allocation. A mutation replay returns the stored response. A stale `expectedVersion` returns `409` with the authoritative current version and writes no mutation or change acknowledgement.

### `POST /api/v1/review-events`

Grades one due review as `again`, `hard`, `good` or `easy`. The server validates the learner calendar context, calculates the next scheduling state, records the immutable review event and updates its card atomically. Mutation replay is idempotent; mismatched replay or stale card version is `409`.

### `PUT /api/v1/assessments/baseline`

Stores the strict dedicated baseline-assessment payload and its versioned mutation metadata. It does not accept or synthesize a Core/Boost `SESSION_JSON`. Exact replay is idempotent and conflicting mutation/version reuse is `409`.

### `PUT /api/v1/assessments/stage`

Stores one validated Stage Assessment attempt using the dedicated `ASSESSMENT_JSON` 1.0 payload. Foundation covers Day 1–90 and requires grammar, vocabulary, speaking and interaction. Independent covers Day 91–180 and adds listening and fluency; Fluency covers Day 181–270. Graduation covers Day 271–365 and requires an evidence-based `cefrEstimate` of B1+, B2-entry, or B2; pronunciation remains optional. The current integrated Graduation definition requires reading and writing as well as spoken/listening evidence, one evidence note per required skill, and a profile threshold: all eight scores at least 3/5 for B2-entry; `pass` plus all eight at least 4/5 for B2. Older definition IDs remain accepted. The attempt ID is the assessment entity ID. The endpoint reuses the existing assessment CAS, mirror, change-log and processed-mutation transaction. Exact replay is idempotent, stale version or mismatched mutation reuse is `409`, and a range above D1 ACTIVE is `422` before any write. Neither result nor estimate grants formal CEFR attainment or locks Core progression.

### `POST /api/v1/sync/mutations`

Upserts one supported normalized entity with its stable mutation ID, expected version and update timestamp. The server rejects stale versions and mutation-ID reuse with a different request fingerprint.

### `POST /api/v1/sync/deletions`

Creates a versioned tombstone for one supported normalized entity. Deletion is synchronized as an operation rather than inferred from a missing snapshot.

### `GET /api/v1/sync/bootstrap`

Returns the authenticated learner's current formal records, normalized sync read model, cursor and `activeTotalDays`. The client requires `activeTotalDays <= availableTotalDays <= supportedMaxDay` before applying any bootstrap record to IndexedDB. This is an additive field within sync protocol v1, not a separate negotiation protocol.

### `GET /api/v1/sync/changes?cursor=0&limit=100`

Returns changes strictly after the integer cursor, ascending. Limit is 1–500. The response includes the next cursor and `hasMore`; clients pull until `hasMore` is false.

## Compatibility

The API major version is in the path. Core/Boost `SESSION_JSON` remains version 1.0 with `chatgpt-project-sources/05-session-schema.json` as its published contract. Stage Assessment uses a separate version 1.0 contract at `docs/schemas/assessment-json-1.0.schema.json` and the executable `StageAssessmentSchema`. Neither contract makes structurally supported curriculum days active. Additive response fields are allowed. Removing/renaming request fields or changing their meaning requires a new API/contract version and a migration path.
