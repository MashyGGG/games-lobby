# GAME//MAP Public Lobby

这是 `MashyGGG/game-map` 私有源码仓库的公共构建与部署仓库。耗时构建使用本仓库的公共 GitHub Actions 分钟。

- `site/`：自动生成的多游戏大厅及浏览器运行包。
- `.github/workflows/build-and-deploy.yml`：只读拉取私有源码、构建、保存 `site/` 并发布 Pages。
- 不保存设计文档、测试、开发历史或服务端密钥。

请不要直接编辑 `site/`。新游戏和页面变更应在私有源码仓库完成，由本仓库的公共 runner 构建。

## 首次配置

1. 创建只选择 `MashyGGG/game-map`、权限仅为 **Contents: Read-only** 的 fine-grained personal access token。
2. 在本仓库 **Settings → Secrets and variables → Actions** 新增 `GAME_MAP_READ_TOKEN`。
3. 在本仓库 **Settings → Pages → Build and deployment** 将 Source 设置为 **GitHub Actions**。
4. 私有源码仓库可配置 `LOBBY_TRIGGER_TOKEN` 自动通知，也可在本仓库 Actions 页面手动运行构建。

工作流不会在 pull request 上运行，也不会向 fork 暴露读取私有仓库的 Secret。最终 Pages 只上传 `site/`。
