# Phase 2 · 社区成员与讨论（开放注册，受保护内测）
 
## 用户路径

1. 用户在网页选择「免费注册」，输入 `username`（3–24 位英文字母、数字、下划线）、昵称和至少 12 位密码。
2. 服务端执行 Turnstile Siteverify、同源校验和 IP 限流（每 10 分钟最多 5 次），创建 `role='member'` 的用户；同名账号返回 409。
3. 不再需要邀请码；已有 `invitations` 表仅为历史迁移兼容保留，不在注册路径读取或写入。
4. 登录时用 WebCrypto HMAC-SHA256 服务端 Pepper 预哈希 + Cloudflare Workers 兼容的 PBKDF2-SHA256（100,000 轮，随机盐）验证密码；会话只存 SHA-256 Token 哈希，Cookie `HttpOnly; SameSite=Lax; Secure(HTTPS)`，一周有效。
5. 登录后打开新话题，Markdown 编辑，停止输入后自动保存草稿；提交时从 draft 原子更新为 pending。**未配置审核后台前不会公开显示**。
6. 公开话题可点赞、收藏和回复；新回复进入 pending，仅本人可预览。
7. 登出将 D1 会话哈希删除，旧 Cookie 失效。

## 新增 API

- `GET /api/v1/me`、`POST /api/v1/auth/register`、`POST /api/v1/auth/login`、`POST /api/v1/auth/logout`
- `GET /api/v1/me/topics`
- `POST /api/v1/topics`（草稿）、`PUT /api/v1/topics/:id`、`POST /api/v1/topics/:id/submit`
- `GET|POST /api/v1/topics/:slug/replies`
- `POST|DELETE /api/v1/topics/:id/like`、`POST|DELETE /api/v1/topics/:id/bookmark`

写操作要求与请求 URL 完全相同的 `Origin`，并对登录注册限流。创建主题和回复要求每个动作携带 `Idempotency-Key`，数据库唯一索引防重复写入。未经授权的编辑、回复、收藏、点赞均拒绝。

## 本地验收

```bash
npm install
npx wrangler d1 migrations apply nowen-community-db --local
npm run dev -- --host 127.0.0.1
# 第二终端
node scripts/phase2-smoke.mjs
```

本地 smoke 测试直接执行开放注册，不预置邀请码；审核状态只在**本地** D1 变更以验证回复/点赞/收藏。管理员角色必须由专属 D1 后台受控授予，没有自动提升后门。

## 未解决上线门槛

- Phase 3 才实现审核、举报、封禁、Turnstile、R2、安全运营及额外限流，仍须禁止公众论坛上线。
- PBKDF2 CPU 预算应在 Cloudflare Workers Free 套餐实测；若超过单请求计算限额，应改用可验证的成熟认证服务或调整部署套餐，**不可降低密码安全性掩盖问题**。
- 动态讨论主题 SEO 与 Markdown 渲染需要 Playwright 回归；Phase 2 页面预览使用 ReactMarkdown，不启用不安全 HTML。
- 不能触碰已有官网访问统计、留言板或 Nowen Note 生产库；远端迁移只能审查后手动执行。
- 首次真实部署前需校验 CSRF、Cookie 同源策略、会话撤销、网络可达性、合规与 D1 恢复。
