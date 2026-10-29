# NOWEN Community · Turnstile 配置（独立站点）

## 已创建的 Cloudflare 资源

| 项目 | 值 |
|---|---|
| Cloudflare Turnstile Widget | `nowen-community` |
| 允许访问的域名 | `community.nowen.cn` |
| 交互模式 | Managed |
| 预通行（Pre-clearance） | Disabled / no_clearance |
| Site Key（公开） | `0x4AAAAAAFqrMaE54L6wuOLe` |

Site Key 可存放在 Git 仓库中，当前位于 `wrangler.jsonc → vars.TURNSTILE_SITE_KEY`，**不是敏感凭据**。

**Secret Key 是真正的服务端凭据**。不能存放在仓库、聊天、日志、`wrangler.jsonc`、公开截图或前端环境变量里。请进入 [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile) 选择 `nowen-community`，查看 Secret Key，并只在 GitHub 仓库 Settings → Environments → `community-internal-release` → Environment secrets 添加：

- 名称：`COMMUNITY_TURNSTILE_SECRET_KEY`
- 值：Cloudflare 该 Widget 的 Secret Key

**不要使用**官网 `nowen-guestbook` 的密钥，也不需要另外配置 `COMMUNITY_TURNSTILE_SITE_KEY`。

## 工作流的其他必要授权

在仓库 Actions secrets 配置 `CLOUDFLARE_API_TOKEN`（最小权限，仅允许必要 Workers、D1、R2、Zone 只读操作）与 `CLOUDFLARE_ACCOUNT_ID`。

在 GitHub Environment `community-internal-release` 内配置审批人员，并增加 `COMMUNITY_RELEASE_UNLOCK`，值为 `INTERNAL_UNROUTED_WORKER_ONLY`。

## 推荐部署顺序

1. 合并 Turnstile 配置 PR，确认工程 CI 与 Playwright 全绿。
2. 人工触发 GitHub Actions `NOWEN Community Manual Release`，选择 **preflight**（只读核验）。
3. 确保 Secret / 环境审批已设置后才选择 **deploy-inert-worker**。此操作不会绑定 `community.nowen.cn`，也不会开放 Workers.dev。
4. 建立独立受限的预发布入口并用真实浏览器验证 Turnstile Siteverify、登录、上传和审核；只有测试通过后才单独审核正式域名的连接。

注意：当前 Widget 仅允许 `community.nowen.cn`，未来若使用其他预发布 hostname，必须新增匹配该 hostname 的 Turnstile Widget（推荐与生产分开），并使用独立密钥。

## 服务端校验

后端 `src/worker/turnstile.ts` 使用 Siteverify，且要求验证结果的 `hostname` 与请求 hostname 一致。仅本地显式设置 `LOCAL_TEST_TURNSTILE=1` 且使用 HTTP localhost 时允许跳过；**生产不得设置该变量**。

当前资源已创建和配置，但**尚未完成真实 Cloudflare Worker 的 Turnstile 联调**，也尚未正式开放论坛。
