-- NOWEN Community Phase 2: additive D1 migration; tracked one-time application (ALTER TABLE is not idempotent)
CREATE TABLE IF NOT EXISTS request_limits (bucket TEXT PRIMARY KEY NOT NULL, hits INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS request_limits_expires_idx ON request_limits(expires_at);
ALTER TABLE topics ADD COLUMN client_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS topics_author_client_key_idx ON topics(author_id,client_key) WHERE client_key IS NOT NULL;
ALTER TABLE replies ADD COLUMN client_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS replies_author_client_key_idx ON replies(author_id,client_key) WHERE client_key IS NOT NULL;
