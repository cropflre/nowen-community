# NOWEN Community 自动部署正式环境

默认部署策略（自 2026-10-29 起）：开发 PR 通过 CI 合并到 `main` 后，GitHub Actions **NOWEN Community Production Auto Deploy** 自动构建并部署 `nowen-community`，无需再手动触发 Staging Release、Domain Gate 或 Environment 审批。

- 生产地址：`https://community.nowen.cn`。
- 仅使用生产 D1 `nowen-community-db`（`a63c9450-f93f-409d-adaf-313491e2bfc8`）和生产 R2 `nowen-community-assets`。
- 保留已有的 Cloudflare Secret `TURNSTILE_SECRET_KEY` 和 `PASSWORD_PEPPER`（**不要旋转 Pepper，旧账号密码依赖它**），不写入源码或日志。
- Workflow 使用仓库已有 `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`；需要 Workers、D1、R2、Zone 及 Turnstile 对应的部署/查询权限。
- 先 typecheck、单测、生产构建，校验产物必须是 `nowen-community` 且包含 `ASSETS`、生产 D1/R2；部署前通过只读的远程资源检查；部署后确认静态资产和安全绑定，再连接或保留生产自定义域名。
- **不执行自动数据库迁移**。D1 表结构缺失时直接失败，避免覆盖数据。
- `workers.dev` 和版本预览仍关闭；Staging Worker 和 staging D1/R2 不会被动到。
- 生产初次启动时用户与帖子为空，测试环境的 `nowen_admin` 不会自动迁移，需在生产注册并授予管理员角色。

如自动部署失败，直接查看本工作流日志。原有手动发布脚本仍保留为历史/紧急调试用途，但无需再使用。
