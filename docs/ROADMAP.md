# NOWEN Community 开发与验收路线图

## 第一阶段：本 PR
- React + TypeScript + Vite + Tailwind、深浅色适配、响应式社区大厅
- Hono Worker + Drizzle Schema + 独立 D1 SQL；公开健康、板块、已发布主题的只读 API
- 基础测试与 PR CI；暂不建立生产服务，尚未验证完整依赖构建

## 第二阶段：真实业务
- 邀请码、邮箱校验、安全密码哈希；强 Cookie 会话、CSRF 防护、服务端身份验证
- 发帖、回复、草稿自动保存、点赞、收藏；限流、幂等、越权检查
- 服务端渲染或预渲染公开帖子详情，OG、Canonical、Sitemap 与中文 SEO
- 单元 + API + Playwright 覆盖邀请重复使用、XSS、越权、刷新等

## 第三阶段：安全运营
- 管理后台、待审核列表、举报、封禁、完整审计
- Turnstile 服务端 Siteverify、分层限流和防刷；R2 独立上传桶及文件校验
- 通知和搜索；定期恢复演练

## 第四阶段：受控上线
- 独立新建 D1 与 R2，绝不复用 nowen-site-stats 或 Nowen Note 库
- GitHub PR CI、迁移验证、手动生产部署；国内移动和宽带 HTTPS/API 验证
- 对照适用法规核实实名、内容审核、备案、运营主体要求后再开放注册

本阶段只读，所有未实现动作均禁用，不宣称已上线。
