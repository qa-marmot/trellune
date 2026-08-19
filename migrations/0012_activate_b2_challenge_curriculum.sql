PRAGMA defer_foreign_keys = ON;

CREATE TABLE curriculum_days_0012 (
  day_number INTEGER PRIMARY KEY CHECK (day_number BETWEEN 1 AND 540),
  phase INTEGER NOT NULL CHECK (phase BETWEEN 1 AND 7),
  title TEXT NOT NULL,
  grammar_topic_key TEXT NOT NULL,
  scenario TEXT NOT NULL
);

CREATE TABLE curriculum_0012_migration_guard (
  invariant INTEGER NOT NULL CHECK (invariant = 1)
);

INSERT INTO curriculum_0012_migration_guard (invariant)
SELECT CASE
  WHEN (SELECT active_total_days FROM curriculum_catalog WHERE curriculum_id = 'english-os-core') = 270
   AND (SELECT content_version FROM curriculum_catalog WHERE curriculum_id = 'english-os-core') = 'fluency-270-v1'
   AND (
     (
       (SELECT COUNT(*) FROM curriculum_days) = 270
       AND (SELECT MIN(day_number) FROM curriculum_days) = 1
       AND (SELECT MAX(day_number) FROM curriculum_days) = 270
     )
     OR (
       (SELECT COUNT(*) FROM curriculum_days) = 180
       AND (SELECT MIN(day_number) FROM curriculum_days) = 91
       AND (SELECT MAX(day_number) FROM curriculum_days) = 270
     )
   )
  THEN 1 ELSE 0
END;

INSERT INTO curriculum_days_0012 (
  day_number, phase, title, grammar_topic_key, scenario
)
SELECT day_number, phase, title, grammar_topic_key, scenario
FROM curriculum_days
ORDER BY day_number;

INSERT INTO curriculum_0012_migration_guard (invariant)
SELECT CASE
  WHEN NOT EXISTS (
    SELECT day_number, phase, title, grammar_topic_key, scenario FROM curriculum_days
    EXCEPT
    SELECT day_number, phase, title, grammar_topic_key, scenario FROM curriculum_days_0012
  )
   AND NOT EXISTS (
    SELECT day_number, phase, title, grammar_topic_key, scenario FROM curriculum_days_0012
    EXCEPT
    SELECT day_number, phase, title, grammar_topic_key, scenario FROM curriculum_days
  )
  THEN 1 ELSE 0
END;

DROP TABLE curriculum_days;
ALTER TABLE curriculum_days_0012 RENAME TO curriculum_days;

WITH RECURSIVE b2_challenge_days(day_number) AS (
  SELECT 271
  UNION ALL
  SELECT day_number + 1 FROM b2_challenge_days WHERE day_number < 365
)
INSERT INTO curriculum_days (day_number, phase, title, grammar_topic_key, scenario)
SELECT
  day_number,
  7,
  'Day ' || day_number,
  'd' || day_number || '-grammar',
  CASE
    WHEN day_number <= 285 THEN 'developing-and-supporting-opinions'
    WHEN day_number <= 300 THEN 'perspectives-tradeoffs-and-hypotheticals'
    WHEN day_number <= 315 THEN 'explaining-complex-ideas-clearly'
    WHEN day_number <= 330 THEN 'discussion-agreement-and-counterpoints'
    WHEN day_number <= 345 THEN 'inference-nuance-and-natural-interaction'
    WHEN day_number <= 360 THEN 'b2-challenge-integration'
    ELSE 'graduation-preparation-and-assessment'
  END
FROM b2_challenge_days;

INSERT INTO curriculum_0012_migration_guard (invariant)
SELECT CASE
  WHEN (
    (SELECT COUNT(*) FROM curriculum_days) = 365
    AND (SELECT MIN(day_number) FROM curriculum_days) = 1
    AND (SELECT MAX(day_number) FROM curriculum_days) = 365
  ) OR (
    (SELECT COUNT(*) FROM curriculum_days) = 275
    AND (SELECT MIN(day_number) FROM curriculum_days) = 91
    AND (SELECT MAX(day_number) FROM curriculum_days) = 365
  )
  THEN 1 ELSE 0
END;

UPDATE curriculum_catalog
SET content_version = 'b2-challenge-365-v1', active_total_days = 365
WHERE curriculum_id = 'english-os-core'
  AND content_version = 'fluency-270-v1'
  AND active_total_days = 270;

INSERT INTO curriculum_0012_migration_guard (invariant)
SELECT CASE
  WHEN (SELECT content_version FROM curriculum_catalog WHERE curriculum_id = 'english-os-core') = 'b2-challenge-365-v1'
   AND (SELECT active_total_days FROM curriculum_catalog WHERE curriculum_id = 'english-os-core') = 365
   AND (SELECT COUNT(*) FROM pragma_foreign_key_check) = 0
  THEN 1 ELSE 0
END;

DROP TABLE curriculum_0012_migration_guard;

PRAGMA defer_foreign_keys = OFF;
