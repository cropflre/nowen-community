# NOWEN Community · 弄文社区

分享经验、解决问题、一起创造。

**当前状态：Phase 1 基础工程 / 邀请制内测准备中。未开放公众注册、发帖、回复或审核。**

基于 Cloudflare Workers、React、TypeScript、Vite、Tailwind CSS 4、Hono、Drizzle ORM、D1 构建。与 NOWEN 官网、官网留言板、Nowen Note 生产数据库完全隔离。

## 已实现的功能

- 社区基础 UI：明暗主题、移动端布局、版块、最新与热门排序、搜索、分页、空状态。
- Hono 只读 API：GET /api/health、GET /api/v1/categories、GET /api/v1/topics、GET /api/v1/topics/:slug。
- 主题页 SEO：GET /t/:slug 服务端输出真实主题 HTML、title、description 与 canonical；未发布内容不能通过公共接口读取。
- 独立数据库模型：用户、邀请码、会话、版块、主题、回复、收藏、点赞、举报、审计、附件。
- 安全默认值：禁用 workers.dev，独立 D1 已创建且完成手动 SQL 初始化，全部写接口关闭。
- CI：类型检查、单元与 API 安全边界测试、构建。

**尚未实现：** 邀请注册、登录、写入/回复/点赞、Markdown 编辑器、管理员审核、Turnstile、R2 上传、持久限流与 E2E。这些功能将在后续阶段实现，不能将基础工程宣传为论坛已上线。

## 本地运行

需要 Node.js 22+。依赖在首次 npm install 时安装。

~~~bash
npm install
npm run db:local
npm run dev
~~~

在本地 Wrangler D1 模拟环境测试。首次安装后建议将生成的 package-lock.json 提交到下一 PR，以锁定生产依赖。

## Cloudflare 预发布准备（不要直接执行生产部署）

~~~bash
npx wrangler d1 create nowen-community-db
# 独立 D1 已经创建，wrangler.jsonc 已写入其真实 ID；核对后才执行下一条迁移命令
npx wrangler d1 migrations apply nowen-community-db --remote
~~~

禁止填写 nowen-site-stats 或 Nowen Note 的 database_id。生产域名 community.nowen.cn 在完成后续阶段的安全、SEO 与合规验收之前不得开放公众发帖。

查看 docs/ARCHITECTURE.md 和 docs/ROADMAP.md 了解后续阶段及发布门禁。

## 开源许可

尚未指定开源许可证；在正式公开发布前需确定许可证并提交 LICENSE 文件。

**远端资源实际状态（2026-10-29）：** 已创建独立 nowen-community-db，应用 0001_init.sql 的 SQL 并查询确认 11 张业务表、6 条默认板块。使用 Cloudflare API 手动执行 SQL 不会登记 Wrangler 的 d1_migrations 记录；首次使用 wrangler migrations apply --remote 时会重放幂等 0001_init.sql 并登记，必须审阅运行输出。尚未部署 Worker 或绑定 community.nowen.cn。
