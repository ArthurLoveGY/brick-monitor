// windows_subsystem 仅 Windows 平台生效，macOS 忽略此属性
#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

fn main() {
    brick_monitor::run()
}
