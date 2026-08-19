ALTER TABLE learners ADD COLUMN start_date TEXT;

CREATE TABLE learner_data_migrations (
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  migration_key TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  PRIMARY KEY (learner_id, migration_key)
);

CREATE INDEX idx_learner_data_migrations
ON learner_data_migrations(learner_id, migration_key);
