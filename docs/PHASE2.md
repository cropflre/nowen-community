# Phase 2 · 邀请制论坛（功能分支，不直接上线）
 
## 用户路径

1. 管理员在本地执行 `node scripts/issue-invite.mjs 7`，将随机邀请码私下发送给受邀用户，生成的哈希插入**独立** D1 `nowen-community-db`。
2. 注册输入 `username`（3-24 位英文、数字、下划线）、昵称、12 位以上密码和邀请码。
3. 服务端对邀请码 SHA-256 后，在 D1 单一事务内 **INSERT 用户 SELECT 有效邀请 + UPDATE 邀请消耗**，多次使用只允许成功一次。
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
node scripts/phase2-smoke.mjs --seed
npm run dev -- --host 127.0.0.1
# 第二终端
node scripts/phase2-smoke.mjs
```

切勿把本地联调邀请码写到远端 D1；真实邀请码通过 `node scripts/issue-invite.mjs` 生成。测试脚本会在**本地** D1 手动把测试主题标为已发布，以验证回复/点赞/收藏；生产没有自动公开 API。

## 未解决上线门槛

- Phase 3 才实现审核、举报、封禁、Turnstile、R2、安全运营及额外限流，仍须禁止公众论坛上线。
- PBKDF2 CPU 预算应在 Cloudflare Workers Free 套餐实测；若超过单请求计算限额，应改用可验证的成熟认证服务或调整部署套餐，**不可降低密码安全性掩盖问题**。
- 动态讨论主题 SEO 与 Markdown 渲染需要 Playwright 回归；Phase 2 页面预览使用 ReactMarkdown，不启用不安全 HTML。
- 不能触碰已有官网访问统计、留言板或 Nowen Note 生产库；远端迁移只能审查后手动执行。
- 首次真实部署前需校验 CSRF、Cookie 同源策略、会话撤销、网络可达性、合规与 D1 恢复。
