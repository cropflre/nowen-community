# NOWEN Community · 弄文社区

从零构建的 NOWEN 开源论坛，技术栈为 React、TypeScript、Vite、Tailwind CSS v4、Hono、Cloudflare Workers、Drizzle ORM 和 D1。

> 当前是 **Phase 1 Foundation**：仅社区大厅和只读 API，**不是已上线的论坛**。规划域名 community.nowen.cn。

## 启动开发

```bash
npm install
npm run db:migrate:local
# 独立终端启动 Worker API
npx wrangler dev --port 8787
# 独立终端启动 Vite Web
npm run dev
```

运行 `npm test`、`npm run check`、`npm run build` 进行测试和构建。

部署前须在 `wrangler.jsonc` 替换全新 D1 数据库 ID，占位符不能用于生产。此阶段绝不复用 `nowen-site-stats`、官网留言板或 Nowen Note 的数据资源。

## 当前实现
- 响应式社区首页、深浅主题、分类导航、站内当前帖子过滤、空态。
- 只读 API：`/api/health`、`/api/categories`、`/api/topics`、`/api/topics/:slug`。只显示 `published` 内容。
- 九张数据模型表：用户、板块、主题、回复、反应、邀请码、会话、举报和操作审计。
- 最小测试与 CI；注册、发帖、评论、审核和附件功能尚未实现，按钮显式禁用。

## 下一步
见 [docs/ROADMAP.md](docs/ROADMAP.md)。后续阶段需补充真正的注册安全、帖子 SEO SSR、管理审核、Turnstile、R2、Playwright 和生产验收。
