CREATE TRIGGER vocabulary_identity_guard
BEFORE INSERT ON vocabulary
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM vocabulary
  WHERE learner_id = NEW.learner_id AND normalized_term = NEW.normalized_term
)
BEGIN
  SELECT RAISE(ABORT, 'duplicate_vocabulary_identity');
END;

CREATE TRIGGER phrase_identity_guard
BEFORE INSERT ON phrases
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM phrases
  WHERE learner_id = NEW.learner_id AND normalized_phrase = NEW.normalized_phrase
)
BEGIN
  SELECT RAISE(ABORT, 'duplicate_phrase_identity');
END;
