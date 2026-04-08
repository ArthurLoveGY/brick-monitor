# macOS 发布说明

本项目通过 GitHub Releases 分发 macOS 桌面版，不走 Mac App Store。

## 本地构建

```bash
pnpm verify:xcode
pnpm install
pnpm build
cargo check --manifest-path src-tauri/Cargo.toml
pnpm tauri:dev
```

## 打包

```bash
pnpm release:macos
```

该命令会先构建前端，再调用 Tauri 生成 `.app` 和 `.dmg`。

如果命令提示未同意 Xcode license，请先执行：

```bash
sudo xcodebuild -license
sudo xcodebuild -runFirstLaunch
```

## 权限要求

应用首次使用需要用户授权：

- 辅助功能
- 输入监控

缺少任一核心权限时，应用会进入显式阻断状态，不会伪装为正常监控。

## 签名与公证

正式发布前需要准备以下环境变量：

- `APPLE_ID`
- `APPLE_TEAM_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_DEVELOPER_CERTIFICATE`

可先执行：

```bash
pnpm release:macos:verify-signing
```

如果缺少任一变量，脚本会直接失败并指出缺失项。

当前仓库已经补齐发布前置检查脚本，但尚未内置真实凭据。
