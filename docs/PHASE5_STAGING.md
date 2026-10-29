# Phase 5 · NOWEN Community 独立预发布环境

## 真实资源状态（2026-10-29）

| 资源 | staging（仅测试） | 当前正式/预生产资源 |
| --- | --- | --- |
| Cloudflare Worker | `nowen-community-staging`（尚未部署） | `nowen-community`（已部署、无公开域名） |
| D1 | `nowen-community-staging-db` | `nowen-community-db` |
| D1 UUID | `073ece5c-4518-4d3c-a264-d9f976020554` | `a63c9450-f93f-409d-adaf-313491e2bfc8` |
| R2 | `nowen-community-staging-assets`（私有） | `nowen-community-assets`（私有） |
| Turnstile Widget | `nowen-community-staging` | `nowen-community` |
| 允许域名 | `staging-community.nowen.cn` | `community.nowen.cn` |

- 新 D1 已按仓库的 `0001_init.sql`、`0002_members.sql`、`0003_notifications.sql` 初始化，`d1_migrations` 台账完整；六个板块存在，用户与帖子为空。
- 新 R2 只允许 Worker 经 `MEDIA` Binding 访问；`r2.dev` 和自定义 R2 域名均关闭。
- 两个 Turnstile Site Key 不同；**绝不能把生产 Secret Key 用到 staging**。
- 预留的 staging hostname **当前没有 Cloudflare DNS、Worker 路由或公开连接**。禁止跳过 Access 直接绑定。
- 资源已创建可能产生额度占用，正式使用前请设置 Cloudflare 用量与费用提醒。

## GitHub 发布工作流

增加 `NOWEN Community Staging Release`（`.github/workflows/release-community-staging.yml`）。

合并本 PR 且 CI 通过后，在仓库 **Actions** 手动执行：

1. Branch：`main`；Action：`preflight`。只做读操作，检查新 D1、R2、迁移、没有任何 staging 入口。
2. 在已有 GitHub Environment `community-internal-release` 中（启用 Required reviewers 与仅限 `main` 部署），增加 **Environment secret**：
   - `COMMUNITY_STAGING_TURNSTILE_SECRET_KEY`：Cloudflare `nowen-community-staging` Widget 的 *Secret Key*。不要存进 variables、仓库或聊天。
3. Action：`deploy-staging-inert-worker`；经 Environment 人工审核才会部署。需要现有仓库 Secrets `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`，现有 Environment Secret `COMMUNITY_RELEASE_UNLOCK=INTERNAL_UNROUTED_WORKER_ONLY`。
4. 工作流用 `CLOUDFLARE_ENV=staging npm run build` 生成正确的 Worker、D1、R2 绑定，先运行 `node scripts/assert-staging-build.mjs`，再执行 `npx wrangler deploy`。
5. 独立设置 staging 的 `TURNSTILE_SECRET_KEY`；随后通过 `STAGING_DEPLOYED=1 node scripts/staging-preflight.mjs` 校验 Worker、D1/R2/Turnstile 绑定及无公共路由。

**重要：** Cloudflare Vite 插件是在 **build 时**选择 `CLOUDFLARE_ENV`，不是在执行 Wrangler deploy 时使用 `--env staging`。这能避免意外覆盖生产 Worker。也不要在 staging 运行任何生产 D1 迁移。

## 开启真实浏览器测试前必须满足的条件

**测试域名仍未开放。** 只有完成以下安全条件才允许单独连接预发布域名：

1. 在 Cloudflare Zero Trust / Access 建立**仅允许授权测试者**的访问策略，明确核验 Policy 已生效（不允许 Bypass 或 Everyone）。
2. 对 `nowen-community-staging` Worker 启用 Cloudflare Access 的 **All traffic** 保护。建议使用 Worker 级的 Access 绑定，确保 route/custom domain/preview 都受控。
3. **先在现有内部 Worker 上验证**匿名访问被 Access 拦截，再绑定 `staging-community.nowen.cn`；禁止反过来。
4. 真实浏览器验收邀请注册、登录/登出、Cookie、Turnstile Siteverify、待审发帖/回复、管理员审核/通知、举报、图片上传与私人读取、越权访问。
5. 中国大陆电信/联通/移动 + Android/iOS 浏览器实测；无障碍与响应式回归；确认图片 EXIF、恶意内容、拒绝文件清理措施。
6. 确认备份恢复、日志监控、费用预算和正式论坛运营合规；之后才考虑 `community.nowen.cn`。

## 可执行的测试矩阵（不允许在生产库直接创建测试账号）

| 测试案例 | 预期 |
| --- | --- |
| 未认证匿名访问 staging 域名 | Cloudflare Access 登录/拒绝；不能直接加载论坛 |
| 访问 `/api/health`（已通过 Access） | 200；响应为 NOWEN Community |
| 分类列表 / 空主题列表 | 六类；无测试主题 |
| 邀请码重复注册 | 第二次拒绝 |
| 普通用户访问管理员 API | 403 |
| 登录、退出并重放旧 Cookie | 旧会话被拒绝 |
| 发帖后未审核 | 非作者不可读，公开列表不出现 |
| 管理员审核通过 | 可见，产生通知与审计记录 |
| 上传 PNG/JPEG/WebP | 正确保存到 staging R2，默认待审 |
| 未登录或越权读取未审附件 | 404 或 403 |
| 使用生产 Turnstile Site Key | Staging 不允许混用 |
| 访问正式 D1/R2 数据 | Staging 不得接触 |

本 PR 只创建独立 staging 环境的**配置、验收脚本和人工发布门禁**；实际公开访问入口仍需要独立评审。现有 `community.nowen.cn` 不变。
