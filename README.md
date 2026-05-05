# Brick Monitor (搬砖实时监控)

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS-lightgrey.svg)](https://github.com/ArthurLoveGY/brick-monitor)

> "搬砖" (bān zhuān) is Chinese internet slang for grinding at work. Brick Monitor tracks your keyboard activity, calculates real-time earnings, and shows your daily work rhythm — running quietly in your system tray.

## Features

- **Global keyboard tracking** — counts keystrokes across all apps and categorizes by type (IDE, Browser, Terminal, Chat, Office)
- **Real-time earnings** — configurable salary calculator computes hourly and daily earnings based on elapsed work time
- **Floating widget** — always-on-top translucent panel showing countdown, earnings, keystrokes, and a Code/Talk heartbeat gauge
- **Full dashboard** — bar, area, line, and pie charts for daily, hourly, and historical trends
- **Privacy controls** — exclude apps or pause tracking when a sensitive window (banking, passwords) is active
- **System tray** — menu bar icon with quick toggle for the floating widget and access to the main window
- **Auto-start** — optional LaunchAgent to launch on login

## System Requirements

- macOS 13.0 (Ventura) or later
- Apple Silicon or Intel Mac

> **Note:** The current version supports **US English (QWERTY)** keyboard layouts. Key names may display incorrectly on other layouts.

## Installation

### Download from GitHub Releases

1. Go to the [Releases](https://github.com/ArthurLoveGY/brick-monitor/releases) page
2. Download the latest `.dmg` file
3. Open the DMG and drag **Brick Monitor** to your Applications folder

### First Launch (Gatekeeper Bypass)

Brick Monitor is distributed unsigned (open source, no Developer ID certificate). macOS Gatekeeper will block it on first launch:

1. **Right-click** (or Control-click) the app in Finder and select **Open**
2. Click **Open** in the confirmation dialog

Or run in Terminal:

```bash
xattr -cr /Applications/Brick\ Monitor.app
```

### Grant Permissions

Brick Monitor needs two macOS permissions:

| Permission | Purpose |
|-----------|---------|
| Accessibility | Detect the currently active application |
| Input Monitoring | Listen for global keyboard events |

When you first launch the app, the settings panel will guide you through granting both. If the system prompts don't appear, open **System Settings → Privacy & Security** and manually enable Brick Monitor ("搬砖实时监控") under both sections.

You may need to restart the app after granting permissions.

## Usage

### Floating Widget

Once permissions are granted, a small translucent panel appears on your desktop:

```
┌─────────────────────────────┐
│ 🕒 1h23m    │ 💰 185.5元    │
│─────────────────────────────│
│ ⌨️ 892      │ 💻 ▰▰▰▰▱▱ 🐟 │
│             │      72%       │
└─────────────────────────────┘
```

Drag the widget to reposition it anywhere on screen.

### System Tray

- **Left click** the tray icon to toggle the floating widget
- **Right click** for menu: toggle widget, open main window, quit

### Main Dashboard

Open the dashboard for detailed statistics and settings:

- Daily keystroke trend (bar chart)
- Hourly distribution (area chart)
- App breakdown (pie chart)
- Historical comparison (line chart)
- Settings: salary config, permissions, privacy exclusions

### Salary Configuration

In the Settings tab, configure:

- Monthly salary and currency
- Work days per month
- Work hours per day
- Start/end time
- Lunch break duration

The floating widget then shows real-time earnings based on elapsed work time × hourly rate.

### App Classification

The app automatically categorizes keystrokes by the active application:

| Category | Apps detected |
|----------|-------------|
| IDE | VSCode, IntelliJ IDEA, Cursor, Vim, Xcode |
| Terminal | Terminal, iTerm2, Warp, Alacritty, Kitty, Ghostty |
| Browser | Chrome, Edge, Firefox, Safari, Brave |
| Chat | WeChat, QQ, Slack, Discord, Telegram |
| Office | Word, Excel, PowerPoint, Notion, Obsidian |

## Privacy

Brick Monitor stores all data **locally on your device**. We never:

- Upload any data to the cloud
- Record the actual content of your keystrokes
- Monitor password fields or sensitive windows

Only metadata is recorded: key type (character/function/modifier), timestamp, and active application name.

### Data Location

```
~/Library/Application Support/brick-monitor/data.db
```

### LaunchAgent

```
~/Library/LaunchAgents/com.brick-monitor.app.plist
```

## Known Limitations

- **Keyboard layout**: Only US English (QWERTY) is fully supported. AZERTY, QWERTZ, and other layouts may show incorrect key names.
- **Code signing**: Distributed unsigned via GitHub. First launch requires Gatekeeper bypass (see Installation).
- **Window detection**: Some full-screen or Stage Manager applications may not be detected correctly.

## Development

### Prerequisites

- Node.js 20+
- pnpm
- Rust (stable)
- Xcode Command Line Tools

Verify Xcode:

```bash
pnpm verify:xcode
```

### Setup

```bash
pnpm install
```

### Run in Development

```bash
pnpm tauri:dev
```

### Type Check & Lint

```bash
pnpm typecheck
```

### Run Tests

```bash
pnpm test
```

### Build for GitHub Release

```bash
pnpm release:github
```

The `.dmg` will be in `src-tauri/target/release/bundle/dmg/`.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Framework | Tauri 2 |
| Backend | Rust |
| Frontend | React 18 + TypeScript |
| Build Tool | Vite 5 |
| State Management | Zustand |
| Charts | Recharts |
| Database | SQLite (rusqlite) |

## License

[MIT](LICENSE)

---

<div align="center">
  <sub>Made with ❤️ by programmers, for programmers</sub>
</div>
