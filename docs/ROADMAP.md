# NOWEN Community 分阶段交付

| 阶段 | 交付内容 | 验收条件 |
| --- | --- | --- |
| Phase 1 | Hono/Workers、D1、UI、只读 API、SEO | 类型检查、测试、构建通过 |
| Phase 2 | 邀请制会员、主题、回复、收藏点赞 | 认证、会话和幂等安全 |
| Phase 3 | 审核、举报、R2 私有附件、通知 | 审核状态与越权测试 |
| Phase 4 | Playwright + 手动发布工程 | CI/E2E 及隔离检查 |
| Phase 5 | 独立 staging D1/R2/Turnstile 与 Worker | 远端资源隔离、无公开入口 |
| Phase 6 | Zero Trust Access Worker All traffic | 精确邮箱允许、无 Bypass |
| Phase 7 | 临时受保护 workers.dev 匿名拒绝验证 | 2026-10-29 已验收并关闭入口 |
| Phase 8（本 PR） | staging 自定义域名审批、匿名拦截、失败回滚、人工功能验收手册 | 门禁 CI 通过后手动运行；授权登录/Turnstile/业务验收未完成 |

坚持邀请制、低心智负担的 NOWEN UI；正式域名 `community.nowen.cn` 不在 Phase 8 范围。
详见 [Phase 8](PHASE8_STAGING_DOMAIN.md)。
