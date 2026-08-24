-- Additive language-neutral storage for SESSION_JSON 1.1.
-- Legacy *_ja columns remain intact so v1.0 rows and rollback readers continue to work.

ALTER TABLE session_imports ADD COLUMN support_language TEXT NOT NULL DEFAULT 'ja'
  CHECK (support_language IN ('ja', 'en'));
ALTER TABLE session_imports ADD COLUMN summary_text TEXT;
ALTER TABLE session_imports ADD COLUMN evaluation_comment_text TEXT;
UPDATE session_imports
SET summary_text = summary_ja,
    evaluation_comment_text = evaluation_comment_ja
WHERE summary_text IS NULL OR evaluation_comment_text IS NULL;

ALTER TABLE vocabulary ADD COLUMN support_language TEXT NOT NULL DEFAULT 'ja'
  CHECK (support_language IN ('ja', 'en'));
ALTER TABLE vocabulary ADD COLUMN meaning_text TEXT;
UPDATE vocabulary SET meaning_text = meaning_ja WHERE meaning_text IS NULL;

ALTER TABLE phrases ADD COLUMN support_language TEXT NOT NULL DEFAULT 'ja'
  CHECK (support_language IN ('ja', 'en'));
ALTER TABLE phrases ADD COLUMN meaning_text TEXT;
UPDATE phrases SET meaning_text = meaning_ja WHERE meaning_text IS NULL;

ALTER TABLE grammar_previews ADD COLUMN support_language TEXT NOT NULL DEFAULT 'ja'
  CHECK (support_language IN ('ja', 'en'));
ALTER TABLE grammar_previews ADD COLUMN note_text TEXT;
UPDATE grammar_previews SET note_text = note_ja WHERE note_text IS NULL;

ALTER TABLE mistakes ADD COLUMN support_language TEXT NOT NULL DEFAULT 'ja'
  CHECK (support_language IN ('ja', 'en'));
ALTER TABLE mistakes ADD COLUMN explanation_text TEXT;
UPDATE mistakes SET explanation_text = explanation_ja WHERE explanation_text IS NULL;
