PRAGMA foreign_keys = ON;

WITH RECURSIVE days(day_number) AS (
  SELECT 1
  UNION ALL
  SELECT day_number + 1 FROM days WHERE day_number < 90
)
INSERT OR IGNORE INTO curriculum_days (day_number, phase, title, grammar_topic_key, scenario)
SELECT
  day_number,
  ((day_number - 1) / 15) + 1,
  'Day ' || day_number,
  'grammar-day-' || day_number,
  CASE ((day_number - 1) % 6)
    WHEN 0 THEN 'self-introduction'
    WHEN 1 THEN 'daily-routine'
    WHEN 2 THEN 'shopping'
    WHEN 3 THEN 'food-and-dining'
    WHEN 4 THEN 'travel-and-directions'
    ELSE 'plans-and-experiences'
  END
FROM days;
