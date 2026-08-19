-- Snapshot every historically inconsistent row before changing it so the
-- repair updates the authoritative row, sync mirror, and change feed together
-- instead of allowing an older mirror to reappear.

-- Older releases recorded delete mirrors without removing their physical D1
-- rows. First preserve semantic mistakes that are still referenced by a live
-- session, then repair any mirror whose latest-session pointer was deleted.
UPDATE mistakes
SET session_id = (
  SELECT replacement.id
  FROM sync_entities AS mirror
  JOIN session_imports AS replacement
    ON replacement.learner_id = mirror.learner_id
   AND replacement.external_session_id = json_extract(mirror.payload_json, '$.sessionId')
  WHERE mirror.learner_id = mistakes.learner_id
    AND mirror.entity_type = 'mistake'
    AND mirror.entity_id = mistakes.id
    AND mirror.operation = 'upsert'
    AND NOT EXISTS (
      SELECT 1 FROM sync_entities AS replacement_tombstone
      WHERE replacement_tombstone.learner_id = replacement.learner_id
        AND replacement_tombstone.entity_type = 'session'
        AND replacement_tombstone.entity_id = replacement.external_session_id
        AND replacement_tombstone.operation = 'delete'
    )
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1
  FROM session_imports AS owner
  JOIN sync_entities AS tombstone
    ON tombstone.learner_id = owner.learner_id
   AND tombstone.entity_type = 'session'
   AND tombstone.entity_id = owner.external_session_id
   AND tombstone.operation = 'delete'
  WHERE owner.id = mistakes.session_id AND owner.learner_id = mistakes.learner_id
)
AND EXISTS (
  SELECT 1
  FROM sync_entities AS mirror
  JOIN session_imports AS replacement
    ON replacement.learner_id = mirror.learner_id
   AND replacement.external_session_id = json_extract(mirror.payload_json, '$.sessionId')
  WHERE mirror.learner_id = mistakes.learner_id
    AND mirror.entity_type = 'mistake'
    AND mirror.entity_id = mistakes.id
    AND mirror.operation = 'upsert'
    AND NOT EXISTS (
      SELECT 1 FROM sync_entities AS replacement_tombstone
      WHERE replacement_tombstone.learner_id = replacement.learner_id
        AND replacement_tombstone.entity_type = 'session'
        AND replacement_tombstone.entity_id = replacement.external_session_id
        AND replacement_tombstone.operation = 'delete'
    )
);

DROP TABLE IF EXISTS migration_0007_mistake_reparents;
CREATE TABLE migration_0007_mistake_reparents (
  learner_id TEXT NOT NULL,
  mistake_id TEXT NOT NULL,
  replacement_session_id TEXT NOT NULL,
  mutation_id TEXT NOT NULL,
  PRIMARY KEY (learner_id, mistake_id),
  UNIQUE (learner_id, mutation_id)
);

INSERT INTO migration_0007_mistake_reparents (
  learner_id, mistake_id, replacement_session_id, mutation_id
)
SELECT mirror.learner_id, mirror.entity_id, owner.external_session_id,
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) ||
  '-4' || substr(lower(hex(randomblob(2))), 2) || '-' ||
  substr('89ab', (random() & 3) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' ||
  lower(hex(randomblob(6)))
FROM sync_entities AS mirror
JOIN mistakes AS item
  ON item.learner_id = mirror.learner_id AND item.id = mirror.entity_id
JOIN session_imports AS owner ON owner.id = item.session_id
WHERE mirror.entity_type = 'mistake' AND mirror.operation = 'upsert'
  AND EXISTS (
    SELECT 1 FROM sync_entities AS deleted_session
    WHERE deleted_session.learner_id = mirror.learner_id
      AND deleted_session.entity_type = 'session'
      AND deleted_session.entity_id = json_extract(mirror.payload_json, '$.sessionId')
      AND deleted_session.operation = 'delete'
  )
  AND NOT EXISTS (
    SELECT 1 FROM sync_entities AS owner_tombstone
    WHERE owner_tombstone.learner_id = owner.learner_id
      AND owner_tombstone.entity_type = 'session'
      AND owner_tombstone.entity_id = owner.external_session_id
      AND owner_tombstone.operation = 'delete'
  );

UPDATE sync_entities
SET payload_json = json_set(
      payload_json,
      '$.sessionId',
      (
        SELECT repair.replacement_session_id
        FROM migration_0007_mistake_reparents AS repair
        WHERE repair.learner_id = sync_entities.learner_id
          AND repair.mistake_id = sync_entities.entity_id
      )
    ),
    version = version + 1,
    last_mutation_id = (
      SELECT repair.mutation_id
      FROM migration_0007_mistake_reparents AS repair
      WHERE repair.learner_id = sync_entities.learner_id
        AND repair.mistake_id = sync_entities.entity_id
    ),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE entity_type = 'mistake' AND operation = 'upsert'
  AND EXISTS (
    SELECT 1 FROM migration_0007_mistake_reparents AS repair
    WHERE repair.learner_id = sync_entities.learner_id
      AND repair.mistake_id = sync_entities.entity_id
  );

INSERT INTO change_log (
  learner_id, entity_type, entity_id, operation, payload_json, operation_id, changed_at
)
SELECT mirror.learner_id, 'sync:mistake', mirror.entity_id, 'upsert',
  json_object('payload', json(mirror.payload_json), 'version', mirror.version),
  repair.mutation_id, mirror.updated_at
FROM migration_0007_mistake_reparents AS repair
JOIN sync_entities AS mirror
  ON mirror.learner_id = repair.learner_id
 AND mirror.entity_type = 'mistake'
 AND mirror.entity_id = repair.mistake_id;

-- Capture every live mirror whose physical source is about to disappear. The
-- staged UUID keeps the mirror and change-feed operation identical per entity.
DROP TABLE IF EXISTS migration_0007_cascade_tombstones;
CREATE TABLE migration_0007_cascade_tombstones (
  learner_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  mutation_id TEXT NOT NULL,
  PRIMARY KEY (learner_id, entity_type, entity_id),
  UNIQUE (learner_id, mutation_id)
);

INSERT OR IGNORE INTO migration_0007_cascade_tombstones (
  learner_id, entity_type, entity_id, mutation_id
)
SELECT entity.learner_id, entity.entity_type, entity.entity_id,
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) ||
  '-4' || substr(lower(hex(randomblob(2))), 2) || '-' ||
  substr('89ab', (random() & 3) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' ||
  lower(hex(randomblob(6)))
FROM sync_entities AS entity
WHERE entity.operation = 'upsert'
  AND (
    (entity.entity_type = 'mistake' AND entity.entity_id IN (
      SELECT item.id FROM mistakes AS item
      JOIN session_imports AS owner ON owner.id = item.session_id
      JOIN sync_entities AS tombstone
        ON tombstone.learner_id = owner.learner_id
       AND tombstone.entity_type = 'session'
       AND tombstone.entity_id = owner.external_session_id
       AND tombstone.operation = 'delete'
      WHERE owner.learner_id = entity.learner_id
    ))
    OR (entity.entity_type = 'learning-item' AND entity.entity_id IN (
      SELECT item.id FROM vocabulary AS item
      JOIN session_imports AS owner ON owner.id = item.session_id
      JOIN sync_entities AS tombstone
        ON tombstone.learner_id = owner.learner_id
       AND tombstone.entity_type = 'session'
       AND tombstone.entity_id = owner.external_session_id
       AND tombstone.operation = 'delete'
      WHERE owner.learner_id = entity.learner_id
      UNION ALL
      SELECT item.id FROM phrases AS item
      JOIN session_imports AS owner ON owner.id = item.session_id
      JOIN sync_entities AS tombstone
        ON tombstone.learner_id = owner.learner_id
       AND tombstone.entity_type = 'session'
       AND tombstone.entity_id = owner.external_session_id
       AND tombstone.operation = 'delete'
      WHERE owner.learner_id = entity.learner_id
    ))
    OR (entity.entity_type = 'grammar-progress' AND entity.entity_id IN (
      SELECT 'preview:' || item.topic_key FROM grammar_previews AS item
      JOIN session_imports AS owner ON owner.id = item.session_id
      JOIN sync_entities AS tombstone
        ON tombstone.learner_id = owner.learner_id
       AND tombstone.entity_type = 'session'
       AND tombstone.entity_id = owner.external_session_id
       AND tombstone.operation = 'delete'
      WHERE owner.learner_id = entity.learner_id
    ))
    OR (entity.entity_type = 'acquisition-event' AND (
      json_extract(entity.payload_json, '$.sourceSessionId') IN (
        SELECT entity_id FROM sync_entities
        WHERE learner_id = entity.learner_id AND entity_type = 'session' AND operation = 'delete'
      )
      OR json_extract(entity.payload_json, '$.entityId') IN (
        SELECT entity_id FROM sync_entities
        WHERE learner_id = entity.learner_id AND entity_type = 'learning-item' AND operation = 'delete'
      )
      OR 'preview:' || json_extract(entity.payload_json, '$.entityId') IN (
        SELECT entity_id FROM sync_entities
        WHERE learner_id = entity.learner_id AND entity_type = 'grammar-progress' AND operation = 'delete'
      )
    ))
    OR (entity.entity_type = 'review-card' AND (
      (json_extract(entity.payload_json, '$.sourceType') = 'session'
       AND json_extract(entity.payload_json, '$.sourceId') IN (
         SELECT entity_id FROM sync_entities
         WHERE learner_id = entity.learner_id AND entity_type = 'session' AND operation = 'delete'
       ))
      OR (json_extract(entity.payload_json, '$.sourceType') = 'mistake'
       AND json_extract(entity.payload_json, '$.sourceId') IN (
         SELECT entity_id FROM sync_entities
         WHERE learner_id = entity.learner_id AND entity_type = 'mistake' AND operation = 'delete'
         UNION ALL
         SELECT item.id FROM mistakes AS item
         JOIN session_imports AS owner ON owner.id = item.session_id
         JOIN sync_entities AS tombstone
           ON tombstone.learner_id = owner.learner_id
          AND tombstone.entity_type = 'session'
          AND tombstone.entity_id = owner.external_session_id
          AND tombstone.operation = 'delete'
         WHERE owner.learner_id = entity.learner_id
       ))
      OR json_extract(entity.payload_json, '$.sourceId') IN (
        SELECT entity_id FROM sync_entities
        WHERE learner_id = entity.learner_id AND entity_type = 'learning-item' AND operation = 'delete'
        UNION ALL
        SELECT item.id FROM vocabulary AS item
        JOIN session_imports AS owner ON owner.id = item.session_id
        JOIN sync_entities AS tombstone
          ON tombstone.learner_id = owner.learner_id
         AND tombstone.entity_type = 'session'
         AND tombstone.entity_id = owner.external_session_id
         AND tombstone.operation = 'delete'
        WHERE owner.learner_id = entity.learner_id
        UNION ALL
        SELECT item.id FROM phrases AS item
        JOIN session_imports AS owner ON owner.id = item.session_id
        JOIN sync_entities AS tombstone
          ON tombstone.learner_id = owner.learner_id
         AND tombstone.entity_type = 'session'
         AND tombstone.entity_id = owner.external_session_id
         AND tombstone.operation = 'delete'
        WHERE owner.learner_id = entity.learner_id
      )
    ))
  );

INSERT OR IGNORE INTO migration_0007_cascade_tombstones (
  learner_id, entity_type, entity_id, mutation_id
)
SELECT event.learner_id, event.entity_type, event.entity_id,
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) ||
  '-4' || substr(lower(hex(randomblob(2))), 2) || '-' ||
  substr('89ab', (random() & 3) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' ||
  lower(hex(randomblob(6)))
FROM sync_entities AS event
WHERE event.entity_type = 'review-event' AND event.operation = 'upsert'
  AND json_extract(event.payload_json, '$.cardId') IN (
    SELECT entity_id FROM sync_entities
    WHERE learner_id = event.learner_id AND entity_type = 'review-card' AND operation = 'delete'
    UNION ALL
    SELECT entity_id FROM migration_0007_cascade_tombstones
    WHERE learner_id = event.learner_id AND entity_type = 'review-card'
  );

UPDATE sync_entities
SET operation = 'delete',
    payload_json = 'null',
    version = version + 1,
    last_mutation_id = (
      SELECT stage.mutation_id
      FROM migration_0007_cascade_tombstones AS stage
      WHERE stage.learner_id = sync_entities.learner_id
        AND stage.entity_type = sync_entities.entity_type
        AND stage.entity_id = sync_entities.entity_id
    ),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE EXISTS (
  SELECT 1 FROM migration_0007_cascade_tombstones AS stage
  WHERE stage.learner_id = sync_entities.learner_id
    AND stage.entity_type = sync_entities.entity_type
    AND stage.entity_id = sync_entities.entity_id
);

INSERT INTO change_log (
  learner_id, entity_type, entity_id, operation, payload_json, operation_id, changed_at
)
SELECT mirror.learner_id, 'sync:' || mirror.entity_type, mirror.entity_id, 'delete',
  json_object('payload', NULL, 'version', mirror.version),
  stage.mutation_id, mirror.updated_at
FROM migration_0007_cascade_tombstones AS stage
JOIN sync_entities AS mirror
  ON mirror.learner_id = stage.learner_id
 AND mirror.entity_type = stage.entity_type
 AND mirror.entity_id = stage.entity_id;

-- Remove every physical row covered by a direct or cascaded tombstone. Review
-- cards and acquisition identities are removed before their source rows.
DELETE FROM review_cards
WHERE EXISTS (
  SELECT 1 FROM sync_entities AS tombstone
  WHERE tombstone.learner_id = review_cards.learner_id
    AND tombstone.entity_type = 'review-card'
    AND tombstone.entity_id = review_cards.id
    AND tombstone.operation = 'delete'
)
OR (source_type = 'session' AND EXISTS (
  SELECT 1 FROM session_imports AS owner
  JOIN sync_entities AS tombstone
    ON tombstone.learner_id = owner.learner_id
   AND tombstone.entity_type = 'session'
   AND tombstone.entity_id = owner.external_session_id
   AND tombstone.operation = 'delete'
  WHERE owner.learner_id = review_cards.learner_id
    AND review_cards.source_id LIKE owner.id || ':review:%'
))
OR (source_type = 'mistake' AND EXISTS (
  SELECT 1 FROM mistakes AS item
  JOIN session_imports AS owner ON owner.id = item.session_id
  JOIN sync_entities AS tombstone
    ON tombstone.learner_id = owner.learner_id
   AND tombstone.entity_type = 'session'
   AND tombstone.entity_id = owner.external_session_id
   AND tombstone.operation = 'delete'
  WHERE item.learner_id = review_cards.learner_id AND item.id = review_cards.source_id
))
OR (source_type IN ('vocabulary', 'phrase') AND EXISTS (
  SELECT 1 FROM (
    SELECT id, learner_id, session_id FROM vocabulary
    UNION ALL
    SELECT id, learner_id, session_id FROM phrases
  ) AS item
  JOIN session_imports AS owner ON owner.id = item.session_id
  JOIN sync_entities AS tombstone
    ON tombstone.learner_id = owner.learner_id
   AND tombstone.entity_type = 'session'
   AND tombstone.entity_id = owner.external_session_id
   AND tombstone.operation = 'delete'
  WHERE item.learner_id = review_cards.learner_id AND item.id = review_cards.source_id
));

DELETE FROM review_events
WHERE EXISTS (
  SELECT 1 FROM sync_entities AS tombstone
  WHERE tombstone.learner_id = review_events.learner_id
    AND tombstone.entity_type = 'review-event'
    AND tombstone.entity_id = review_events.id
    AND tombstone.operation = 'delete'
);

DELETE FROM acquisition_identities
WHERE EXISTS (
  SELECT 1 FROM sync_entities AS tombstone
  WHERE tombstone.learner_id = acquisition_identities.learner_id
    AND tombstone.operation = 'delete'
    AND (
      (tombstone.entity_type = 'learning-item'
       AND tombstone.entity_id = acquisition_identities.entity_id)
      OR (tombstone.entity_type = 'grammar-progress'
       AND tombstone.entity_id = 'preview:' || acquisition_identities.canonical_text)
    )
);

DELETE FROM vocabulary
WHERE EXISTS (
  SELECT 1 FROM sync_entities AS tombstone
  WHERE tombstone.learner_id = vocabulary.learner_id
    AND tombstone.entity_type = 'learning-item'
    AND tombstone.entity_id = vocabulary.id
    AND tombstone.operation = 'delete'
);

DELETE FROM phrases
WHERE EXISTS (
  SELECT 1 FROM sync_entities AS tombstone
  WHERE tombstone.learner_id = phrases.learner_id
    AND tombstone.entity_type = 'learning-item'
    AND tombstone.entity_id = phrases.id
    AND tombstone.operation = 'delete'
);

DELETE FROM grammar_previews
WHERE EXISTS (
  SELECT 1 FROM sync_entities AS tombstone
  WHERE tombstone.learner_id = grammar_previews.learner_id
    AND tombstone.entity_type = 'grammar-progress'
    AND tombstone.entity_id = 'preview:' || grammar_previews.topic_key
    AND tombstone.operation = 'delete'
);

DELETE FROM mistakes
WHERE EXISTS (
  SELECT 1 FROM sync_entities AS tombstone
  WHERE tombstone.learner_id = mistakes.learner_id
    AND tombstone.entity_type = 'mistake'
    AND tombstone.entity_id = mistakes.id
    AND tombstone.operation = 'delete'
);

DELETE FROM session_imports
WHERE EXISTS (
  SELECT 1 FROM sync_entities AS tombstone
  WHERE tombstone.learner_id = session_imports.learner_id
    AND tombstone.entity_type = 'session'
    AND tombstone.entity_id = session_imports.external_session_id
    AND tombstone.operation = 'delete'
);

DELETE FROM daily_progress
WHERE EXISTS (
  SELECT 1 FROM sync_entities AS tombstone
  WHERE tombstone.learner_id = daily_progress.learner_id
    AND tombstone.entity_type = 'daily-progress'
    AND tombstone.entity_id = 'study:' || daily_progress.study_date || ':curriculum:' || daily_progress.curriculum_day
    AND tombstone.operation = 'delete'
);

DELETE FROM assessments
WHERE EXISTS (
  SELECT 1 FROM sync_entities AS tombstone
  WHERE tombstone.learner_id = assessments.learner_id
    AND tombstone.entity_type = 'assessment'
    AND tombstone.entity_id = assessments.id
    AND tombstone.operation = 'delete'
);

DROP TABLE migration_0007_cascade_tombstones;
DROP TABLE migration_0007_mistake_reparents;

DROP TABLE IF EXISTS migration_0007_progress_repairs;
CREATE TABLE migration_0007_progress_repairs (
  learner_id TEXT NOT NULL,
  study_date TEXT NOT NULL,
  curriculum_day INTEGER,
  mirror_operation TEXT,
  mirror_version INTEGER,
  PRIMARY KEY (learner_id, study_date)
);

INSERT INTO migration_0007_progress_repairs (
  learner_id, study_date, curriculum_day, mirror_operation, mirror_version
)
SELECT progress.learner_id, progress.study_date, progress.curriculum_day,
  mirror.operation, mirror.version
FROM daily_progress AS progress
LEFT JOIN sync_entities AS mirror
  ON mirror.learner_id = progress.learner_id
 AND mirror.entity_type = 'daily-progress'
 AND mirror.entity_id = 'study:' || progress.study_date || ':curriculum:' || progress.curriculum_day
WHERE (
  progress.core_voice_imported = 1
  AND NOT EXISTS (
    SELECT 1
    FROM session_imports
    WHERE session_imports.learner_id = progress.learner_id
      AND session_imports.study_date = progress.study_date
      AND session_imports.curriculum_day = progress.curriculum_day
      AND session_imports.kind = 'core'
  )
) OR progress.core_completed != CASE
  WHEN progress.review_completed = 1
    AND progress.grammar_completed = 1
    AND progress.core_voice_imported = 1
  THEN 1 ELSE 0
END;

-- Historical delete mirrors are authoritative. Older releases could leave
-- their physical rows behind; remove those rows without reviving or
-- downgrading the tombstone.
DELETE FROM daily_progress
WHERE EXISTS (
  SELECT 1
  FROM migration_0007_progress_repairs AS repair
  WHERE repair.learner_id = daily_progress.learner_id
    AND repair.study_date = daily_progress.study_date
    AND repair.mirror_operation = 'delete'
);

UPDATE daily_progress
SET core_voice_imported = CASE
      WHEN core_voice_imported = 1 AND EXISTS (
        SELECT 1
        FROM session_imports
        WHERE session_imports.learner_id = daily_progress.learner_id
          AND session_imports.study_date = daily_progress.study_date
          AND session_imports.curriculum_day = daily_progress.curriculum_day
          AND session_imports.kind = 'core'
      ) THEN 1 ELSE 0
    END,
    core_completed = CASE
      WHEN review_completed = 1
        AND grammar_completed = 1
        AND core_voice_imported = 1
        AND EXISTS (
          SELECT 1
          FROM session_imports
          WHERE session_imports.learner_id = daily_progress.learner_id
            AND session_imports.study_date = daily_progress.study_date
            AND session_imports.curriculum_day = daily_progress.curriculum_day
            AND session_imports.kind = 'core'
        )
      THEN 1 ELSE 0
    END,
    version = MAX(
      version,
      COALESCE((
        SELECT repair.mirror_version
        FROM migration_0007_progress_repairs AS repair
        WHERE repair.learner_id = daily_progress.learner_id
          AND repair.study_date = daily_progress.study_date
      ), 0)
    ) + 1,
    last_mutation_id = lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) ||
      '-4' || substr(lower(hex(randomblob(2))), 2) || '-' ||
      substr('89ab', (random() & 3) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' ||
      lower(hex(randomblob(6))),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE EXISTS (
  SELECT 1
  FROM migration_0007_progress_repairs AS repair
  WHERE repair.learner_id = daily_progress.learner_id
    AND repair.study_date = daily_progress.study_date
    AND COALESCE(repair.mirror_operation, 'upsert') = 'upsert'
);

INSERT INTO sync_entities (
  learner_id, entity_type, entity_id, operation, payload_json,
  version, last_mutation_id, updated_at
)
SELECT progress.learner_id, 'daily-progress',
  'study:' || progress.study_date || ':curriculum:' || progress.curriculum_day,
  'upsert',
  json_object(
    'id', 'study:' || progress.study_date || ':curriculum:' || progress.curriculum_day,
    'studyDate', progress.study_date,
    'curriculumDay', progress.curriculum_day,
    'reviewsCompleted', json(CASE progress.review_completed WHEN 1 THEN 'true' ELSE 'false' END),
    'grammarCompleted', json(CASE progress.grammar_completed WHEN 1 THEN 'true' ELSE 'false' END),
    'coreSessionImported', json(CASE progress.core_voice_imported WHEN 1 THEN 'true' ELSE 'false' END),
    'coreCompleted', json(CASE progress.core_completed WHEN 1 THEN 'true' ELSE 'false' END),
    'version', progress.version,
    'updatedAt', progress.updated_at
  ),
  progress.version, progress.last_mutation_id, progress.updated_at
FROM daily_progress AS progress
JOIN migration_0007_progress_repairs AS repair
  ON repair.learner_id = progress.learner_id
 AND repair.study_date = progress.study_date
WHERE progress.curriculum_day IS NOT NULL
  AND COALESCE(repair.mirror_operation, 'upsert') = 'upsert'
ON CONFLICT(learner_id, entity_type, entity_id) DO UPDATE SET
  operation = excluded.operation,
  payload_json = excluded.payload_json,
  version = excluded.version,
  last_mutation_id = excluded.last_mutation_id,
  updated_at = excluded.updated_at;

INSERT INTO change_log (
  learner_id, entity_type, entity_id, operation, payload_json, operation_id, changed_at
)
SELECT progress.learner_id, 'sync:daily-progress',
  'study:' || progress.study_date || ':curriculum:' || progress.curriculum_day,
  'upsert',
  json_object(
    'payload', json_object(
      'id', 'study:' || progress.study_date || ':curriculum:' || progress.curriculum_day,
      'studyDate', progress.study_date,
      'curriculumDay', progress.curriculum_day,
      'reviewsCompleted', json(CASE progress.review_completed WHEN 1 THEN 'true' ELSE 'false' END),
      'grammarCompleted', json(CASE progress.grammar_completed WHEN 1 THEN 'true' ELSE 'false' END),
      'coreSessionImported', json(CASE progress.core_voice_imported WHEN 1 THEN 'true' ELSE 'false' END),
      'coreCompleted', json(CASE progress.core_completed WHEN 1 THEN 'true' ELSE 'false' END),
      'version', progress.version,
      'updatedAt', progress.updated_at
    ),
    'version', progress.version
  ),
  progress.last_mutation_id,
  progress.updated_at
FROM daily_progress AS progress
JOIN migration_0007_progress_repairs AS repair
  ON repair.learner_id = progress.learner_id
 AND repair.study_date = progress.study_date
WHERE progress.curriculum_day IS NOT NULL
  AND COALESCE(repair.mirror_operation, 'upsert') = 'upsert';

DROP TABLE migration_0007_progress_repairs;

CREATE TRIGGER daily_progress_insert_guard
BEFORE INSERT ON daily_progress
FOR EACH ROW
WHEN (
  NEW.core_completed != CASE
    WHEN NEW.review_completed = 1 AND NEW.grammar_completed = 1 AND NEW.core_voice_imported = 1
    THEN 1 ELSE 0
  END
  OR (
    NEW.core_voice_imported = 1 AND NOT EXISTS (
      SELECT 1 FROM session_imports
      WHERE learner_id = NEW.learner_id
        AND study_date = NEW.study_date
        AND curriculum_day = NEW.curriculum_day
        AND kind = 'core'
    )
  )
)
BEGIN
  SELECT RAISE(ABORT, 'daily_progress_insert_invariant');
END;

CREATE TRIGGER daily_progress_update_guard
BEFORE UPDATE OF curriculum_day, review_completed, grammar_completed,
  core_voice_imported, core_completed ON daily_progress
FOR EACH ROW
WHEN (
  NEW.core_completed != CASE
    WHEN NEW.review_completed = 1 AND NEW.grammar_completed = 1 AND NEW.core_voice_imported = 1
    THEN 1 ELSE 0
  END
  OR (
    NEW.core_voice_imported = 1 AND NOT EXISTS (
      SELECT 1 FROM session_imports
      WHERE learner_id = NEW.learner_id
        AND study_date = NEW.study_date
        AND curriculum_day = NEW.curriculum_day
        AND kind = 'core'
    )
  )
)
BEGIN
  SELECT RAISE(ABORT, 'daily_progress_update_invariant');
END;
