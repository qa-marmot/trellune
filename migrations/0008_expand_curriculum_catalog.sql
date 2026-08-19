PRAGMA defer_foreign_keys = ON;

CREATE TABLE curriculum_days_0008 (
  day_number INTEGER PRIMARY KEY CHECK (day_number BETWEEN 1 AND 540),
  phase INTEGER NOT NULL CHECK (phase BETWEEN 1 AND 6),
  title TEXT NOT NULL,
  grammar_topic_key TEXT NOT NULL,
  scenario TEXT NOT NULL
);

CREATE TABLE curriculum_0008_migration_guard (
  invariant INTEGER NOT NULL CHECK (invariant = 1)
);

INSERT INTO curriculum_days_0008 (
  day_number, phase, title, grammar_topic_key, scenario
)
SELECT day_number, phase, title, grammar_topic_key, scenario
FROM curriculum_days
ORDER BY day_number;

INSERT INTO curriculum_0008_migration_guard (invariant)
SELECT CASE
  WHEN (SELECT COUNT(*) FROM curriculum_days_0008) =
       (SELECT COUNT(*) FROM curriculum_days)
  THEN 1 ELSE 0
END;

DROP TABLE curriculum_days;
ALTER TABLE curriculum_days_0008 RENAME TO curriculum_days;

CREATE TABLE curriculum_catalog (
  curriculum_id TEXT PRIMARY KEY CHECK (curriculum_id = 'english-os-core'),
  content_version TEXT NOT NULL,
  active_total_days INTEGER NOT NULL CHECK (active_total_days BETWEEN 1 AND 540)
);

INSERT INTO curriculum_catalog (curriculum_id, content_version, active_total_days)
VALUES ('english-os-core', 'legacy-90-v1', 90);

INSERT INTO curriculum_0008_migration_guard (invariant)
SELECT CASE
  WHEN (SELECT COUNT(*) FROM pragma_foreign_key_check) = 0
  THEN 1 ELSE 0
END;

DROP TABLE curriculum_0008_migration_guard;

PRAGMA defer_foreign_keys = OFF;
