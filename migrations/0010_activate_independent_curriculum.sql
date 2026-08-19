CREATE TABLE curriculum_0010_migration_guard (
  invariant INTEGER NOT NULL CHECK (invariant = 1)
);

INSERT INTO curriculum_0010_migration_guard (invariant)
SELECT CASE
  WHEN (SELECT active_total_days FROM curriculum_catalog WHERE curriculum_id = 'english-os-core') = 90
   AND (SELECT content_version FROM curriculum_catalog WHERE curriculum_id = 'english-os-core') = 'legacy-90-v1'
   AND (
     (SELECT COUNT(*) FROM curriculum_days) = 0
     OR (
       (SELECT COUNT(*) FROM curriculum_days WHERE day_number BETWEEN 1 AND 90) = 90
       AND (SELECT COUNT(*) FROM curriculum_days WHERE day_number > 90) = 0
     )
   )
  THEN 1 ELSE 0
END;

WITH RECURSIVE independent_days(day_number) AS (
  SELECT 91
  UNION ALL
  SELECT day_number + 1 FROM independent_days WHERE day_number < 180
)
INSERT INTO curriculum_days (day_number, phase, title, grammar_topic_key, scenario)
SELECT
  day_number,
  5,
  'Day ' || day_number,
  'd' || day_number || '-grammar',
  CASE
    WHEN day_number <= 105 THEN 'experiences-and-recent-events'
    WHEN day_number <= 120 THEN 'reasons-and-comparisons'
    WHEN day_number <= 135 THEN 'plans-advice-and-possibilities'
    WHEN day_number <= 150 THEN 'stories-and-explaining-events'
    WHEN day_number <= 165 THEN 'opinions-and-everyday-discussions'
    ELSE 'b1-entry-integration'
  END
FROM independent_days;

INSERT INTO curriculum_0010_migration_guard (invariant)
SELECT CASE
  WHEN (
    (SELECT COUNT(*) FROM curriculum_days) = 180
    AND (SELECT MIN(day_number) FROM curriculum_days) = 1
    AND (SELECT MAX(day_number) FROM curriculum_days) = 180
  ) OR (
    (SELECT COUNT(*) FROM curriculum_days) = 90
    AND (SELECT MIN(day_number) FROM curriculum_days) = 91
    AND (SELECT MAX(day_number) FROM curriculum_days) = 180
  )
  THEN 1 ELSE 0
END;

UPDATE curriculum_catalog
SET content_version = 'independent-180-v1', active_total_days = 180
WHERE curriculum_id = 'english-os-core'
  AND content_version = 'legacy-90-v1'
  AND active_total_days = 90;

INSERT INTO curriculum_0010_migration_guard (invariant)
SELECT CASE
  WHEN (SELECT content_version FROM curriculum_catalog WHERE curriculum_id = 'english-os-core') = 'independent-180-v1'
   AND (SELECT active_total_days FROM curriculum_catalog WHERE curriculum_id = 'english-os-core') = 180
   AND (SELECT COUNT(*) FROM pragma_foreign_key_check) = 0
  THEN 1 ELSE 0
END;

DROP TABLE curriculum_0010_migration_guard;
