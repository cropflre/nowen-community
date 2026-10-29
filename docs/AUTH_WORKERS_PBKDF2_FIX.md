# 注册 500：Cloudflare Workers PBKDF2 限制

### 根因与限制

Workers 的 `crypto.subtle.deriveBits` 不支持单次 PBKDF2 超过 100,000 次迭代；项目原有 600,000 次导致 `NotSupportedError`，在注册端变为 `500 internal_error`。本地 Workers 模拟环境可能无法重现该限制。两个独立 D1 在本次修复之前均确认注册人数为 0，无历史密码需要迁移。

### 改动

使用独立高熵 `PASSWORD_PEPPER`（HMAC-SHA256 预哈希）+ 随机盐 16 字节 + PBKDF2-SHA256 100,000 次；存储格式版本化；服务器缺少 Pepper 时明确返回 `503 AUTH_UNAVAILABLE`，**不会回退为无 Pepper 或明文**。已单独切换开放注册（不需要邀请码）；Turnstile、限流、待审状态不变。

**生产安全提示：** 如果同时泄露 D1 和 Pepper，100,000 次的离线抗猜测成本低于标准 600,000；正式开放前应评估托管认证或独立 Argon2id 认证服务。不要把 Pepper 放进 D1、代码或前端。Pepper 必须永久安全保存，轮换需要迁移密码。

### 必做设置（GitHub Environment）

在 `community-internal-release` 的 **Environment secrets** 中添加：
- `COMMUNITY_STAGING_PASSWORD_PEPPER`（只用于 staging）。
- `COMMUNITY_PASSWORD_PEPPER`（用于后续正式 Worker，禁止共用）。

用本机命令 `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"` 分别生成并仅写入 GitHub Secrets 和密码管理器，**不要贴到聊天、Issue、PR 或日志**。发布脚本要求至少 43 字符，且仅允许 Base64URL 字符。

### 有域名的 staging 安全部署

如 staging 自定义域名处于打开状态，旧 Phase 5 预检会要求**没有入口**，故必须按序：

1. 合并修复 PR，确认 CI（包括真实本地 API 注册/登录）成功。
2. 运行 `NOWEN Community Staging Domain Gate → disable-domain`，验证测试域名已解绑。
3. 在受保护 Environment 添加上述 staging Pepper。
4. 运行 `NOWEN Community Staging Release → deploy-staging-inert-worker`，完成构建、发布、设置私密 Turnstile 与 Pepper、核验 Worker 绑定。
5. 运行 `NOWEN Community Staging Domain Gate → check`，再人工审批 `enable-protected-domain`，重开测试域名并验证匿名访问仍被 Access 拦截。
6. **用新的密码和新的 Turnstile token**，无需邀请码注册 `nowen_admin`、昵称 `弄文社区`。仅注册成功后再提升角色为 admin。

注意：之前聊天贴出的密码不得继续使用。
