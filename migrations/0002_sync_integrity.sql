ALTER TABLE daily_progress ADD COLUMN last_mutation_id TEXT;
ALTER TABLE session_imports ADD COLUMN canonical_payload_hash TEXT;

UPDATE session_imports
SET canonical_payload_hash = source_text_hash
WHERE canonical_payload_hash IS NULL;

CREATE UNIQUE INDEX idx_session_canonical_payload_hash
ON session_imports(learner_id, canonical_payload_hash)
WHERE canonical_payload_hash IS NOT NULL;

CREATE TABLE sync_entities (
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'profile-settings', 'daily-progress', 'learning-event', 'session', 'mistake',
    'learning-item', 'acquisition-event', 'review-card', 'review-event',
    'grammar-progress', 'assessment'
  )),
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('upsert', 'delete')),
  payload_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  last_mutation_id TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (learner_id, entity_type, entity_id),
  UNIQUE (learner_id, last_mutation_id)
);

CREATE INDEX idx_sync_entities_learner
ON sync_entities(learner_id, entity_type, entity_id);

DROP TRIGGER progress_mutation_version_guard;

CREATE TRIGGER progress_mutation_version_guard
BEFORE INSERT ON processed_mutations
FOR EACH ROW
WHEN NEW.entity_type = 'daily_progress' AND NOT EXISTS (
  SELECT 1 FROM daily_progress
  WHERE learner_id = NEW.learner_id
    AND study_date = NEW.entity_id
    AND version = NEW.entity_version
    AND last_mutation_id = NEW.mutation_id
)
BEGIN
  SELECT RAISE(ABORT, 'progress_version_conflict');
END;

CREATE TRIGGER sync_mutation_write_guard
BEFORE INSERT ON processed_mutations
FOR EACH ROW
WHEN NEW.entity_type LIKE 'sync:%' AND NOT EXISTS (
  SELECT 1 FROM sync_entities
  WHERE learner_id = NEW.learner_id
    AND entity_type = SUBSTR(NEW.entity_type, 6)
    AND entity_id = NEW.entity_id
    AND version = NEW.entity_version
    AND last_mutation_id = NEW.mutation_id
)
BEGIN
  SELECT RAISE(ABORT, 'sync_version_conflict');
END;
