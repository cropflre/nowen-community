# Staging 主题详情页 500 修复

2026-10-29 验证：主题 `bc05c9ca-f948-4abc-8b83-127a934e35bf` 在 staging D1 的 `topics` 表中为 `published`，与 `users` / `categories` JOIN 返回正确数据，标题为 `testtesttest`。因此不是帖子丢失。

根因：`src/worker/index.ts` 中 `GET /t/:slug` 在生成 SEO HTML 时调用 `c.env.ASSETS.fetch('/')` 获取 SPA 模板，但是 `wrangler.jsonc` 的 `assets` 未配置 `binding: "ASSETS"`；线上 staging Worker 的实际绑定清单也缺少 `ASSETS`，导致调用 `undefined.fetch` 抛异常，Hono 返回 `500 internal_error`。Cloudflare 官方文档明确要求显式声明该绑定。

修复：
- 新增 Cloudflare 静态资产绑定 `ASSETS`，保留原有 `run_worker_first` 和 SPA 规则。
- 主题页在绑定异常缺失时返回明确的 503，避免无信息的 500。
- 生成产物断言 `ASSETS` 绑定；staging 资源预检和启用域名门禁都强制验证线上绑定存在。
- Phase 3 真实本地 D1+Worker smoke 新增 `/t/:slug`：待审核返回 404，已发布返回 HTML 200，检查页面标题和正文。

## 安全部署顺序

**不要在当前已开放的 staging 域名上直接运行 inert release**；发布门禁要求无入口。

1. PR CI 全绿后合并 main。
2. 手动运行 `NOWEN Community Staging Domain Gate → disable-domain`，确认成功（关闭测试站）。
3. 手动运行 `NOWEN Community Staging Release → deploy-staging-inert-worker`，确认新版本构建、`ASSETS` / D1 / R2 / Pepper / Turnstile 绑定预检全部通过。
4. 手动运行 `NOWEN Community Staging Domain Gate → check`，成功后再运行 `enable-protected-domain`（需 Environment 人工审批）。
5. 在已授权浏览器中打开 `https://staging-community.nowen.cn/t/bc05c9ca-f948-4abc-8b83-127a934e35bf`，预期 HTTP 200、主题正文显示；再验收未发布话题 404、普通会员不能进入管理页。

本修复不修改 D1 中的任何主题、用户和生产域名配置。
