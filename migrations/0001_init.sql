-- NOWEN Community: isolated D1 schema. Safe to create on a new database only.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY NOT NULL, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member','moderator','admin')), state TEXT NOT NULL DEFAULT 'active' CHECK(state IN ('active','suspended')), avatar_key TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch()));
CREATE TABLE IF NOT EXISTS invitations (id TEXT PRIMARY KEY NOT NULL, code_hash TEXT NOT NULL UNIQUE, created_by TEXT REFERENCES users(id), used_by TEXT REFERENCES users(id), expires_at INTEGER, used_at INTEGER, created_at INTEGER NOT NULL DEFAULT (unixepoch()));
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL DEFAULT (unixepoch()));
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', icon TEXT NOT NULL DEFAULT 'messages-square', sort INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL DEFAULT (unixepoch()));
CREATE TABLE IF NOT EXISTS topics (id TEXT PRIMARY KEY NOT NULL, slug TEXT NOT NULL UNIQUE, category_id TEXT NOT NULL REFERENCES categories(id), author_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, content TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('draft','pending','published','hidden')), pinned INTEGER NOT NULL DEFAULT 0, reply_count INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL DEFAULT (unixepoch()), updated_at INTEGER NOT NULL DEFAULT (unixepoch()));
CREATE INDEX IF NOT EXISTS topics_feed_idx ON topics(status,created_at);
CREATE INDEX IF NOT EXISTS topics_category_idx ON topics(category_id,status,created_at);
CREATE TABLE IF NOT EXISTS replies (id TEXT PRIMARY KEY NOT NULL, topic_id TEXT NOT NULL REFERENCES topics(id), author_id TEXT NOT NULL REFERENCES users(id), content TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','published','hidden')), created_at INTEGER NOT NULL DEFAULT (unixepoch()));
CREATE INDEX IF NOT EXISTS replies_topic_idx ON replies(topic_id,status,created_at);
CREATE TABLE IF NOT EXISTS topic_likes (topic_id TEXT NOT NULL REFERENCES topics(id), user_id TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL DEFAULT (unixepoch()), PRIMARY KEY(topic_id,user_id));
CREATE TABLE IF NOT EXISTS bookmarks (topic_id TEXT NOT NULL REFERENCES topics(id), user_id TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL DEFAULT (unixepoch()), PRIMARY KEY(topic_id,user_id));
CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY NOT NULL, reporter_id TEXT NOT NULL REFERENCES users(id), target_type TEXT NOT NULL CHECK(target_type IN ('topic','reply')), target_id TEXT NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved','dismissed')), created_at INTEGER NOT NULL DEFAULT (unixepoch()));
CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY NOT NULL, actor_id TEXT REFERENCES users(id), action TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT (unixepoch()));
CREATE TABLE IF NOT EXISTS uploads (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), object_key TEXT NOT NULL UNIQUE, content_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','approved','deleted')), created_at INTEGER NOT NULL DEFAULT (unixepoch()));
INSERT OR IGNORE INTO categories (id,name,description,icon,sort) VALUES
('note','弄文笔记','写作、同步、插件与知识管理','notebook-pen',10),
('reader','弄文阅读','漫画、小说、NAS 私人书库','book-open',20),
('video','弄文视频','影音管理、字幕与媒体库','clapperboard',30),
('showcase','作品展示','分享你的工作流与开源作品','sparkles',40),
('help','问题求助','发布疑问，与社区一起找到答案','life-buoy',50),
('chat','茶话会','轻松聊聊技术、生活与创作','coffee',60);
