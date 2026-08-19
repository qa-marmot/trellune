PRAGMA defer_foreign_keys = ON;
PRAGMA legacy_alter_table = ON;

CREATE TABLE assessments_0009 (
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('baseline', 'weekly', 'stage')),
  completed_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  last_mutation_id TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (learner_id, id)
);

CREATE TABLE assessment_0009_migration_guard (
  invariant INTEGER NOT NULL CHECK (invariant = 1)
);

INSERT INTO assessments_0009 (
  learner_id, id, type, completed_at, payload_json, version, last_mutation_id, updated_at
)
SELECT learner_id, id, type, completed_at, payload_json, version, last_mutation_id, updated_at
FROM assessments;

INSERT INTO assessment_0009_migration_guard (invariant)
SELECT CASE
  WHEN (SELECT COUNT(*) FROM assessments_0009) = (SELECT COUNT(*) FROM assessments)
  THEN 1 ELSE 0
END;

ALTER TABLE assessments RENAME TO assessments_0009_previous;
ALTER TABLE assessments_0009 RENAME TO assessments;
DROP TABLE assessments_0009_previous;

INSERT INTO assessment_0009_migration_guard (invariant)
SELECT CASE
  WHEN (SELECT COUNT(*) FROM pragma_foreign_key_check) = 0
  THEN 1 ELSE 0
END;

DROP TABLE assessment_0009_migration_guard;

PRAGMA legacy_alter_table = OFF;
PRAGMA defer_foreign_keys = OFF;
