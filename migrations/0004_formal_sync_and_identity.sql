ALTER TABLE processed_mutations ADD COLUMN request_fingerprint TEXT;
ALTER TABLE change_log ADD COLUMN operation_id TEXT;

CREATE INDEX idx_change_log_operation
ON change_log(learner_id, operation_id, sequence);

CREATE TABLE acquisition_identities (
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('vocabulary', 'phrase', 'grammar-preview')),
  canonical_text TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (learner_id, kind, canonical_text)
);

INSERT OR IGNORE INTO acquisition_identities (
  learner_id, kind, canonical_text, entity_id, created_at
)
SELECT learner_id, 'vocabulary', normalized_term, MIN(id), MIN(created_at)
FROM vocabulary
GROUP BY learner_id, normalized_term;

INSERT OR IGNORE INTO acquisition_identities (
  learner_id, kind, canonical_text, entity_id, created_at
)
SELECT learner_id, 'phrase', normalized_phrase, MIN(id), MIN(created_at)
FROM phrases
GROUP BY learner_id, normalized_phrase;

INSERT OR IGNORE INTO acquisition_identities (
  learner_id, kind, canonical_text, entity_id, created_at
)
SELECT learner_id, 'grammar-preview', topic_key, MIN(id), MIN(created_at)
FROM grammar_previews
GROUP BY learner_id, topic_key;

DROP TRIGGER vocabulary_identity_guard;
DROP TRIGGER phrase_identity_guard;
DROP TRIGGER vocabulary_daily_limit;
DROP TRIGGER phrase_daily_limit;
DROP TRIGGER grammar_preview_daily_limit;

CREATE TRIGGER vocabulary_identity_claim
BEFORE INSERT ON vocabulary
FOR EACH ROW
BEGIN
  INSERT OR IGNORE INTO acquisition_identities (
    learner_id, kind, canonical_text, entity_id, created_at
  ) VALUES (NEW.learner_id, 'vocabulary', NEW.normalized_term, NEW.id, NEW.created_at);
  SELECT CASE WHEN (
    SELECT entity_id FROM acquisition_identities
    WHERE learner_id = NEW.learner_id
      AND kind = 'vocabulary'
      AND canonical_text = NEW.normalized_term
  ) <> NEW.id THEN RAISE(IGNORE) END;
  SELECT CASE WHEN (
    SELECT COUNT(*) FROM vocabulary
    WHERE learner_id = NEW.learner_id AND study_date = NEW.study_date
  ) >= 8 THEN RAISE(ABORT, 'daily_word_limit_exceeded') END;
END;

CREATE TRIGGER phrase_identity_claim
BEFORE INSERT ON phrases
FOR EACH ROW
BEGIN
  INSERT OR IGNORE INTO acquisition_identities (
    learner_id, kind, canonical_text, entity_id, created_at
  ) VALUES (NEW.learner_id, 'phrase', NEW.normalized_phrase, NEW.id, NEW.created_at);
  SELECT CASE WHEN (
    SELECT entity_id FROM acquisition_identities
    WHERE learner_id = NEW.learner_id
      AND kind = 'phrase'
      AND canonical_text = NEW.normalized_phrase
  ) <> NEW.id THEN RAISE(IGNORE) END;
  SELECT CASE WHEN (
    SELECT COUNT(*) FROM phrases
    WHERE learner_id = NEW.learner_id AND study_date = NEW.study_date
  ) >= 3 THEN RAISE(ABORT, 'daily_phrase_limit_exceeded') END;
END;

CREATE TRIGGER grammar_preview_identity_claim
BEFORE INSERT ON grammar_previews
FOR EACH ROW
BEGIN
  INSERT OR IGNORE INTO acquisition_identities (
    learner_id, kind, canonical_text, entity_id, created_at
  ) VALUES (NEW.learner_id, 'grammar-preview', NEW.topic_key, NEW.id, NEW.created_at);
  SELECT CASE WHEN (
    SELECT entity_id FROM acquisition_identities
    WHERE learner_id = NEW.learner_id
      AND kind = 'grammar-preview'
      AND canonical_text = NEW.topic_key
  ) <> NEW.id THEN RAISE(IGNORE) END;
  SELECT CASE WHEN (
    SELECT COUNT(*) FROM grammar_previews
    WHERE learner_id = NEW.learner_id AND study_date = NEW.study_date
  ) >= 1 THEN RAISE(ABORT, 'daily_preview_grammar_limit_exceeded') END;
END;
