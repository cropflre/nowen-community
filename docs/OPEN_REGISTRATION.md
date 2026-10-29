# NOWEN Community：开放注册（无需邀请码）

## 用户路径
注册表单仅需用户名、昵称、密码和 Turnstile 验证。成功后默认 `role='member'`，发帖、回复和图片仍需管理员审核。

## 后端安全措施
- 每 IP 每 10 分钟最多尝试 5 次注册（已有 D1 request_limits）；不要为绕过限流而重复清表。
- 注册与登录都必须服务端 Turnstile Siteverify（失败即拒绝）、同源 Origin 校验和强密码（至少 12 字符）。
- 显示昵称允许中文；登录用户名仅允许 3–24 位英文字母/数字/下划线。
- 用户名唯一约束；重复注册返回 409，不会覆盖其他用户。
- 新注册用户始终是 `member`，不存在「第一个注册用户自动管理员」逻辑。
- 历史 `invitations` D1 表与旧迁移文件不做破坏性更改，但注册接口和 UI 不再引用。
- **正式面向公众前应加强防滥用**：视合规需要实施邮箱/手机验证、按 IP 和账号更严格的频控、管理员封禁、错误监控、审计/举报，以及合规运营流程。Cloudflare Access 只保护 staging，不等于正式上线完成。

## staging 验收
1. 合并 PR，确认 CI 全绿，保持 staging 域名解绑。
2. 运行 `NOWEN Community Staging Release → deploy-staging-inert-worker`，确认 Pepper/Turnstile Worker Secrets 都已正确绑定。
3. 运行 `NOWEN Community Staging Domain Gate → check → enable-protected-domain`，测试站继续使用 Cloudflare Access 白名单邮箱保护。
4. 使用**新密码**、用户名 `nowen_admin`、昵称 `弄文社区` 注册，表单不再要求邀请码，验证成功注册、登录和登出。
5. 核验用户在 staging D1 中 `role='member'`，之后由管理员受控提升为 `admin`，重新登录验收后台。
6. 验收完成运行 `disable-domain`，确认域名解绑且 Workers.dev/预览依旧关闭。

本次仅提交代码和测试，不自动部署、不改生产域名、D1 或历史邀请码记录。
