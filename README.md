# NOWEN Community · 弄文社区

**正式地址：[community.nowen.cn](https://community.nowen.cn)**

围绕 Nowen Note、Nowen Reader、Nowen Video 的开源产品交流、问题求助与作品展示社区。免费开放注册，内容审核后公开。

## 当前功能（2026-10-29）

- 分类广场：最新／按全站回复数排序、搜索、分页和响应式布局
- 主题与回复：Markdown + GFM、发帖草稿自动保存、Markdown 工具栏、图片上传并插入正文
- 我的帖子：草稿继续编辑和删除、待审核／已发布／未通过状态、帖子入口
- 登录与设置：用户名密码、修改昵称、登录后修改密码；未接入电子邮件找回，不提供不安全的免验证重置
- 互动通知：点赞、收藏、举报、回复审批，通知可跳转帖子及全部标为已读
- 管理中心：帖子／回复／图片审核、举报上下文、置顶与隐藏／恢复帖子、普通用户封禁／解封
- 内容保护：Cloudflare Turnstile（需要时展示交互）、服务端校验、D1 限流、CSRF Origin 检查、审核与审计日志；R2 附件按状态授权访问

## 技术栈

React 19 + TypeScript + Vite + Hono + Drizzle ORM + Cloudflare Workers/D1/R2 + Tailwind CSS 4。

## 本地开发

需要 Node.js 22+；首次安装后：

```bash
npm install
npm run db:local
npm run dev
npm run check
npm run test:e2e
```

本地完整写接口联调使用 `LOCAL_TEST_TURNSTILE=1` 和本地开发专用的 `PASSWORD_PEPPER`，不要使用生产密钥。

## 发布

合并到 `main` 后自动触发 [Production Auto Deploy](.github/workflows/production-auto-deploy.yml)：

1. 类型、单测、构建和浏览器端测试全部通过
2. 严格校验生产 Worker、D1/R2、ASSETS、Turnstile、PASSWORD_PEPPER
3. 原位部署 `nowen-community` 并验证 `community.nowen.cn`

不会自动修改或重建 D1 数据库，所有结构迁移须另行备份和审查。旧 Staging 工作流作为历史测试手段保留，不再是正式发布路径。

## 仍需完善

- 邮箱验证／安全密码找回、用户主页与头像
- 账号内容申诉、举报处置和图片残留清理
- 生产运营与备案合规核查、移动网络人工验收
- 开源许可证（当前尚未添加 LICENSE，请勿误认为已取得复用授权）

详细方案见 [架构说明](docs/ARCHITECTURE.md)、[路线图](docs/ROADMAP.md)。
