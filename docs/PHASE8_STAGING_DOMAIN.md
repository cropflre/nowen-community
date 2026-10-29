# Phase 8 · staging 自定义域名与真实功能内测

> Phase 7 已在 2026-10-29 验证：未登录 GET / 和 /api/health 均被 Cloudflare Access 拦截；临时 workers.dev 已关闭。**这不等于 Phase 8 已通过。**

## 目标与隔离边界

- 仅绑定 `staging-community.nowen.cn` → `nowen-community-staging`，不绑定 `community.nowen.cn`。
- 保持 Workers.dev 和 Version Previews 关闭；沿用经验证的 Worker 级 All traffic Access 应用。
- 专用 staging D1、私有 R2、staging Turnstile Widget 必须保持不变；生产库及 DNS 不得修改。
- 必须用匿名请求证明 HTTP 未穿透 Access；不接受返回 HTTP 200 或非 Access 404/5xx 作为成功。
- 全部动作必须通过 GitHub Actions 手动触发。开启使用 `community-internal-release` Environment 批准门禁；操作失败自动尝试删除唯一 staging Custom Domain。关闭动作不需要 Access API 读取。
- 不创建任意 DNS 记录。Cloudflare Workers Custom Domain 通常自动托管 DNS 和 HTTPS 证书。若已经存在 staging DNS 记录，`check` 必须失败，先人工核查。

## GitHub 手动操作流程

1. 在 GitHub `main` 分支合并本阶段 PR，确保 CI 和移动/桌面 E2E 全绿。
2. 前往 [Staging Domain Gate](https://github.com/cropflre/nowen-community/actions/workflows/staging-domain-gate.yml)，`main` 上选择 `check`，无副作用确认 Access / 绑定 / DNS / Turnstile。
3. 启用 GitHub Environment `community-internal-release` 的 Required reviewers；如果没有这个规则，不允许选择开启。确认 GitHub Token 有 Workers Scripts/Custom Domains 的必要权限，且保留最小 Access Read、Zone DNS Read 权限。
4. 同一工作流选 `enable-protected-domain`，人工审核后，脚本绑定 staging Custom Domain，并从匿名身份对 `/`、`/api/health` 做 Access 拦截测试；失败会尝试移除域名。DNS/证书签发可能需要时间，超时也视为失败并回滚。
5. 运行日志输出 **PHASE 8 STAGING DOMAIN ACTIVE** 后，在无痕窗口访问 https://staging-community.nowen.cn；**先确认要求 Access 登录**，用允许名单内邮箱登录，访问 /api/health 与首页及六个分类。
6. 再在这一个 staging 域名真实测试 Turnstile 验证、一次性邀请码、账户创建/退出/失效、草稿、发帖待审核、审核后台、回复、举报、点赞收藏、R2 PNG/JPEG/WebP 上传与越权读取。不可使用生产用户数据。至少用 PC、Android/iOS 以及中国大陆实际网络做一次验证。
7. 验收后运行 `disable-domain`，查看日志确实完成解绑；继续核验 Worker 的 workers.dev、Preview URLs 已关闭。新版本启用前再手动打开，不应长期保持对外入口。

## 最小验收矩阵

| 验证项 | 期望 |
| --- | --- |
| 未认证打开首页和 /api/health | Access 登录/拒绝，禁止直接 200 |
| 授权邮箱访问首页 | 正常加载，六个分类可见 |
| 非白名单邮箱 | Cloudflare Access 拒绝 |
| Staging Turnstile | 真实 Siteverify；hostname 应为 staging 域名 |
| 邀请码 | 可注册且一次性消费，非法/重放拒绝 |
| Session | 登出后旧 Cookie 无效 |
| 帖子 | 待审核不可公开读取、审批后展示 |
| 管理后台 | 普通用户 403，审核记录可追溯 |
| R2 图片 | 类型/大小限制、私有对象访问及越权拒绝 |
| 回滚 | 解绑后入口停止，生产服务完全不受影响 |

## 重要限制

- 本 PR **只交付受控上线脚本与文档**，不会自动绑定域名或公开论坛。
- 云端的匿名访问拦截测试不能证明授权身份能正常登录，也不能代替 Turnstile Siteverify 和跨设备验收。
- 如自动回滚报 CRITICAL，立刻打开 Cloudflare Workers → `nowen-community-staging` → Domains，手动删除 `staging-community.nowen.cn`。保留 Access All traffic 防护。
- 这项流程主要核验访问层。公开社区仍需备案/运营合规、敏感内容审查、附件安全、监控和数据恢复等上线审计。
- Phase 5/6 只读预检默认要求无公网域名；Phase 8 入口启用期间不要运行会要求“域名不存在”的旧预检。先使用 `disable-domain` 解绑后再跑。
