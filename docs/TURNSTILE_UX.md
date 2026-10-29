# Turnstile 提交区 UX 优化

默认采用 Cloudflare **Managed Widget** 的官方 `appearance: 'interaction-only'`。验证继续在页面加载时执行，但正常用户无需看到常驻的绿色「成功」卡片；只有 Cloudflare 需要人工交互时才显示验证控件。

适用于登录/注册、发帖及回复等所有复用 `TurnstileField` 的表单；不改变 Worker `siteverify`、token 过期及错误验证逻辑。失败会显示错误信息，重试时重置错误状态。

**不应通过 `display:none` 或删除客户端 token/服务端 Siteverify 来强行隐藏控件**。这会破坏交互挑战或安全保证。

生产发布：合并 `main` 后自动触发 `NOWEN Community Production Auto Deploy`；可在 `https://community.nowen.cn` 验证。
