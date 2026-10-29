# Phase 7 · 临时受保护的 staging 浏览器入口

## 当前核验状态（2026-10-29）

- `nowen-community-staging` Worker 已部署，使用独立 staging D1 / 私有 R2 / Turnstile。
- Cloudflare Zero Trust 已启用，`NOWEN Community Staging Access` 已配置为 **staging Worker 的 All traffic** 保护，只有一个精确邮箱 Allow 策略，没有 Bypass。
- `workers.dev` 已关闭；`preview_urls` 已关闭；`staging-community.nowen.cn` 尚未绑定。
- 之前的 `Access Safety Gate` 曾在 Access 应用创建前失败；Cloudflare API 现已核实策略，但需要在 GitHub 上重新测试。访问保护在实际上线前必须用匿名 HTTP 证明。
- 不应直接将 `community.nowen.cn` 正式域名接入。

## 临时测试入口：先验证访问拦截

新增 GitHub 工作流 [NOWEN Community Protected Test Entry](https://github.com/cropflre/nowen-community/actions/workflows/protected-test-entry.yml)，具有三个手动选项：

| Action | 作用 |
| --- | --- |
| `check` | 只读核验 staging D1/R2、Turnstile Secret、Access 策略和无公开入口 |
| `enable-protected-entry` | 需要 GitHub Environment 人工批准，然后临时开启 **staging Worker** 的 `workers.dev` URL，版本预览仍关闭，验证两条未登录请求均跳转 Cloudflare Access 或明确被 Access 拒绝 |
| `disable-entry` | **紧急关闭** staging `workers.dev`，即使 Access API 失效也能执行；不要求人工审批 |

启用命令检查以下条件：

1. 所处 Cloudflare 账户 ID 符合 NOWEN Community；Worker 必须准确为 `nowen-community-staging`。
2. Worker 绑定的 D1、R2 和 Turnstile 都必须是 staging 专属；没有测试域名或 Worker 路由。
3. Cloudflare Access 应用名称必须是 `NOWEN Community Staging Access`，绑定类型为 `worker`（即 **All traffic**），且只绑定 staging Worker。
4. 只能有一个 Allow 策略、一个**具体邮箱** Include；无 Bypass、Everyone 或邮箱域名通配。
5. 只启用 `nowen-community-staging.<account-subdomain>.workers.dev`，`preview_urls=false`；**不修改正式 Worker、D1、R2、DNS、生产域名**。
6. 使用 GitHub Runner 真实匿名请求 `/api/health` 与 `/`：应跳转 Access 登录或明确由 Access 拒绝；HTTP 200、非 Access 404、DNS 失败等均不得算通过。如果不能证实被 Access 拦截，**自动关闭临时入口并让 CI 失败**。

**注意：** 成功通过不会验证受许可用户能够登录。还须管理员从无痕浏览器、指定邮箱及另一台设备人工测试。不应向不在 Allow 策略内的人发送测试入口。

## 操作顺序

1. 合并 Phase 7 PR，等待 main CI 与 Playwright 测试通过。
2. 在 GitHub Actions 运行 `NOWEN Community Protected Test Entry → check`。
3. `check` 成功后，在同一工作流选择 `enable-protected-entry`，按 Environment 审批流程批准。执行过程中不要直接修改 Cloudflare Route/DNS。
4. 若匿名 Access 拦截检查失败，脚本自动关闭；若成功，可从成功日志读取仅在 Access 登录后可用的 staging workers.dev 地址。
5. 用无痕模式访问临时入口，应要求 Cloudflare Access 登录；使用你的 Cloudflare 授权邮箱登录后，测试 `/api/health`、首页和六个分类。
6. **在 workers.dev 临时入口上，不测试真实 Turnstile 提交**：当前测试 Widget 仅允许 `staging-community.nowen.cn`，而后端要求 Siteverify 的 hostname 与请求 hostname 相同。完整注册/上传/提交测试必须等正式绑定受保护的 staging 域名。
7. 人工验证完成，使用 `disable-entry` 关闭临时入口。后续再计划只对 staging Worker 连接 `staging-community.nowen.cn`，再次验证 Cloudflare Access 登录、Turnstile 验证、隐私和附件。

## 必须保留的安全边界

- GitHub `community-internal-release` 应设 Required reviewers 和仅允许 main 部署。环境解锁值只是安全开关，不可代替人工审批。
- 禁止在公开 PR、日志、截图或评论里放 Access 会话 Cookie、Turnstile Secret、Cloudflare Token。
- 如 Cloudflare API Token 缺少 Workers Script/Workers Route 变更权限，工作流应失败，不要改用 Global API Key。
- Access 权限或网络被断开，不能手工改 Worker URL 强行绕过检查；需要恢复 Cloudflare Access API 后再开通。
- 如果 `enable-protected-entry` 失败且自动回滚也失败，需在 [Cloudflare Workers 控制台](https://dash.cloudflare.com/?to=/:account/workers-and-pages) 找到 `nowen-community-staging`，立即关闭 `workers.dev` 访问。
- 后续 `staging-community.nowen.cn` 域名接入需单独审批，并以真实浏览器验收为门槛；`community.nowen.cn` 正式发布还要完成安全、合规、国内网络等专项验收。

Phase 7 本阶段交付的是**访问验证与可控开关**，不意味着论坛正式上线。

## Access Safety Gate 常见故障：GitHub token 看不到应用

2026-10-29 实际出现过：Cloudflare 账户连接器能够看到 `NOWEN Community Staging Access`，但 GitHub Actions 使用的 `CLOUDFLARE_API_TOKEN` 调用 Access 应用列表返回空数组，进而导致 **Expected exact one staging Access application**。

这不是删除或重新创建 Access 应用的理由，**也不能跳过 Access 保护检查**。

修复方式：

1. 打开 [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)，找到给 NOWEN Community GitHub Actions 使用的 Token。
2. 检查 **Account → Access: Apps and Policies → Read** 权限，并确认资源范围是拥有 staging Worker 的 Cloudflare 账户。如果无法原位编辑权限，可创建权限正确的新 Token，轮换 GitHub 仓库的 `CLOUDFLARE_API_TOKEN`。
3. 不要使用 Global API Key，不要把 Token 放进 GitHub Variables 或写进 Issue。
4. 合并本修复之后重新运行 **NOWEN Community Access Safety Gate** 或 **NOWEN Community Protected Test Entry → check**。
5. 脚本已改为直接按固定 Access Application ID 查询并严格验证名称、Worker Tag、全流量保护与精确邮箱规则；直接读取被拒绝会给出 Token 权限诊断并 **Fail Closed**。
6. 成功后才能执行 `enable-protected-entry`。绝不以更新权限为由直接开启 Worker URL。
