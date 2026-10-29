# NOWEN Community · 弄文社区

分享经验、解决问题、一起创造。

**当前状态：Phase 1–4 代码已合并，D1 迁移和私有 R2 已就绪，Turnstile 组件已创建；Worker 尚未部署，论坛未公开运营。**

基于 Cloudflare Workers、React、TypeScript、Vite、Tailwind CSS 4、Hono、Drizzle ORM、D1 构建。与 NOWEN 官网、官网留言板、Nowen Note 生产数据库完全隔离。

## 已实现的功能

- 社区基础 UI：明暗主题、移动端布局、版块、最新与热门排序、搜索、分页、空状态。
- Hono 只读 API：GET /api/health、GET /api/v1/categories、GET /api/v1/topics、GET /api/v1/topics/:slug。
- 主题页 SEO：GET /t/:slug 服务端输出真实主题 HTML、title、description 与 canonical；未发布内容不能通过公共接口读取。
- 独立数据库模型：用户、会话（历史邀请码表保留）、版块、主题、回复、收藏、点赞、举报、审计、附件。
- 安全默认值：禁用 workers.dev，独立 D1 已创建且完成手动 SQL 初始化，全部写接口关闭。
- CI：类型检查、单元与 API 安全边界测试、构建。

**已在后续阶段开发**开放注册、登录、草稿、回复/点赞/收藏、审核后台、R2 上传、限流和 Playwright 测试。仍需真实 Cloudflare 部署、Turnstile 验证、国内网络验收及合规审查，不能宣称论坛已上线。

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
npx wrangler d1 migrations list nowen-community-db --remote
# 三项远端迁移已经完成，禁止重复执行或重建现有数据库
~~~

禁止填写 nowen-site-stats 或 Nowen Note 的 database_id。生产域名 community.nowen.cn 在完成后续阶段的安全、SEO 与合规验收之前不得开放公众发帖。

查看 docs/ARCHITECTURE.md 和 docs/ROADMAP.md 了解后续阶段及发布门禁。

## 开源许可

尚未指定开源许可证；在正式公开发布前需确定许可证并提交 LICENSE 文件。

**远端资源实际状态（2026-10-29）：** 已创建独立 nowen-community-db，应用 0001_init.sql 的 SQL 并查询确认 11 张业务表、6 条默认板块。使用 Cloudflare API 手动执行 SQL 不会登记 Wrangler 的 d1_migrations 记录；首次使用 wrangler migrations apply --remote 时会重放幂等 0001_init.sql 并登记，必须审阅运行输出。尚未部署 Worker 或绑定 community.nowen.cn。


## Phase 2（开放注册与成员讨论）

阶段 2 提供无需邀请码的用户注册、登录、可撤销会话、草稿自动保存、发帖提交待审、回复、点赞与收藏。所有用户生成内容**默认待审**，尚未实现 Phase 3 的管理员审核与防刷验收，不可直接部署公众论坛。

本地测试和邀请码签发见 [docs/PHASE2.md](docs/PHASE2.md)。任何真实远端 D1 迁移必须人工审查，保留原有数据。


## Phase 4 · 安全预发布流程

[Phase 4 发布与验收手册](docs/PHASE4.md) 包含 Playwright 浏览器回归、受控发布工作流、独立 D1/R2 验证与回滚说明。尚未对公众开放；R2 与独立 Turnstile 已创建，真实部署及国内网络测试仍待完成。


## Turnstile 配置

独立组件 `nowen-community` 已创建，公开 Site Key 已写入 Wrangler 配置。Secret Key 必须由管理员在受保护的 GitHub Environment 中设置，具体见 [Turnstile 配置指南](docs/TURNSTILE.md)。当前不公开论坛。

## Phase 5 · 独立预发布（Staging）

Cloudflare 上已建立与正式环境完全隔离的 `nowen-community-staging-db`、私有 `nowen-community-staging-assets` 和 `nowen-community-staging` Turnstile Widget。测试 D1 已应用三份迁移，保留六个社区版块。

详细配置、GitHub 手动预检、`CLOUDFLARE_ENV=staging` 构建、受保护 Worker 部署以及后续 Cloudflare Access 准入要求，见 [Phase 5 Staging 手册](docs/PHASE5_STAGING.md)。

**重要：staging 域名仅能在严格 Cloudflare Access 保护下人工开启；域名启停状态以 Cloudflare API 为准。** 若需要真实浏览器验收，必须先启用 Worker 级 Cloudflare Access 并验证未授权访问被阻止；不能直接公开测试域名。


## Phase 6 · Cloudflare Access 安全准入

Staging Worker 已部署，但未绑定测试域名。Cloudflare Zero Trust 当前尚未启用；必须先在 Cloudflare 开通 Zero Trust，给 `nowen-community-staging` 配置 **All traffic**、**指定邮箱允许名单** 的 Worker 级 Access 保护（不影响其他 NOWEN Worker）。

合并 Phase 6 PR 后可手动运行 `NOWEN Community Access Safety Gate` 只读预检；Access 未启用、策略不严格或 API Token 缺少读取权限将安全失败。**禁止直接开放 staging 域名**。具体步骤见 [Phase 6 Access 手册](docs/PHASE6_ACCESS.md)。

## Phase 7 · 受保护测试入口

新增 [Phase 7 预览验收手册](docs/PHASE7_PROTECTED_PREVIEW.md) 和手动 GitHub Actions 工作流。开启 staging workers.dev 前要求严格的 Cloudflare Access Worker 级保护；GitHub Runner 从匿名状态实测 `/` 和 `/api/health` 均被 Access 拒绝，否则自动关闭；可独立执行紧急关闭。**不启用 Version URLs、不绑定生产域名。**
