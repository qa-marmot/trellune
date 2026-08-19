ALTER TABLE review_cards ADD COLUMN state TEXT NOT NULL DEFAULT 'new'
  CHECK (state IN ('new', 'learning', 'review', 'relearning', 'previewed', 'suspended'));
ALTER TABLE review_cards ADD COLUMN stability_level INTEGER NOT NULL DEFAULT 0
  CHECK (stability_level >= 0);
ALTER TABLE review_cards ADD COLUMN lapses INTEGER NOT NULL DEFAULT 0
  CHECK (lapses >= 0);
ALTER TABLE review_cards ADD COLUMN last_reviewed_at TEXT;
ALTER TABLE review_cards ADD COLUMN algorithm_version INTEGER NOT NULL DEFAULT 1
  CHECK (algorithm_version = 1);
ALTER TABLE review_cards ADD COLUMN last_mutation_id TEXT;

UPDATE curriculum_days
SET grammar_topic_key = 'd' || day_number || '-grammar';

UPDATE review_cards
SET state = 'previewed'
WHERE (source_type = 'vocabulary' AND EXISTS (
  SELECT 1 FROM vocabulary WHERE vocabulary.id = review_cards.source_id AND vocabulary.state = 'previewed'
)) OR (source_type = 'phrase' AND EXISTS (
  SELECT 1 FROM phrases WHERE phrases.id = review_cards.source_id AND phrases.state = 'previewed'
));

ALTER TABLE mistakes ADD COLUMN canonical_identity TEXT;

UPDATE mistakes
SET canonical_identity = LOWER(TRIM(category || ':' || original_text || ':' || correction_text))
WHERE canonical_identity IS NULL;

-- Collapse legacy duplicate mistake rows before enforcing the semantic key. Keep one
-- stable source id, preserve its accumulated frequency and retain at most one card.
DELETE FROM review_cards
WHERE source_type = 'mistake'
  AND id NOT IN (
    SELECT MIN(review_cards.id)
    FROM review_cards
    JOIN mistakes ON mistakes.id = review_cards.source_id
    GROUP BY mistakes.learner_id, mistakes.canonical_identity
  );

UPDATE review_cards
SET source_id = (
  SELECT MIN(canonical.id)
  FROM mistakes AS canonical
  JOIN mistakes AS duplicate
    ON duplicate.learner_id = canonical.learner_id
   AND duplicate.canonical_identity = canonical.canonical_identity
  WHERE duplicate.id = review_cards.source_id
)
WHERE source_type = 'mistake';

UPDATE mistakes
SET occurrence_count = (
  SELECT SUM(duplicate.occurrence_count)
  FROM mistakes AS duplicate
  WHERE duplicate.learner_id = mistakes.learner_id
    AND duplicate.canonical_identity = mistakes.canonical_identity
)
WHERE id IN (
  SELECT MIN(id) FROM mistakes GROUP BY learner_id, canonical_identity
);

DELETE FROM mistakes
WHERE id NOT IN (
  SELECT MIN(id) FROM mistakes GROUP BY learner_id, canonical_identity
);

CREATE UNIQUE INDEX idx_mistakes_semantic_identity
ON mistakes(learner_id, canonical_identity)
WHERE canonical_identity IS NOT NULL;

CREATE TABLE review_events (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES review_cards(id) ON DELETE CASCADE,
  grade TEXT NOT NULL CHECK (grade IN ('again', 'hard', 'good', 'easy')),
  occurred_at TEXT NOT NULL,
  study_date TEXT NOT NULL,
  curriculum_day INTEGER NOT NULL REFERENCES curriculum_days(day_number),
  algorithm_version INTEGER NOT NULL CHECK (algorithm_version = 1),
  before_json TEXT NOT NULL,
  after_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (learner_id, id)
);

CREATE INDEX idx_review_events_learner_time
ON review_events(learner_id, occurred_at);

CREATE TABLE assessments (
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('baseline', 'weekly')),
  completed_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  last_mutation_id TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (learner_id, id)
);

CREATE TRIGGER review_mutation_write_guard
BEFORE INSERT ON processed_mutations
FOR EACH ROW
WHEN NEW.entity_type = 'review_event' AND NOT EXISTS (
  SELECT 1 FROM review_cards
  WHERE learner_id = NEW.learner_id
    AND id = NEW.entity_id
    AND version = NEW.entity_version
    AND last_mutation_id = NEW.mutation_id
)
BEGIN
  SELECT RAISE(ABORT, 'review_version_conflict');
END;

CREATE TRIGGER assessment_mutation_write_guard
BEFORE INSERT ON processed_mutations
FOR EACH ROW
WHEN NEW.entity_type = 'assessment' AND NOT EXISTS (
  SELECT 1 FROM assessments
  WHERE learner_id = NEW.learner_id
    AND id = NEW.entity_id
    AND version = NEW.entity_version
    AND last_mutation_id = NEW.mutation_id
)
BEGIN
  SELECT RAISE(ABORT, 'assessment_version_conflict');
END;
