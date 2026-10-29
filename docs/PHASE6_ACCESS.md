# Phase 6 · Cloudflare Access 保护与 staging 浏览器验收

## 当前事实（2026-10-29）

- PR #13 已合并，`nowen-community-staging` 已通过 GitHub Actions 成功部署。
- 独立 staging D1、R2 与 Turnstile Secret 均已绑定到该 Worker。
- `workers.dev`、Preview URLs、正式/测试域名路由均未公开。**请保留这一状态。**
- Cloudflare API `GET /accounts/{account_id}/access/apps` 目前返回 **403 / access.api.error.not_enabled**：**Zero Trust 还没有激活**。
- 当前无法也不应绑定 `staging-community.nowen.cn`；新脚本只读检查、不会启用 Access、不会改 DNS。

## 你只需要先启用 Zero Trust

1. 打开 [Cloudflare Zero Trust](https://one.dash.cloudflare.com/)（也可在 Cloudflare Dashboard 左侧找到 Zero Trust）。
2. 在**已有的同一个 Cloudflare 账户**中创建 Zero Trust 组织。Team name 可填 `nowen-community`（若未被占用），并选择适合的 **Zero Trust Free** 计划；按页面要求完成账户及付款资料登记。不要重新购买付费计划、不要修改 NOWEN 官网域名。
3. 创建完成后进入 [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages)，选择 **`nowen-community-staging`**（**不是** `nowen-community`）。
4. 选择 **Access → Protect this Worker behind Access → All traffic**。只保护 staging Worker，不要选择整个账户所有 Workers，以免影响官网统计和其他正式服务。
5. 将 Access Application 命名为 **`NOWEN Community Staging Access`**。
6. 在 Authentication Policy 中选择 **Allow**，使用 **Emails** 添加*你本人实际用于测试的具体邮箱地址*，不要使用 Everyone / Everyone in organization / 宽泛 Email domain / Bypass。
7. 保存前确认指定对象是 `nowen-community-staging` Worker，访问范围是 **All traffic**，不是 **Previews only**。

**安全提醒：** 登录测试需要邮箱，但不要把邮箱、Secret Key、Cookie 或验证码发给 ChatGPT。官方文档：[Zero Trust 初始化](https://developers.cloudflare.com/cloudflare-one/setup/) · [Worker Access](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)。

## GitHub 只读安全门禁

新增工作流 `NOWEN Community Access Safety Gate`：

- 先运行 `scripts/staging-preflight.mjs`，确认 staging D1/R2、Worker 秘钥绑定正确、公共路由与域名不存在。
- 再运行 `scripts/access-gate.mjs`，核验 Zero Trust API 可访问、Worker 级别 **All traffic** Access Application 存在，且 Allow Policy 仅包含具体邮箱、没有 Bypass。
- Access 未启用、API Token 缺少 Access Apps / Policies 读取权限、应用不存在、身份策略过宽时 **直接失败（fail closed）**。
- 此流程**不会公开网站**，不创建任何资源，不改 DNS、Worker 或数据库。
- 如果 API Token 返回 Access 403 权限错误，更新仓库级 Cloudflare API Token，只授予需要的 **Access Apps/Policies Read** 权限，保留已有最小 Workers/D1/R2 权限；不要使用 Global API Key。

在 `main` 合并 Phase 6 PR 后手动执行 [Access Safety Gate](https://github.com/cropflre/nowen-community/actions/workflows/community-access-gate.yml)。只有所有检查成功才能进入测试入口开放的独立审批步骤。

## 实际浏览器测试步骤（先完成 Access 再单独审批）

1. **仅在 Worker Access 已开启且配置经 API 核验后**，临时开启受 Access 保护的 Staging Worker 预览入口。
2. 在退出 Cloudflare / 无痕浏览器中访问该入口，确认跳转 Access 登录或直接 401/403，**绝不应显示论坛 HTML 或 API 内容**。
3. 用允许的测试者邮箱登录 Access，验证可以进入 staging Worker 并读取 `/api/health` 和六个版块。注意此时应用尚没有真实测试账号。
4. 再经单独审批绑定 `staging-community.nowen.cn`，复测匿名拒绝、登录、跨设备访问；测试域名仅用于受控内测，不得开放给所有用户。
5. 在 staging D1/R2 创建仅用于测试的数据：邀请码一次性、注册、密码会话、文章草稿/待审核、评论审核、通知、举报、图片 PNG/JPEG/WebP、越权下载与用户封禁。
6. 必须先安排内容识别、恶意文件处理、EXIF 清除与拒绝上传垃圾回收，才能发布正式网站。真实公网与中国大陆电信/联通/移动、Android/iOS 测试必须完成。

## 不可跳过的发布门槛

- ❌ 不因 staging Worker 已部署就把 `community.nowen.cn` 绑定上去
- ❌ 不把 staging 测试数据写到正式数据库
- ❌ 不把 Turnstile / Cloudflare API Secret 放在 GitHub Variables 或 README
- ❌ 不以 `robots.txt`、`noindex` 或隐藏网址替代 Cloudflare Access
- ❌ 不把保护范围设为 Entire Account Workers，避免其他 NOWEN 服务受影响
- ✅ 未满足安全门禁则保持 Worker 无公网入口

Phase 6 的这一部分仅交付**Access 前置安全门禁与操作规范**。零信任组织开通、真实策略创建和浏览器 E2E 需要在完成外部配置后继续进行，不宣称正式社区上线。
