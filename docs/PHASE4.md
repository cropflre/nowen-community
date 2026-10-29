# Phase 4 · 发布工程与验收手册

## 当前真实状态（2026-10-29，依据 Cloudflare 与 GitHub 实测）

- Phase 1–4 已全部合并到 `main`，主分支 CI 和浏览器 E2E 已通过。
- 独立 D1 `nowen-community-db` 已应用并验证 `0001_init.sql` / `0002_members.sql` / `0003_notifications.sql`；远端 `d1_migrations` 台账存在。
- 已创建**私有** R2 `nowen-community-assets`；`r2.dev` 关闭、无公开存储域名。
- 独立 Turnstile `nowen-community` 已创建，Managed 模式，仅绑定 `community.nowen.cn`；**公开 Site Key** 由 `wrangler.jsonc` 的 `vars.TURNSTILE_SITE_KEY` 配置，Secret Key 仅保存在受保护的 GitHub Environment 中。
- 尚未部署论坛 Worker 或绑定 `community.nowen.cn`；实际 Turnstile Siteverify、国内网络和论坛合规仍待验证。

## 本阶段工作

1. 增加 Playwright Chromium 桌面、Pixel 移动端测试：官网、主题切换、邀请制注册、草稿自动保存、待审核状态、普通用户禁止访问管理后台。仅本地隔离的 D1 与 R2 模拟器运行。失败时存 7 天截图和 trace。
2. 新增 `.github/workflows/release-community.yml`，只允许 `workflow_dispatch`。先执行源码检查和 Cloudflare **只读**资源审计；部署必须在 main 上、人工配置环境 `community-internal-release` 并启用审核规则。
3. `deploy-inert-worker` 只部署 `workers_dev=false`、不附加任何公开域名/路由的 Worker，随后设置 Turnstile 密钥；不运行远端数据库迁移，不修改 DNS，也不启用公众注册。
4. `scripts/release-preflight.mjs` 校验独立 D1 的必要表、迁移台账、独立 R2、未绑定生产域名。发现任何资源或权限异常时 **fail closed**。

## 需要在 Cloudflare 控制台完成的操作

- R2 已开通并创建独立私有 `nowen-community-assets` Bucket。继续保持 r2.dev 和公共存储域名关闭。
- Turnstile Widget 已创建，公开 Site Key 已写入 Wrangler 配置；不要复用 NOWEN 官网留言板的密钥。**需将私有 Secret Key 配置到 GitHub 受保护 Environment**，并在实际域名部署后验收 Siteverify。
- D1 三项迁移与台账已远端核验。再次部署前仍需保留独立可恢复备份并验证恢复流程；不重复执行已应用迁移。
- 上线前检查法律合规、论坛内容规则、举报响应与个人信息收集要求。**邀请内测与公开论坛不是同一验收标准。**

## GitHub Actions 凭据、环境与审批

仓库 `cropflre/nowen-community` 中应建立 GitHub Actions secrets：
- `CLOUDFLARE_API_TOKEN`，仅授权必要的 Workers Scripts、D1、R2 和相关 Zone 权限；
- `CLOUDFLARE_ACCOUNT_ID`，Cloudflare 账户 ID。

在仓库 Settings → Environments 建立 `community-internal-release`，添加 Required reviewers，再在**这个 Environment 内**配置：
- `COMMUNITY_RELEASE_UNLOCK` 值为 `INTERNAL_UNROUTED_WORKER_ONLY`；
- `COMMUNITY_TURNSTILE_SECRET_KEY`（Worker 的服务端密钥，不放代码仓库）；
- Site Key 是公开配置，已包含于 `wrangler.jsonc`，**不需要**另建 `COMMUNITY_TURNSTILE_SITE_KEY` GitHub Secret。

环境必须配置人工审批，否则 GitHub 不会自动提供保护。若令牌、环境或 R2 未准备好，工作流应明确失败，不允许绕过。

> 注意：发布工作流只负责内部不公开 Worker。绑定 `community.nowen.cn` 需要在完整合规、网络、登录、安全和媒体审核验收后，再通过单独的发布审批流程进行。

## 执行顺序

1. PR #1 / #8 / #9 / #10 / #11 已合并；合并本次 Turnstile 配置 PR 后重新检查主分支 CI。
2. 检查 CI + Playwright E2E 全部通过；检查 D1/R2 资源、Turnstile 密钥。
3. 在本地备份远端 D1（先确认 Wrangler 命令与导出目标环境）：

   ```bash
   npx wrangler d1 export nowen-community-db --remote --output ./community-backup.sql
   ```

   备份文件包含用户账号与内容，必须加密保存，**绝不可提交 GitHub 或上传公开 CI Artifact**。

4. 核对 `d1_migrations` 台账与 `sqlite_master` 实际表，确认未遗漏迁移，记录导出校验和。
5. 手动运行 GitHub Actions → **NOWEN Community Manual Release** → `preflight`。如果资源状态、权限或迁移台账发生异常，必须停止。
6. 配置 GitHub Environment 人工审批，选择 `deploy-inert-worker`。部署后确认无 Workers.dev 可用 URL、没有 Custom Domain 或 Worker 路由。
7. 后续另行建立可访问的 staging 子域名并对中国大陆电信/联通/移动以及手机宽带进行浏览器测试：HTTPS、登录 Cookie、验证码、反滥用、权限和图片。
8. 最终生产绑定前，测试 Workers 版本回滚；D1 不依赖 Worker 回滚自动还原，应独立演练 Time Travel/导出恢复；R2 数据应具备对象存档与清理方案。

## 严禁的行为

- 不得向现有 `nowen-site-stats` Worker 或官网 D1 应用此仓库的迁移。
- 不允许直接将 `LOCAL_TEST_TURNSTILE=1` 设置为远端 Worker 变量。
- 不得把论坛变成开放注册、开放公共 R2、自动部署到生产域名。
- 不允许将 D1 导出里的个人信息放到公开 GitHub Actions Artifact。

## 尚未完成的正式上线门槛

- R2 账户、私有 Bucket 已就绪；还需真实文件上传、审核与清理回归；
- 远端 D1 迁移已完成；独立完整 SQL 导出与恢复演练仍待落实；
- 实际 Cloudflare Turnstile 服务端验证；
- 真实公网环境的端到端验收（含国内线路）；
- R2 图片内容检测、恶意文件扫描、EXIF 清除与过期/拒绝文件清理；
- 论坛合规、实名核验、运营方审批；
- 生产域名切换计划、回滚演练及监控。

**本阶段合格的交付是“可审计的预发布流水线与浏览器测试”，不是“论坛已上线”。**
