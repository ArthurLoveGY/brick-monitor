# macOS 发布就绪审查报告

**项目**: Brick Monitor (搬砖实时监控)  
**版本**: 0.1.0  
**审查日期**: 2026-05-04  
**结论**: ❌ 尚未达到可发布状态——存在 5 个阻断级问题和多个重要缺陷需要修复。

---

## 🔴 阻断级问题（必须修复才能发布）

### 1. 缺少代码签名配置

`tauri.conf.json` 中没有任何代码签名相关配置。macOS 上分发的应用必须经过签名，否则用户会看到"无法验证开发者"的警告，甚至无法打开应用。

**缺失项**:
- `bundle.macOS.signingIdentity` 未配置
- 没有引入 `APPLE_SIGNING_IDENTITY` 等环境变量
- `scripts/verify-macos-signing-env.sh` 存在但不被构建流程自动调用

**修复方向**:
在 `tauri.conf.json` 的 `bundle.macOS` 中加入:
```json
"signingIdentity": "-"
```
使用 `-` 代表 ad-hoc 签名（仅本地测试），正式分发需填入 Developer ID Application 证书名称。同时需配合 Tauri 的 signing 配置注入 `APPLE_SIGNING_IDENTITY` 环境变量。

### 2. 缺少公证 (Notarization) 配置

macOS 10.15+ 要求所有在 App Store 外分发的应用必须经过 Apple 公证，否则 Gatekeeper 会直接拦截。

**缺失项**:
- 无 notarization 配置（team ID、provider short name 等）
- `scripts/verify-macos-signing-env.sh` 虽检查了环境变量但未被构建流程使用

**修复方向**:
Tauri 2 在 `tauri.conf.json` 中支持 `bundle.macOS.providerShortName` 等字段，并可通过环境变量 `APPLE_ID`、`APPLE_TEAM_ID`、`APPLE_APP_SPECIFIC_PASSWORD` 驱动公证流程。需确认 Tauri CLI 构建命令实际读取了这些变量。

### 3. 缺少必需的 Info.plist 隐私描述

项目使用了 Accessibility API (`AXIsProcessTrusted`) 和 Input Monitoring API (`CGEventTapCreate`)，macOS 要求声明 `NSAppleEventsUsageDescription`。

**缺失项**:
- `tauri.conf.json` 中未配置 `NSAppleEventsUsageDescription` 等隐私用途字符串
- 首次请求权限时系统会显示空白或默认对话框，用户体验差

**修复方向**:
Tauri 2 支持在 `tauri.conf.json` 的 `bundle.infoPlist` 段中注入自定义 plist 字段。需增加:
```
NSAppleEventsUsageDescription: "用于检测当前活动应用以分类键盘输入"
```
另外也建议加入:
```
com.apple.security.device.usb: 说明（如适用）
```

### 4. 键盘映射仅支持美式英文布局

`src-tauri/src/keyboard/listener.rs` 中的 `physical_key_event` 函数（第 345-455 行）硬编码了物理键码到字母的映射，例如键码 0 固定映射为 "a"。在 AZERTY（法语）、QWERTZ（德语）等非美式键盘布局上，按键名称会全部错误。

**影响范围**:
- 所有非 US QWERTY 布局的 Mac 键盘
- 这不仅影响显示，还会影响 `classify_key` 函数通过 key_code 判断键类型的准确性（虽然目前 classify_key 用 HID 码而非键名）

**修复方向**:
使用 CoreGraphics 的 `UCKeyTranslate` 或 IOKit 的 `TISCopyCurrentKeyboardLayoutInputSource` 获取当前键盘布局，将物理键码映射到正确的字符。或者至少在产品说明中标注仅支持美式键盘。

### 5. 键盘监听器死亡后无法自动恢复

`listener.rs` 第 192-298 行：macOS 的 `CGEventTap` 可能因为多种原因被系统终止（处理超时、权限变更、系统休眠恢复等）。当前实现中：

- `CFRunLoopRun()` 在 tap 线程中无限阻塞（第 294 行）
- 如果 tap 被终止，线程退出，`LISTENER_STARTED` 被重置为 false
- 但没有任何监控机制检测到这一点并尝试重启

用户只能通过手动点击"重新检测"按钮来恢复。更糟的是，`initialize_monitoring` 在权限恢复后调用 `listener.start()`，但 `start()` 函数中 `ATOMIC_SWAP` 只在首次启动时创建线程——如果旧线程已死亡，第二次调用 swap 会返回 true 并直接 `return Ok(())` 而不重建线程。

**修复方向**:
在 `start()` 中检测线程是否仍在运行，或使用 `healthcheck` 机制定期检查。同时移除 swap 逻辑中对已死亡线程的假设。

---

## 🟡 重要问题（强烈建议修复）

### 6. 项目命名不一致

| 位置 | 使用的名称 |
|------|-----------|
| `package.json` name | `keyboard-tracker` |
| `index.html` title | `Keyboard Tracker` |
| Rust crate name | `brick-monitor` |
| `tauri.conf.json` identifier | `com.brick-monitor` |
| `tauri.conf.json` productName | `搬砖实时监控` |
| 数据库目录名 | `keyboard-tracker` (硬编码在 `database/operations.rs`) |
| 自动启动 plist 名 | 由 `identifier` 动态生成 |

**修复方向**: 全局统一为 `brick-monitor`，数据库目录改为从 app identifier 或 `dirs::data_dir()` / app name 动态获取，而非硬编码 `keyboard-tracker`。

### 7. 构建产物中混入了 Windows 目标

`tauri.conf.json` 的 `bundle.targets` 包含了 `"msi"`（Windows 安装包）。macOS 构建时通常会忽略不适用目标，但在 CI/CD 中可能引发错误。建议分平台配置构建目标。

### 8. 缺少 LSUIElement（Dock 图标隐藏）

项目主要作为浮动窗口 + 托盘图标的常驻工具，但目前没有设置 `LSUIElement = true`。这意味着应用图标会出现在 Dock 中，占用空间且用户体验不佳。对于这类"后台常驻 + 小浮动面板"的应用，隐藏 Dock 图标是行业惯例。

**修复方向**: 在 Info.plist 中设置 `LSUIElement = true`，同时确保托盘菜单有"退出"选项。

### 9. 前台窗口检测问题

`src-tauri/src/window/macos.rs` 第 13-43 行：`get_active_window()` 获取所有在屏幕上的窗口列表（排除桌面元素），然后返回第一个 layer 为 0 的窗口。此方法有两个问题：

- **排序假设**: `CGWindowListCopyWindowInfo` 返回的列表顺序并非严格按 Z-order，第一个 layer=0 的窗口不一定是前台窗口。更准确的方法是使用 `NSWorkspace.shared.frontmostApplication` 或结合 `kCGWindowListOptionOnScreenAboveWindow`。
- **全屏/分屏应用**: 在全屏或 Stage Manager 环境下，layer=0 的判断可能失效。

### 10. DPI 缩放适配不足

浮动窗口大小硬编码为 284x116 像素，在高 DPI（Retina）屏幕上会显得很小，在低 DPI 外接显示器上可能过大。虽然 Tauri 有基本的 DPI 处理，但固定像素尺寸不会随缩放比例自适应。

---

## 🟢 建议改进（非阻断，但提升质量）

### 11. `main.rs` 的 windows_subsystem 属性

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
```

这行配置仅在 Windows 平台有效，macOS 上无害但令人困惑。建议分成平台条件编译，或至少加注释说明。

### 12. 部分功能键的 HID 码为 0x00

`physical_key_event` 函数中，Fn、F13-F19、F17、F18、F19 等键的 HID 码被设为 0x00。这些键在 `classify_key` 中 fallback 到 `KeyType::Char`，导致分类错误。

### 13. 未实现窗口重新打开的快捷方式

当用户关闭主窗口（实际是隐藏），点击 Dock 图标时不会重新显示主窗口。应监听 Tauri 的 Dock 点击事件并重新 show 主窗口。

### 14. 缺少错误恢复的用户引导

当权限不足时，`MacosAccessPanel.tsx` 能显示错误信息，但未提供清晰的步骤引导（例如截图展示如何授予权限）。对于非技术用户，直接跳转到系统设置页面后他们可能不知道应该勾选哪个应用。

### 15. 数据库未实现 WAL 模式

SQLite 默认使用 rollback journal 模式。对于频繁写入（每次按键都写入数据库）的场景，WAL 模式能显著减少锁竞争。当前实现只用 `execute_batch(SCHEMA)` 创建表，未执行 `PRAGMA journal_mode=WAL`。

---

## ✅ 已正确处理的部分

以下是项目已做对的 macOS 兼容事项，值得肯定：

- **Tauri v2 架构**: 使用最新的 Tauri 2，有完善的 macOS 支持
- **macOS 权限检测**: `AXIsProcessTrusted` + `CGPreflightListenEventAccess` 双重检查
- **权限请求提示**: `AXIsProcessTrustedWithOptions` 和 `CGRequestListenEventAccess` 正确调用
- **CGEventTap 键盘监听**: 使用正确的 API 和 CFRunLoop 模式
- **LaunchAgent 自启动**: plist 格式正确，放置在 `~/Library/LaunchAgents/`
- **应用图标**: `icon.icns` 已生成，多种尺寸 PNG 齐全
- **浮窗透明**: 正确关闭了 macOS 浮窗的阴影
- **主窗口关闭转隐藏**: 防止误关闭导致需要重启
- **系统托盘**: 带中文菜单，左键点击切换浮窗
- **隐私设置**: 支持排除特定应用和敏感窗口关键词过滤
- **数据库迁移**: 已有 lunch_break_minutes 列的向后兼容迁移
- **Xcode 验证脚本**: `verify-xcode-ready.sh` 能检测 Xcode 是否就绪

---

## 📋 修复优先级总结

| 优先级 | 问题 | 预估工作量 |
|-------|------|----------|
| P0 | 代码签名配置 | 1-2 天（取决于证书是否已获取） |
| P0 | 公证配置 | 0.5 天（配合签名一起做） |
| P0 | Info.plist 隐私声明 | 0.5 天 |
| P0 | 键盘映射国际化 | 2-3 天 |
| P0 | 监听器死亡恢复 | 1-2 天 |
| P1 | 命名统一 | 0.5 天 |
| P1 | 移除 Windows 构建目标 | 0.1 天 |
| P1 | Dock 图标隐藏 | 0.2 天 |
| P1 | 前台窗口检测优化 | 1 天 |
| P1 | DPI 适配 | 1 天 |
| P2 | main.rs 属性清理 | 0.1 天 |
| P2 | 功能键 HID 码修正 | 0.5 天 |
| P2 | Dock 点击恢复窗口 | 0.3 天 |
| P2 | WAL 模式 | 0.1 天 |
| P2 | 用户引导优化 | 1 天 |

**总计**: P0 问题修复后可以发 beta/内测版；P0+P1 全部修复后可正式发布。
