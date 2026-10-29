-- Rename the community category; keep id='video' and all existing topic links.
-- Idempotent for fresh installs and deployments updated directly in Cloudflare D1.
UPDATE categories SET name='弄文影视' WHERE id='video' AND name='弄文视频';
