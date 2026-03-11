use rdev::{listen, Event, EventType, Key};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};
use crate::keyboard::key_classifier::{classify_key, KeyEvent};
use crate::window::get_active_window;

pub struct KeyboardListener {
    app_handle: AppHandle,
    is_running: Arc<Mutex<bool>>,
    buffer: Arc<Mutex<Vec<(KeyEvent, String, String)>>>, // (event, app_name, app_category)
}

impl KeyboardListener {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            is_running: Arc::new(Mutex::new(false)),
            buffer: Arc::new(Mutex::new(Vec::with_capacity(100))),
        }
    }

    pub fn start(&self) -> Result<(), Box<dyn std::error::Error>> {
        *self.is_running.lock().unwrap() = true;

        let app_handle = self.app_handle.clone();
        let is_running = self.is_running.clone();
        let buffer = self.buffer.clone();

        // 在独立线程中监听
        std::thread::spawn(move || {
            let callback = move |event: Event| {
                let running = is_running.lock().unwrap();
                if !*running {
                    return;
                }
                drop(running);

                if let EventType::KeyPress(key) = event.event_type {
                    // 获取当前活动窗口信息
                    let window_info = get_active_window();

                    let app_name: String;
                    let app_category: crate::window::AppCategory;
                    let window_title: String;

                    match window_info {
                        Some(ref w) => {
                            app_name = w.app_name.clone();
                            app_category = w.category.clone();
                            window_title = w.window_title.clone();
                        }
                        None => {
                            app_name = "Unknown".to_string();
                            app_category = crate::window::AppCategory::Other;
                            window_title = String::new();
                        }
                    }

                    // 检查隐私设置
                    let should_skip = if let Some(db) = app_handle.try_state::<std::sync::Mutex<crate::database::Database>>() {
                        if let Ok(db_lock) = db.lock() {
                            if let Ok(settings) = db_lock.get_privacy_settings() {
                                // 检查是否在排除列表中
                                let is_excluded = settings.exclude_apps.iter().any(|excluded| {
                                    app_name.to_lowercase().contains(&excluded.to_lowercase())
                                });

                                // 检查是否包含敏感关键词
                                let is_sensitive = settings.pause_during_sensitive && {
                                    let title_lower = window_title.to_lowercase();
                                    settings.sensitive_window_keywords.iter().any(|keyword| {
                                        title_lower.contains(&keyword.to_lowercase())
                                    })
                                };

                                is_excluded || is_sensitive
                            } else { false }
                        } else { false }
                    } else { false };

                    if should_skip {
                        return; // 跳过记录此按键
                    }

                    let key_name = key_to_string(&key);
                    let key_code = key_name_to_code(&key_name);
                    let key_type = classify_key(key_code, &key_name);

                    let key_event = KeyEvent {
                        key_code,
                        key_name: key_name.clone(),
                        key_type,
                        timestamp: chrono::Utc::now().timestamp_millis(),
                        is_key_down: true,
                    };

                    // 发送到前端
                    let _ = app_handle.emit("keystroke", &key_event);

                    // 缓存到批量写入缓冲区
                    let mut buf = buffer.lock().unwrap();
                    buf.push((key_event, app_name.clone(), format!("{:?}", app_category)));

                    // 每隔 10 个按键就写入数据库
                    if buf.len() >= 10 {
                        // 批量写入数据库
                        if let Some(db) = app_handle.try_state::<std::sync::Mutex<crate::database::Database>>() {
                            if let Ok(mut db_lock) = db.lock() {
                                for (evt, name, category) in buf.iter() {
                                    let category_enum = match category.as_str() {
                                        "IDE" => crate::window::AppCategory::IDE,
                                        "Browser" => crate::window::AppCategory::Browser,
                                        "Terminal" => crate::window::AppCategory::Terminal,
                                        "Chat" => crate::window::AppCategory::Chat,
                                        "Office" => crate::window::AppCategory::Office,
                                        _ => crate::window::AppCategory::Other,
                                    };
                                    let _ = db_lock.insert_single_keystroke(evt, name, &category_enum);
                                }
                            }
                        }

                        // 也发送事件通知前端
                        let events: Vec<KeyEvent> = buf.iter().map(|(e, _, _)| e.clone()).collect();
                        let _ = app_handle.emit("keystroke-batch", &events);
                        buf.clear();
                    }
                }
            };

            // 注意：rdev::listen 会阻塞当前线程
            if let Err(e) = listen(callback) {
                eprintln!("键盘监听错误: {:?}", e);
            }
        });

        Ok(())
    }

    pub fn stop(&self) {
        *self.is_running.lock().unwrap() = false;
    }
}

fn key_to_string(key: &Key) -> String {
    match key {
        Key::KeyA => "a".to_string(),
        Key::KeyB => "b".to_string(),
        Key::KeyC => "c".to_string(),
        Key::KeyD => "d".to_string(),
        Key::KeyE => "e".to_string(),
        Key::KeyF => "f".to_string(),
        Key::KeyG => "g".to_string(),
        Key::KeyH => "h".to_string(),
        Key::KeyI => "i".to_string(),
        Key::KeyJ => "j".to_string(),
        Key::KeyK => "k".to_string(),
        Key::KeyL => "l".to_string(),
        Key::KeyM => "m".to_string(),
        Key::KeyN => "n".to_string(),
        Key::KeyO => "o".to_string(),
        Key::KeyP => "p".to_string(),
        Key::KeyQ => "q".to_string(),
        Key::KeyR => "r".to_string(),
        Key::KeyS => "s".to_string(),
        Key::KeyT => "t".to_string(),
        Key::KeyU => "u".to_string(),
        Key::KeyV => "v".to_string(),
        Key::KeyW => "w".to_string(),
        Key::KeyX => "x".to_string(),
        Key::KeyY => "y".to_string(),
        Key::KeyZ => "z".to_string(),
        Key::Num0 => "0".to_string(),
        Key::Num1 => "1".to_string(),
        Key::Num2 => "2".to_string(),
        Key::Num3 => "3".to_string(),
        Key::Num4 => "4".to_string(),
        Key::Num5 => "5".to_string(),
        Key::Num6 => "6".to_string(),
        Key::Num7 => "7".to_string(),
        Key::Num8 => "8".to_string(),
        Key::Num9 => "9".to_string(),
        Key::Space => "Space".to_string(),
        Key::Return => "Enter".to_string(),
        Key::Backspace => "Backspace".to_string(),
        Key::Tab => "Tab".to_string(),
        Key::Escape => "Escape".to_string(),
        Key::ShiftLeft | Key::ShiftRight => "Shift".to_string(),
        Key::ControlLeft | Key::ControlRight => "Ctrl".to_string(),
        Key::Alt | Key::AltGr => "Alt".to_string(),
        Key::MetaLeft | Key::MetaRight => "Meta".to_string(),
        Key::UpArrow => "Up".to_string(),
        Key::DownArrow => "Down".to_string(),
        Key::LeftArrow => "Left".to_string(),
        Key::RightArrow => "Right".to_string(),
        Key::F1 => "F1".to_string(),
        Key::F2 => "F2".to_string(),
        Key::F3 => "F3".to_string(),
        Key::F4 => "F4".to_string(),
        Key::F5 => "F5".to_string(),
        Key::F6 => "F6".to_string(),
        Key::F7 => "F7".to_string(),
        Key::F8 => "F8".to_string(),
        Key::F9 => "F9".to_string(),
        Key::F10 => "F10".to_string(),
        Key::F11 => "F11".to_string(),
        Key::F12 => "F12".to_string(),
        Key::Delete => "Delete".to_string(),
        Key::Home => "Home".to_string(),
        Key::End => "End".to_string(),
        Key::PageUp => "PageUp".to_string(),
        Key::PageDown => "PageDown".to_string(),
        Key::Insert => "Insert".to_string(),
        _ => format!("{:?}", key),
    }
}

fn key_name_to_code(name: &str) -> u32 {
    match name {
        // 字母 a-z -> HID usage codes
        "a" => 0x04, "b" => 0x05, "c" => 0x06, "d" => 0x07,
        "e" => 0x08, "f" => 0x09, "g" => 0x0A, "h" => 0x0B,
        "i" => 0x0C, "j" => 0x0D, "k" => 0x0E, "l" => 0x0F,
        "m" => 0x10, "n" => 0x11, "o" => 0x12, "p" => 0x13,
        "q" => 0x14, "r" => 0x15, "s" => 0x16, "t" => 0x17,
        "u" => 0x18, "v" => 0x19, "w" => 0x1A, "x" => 0x1B,
        "y" => 0x1C, "z" => 0x1D,
        // 数字 0-9
        "0" => 0x27, "1" => 0x1E, "2" => 0x1F, "3" => 0x20,
        "4" => 0x21, "5" => 0x22, "6" => 0x23, "7" => 0x24,
        "8" => 0x25, "9" => 0x26,
        // 功能键
        "F1" => 0x3A, "F2" => 0x3B, "F3" => 0x3C, "F4" => 0x3D,
        "F5" => 0x3E, "F6" => 0x3F, "F7" => 0x40, "F8" => 0x41,
        "F9" => 0x42, "F10" => 0x43, "F11" => 0x44, "F12" => 0x45,
        // 修饰键
        "Shift" => 0xE1, "Ctrl" => 0xE0, "Alt" => 0xE2, "Meta" => 0xE3,
        // 导航键
        "Up" => 0x52, "Down" => 0x51, "Left" => 0x50, "Right" => 0x4F,
        "Home" => 0x4A, "End" => 0x4D, "PageUp" => 0x4B, "PageDown" => 0x4E,
        // 编辑键
        "Backspace" => 0x2A, "Delete" => 0x4C, "Insert" => 0x49,
        // 系统键
        "Enter" => 0x28, "Tab" => 0x2B, "Space" => 0x2C, "Escape" => 0x29,
        _ => 0x00,
    }
}
