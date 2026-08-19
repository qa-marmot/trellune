CREATE TABLE curriculum_0011_migration_guard (
  invariant INTEGER NOT NULL CHECK (invariant = 1)
);

INSERT INTO curriculum_0011_migration_guard (invariant)
SELECT CASE
  WHEN (SELECT active_total_days FROM curriculum_catalog WHERE curriculum_id = 'english-os-core') = 180
   AND (SELECT content_version FROM curriculum_catalog WHERE curriculum_id = 'english-os-core') = 'independent-180-v1'
   AND (
     (
       (SELECT COUNT(*) FROM curriculum_days) = 180
       AND (SELECT MIN(day_number) FROM curriculum_days) = 1
       AND (SELECT MAX(day_number) FROM curriculum_days) = 180
     )
     OR (
       (SELECT COUNT(*) FROM curriculum_days) = 90
       AND (SELECT MIN(day_number) FROM curriculum_days) = 91
       AND (SELECT MAX(day_number) FROM curriculum_days) = 180
     )
   )
  THEN 1 ELSE 0
END;

WITH RECURSIVE fluency_days(day_number) AS (
  SELECT 181
  UNION ALL
  SELECT day_number + 1 FROM fluency_days WHERE day_number < 270
)
INSERT INTO curriculum_days (day_number, phase, title, grammar_topic_key, scenario)
SELECT
  day_number,
  6,
  'Day ' || day_number,
  'd' || day_number || '-grammar',
  CASE
    WHEN day_number <= 195 THEN 'explaining-experiences-in-detail'
    WHEN day_number <= 210 THEN 'summarizing-and-retelling'
    WHEN day_number <= 225 THEN 'problems-solutions-and-decisions'
    WHEN day_number <= 240 THEN 'opinions-reasons-and-perspectives'
    WHEN day_number <= 255 THEN 'natural-interaction-and-paraphrasing'
    ELSE 'b1-plus-integration'
  END
FROM fluency_days;

INSERT INTO curriculum_0011_migration_guard (invariant)
SELECT CASE
  WHEN (
    (SELECT COUNT(*) FROM curriculum_days) = 270
    AND (SELECT MIN(day_number) FROM curriculum_days) = 1
    AND (SELECT MAX(day_number) FROM curriculum_days) = 270
  ) OR (
    (SELECT COUNT(*) FROM curriculum_days) = 180
    AND (SELECT MIN(day_number) FROM curriculum_days) = 91
    AND (SELECT MAX(day_number) FROM curriculum_days) = 270
  )
  THEN 1 ELSE 0
END;

UPDATE curriculum_catalog
SET content_version = 'fluency-270-v1', active_total_days = 270
WHERE curriculum_id = 'english-os-core'
  AND content_version = 'independent-180-v1'
  AND active_total_days = 180;

INSERT INTO curriculum_0011_migration_guard (invariant)
SELECT CASE
  WHEN (SELECT content_version FROM curriculum_catalog WHERE curriculum_id = 'english-os-core') = 'fluency-270-v1'
   AND (SELECT active_total_days FROM curriculum_catalog WHERE curriculum_id = 'english-os-core') = 270
   AND (SELECT COUNT(*) FROM pragma_foreign_key_check) = 0
  THEN 1 ELSE 0
END;

DROP TABLE curriculum_0011_migration_guard;
