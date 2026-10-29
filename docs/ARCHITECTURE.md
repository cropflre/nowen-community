# NOWEN Community · 架构与安全边界

## 部署拓扑

community.nowen.cn -> Cloudflare Workers (静态页面 + Hono /api/*) -> 专属 D1 nowen-community-db。
后续将接入独立 R2 nowen-community-assets、Turnstile 与持久化限流。

- src/client：React + Vite + Tailwind 4、响应式双主题 UI。
- src/worker：Hono API；主题页服务端输出语义 HTML。
- src/db/schema.ts：Drizzle ORM 建模。
- migrations/0001_init.sql：专属 D1 初始化迁移，附带默认分类。
- .github/workflows/ci.yml：仅验证代码，不自动发布生产。

## 关键隔离

- 不复用官网 nowen-site-stats D1，不共享生产密钥。
- wrangler.jsonc 内数据库 ID 00000000-0000-4000-8000-000000000000 为未初始化占位值，仅便于本地工程启动。
- Cloudflare 自定义域名和实际 R2 资源将在部署审查后创建，不抢占其他 NOWEN DNS 记录。

## SEO 和内容安全

GET /t/:slug 由 Worker 查询状态为 published 的主题，生成初始可见文章、网页标题和 canonical，再由 React 接管等价内容。返回隐藏/草稿主题时应为 404。现阶段内容显示为安全纯文本，后续 Markdown 必须进行 HTML sanitize。

## 阶段 2/3 最小安全要求

- 邀请码原文不落库，仅保存哈希；一次性使用必须在数据库事务/原子条件更新下完成。
- 安全密码哈希、HttpOnly + Secure + SameSite Cookie、服务端角色判断和退出会话撤销。
- CSRF/Origin 验证、Turnstile 服务端校验、持久限流、重复提交幂等性。
- 上传文件做实际内容检测、大小约束、路径隔离、R2 私有读取和审核。
- 管理员审核/封禁动作均记入 audit_logs。
- 需完成针对越权、XSS、CSRF、SQL 注入、垃圾内容、DoS 的专项测试。

## 发布约束

所有提交先进入 feature 分支 PR；main 不自动发布。需先测试国内电信、联通、移动网络访问；再完成邀请/审核/文件安全、备份恢复、人工审批，才能启用 community.nowen.cn 对外服务。公开论坛合规条件在开放前另行核对。
