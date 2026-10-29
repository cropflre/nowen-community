# NOWEN Community 分阶段交付

| 阶段 | 开发内容 | 验收门槛 |
|---|---|---|
| Phase 1（当前） | 工程初始化、Cloudflare Worker + Hono、Drizzle/D1 数据模型、响应式 NOWEN UI、只读主题/分类接口、SEO、CI | npm run check 通过、未开放写接口、无生产发布 |
| Phase 2（本 PR） | 邀请注册、登录、主题/回复/点赞/收藏、Markdown 预览、自动草稿与提交待审 | 邀请码原子一次性、会话撤销、Origin 校验、幂等请求、集成测试；**不开放自动公开** |
| Phase 3（本 PR） | 管理审核中心、举报、封禁、审计、Turnstile、独立 R2 私有图片、持久化限流、通知；已有 Phase 1 标题/正文搜索 | 需要真实 D1+R2 联调及 PC/移动端 E2E；病毒扫描和内容识别仍为上线前缺口 |
| Phase 4（当前 PR） | Chromium 桌面/移动 E2E、只读资源预检、受保护 GitHub Actions 手动非公开部署、备份/回滚说明 | CI/E2E 全绿且 R2、真实 Turnstile、D1 迁移台账、合规、国内网络和人工验收后才允许生产域名绑定 |

| Phase 5（本 PR） | 独立 staging D1/R2/Turnstile、Vite staging 环境、发布前资源核验、私有 staging Worker 手动部署门禁 | 真实 D1 三项迁移完成；CI 全绿；不绑定任何公网入口；之后必须先配置 Cloudflare Access 才能开放受控测试域名 |

产品原则：参考 V2EX 的轻量分类讨论模式，原创 NOWEN UI、优先简单操作。未上线按钮必须明确禁用。

阶段 5 的完整手册见 [PHASE5_STAGING.md](PHASE5_STAGING.md)。正式域名仍未公开上线。
