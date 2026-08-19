PRAGMA foreign_keys = ON;

CREATE TABLE learners (
  id TEXT PRIMARY KEY,
  access_subject TEXT NOT NULL UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'Asia/Tokyo',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE curriculum_days (
  day_number INTEGER PRIMARY KEY CHECK (day_number BETWEEN 1 AND 90),
  phase INTEGER NOT NULL CHECK (phase BETWEEN 1 AND 6),
  title TEXT NOT NULL,
  grammar_topic_key TEXT NOT NULL,
  scenario TEXT NOT NULL
);

CREATE TABLE daily_progress (
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  study_date TEXT NOT NULL,
  curriculum_day INTEGER REFERENCES curriculum_days(day_number),
  review_completed INTEGER NOT NULL DEFAULT 0 CHECK (review_completed IN (0, 1)),
  grammar_completed INTEGER NOT NULL DEFAULT 0 CHECK (grammar_completed IN (0, 1)),
  core_voice_imported INTEGER NOT NULL DEFAULT 0 CHECK (core_voice_imported IN (0, 1)),
  core_completed INTEGER NOT NULL DEFAULT 0 CHECK (core_completed IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (learner_id, study_date),
  CHECK (
    core_completed = 0 OR
    (review_completed = 1 AND grammar_completed = 1 AND core_voice_imported = 1)
  )
);

CREATE TABLE session_imports (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  external_session_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  source_text_hash TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('core', 'boost')),
  study_date TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  curriculum_day INTEGER REFERENCES curriculum_days(day_number),
  boost_duration_minutes INTEGER CHECK (boost_duration_minutes IN (5, 15, 30, 60)),
  boost_mode TEXT CHECK (boost_mode IN (
    'review_rescue', 'speaking_sprint', 'grammar_deep_dive',
    'scenario_challenge', 'weakness_attack', 'next_lesson_preview', 'free_talk'
  )),
  summary_ja TEXT,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 1 AND 120),
  task_completion_score INTEGER NOT NULL CHECK (task_completion_score BETWEEN 1 AND 5),
  grammar_score INTEGER NOT NULL CHECK (grammar_score BETWEEN 1 AND 5),
  vocabulary_score INTEGER NOT NULL CHECK (vocabulary_score BETWEEN 1 AND 5),
  fluency_score INTEGER NOT NULL CHECK (fluency_score BETWEEN 1 AND 5),
  interaction_score INTEGER NOT NULL CHECK (interaction_score BETWEEN 1 AND 5),
  evaluation_comment_ja TEXT NOT NULL,
  contract_version INTEGER NOT NULL CHECK (contract_version = 1),
  imported_at TEXT NOT NULL,
  UNIQUE (learner_id, external_session_id),
  UNIQUE (learner_id, idempotency_key),
  UNIQUE (learner_id, source_text_hash),
  CHECK (
    (kind = 'core' AND curriculum_day IS NOT NULL AND boost_duration_minutes IS NULL AND boost_mode IS NULL) OR
    (kind = 'boost' AND curriculum_day IS NULL AND boost_duration_minutes IS NOT NULL AND boost_mode IS NOT NULL)
  )
);

CREATE TABLE vocabulary (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES session_imports(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  study_date TEXT NOT NULL,
  term TEXT NOT NULL,
  normalized_term TEXT NOT NULL,
  meaning_ja TEXT NOT NULL,
  example TEXT,
  state TEXT NOT NULL CHECK (state IN ('new', 'previewed', 'active', 'mastered')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (learner_id, session_id, client_id)
);

CREATE TABLE phrases (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES session_imports(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  study_date TEXT NOT NULL,
  phrase TEXT NOT NULL,
  normalized_phrase TEXT NOT NULL,
  meaning_ja TEXT NOT NULL,
  example TEXT,
  state TEXT NOT NULL CHECK (state IN ('new', 'previewed', 'active', 'mastered')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (learner_id, session_id, client_id)
);

CREATE TABLE grammar_previews (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES session_imports(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  study_date TEXT NOT NULL,
  topic_key TEXT NOT NULL,
  title TEXT NOT NULL,
  note_ja TEXT,
  state TEXT NOT NULL DEFAULT 'previewed' CHECK (state = 'previewed'),
  created_at TEXT NOT NULL,
  UNIQUE (learner_id, session_id, client_id)
);

CREATE TABLE mistakes (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES session_imports(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  category TEXT NOT NULL,
  original_text TEXT NOT NULL,
  correction_text TEXT NOT NULL,
  explanation_ja TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  occurrence_count INTEGER NOT NULL DEFAULT 1 CHECK (occurrence_count > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (learner_id, session_id, client_id)
);

CREATE TABLE review_cards (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('vocabulary', 'phrase', 'mistake', 'session')),
  source_id TEXT NOT NULL,
  front_text TEXT NOT NULL,
  back_text TEXT NOT NULL,
  due_date TEXT NOT NULL,
  interval_days INTEGER NOT NULL DEFAULT 1 CHECK (interval_days > 0),
  ease_factor REAL NOT NULL DEFAULT 2.5 CHECK (ease_factor >= 1.3),
  repetitions INTEGER NOT NULL DEFAULT 0 CHECK (repetitions >= 0),
  last_result TEXT CHECK (last_result IN ('again', 'hard', 'good', 'easy')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at TEXT NOT NULL,
  UNIQUE (learner_id, source_type, source_id)
);

CREATE TABLE reviewed_cards (
  session_id TEXT NOT NULL REFERENCES session_imports(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  PRIMARY KEY (session_id, card_id)
);

CREATE TABLE processed_mutations (
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  mutation_id TEXT NOT NULL,
  response_json TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  entity_version INTEGER,
  processed_at TEXT NOT NULL,
  PRIMARY KEY (learner_id, mutation_id)
);

CREATE TABLE change_log (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('upsert', 'delete')),
  payload_json TEXT NOT NULL,
  changed_at TEXT NOT NULL
);

CREATE INDEX idx_sessions_learner_date ON session_imports(learner_id, study_date);
CREATE INDEX idx_vocabulary_learner_date ON vocabulary(learner_id, study_date);
CREATE INDEX idx_phrases_learner_date ON phrases(learner_id, study_date);
CREATE INDEX idx_grammar_previews_learner_date ON grammar_previews(learner_id, study_date);
CREATE INDEX idx_review_cards_due ON review_cards(learner_id, due_date);
CREATE INDEX idx_change_log_pull ON change_log(learner_id, sequence);

CREATE TRIGGER vocabulary_daily_limit
BEFORE INSERT ON vocabulary
FOR EACH ROW
WHEN (SELECT COUNT(*) FROM vocabulary WHERE learner_id = NEW.learner_id AND study_date = NEW.study_date) >= 8
BEGIN
  SELECT RAISE(ABORT, 'daily_word_limit_exceeded');
END;

CREATE TRIGGER phrase_daily_limit
BEFORE INSERT ON phrases
FOR EACH ROW
WHEN (SELECT COUNT(*) FROM phrases WHERE learner_id = NEW.learner_id AND study_date = NEW.study_date) >= 3
BEGIN
  SELECT RAISE(ABORT, 'daily_phrase_limit_exceeded');
END;

CREATE TRIGGER grammar_preview_daily_limit
BEFORE INSERT ON grammar_previews
FOR EACH ROW
WHEN (SELECT COUNT(*) FROM grammar_previews WHERE learner_id = NEW.learner_id AND study_date = NEW.study_date) >= 1
BEGIN
  SELECT RAISE(ABORT, 'daily_preview_grammar_limit_exceeded');
END;

CREATE TRIGGER boost_cannot_complete_core
BEFORE UPDATE OF core_voice_imported ON daily_progress
FOR EACH ROW
WHEN NEW.core_voice_imported = 1 AND OLD.core_voice_imported = 0 AND NOT EXISTS (
  SELECT 1 FROM session_imports
  WHERE learner_id = NEW.learner_id AND study_date = NEW.study_date AND kind = 'core'
)
BEGIN
  SELECT RAISE(ABORT, 'core_voice_requires_core_session');
END;

CREATE TRIGGER progress_mutation_version_guard
BEFORE INSERT ON processed_mutations
FOR EACH ROW
WHEN NEW.entity_type = 'daily_progress' AND NOT EXISTS (
  SELECT 1 FROM daily_progress
  WHERE learner_id = NEW.learner_id
    AND study_date = NEW.entity_id
    AND version = NEW.entity_version
)
BEGIN
  SELECT RAISE(ABORT, 'progress_version_conflict');
END;
