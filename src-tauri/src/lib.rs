pub mod keyboard;
pub mod window;
pub mod database;
pub mod salary;
pub mod commands;
pub mod error;
pub mod permissions;
pub mod autostart;

use tauri::Manager;
use std::sync::atomic::{AtomicBool, Ordering};

static FLOATING_VISIBLE: AtomicBool = AtomicBool::new(true);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // 初始化数据库
            let db = database::Database::new().expect("Failed to initialize database");
            app.manage(std::sync::Mutex::new(db));
            app.manage(permissions::MonitoringRuntimeState::default());

            // 浮窗使用前端自己的圆角玻璃层。
            // 不再叠加整窗 vibrancy，避免 macOS 把透明窗口按矩形材质渲染，导致四角露出方形底板。
            #[cfg(target_os = "macos")]
            if let Some(floating_win) = app.get_webview_window("floating") {
                let _ = floating_win.set_shadow(false);
            }

            // 监听主窗口关闭事件，改为隐藏
            let app_handle = app.handle().clone();
            if let Some(main_win) = app.get_webview_window("main") {
                main_win.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        // 阻止关闭
                        api.prevent_close();
                        // 隐藏窗口
                        if let Some(win) = app_handle.get_webview_window("main") {
                            let _ = win.hide();
                        }
                    }
                });
            }

            // 初始化监控权限与监听状态
            permissions::initialize_monitoring(&app.handle().clone())
                .map_err(|error| -> Box<dyn std::error::Error> { Box::new(error) })?;

            // 创建托盘菜单
            setup_tray(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::keystroke::get_today_stats,
            commands::keystroke::get_today_hourly,
            commands::keystroke::get_history_stats,
            commands::keystroke::get_app_breakdown,
            commands::heartbeat::get_heartbeat_data,
            commands::salary::get_salary_config,
            commands::salary::save_salary_config,
            commands::salary::get_salary_info,
            commands::salary::get_work_schedule,
            commands::settings::get_privacy_settings,
            commands::settings::save_privacy_settings,
            commands::system::get_monitoring_status,
            commands::system::refresh_monitoring_status,
            commands::system::request_monitoring_permissions,
            commands::system::open_macos_privacy_settings,
            commands::system::get_autostart_status,
            commands::system::set_autostart_enabled,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::{
        menu::{Menu, MenuItem},
        tray::{TrayIconBuilder, TrayIconEvent},
    };

    // 初始文本根据当前状态设置
    let toggle_widget = MenuItem::with_id(app, "toggle_widget", "隐藏悬浮窗", true, None::<&str>)?;
    let show_main = MenuItem::with_id(app, "show_main", "打开主窗口", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出程序", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&toggle_widget, &show_main, &quit])?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "toggle_widget" => {
                if let Some(win) = app.get_webview_window("floating") {
                    let is_visible = FLOATING_VISIBLE.load(Ordering::SeqCst);
                    if is_visible {
                        let _ = win.hide();
                        FLOATING_VISIBLE.store(false, Ordering::SeqCst);
                    } else {
                        let _ = win.show();
                        FLOATING_VISIBLE.store(true, Ordering::SeqCst);
                    }
                }
            }
            "show_main" => {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            use tauri::tray::MouseButton;
            use tauri::tray::MouseButtonState;
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(win) = app.get_webview_window("floating") {
                    let is_visible = FLOATING_VISIBLE.load(Ordering::SeqCst);
                    if is_visible {
                        let _ = win.hide();
                        FLOATING_VISIBLE.store(false, Ordering::SeqCst);
                    } else {
                        let _ = win.show();
                        FLOATING_VISIBLE.store(true, Ordering::SeqCst);
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}
