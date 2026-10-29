# Phase 3 · 审核、安全与上传（开发分支）

本阶段基于 Phase 2 PR #8，**不意味着论坛可以直接公开运营**。在 Phase 1 / Phase 2 尚未合并时，以堆叠 PR 审核，生产 Worker、生产 D1 和 R2 不受影响。

## 实现范围

- 管理员入口 `/admin`：待审核主题、待审核回复、未处理举报、待审核图片，提供审核通过、拒绝和举报处理。权限由后端服务器严格检查，非登录或普通会员返回 403。
- `admin` 和 `moderator` 可审核内容；只有 `admin` 能封禁普通会员。不能封禁自己或其他管理员；封禁删除相关活动会话。
- 内容操作与审计记录使用 D1 原子 batch；状态由 `pending` 切换到 `published/hidden`。重复审批返回 409。
- 举报功能：已登录用户可举报公开主题和已发布回复，服务端确认目标真实存在；限流后提交管理员。
- 图片上传：`POST /api/v1/uploads` 仅接收 **PNG/JPEG/WebP，最多 2 MiB**，服务器校验真实文件头，不接受 SVG/HTML，存入**独立私有** R2 存储桶 `nowen-community-assets`，状态默认为 `pending`。审核通过前只有作者和审核者可获取；无公开 R2 bucket URL，不直接在 Markdown 公开嵌入尚未审核的内容。
- Turnstile 服务端 Siteverify：注册、登录、提交主题、回复、上传要求有效令牌；生产环境缺少密钥 / 令牌即拒绝。只有本地无 Cloudflare 入口头的 HTTP localhost 可跳过，以支持本地 CI。Turnstile Site Key 是前端公开配置，Secret Key 只能放在 Worker Secret。
- 通知：主题审核通过后通知发帖人；回复通过后通知主题作者。用户可读取并标记已读。

## 独立资源与部署前置

```text
Worker          nowen-community
D1              nowen-community-db
R2              nowen-community-assets (private)
Turnstile       TURNSTILE_SITE_KEY (public configuration)
Worker Secret   TURNSTILE_SECRET_KEY (secret)
Domain          community.nowen.cn
```

**不得使用 nowen-site-stats Worker、nowen-site-stats D1、Nowen Note 生产数据库或官网 Turnstile 旧密钥。**

本分支仅提交 `wrangler.jsonc` 中的 R2 binding 声明，不会创建远端 bucket、迁移远端 D1 或绑定生产域名。待前置验收后由负责发布人员独立创建资源并运行受控迁移。

### 数据迁移

- 已有迁移 `0001_init.sql` 和 `0002_members.sql`。
- Phase 3 新增 `0003_notifications.sql`，只增加通知表与索引。
- 在本地运行：`npx wrangler d1 migrations apply nowen-community-db --local`。
- 远端 **先备份并核对迁移历史**，不可未经检查直接 `--remote`。D1 迁移一旦应用不要修改旧文件内容。

### 测试

```bash
npm install
npm run check
npx wrangler d1 migrations apply nowen-community-db --local
node scripts/phase2-smoke.mjs --seed
node scripts/phase3-smoke.mjs --seed
npm run dev -- --host 127.0.0.1
# 第二终端
node scripts/phase2-smoke.mjs
node scripts/phase3-smoke.mjs
```

集成检查：普通用户越权 403、待审核主题不公开、审核后可见、重复审批 409、举报处理、图片签名伪造 415、私有媒体 404、管理员可预览、审核后公开、封禁立即失效，以及通知入库。

## 管理员初始化（只能在受控环境执行）

初始账号须先使用已核验的邀请码注册，再由拥有数据库管理权限的维护者在**专属社区 D1** 中提升角色：

```sql
UPDATE users SET role='admin'
WHERE username='你的已验证用户名' AND role='member';
```

绝不提供公开的“首次注册即管理员”后门，也不要在 GitHub 仓库中提交默认管理员账号或密码。

## 上线前的剩余安全门槛

1. 公共论坛开放前，核实运营主体、备案、实名验证、社区规则、内容处置、留存和适用法律要求。当前仅限邀请制测试。
2. R2 审核仅验证图片文件签名，不等价于病毒扫描、非法内容识别、EXIF 隐私清理。大规模开放前增加媒体处理与安全检测；拒绝的对象需通过定时 GC 或人工处置从 R2 真正删除。
3. 补充 Playwright PC/Android 视口 E2E，覆盖上传失败、登录状态、过期验证码、草稿恢复和审核闭环。
4. 在中国大陆移动流量、宽带实际检查 `community.nowen.cn` HTTPS / Turnstile / R2。先观察 Cloudflare 免费计划限额（特别是 D1 行读写、CPU 和 R2）。
5. 生产发布使用 GitHub Actions 手动审批、Worker 版本回滚、D1/R2 恢复演练和监控告警；未验收不合并部署。
