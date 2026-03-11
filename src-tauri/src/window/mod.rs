use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct ActiveWindow {
    pub app_name: String,
    pub window_title: String,
    pub process_id: u32,
    pub category: AppCategory,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub enum AppCategory {
    IDE,       // VSCode, IDEA, Cursor
    Browser,   // Chrome, Edge, Safari
    Terminal,  // Terminal, iTerm, CMD
    Chat,      // WeChat, Slack, Discord
    Office,    // Word, Excel, PowerPoint
    Other,
}

#[cfg(target_os = "windows")]
mod windows;

#[cfg(target_os = "macos")]
mod macos;

pub fn get_active_window() -> Option<ActiveWindow> {
    #[cfg(target_os = "windows")]
    return windows::get_active_window();

    #[cfg(target_os = "macos")]
    return macos::get_active_window();

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    return None;
}

pub fn classify_app(app_name: &str) -> AppCategory {
    let app_lower = app_name.to_lowercase();

    if ["vscode", "idea", "cursor", "sublime", "atom", "vim", "neovim", "xcode"]
        .iter().any(|s| app_lower.contains(s)) {
        AppCategory::IDE
    } else if ["chrome", "edge", "firefox", "safari", "brave"]
        .iter().any(|s| app_lower.contains(s)) {
        AppCategory::Browser
    } else if ["terminal", "iterm", "cmd", "powershell", "windowsterminal"]
        .iter().any(|s| app_lower.contains(s)) {
        AppCategory::Terminal
    } else if ["wechat", "slack", "discord", "teams", "qq", "telegram"]
        .iter().any(|s| app_lower.contains(s)) {
        AppCategory::Chat
    } else if ["word", "excel", "powerpoint", "notion", "obsidian"]
        .iter().any(|s| app_lower.contains(s)) {
        AppCategory::Office
    } else {
        AppCategory::Other
    }
}
