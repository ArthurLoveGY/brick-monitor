# 搬砖实时监控 🧱

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey.svg)](https://github.com/ArthurLoveGY/brick-monitor)

> 程序员专属工时监控神器 —— 实时追踪你的"搬砖"时长，自动计算今日收入！

## 功能特色

- **实时监控** - 追踪你在 IDE、终端、浏览器等应用中的按键活动
- **收入计算** - 根据月薪和工作时间，自动计算今日已赚多少钱
- **下班倒计时** - 显示距离下班还有多长时间
- **工作状态分析** - 智能识别 Coding / 摸鱼 / 聊天 状态
- **悬浮窗显示** - 小巧的悬浮窗，不影响工作，一眼看清重要数据
- **隐私保护** - 支持排除敏感应用，不记录隐私窗口

## 界面预览

### 悬浮窗

```
┌─────────────────────────────┐
│ 🕒 1h23m    │ 💰 185.5元    │
│─────────────────────────────│
│ ⌨️ 892      │ 💻 ▰▰▰▰▱▱ 🐟 │
│             │      72%       │
└─────────────────────────────┘
```

### 主窗口

- 今日按键统计图表
- 应用分类占比
- 历史数据查看
- 工资配置设置

## 安装

### 下载安装包

前往 [Releases](https://github.com/ArthurLoveGY/brick-monitor/releases) 页面下载最新版本的安装包。

### 从源码构建

**环境要求：**

- Node.js 18+
- Rust 1.70+
- pnpm / npm / yarn

```bash
# 克隆仓库
git clone https://github.com/ArthurLoveGY/brick-monitor.git
cd brick-monitor

# 安装依赖
npm install

# 开发模式运行
npm run tauri dev

# 构建发布版本
npm run tauri build
```

## 使用说明

### 首次使用

1. 启动应用后，点击托盘图标 → "打开主窗口"
2. 在设置页面配置你的月薪和工作时间
3. 悬浮窗会自动显示在桌面上

### 快捷操作

- **左键托盘图标** - 显示/隐藏悬浮窗
- **右键托盘图标** - 打开菜单
- **拖动悬浮窗** - 按住左键拖动到任意位置

### 应用分类

自动识别以下应用类型：

| 类别       | 应用                                                 |
| ---------- | ---------------------------------------------------- |
| 💻 Coding  | VSCode, IDEA, Cursor, Vim, Terminal, CMD, PowerShell |
| 💬 Chat    | 微信, QQ, Slack, Discord, Telegram                   |
| 🌐 Browser | Chrome, Edge, Firefox, Safari                        |
| 📄 Office  | Word, Excel, PowerPoint, Notion                      |

## 技术栈

- **前端**: React + TypeScript + Tailwind CSS
- **后端**: Rust + Tauri 2.0
- **数据库**: SQLite
- **监控**: rdev (跨平台键盘监听)

## 隐私说明

本应用**不会**：

- 上传任何数据到云端
- 记录具体的按键内容
- 监控密码输入框

本应用**仅记录**：

- 按键时间戳
- 按键类型（字符/功能键等）
- 当前活动窗口的应用名称

## 配置文件

数据存储在本地：

- **Windows**: `%APPDATA%/brick-monitor/data.db`
- **macOS**: `~/Library/Application Support/brick-monitor/data.db`

## 开源协议

[MIT License](LICENSE)

## 致谢

如果你觉得这个项目有趣，欢迎 ⭐ Star 支持！

---

<div align="center">
  <sub>Made with ❤️ by programmers, for programmers</sub>
</div>
