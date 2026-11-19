-- P0 batch 1: question resolution + best answers, and a wider notification kind set.
-- Additive ALTERs only for topics; notifications needs a SQLite table rebuild to widen its CHECK.
ALTER TABLE topics ADD COLUMN best_reply_id TEXT;
ALTER TABLE topics ADD COLUMN solved_at INTEGER;
CREATE INDEX IF NOT EXISTS topics_solved_idx ON topics(solved_at, created_at);

CREATE TABLE IF NOT EXISTS notifications_wide (
 id TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL REFERENCES users(id),
 kind TEXT NOT NULL CHECK(kind IN ('topic_published','reply_approved','best_answer')),
 target_id TEXT NOT NULL,
 dedupe_key TEXT NOT NULL UNIQUE,
 read_at INTEGER,
 created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO notifications_wide SELECT id,user_id,kind,target_id,dedupe_key,read_at,created_at FROM notifications;
DROP TABLE notifications;
ALTER TABLE notifications_wide RENAME TO notifications;
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id,read_at,created_at);
