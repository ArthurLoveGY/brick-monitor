# Brick Monitor — GitHub Release 发布修改计划

**目标**: 将项目修复到可在 GitHub 上发布 dmg 安装包的状态，让用户下载后能正常安装使用。

**前提**: GitHub 发布不需要 Apple Developer 账号、签名或公证。用户通过右键 → 打开即可绕过 Gatekeeper，这也是绝大多数开源 macOS 工具的分发方式。

---

## 修改列表

### 1. 项目命名全局统一

**现状**: `package.json` 叫 `keyboard-tracker`，`index.html` title 是 `Keyboard Tracker`，Rust crate 叫 `brick-monitor`，数据库目录硬编码 `keyboard-tracker`。

**修改**:

- `package.json`: `"name"` 改为 `"brick-monitor"`
- `index.html`: `<title>` 改为 `"Brick Monitor"`
- `src-tauri/src/database/operations.rs` 第 17-18 行：数据库目录从 `"keyboard-tracker"` 改为 `"brick-monitor"`
- `src-tauri/tauri.conf.json`: `"identifier"` 改为 `"com.brick-monitor.app"`（避免与 `com.brick-monitor` 可能存在的其他应用冲突）

**文件变更**:
| 文件 | 变更 |
|------|------|
| `package.json` | `name` → `brick-monitor` |
| `index.html` | `<title>` → `Brick Monitor` |
| `src-tauri/src/database/operations.rs:18` | `"keyboard-tracker"` → `"brick-monitor"` |
| `src-tauri/tauri.conf.json` | `identifier` → `com.brick-monitor.app` |

---

### 2. Info.plist 隐私用途声明

**现状**: macOS 在弹出权限请求对话框时，如果 Info.plist 中没有对应声明，对话框会显示空白或系统默认文本。

**修改**:

在 `src-tauri/tauri.conf.json` 的 `bundle` 段中加入 `infoPlist` 覆盖：

```json
"bundle": {
  "active": true,
  "targets": ["app", "dmg"],
  "icon": [...],
  "macOS": {
    "minimumSystemVersion": "13.0",
    "infoPlist": {
      "NSAppleEventsUsageDescription": "Brick Monitor uses this to detect the currently active application for keystroke categorization.",
      "NSHumanReadableCopyright": "MIT License. Copyright (c) 2024"
    }
  }
}
```

**文件变更**:
| 文件 | 变更 |
|------|------|
| `src-tauri/tauri.conf.json` | `bundle.macOS` 中新增 `infoPlist` 字段 |

---

### 3. macOS 构建配置修正

**现状**: `bundle.targets` 包含 `"msi"`（Windows 专属），构建脚本引用不存在的 `scripts/`，`verify-macos-signing-env.sh` 对 GitHub 发布无意义。

**修改**:

- `tauri.conf.json` 的 `bundle.targets` 改为 `["app", "dmg"]`（仅 macOS）
- `package.json` 的 `release:macos` 命令改为 `pnpm build && tauri build --bundles app,dmg`
- 移除 `release:macos:verify-signing` 脚本引用（该脚本对 GitHub 发布无意义，本地保留文件即可）
- `package.json` 新增 `release:github` 脚本

```json
"scripts": {
  ...
  "release:macos": "pnpm build && tauri build --bundles app,dmg",
  "release:macos:verify-signing": "zsh ./scripts/verify-macos-signing-env.sh",
  "release:github": "pnpm build && tauri build --bundles dmg"
}
```

**文件变更**:
| 文件 | 变更 |
|------|------|
| `src-tauri/tauri.conf.json` | `bundle.targets` → `["app", "dmg"]` |
| `package.json` | 新增 `release:github` 命令 |

---

### 4. Dock 图标隐藏 (LSUIElement)

**现状**: 应用图标始终显示在 Dock 中，但这是一个"浮动窗口+托盘图标"的常驻工具，应该隐藏 Dock 图标。

**修改**:

在 `tauri.conf.json` 的 `bundle.macOS.infoPlist` 中加入 `LSUIElement`。

但是，`LSUIElement = true` 会带来一个副作用：应用成为"后台应用"，此时 `NSApp.activate(ignoringOtherApps:)` 行为会变化，可能影响主窗口的显示。需要在 Rust 侧做配合。

更安全的做法是：在 Tauri 窗口构建时使用 `SetActivationPolicy`，而不是静态 Info.plist。在 `lib.rs` 的 `setup` 中：

```rust
#[cfg(target_os = "macos")]
{
    use objc::{class, msg_send, sel, sel_impl};
    let cls = class!(NSApplication);
    let app: cocoa::base::id = msg_send![cls, sharedApplication];
    let _: () = msg_send![app, setActivationPolicy: 1]; // NSApplicationActivationPolicyAccessory = 1
}
```

**文件变更**:
| 文件 | 变更 |
|------|------|
| `src-tauri/src/lib.rs` | `setup()` 中新增 `setActivationPolicy` 调用 |

---

### 5. 键盘映射标注 + 添加多布局说明

**现状**: 物理键码硬编码为美式 QWERTY 布局。修复多布局支持的工作量较大（需要 IOKit `TISCopyCurrentKeyboardLayoutInputSource` + `UCKeyTranslate`）。

**修改策略**（GitHub 首次发布版本）:

- 在浮动窗口 / Dashboard 中添加平台提示：`"当前仅适配美式英文键盘布局"`
- 在 README 中明确说明
- 将多布局支持列入后续版本计划

前端修改：在 `src/components/FloatingWidget/index.tsx` 或 `Dashboard` 组件中添加一条提示信息。

同时修复 `listener.rs` 中 Fn/F13-F19 等键 HID 码为 0x00 的问题，将它们正确映射：

```rust
63 => ("Fn", 0x65),      // HID usage for Keyboard Application
64 => ("F17", 0x6C),
79 => ("F18", 0x6D),
80 => ("F19", 0x6E),
105 => ("F13", 0x68),
106 => ("F16", 0x6B),
107 => ("F14", 0x69),
113 => ("F15", 0x6A),
```

**文件变更**:
| 文件 | 变更 |
|------|------|
| `src-tauri/src/keyboard/listener.rs` | 修正功能键 HID 码 |
| `README.md` | 新增"已知限制"章节 |
| `src/components/FloatingWidget/index.tsx` | 添加键盘布局提示 |

---

### 6. 监听器死亡恢复

**现状**: `start()` 使用 `AtomicBool::swap` 来确保只启动一次。但监听器线程死亡后（tap 被系统终止），swap 已为 true，再次调用 start 会直接 return，无法重建线程。

**修改**:

在 `src-tauri/src/keyboard/listener.rs` 中，重构 `start()` 方法：

```rust
pub fn start(&self) -> Result<(), Box<dyn std::error::Error>> {
    LISTENER_ENABLED.store(true, Ordering::SeqCst);

    // 如果已有存活线程则不重复启动
    if LISTENER_STARTED.load(Ordering::SeqCst) {
        return Ok(());
    }

    // 先标记为已启动（在 spawn 之前）
    LISTENER_STARTED.store(true, Ordering::SeqCst);

    let app_handle = self.app_handle.clone();
    let buffer = self.buffer.clone();

    std::thread::spawn(move || {
        let event_app_handle = app_handle.clone();
        let event_buffer = buffer.clone();
        let event_callback = move |key_name: String, key_code: u32| {
            if !LISTENER_ENABLED.load(Ordering::SeqCst) {
                return;
            }
            handle_key_press(&event_app_handle, &event_buffer, key_name, key_code);
        };

        let listen_result = start_platform_listener(event_callback);
        // 线程退出意味着监听器死亡
        LISTENER_STARTED.store(false, Ordering::SeqCst);
        LISTENER_ENABLED.store(false, Ordering::SeqCst);
        if let Err(error) = listen_result {
            let app_error = crate::error::AppError::new(
                "KEYBOARD_LISTENER_RUNTIME_FAILED",
                format!("键盘监听线程异常退出: {error}"),
            );
            let _ = permissions::record_runtime_error(&app_handle, app_error);
        }
    });

    Ok(())
}
```

关键变更：
- 先 store(true) 再 spawn，避免竞态
- 线程退出后 `store(false)`，使得下次调用 start 可以重建
- 同时 `store(false)` LISTENER_ENABLED，确保前端状态同步

**文件变更**:
| 文件 | 变更 |
|------|------|
| `src-tauri/src/keyboard/listener.rs` | 重构 `start()` 的状态管理 |

---

### 7. 权限检查面板增加 US 键盘标注 + 优化引导文案

**现状**: `MacosAccessPanel.tsx` 有权限检查和请求，但对非技术用户缺少清晰的引导。

**修改**:

- 在面板中添加键盘布局提示
- 将"打开系统设置"按钮的引导文案优化，告知用户在设置中搜索哪个应用名
- 添加一行说明："在系统设置中找到"搬砖实时监控"，勾选其前面的复选框"

**文件变更**:
| 文件 | 变更 |
|------|------|
| `src/components/Settings/MacosAccessPanel.tsx` | 优化引导文案 |

---

### 8. 数据库 WAL 模式

**现状**: SQLite 使用默认的 rollback journal，频繁写入场景下 WAL 模式并发性能更好。

**修改**:

在 `src-tauri/src/database/operations.rs` 的 `Database::new()` 中，`execute_batch(SCHEMA)` 之后增加：

```rust
conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")?;
```

**文件变更**:
| 文件 | 变更 |
|------|------|
| `src-tauri/src/database/operations.rs` | `new()` 中添加 WAL pragma |

---

### 9. `main.rs` 平台属性修正

**现状**: `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]` 在 macOS 构建中没有效果但令人困惑。

**修改**:

```rust
// windows_subsystem 仅在 Windows 平台生效，macOS 忽略此属性
#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]
```

**文件变更**:
| 文件 | 变更 |
|------|------|
| `src-tauri/src/main.rs` | 条件编译增加 `target_os = "windows"` |

---

### 10. README 完善

**现状**: 没有 README。GitHub Release 需要明确的安装说明和使用指南。

**新建内容**: `README.md`，包含以下章节：

- 项目简介（中文 + 英文）
- 功能特性
- 系统要求（macOS 13.0+）
- 安装方式
  - 从 GitHub Releases 下载 dmg，拖入 Applications
  - 首次打开右键点击 → 打开（绕过 Gatekeeper）
  - 授予"辅助功能"和"输入监控"权限
- 使用说明（浮动窗口、主窗口、托盘菜单、工资配置）
- 已知限制（仅支持美式键盘布局）
- 开发指南（pnpm install、pnpm tauri:dev、pnpm release:github）
- 技术栈
- MIT License

**文件变更**:
| 文件 | 变更 |
|------|------|
| `README.md` | 新建文件 |

---

### 11. GitHub Actions 自动构建

**现状**: 无 CI/CD 配置。

**新建内容**: `.github/workflows/release.yml`

使用 Tauri 官方 action，在推送 tag 时自动构建 macOS dmg 并发布到 Release。

```yaml
name: Release
on:
  push:
    tags: ['v*']

jobs:
  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: 'Brick Monitor ${{ github.ref_name }}'
          releaseBody: 'See the assets to download and install this version.'
          releaseDraft: true
          args: --bundles dmg
```

**文件变更**:
| 文件 | 变更 |
|------|------|
| `.github/workflows/release.yml` | 新建文件 |

---

## 不需要做的事情（明确排除）

以下事项在 GitHub Release 方案中**不需要**，留待将来如果上架 App Store 或需要公证分发时再做：

- ❌ Apple Developer 账号 / 证书申请
- ❌ 代码签名配置 (`signingIdentity`)
- ❌ 公证 (notarization) 配置
- ❌ Hardened Runtime entitlement
- ❌ `scripts/verify-macos-signing-env.sh` 集成到构建流程

---

## 执行顺序

| 步骤 | 任务 | 文件数 | 复杂度 |
|-----|------|-------|-------|
| 1 | 命名统一 | 4 | 低 |
| 2 | Info.plist 隐私声明 | 1 | 低 |
| 3 | 构建配置修正 | 2 | 低 |
| 4 | Dock 图标隐藏 | 1 | 中 |
| 5 | 键盘映射标注 + HID 修正 | 3 | 低 |
| 6 | 监听器死亡恢复 | 1 | 中 |
| 7 | 权限面板文案优化 | 1 | 低 |
| 8 | 数据库 WAL 模式 | 1 | 低 |
| 9 | main.rs 属性修正 | 1 | 低 |
| 10 | README | 1 | 中 |
| 11 | GitHub Actions CI | 1 | 中 |
| - | 最终测试 & 构建验证 | - | - |

预计总工作量：2-3 个工作日。

---

## 发布 Checklist

发布前逐项确认：

- [ ] `pnpm build` 前端构建无错误
- [ ] `cargo build --manifest-path src-tauri/Cargo.toml` Rust 编译无错误
- [ ] `pnpm release:github` 生成 dmg 文件成功
- [ ] dmg 文件能在 macOS 13.x / 14.x 上安装
- [ ] 安装后首次启动能正常弹出权限请求
- [ ] 授予权限后浮动窗口 + 键盘监听正常运行
- [ ] 托盘图标正常显示，菜单可用
- [ ] README 中的安装步骤可复现
- [ ] git tag 推送后 GitHub Actions 自动构建成功
