-- Phase 3: audit-safe notifications for reviewed discussions.
CREATE TABLE IF NOT EXISTS notifications (
 id TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL REFERENCES users(id),
 kind TEXT NOT NULL CHECK(kind IN ('topic_published','reply_approved')),
 target_id TEXT NOT NULL,
 dedupe_key TEXT NOT NULL UNIQUE,
 read_at INTEGER,
 created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id,read_at,created_at);
