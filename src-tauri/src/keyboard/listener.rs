use crate::keyboard::key_classifier::{classify_key, KeyEvent};
use crate::permissions;
use crate::window::get_active_window;
#[cfg(not(target_os = "macos"))]
use rdev::{listen, Event, EventType, Key};
use std::ffi::c_void;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};

static LISTENER_STARTED: AtomicBool = AtomicBool::new(false);
static LISTENER_ENABLED: AtomicBool = AtomicBool::new(false);

pub struct KeyboardListener {
    app_handle: AppHandle,
    buffer: Arc<Mutex<Vec<(KeyEvent, String, String)>>>,
}

impl KeyboardListener {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            buffer: Arc::new(Mutex::new(Vec::with_capacity(100))),
        }
    }

    pub fn start(&self) -> Result<(), Box<dyn std::error::Error>> {
        LISTENER_ENABLED.store(true, Ordering::SeqCst);

        // 如果监听器线程已存活，不重复启动
        if LISTENER_STARTED.load(Ordering::SeqCst) {
            return Ok(());
        }

        // 原子标记已启动，避免竞态：先标记再 spawn，线程退出时复位
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

            // 线程退出意味着监听器死亡（系统终止 tap / 权限变更 / 休眠恢复等）
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

    pub fn stop(&self) {
        LISTENER_ENABLED.store(false, Ordering::SeqCst);
    }

    pub fn set_enabled(enabled: bool) {
        LISTENER_ENABLED.store(enabled, Ordering::SeqCst);
    }

    pub fn is_started() -> bool {
        LISTENER_STARTED.load(Ordering::SeqCst)
    }
}

fn handle_key_press(
    app_handle: &AppHandle,
    buffer: &Arc<Mutex<Vec<(KeyEvent, String, String)>>>,
    key_name: String,
    key_code: u32,
) {
    let window_info = match get_active_window() {
        Ok(window_info) => window_info,
        Err(error) => {
            let _ = permissions::record_runtime_error(app_handle, error);
            return;
        }
    };

    let app_name = window_info.app_name;
    let app_category = window_info.category;
    let window_title = window_info.window_title;

    let should_skip = if let Some(db) =
        app_handle.try_state::<std::sync::Mutex<crate::database::Database>>()
    {
        if let Ok(db_lock) = db.lock() {
            if let Ok(settings) = db_lock.get_privacy_settings() {
                let is_excluded = settings
                    .exclude_apps
                    .iter()
                    .any(|excluded| app_name.to_lowercase().contains(&excluded.to_lowercase()));

                let is_sensitive = settings.pause_during_sensitive && {
                    let title_lower = window_title.to_lowercase();
                    settings
                        .sensitive_window_keywords
                        .iter()
                        .any(|keyword| title_lower.contains(&keyword.to_lowercase()))
                };

                is_excluded || is_sensitive
            } else {
                false
            }
        } else {
            false
        }
    } else {
        false
    };

    if should_skip {
        return;
    }

    let key_type = classify_key(key_code, &key_name);
    let key_event = KeyEvent {
        key_code,
        key_name,
        key_type,
        timestamp: chrono::Utc::now().timestamp_millis(),
        is_key_down: true,
    };

    let _ = app_handle.emit("keystroke", &key_event);

    let mut buf = match buffer.lock() {
        Ok(buf) => buf,
        Err(_) => {
            let app_error = crate::error::AppError::new(
                "KEYBOARD_EVENT_BUFFER_LOCK_FAILED",
                "键盘事件缓冲区已损坏",
            );
            let _ = permissions::record_runtime_error(app_handle, app_error);
            return;
        }
    };

    buf.push((key_event, app_name.clone(), format!("{:?}", app_category)));

    if buf.len() < 10 {
        return;
    }

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

    let events: Vec<KeyEvent> = buf.iter().map(|(e, _, _)| e.clone()).collect();
    let _ = app_handle.emit("keystroke-batch", &events);
    buf.clear();
}

#[cfg(not(target_os = "macos"))]
fn start_platform_listener<F>(mut callback: F) -> Result<(), String>
where
    F: FnMut(String, u32) + Send + 'static,
{
    let rdev_callback = move |event: Event| {
        if let EventType::KeyPress(key) = event.event_type {
            let key_name = key_to_string(&key);
            let key_code = key_name_to_code(&key_name);
            callback(key_name, key_code);
        }
    };

    listen(rdev_callback).map_err(|error| format!("{error:?}"))
}

#[cfg(target_os = "macos")]
fn start_platform_listener<F>(callback: F) -> Result<(), String>
where
    F: FnMut(String, u32) + Send + 'static,
{
    macos::listen(callback)
}

#[cfg(target_os = "macos")]
mod macos {
    use super::*;
    use cocoa::base::{id, nil};
    use cocoa::foundation::NSAutoreleasePool;
    use core_graphics::event::{CGEvent, CGEventFlags, CGEventTapLocation, CGEventType, EventField};
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::Mutex;

    type CGEventRef = CGEvent;
    type CGEventMask = u64;
    type CGEventTapProxy = id;
    type CFMachPortRef = *const c_void;
    type CFRunLoopRef = id;
    type CFRunLoopSourceRef = id;
    type CFRunLoopMode = id;

    static GLOBAL_CALLBACK: Mutex<Option<Box<dyn FnMut(String, u32) + Send>>> = Mutex::new(None);
    static LAST_FLAGS: AtomicU64 = AtomicU64::new(0);

    const KCG_HEAD_INSERT_EVENT_TAP: u32 = 0;
    const NSEVENT_MODIFIER_FLAG_CAPS_LOCK: u64 = 1 << 16;
    const NSEVENT_MODIFIER_FLAG_SHIFT: u64 = 1 << 17;
    const NSEVENT_MODIFIER_FLAG_CONTROL: u64 = 1 << 18;
    const NSEVENT_MODIFIER_FLAG_OPTION: u64 = 1 << 19;
    const NSEVENT_MODIFIER_FLAG_COMMAND: u64 = 1 << 20;

    #[repr(u32)]
    enum CGEventTapOption {
        ListenOnly = 1,
    }

    #[link(name = "Cocoa", kind = "framework")]
    extern "C" {
        fn CGEventTapCreate(
            tap: CGEventTapLocation,
            place: u32,
            options: CGEventTapOption,
            events_of_interest: CGEventMask,
            callback: unsafe extern "C" fn(
                CGEventTapProxy,
                CGEventType,
                CGEventRef,
                *mut c_void,
            ) -> CGEventRef,
            user_info: id,
        ) -> CFMachPortRef;
        fn CFMachPortCreateRunLoopSource(
            allocator: id,
            tap: CFMachPortRef,
            order: u64,
        ) -> CFRunLoopSourceRef;
        fn CFRunLoopAddSource(rl: CFRunLoopRef, source: CFRunLoopSourceRef, mode: CFRunLoopMode);
        fn CFRunLoopGetCurrent() -> CFRunLoopRef;
        fn CGEventTapEnable(tap: CFMachPortRef, enable: bool);
        fn CFRunLoopRun();
        static kCFRunLoopCommonModes: CFRunLoopMode;
    }

    pub fn listen<F>(callback: F) -> Result<(), String>
    where
        F: FnMut(String, u32) + Send + 'static,
    {
        {
            let mut global_callback = GLOBAL_CALLBACK
                .lock()
                .map_err(|_| "GLOBAL_CALLBACK 锁已损坏".to_string())?;
            *global_callback = Some(Box::new(callback));
        }

        unsafe {
            let _pool = NSAutoreleasePool::new(nil);
            let event_mask = (1 << CGEventType::KeyDown as u64) | (1 << CGEventType::FlagsChanged as u64);
            let tap = CGEventTapCreate(
                CGEventTapLocation::HID,
                KCG_HEAD_INSERT_EVENT_TAP,
                CGEventTapOption::ListenOnly,
                event_mask,
                raw_callback,
                nil,
            );

            if tap.is_null() {
                return Err("CGEventTapCreate 返回空指针，请确认辅助功能/输入监控权限已授予".to_string());
            }

            let loop_source = CFMachPortCreateRunLoopSource(nil, tap, 0);
            if loop_source.is_null() {
                return Err("CFMachPortCreateRunLoopSource 返回空指针".to_string());
            }

            let current_loop = CFRunLoopGetCurrent();
            CFRunLoopAddSource(current_loop, loop_source, kCFRunLoopCommonModes);
            CGEventTapEnable(tap, true);
            CFRunLoopRun();
        }

        Ok(())
    }

    unsafe extern "C" fn raw_callback(
        _proxy: CGEventTapProxy,
        event_type: CGEventType,
        cg_event: CGEventRef,
        _user_info: *mut c_void,
    ) -> CGEventRef {
        let code = cg_event.get_integer_value_field(EventField::KEYBOARD_EVENT_KEYCODE) as u16;

        let maybe_event = match event_type {
            CGEventType::KeyDown => physical_key_event(code),
            CGEventType::FlagsChanged => modifier_key_event(code, cg_event.get_flags()),
            _ => None,
        };

        if let Some((key_name, key_code)) = maybe_event {
            if let Ok(mut global_callback) = GLOBAL_CALLBACK.lock() {
                if let Some(callback) = global_callback.as_mut() {
                    callback(key_name, key_code);
                }
            }
        }

        cg_event
    }

    unsafe fn modifier_key_event(code: u16, flags: CGEventFlags) -> Option<(String, u32)> {
        let current_flags = flags.bits();
        let previous_flags = LAST_FLAGS.load(Ordering::SeqCst);
        let pressed = match code {
            54 | 55 => current_flags & NSEVENT_MODIFIER_FLAG_COMMAND != 0,
            56 | 60 => current_flags & NSEVENT_MODIFIER_FLAG_SHIFT != 0,
            58 | 61 => current_flags & NSEVENT_MODIFIER_FLAG_OPTION != 0,
            59 | 62 => current_flags & NSEVENT_MODIFIER_FLAG_CONTROL != 0,
            57 => current_flags & NSEVENT_MODIFIER_FLAG_CAPS_LOCK != 0,
            _ => current_flags > previous_flags,
        };
        LAST_FLAGS.store(current_flags, Ordering::SeqCst);

        if !pressed {
            return None;
        }

        physical_key_event(code)
    }

    fn physical_key_event(code: u16) -> Option<(String, u32)> {
        let (name, hid_code) = match code {
            0 => ("a", 0x04),
            1 => ("s", 0x16),
            2 => ("d", 0x07),
            3 => ("f", 0x09),
            4 => ("h", 0x0B),
            5 => ("g", 0x0A),
            6 => ("z", 0x1D),
            7 => ("x", 0x1B),
            8 => ("c", 0x06),
            9 => ("v", 0x19),
            11 => ("b", 0x05),
            12 => ("q", 0x14),
            13 => ("w", 0x1A),
            14 => ("e", 0x08),
            15 => ("r", 0x15),
            16 => ("y", 0x1C),
            17 => ("t", 0x17),
            18 => ("1", 0x1E),
            19 => ("2", 0x1F),
            20 => ("3", 0x20),
            21 => ("4", 0x21),
            22 => ("6", 0x23),
            23 => ("5", 0x22),
            24 => ("=", 0x2E),
            25 => ("9", 0x26),
            26 => ("7", 0x24),
            27 => ("-", 0x2D),
            28 => ("8", 0x25),
            29 => ("0", 0x27),
            30 => ("]", 0x30),
            31 => ("o", 0x12),
            32 => ("u", 0x18),
            33 => ("[", 0x2F),
            34 => ("i", 0x0C),
            35 => ("p", 0x13),
            37 => ("l", 0x0F),
            38 => ("j", 0x0D),
            39 => ("'", 0x34),
            40 => ("k", 0x0E),
            41 => (";", 0x33),
            42 => ("\\", 0x31),
            43 => (",", 0x36),
            44 => ("/", 0x38),
            45 => ("n", 0x11),
            46 => ("m", 0x10),
            47 => (".", 0x37),
            48 => ("Tab", 0x2B),
            49 => ("Space", 0x2C),
            50 => ("`", 0x35),
            51 => ("Backspace", 0x2A),
            53 => ("Escape", 0x29),
            54 | 55 => ("Meta", 0xE3),
            56 | 60 => ("Shift", 0xE1),
            57 => ("CapsLock", 0x39),
            58 | 61 => ("Alt", 0xE2),
            59 | 62 => ("Ctrl", 0xE0),
            63 => ("Fn", 0x65),
            64 => ("F17", 0x6C),
            65 => ("NumpadDecimal", 0x63),
            67 => ("NumpadMultiply", 0x55),
            69 => ("NumpadPlus", 0x57),
            71 => ("NumpadClear", 0x53),
            75 => ("NumpadDivide", 0x54),
            76 => ("Enter", 0x28),
            78 => ("NumpadMinus", 0x56),
            79 => ("F18", 0x6D),
            80 => ("F19", 0x6E),
            81 => ("NumpadEquals", 0x67),
            82 => ("Numpad0", 0x62),
            83 => ("Numpad1", 0x59),
            84 => ("Numpad2", 0x5A),
            85 => ("Numpad3", 0x5B),
            86 => ("Numpad4", 0x5C),
            87 => ("Numpad5", 0x5D),
            88 => ("Numpad6", 0x5E),
            89 => ("Numpad7", 0x5F),
            91 => ("Numpad8", 0x60),
            92 => ("Numpad9", 0x61),
            96 => ("F5", 0x3E),
            97 => ("F6", 0x3F),
            98 => ("F7", 0x40),
            99 => ("F3", 0x3C),
            100 => ("F8", 0x41),
            101 => ("F9", 0x42),
            103 => ("F11", 0x44),
            105 => ("F13", 0x68),
            106 => ("F16", 0x6B),
            107 => ("F14", 0x69),
            109 => ("F10", 0x43),
            111 => ("F12", 0x45),
            113 => ("F15", 0x6A),
            114 => ("Insert", 0x49),
            115 => ("Home", 0x4A),
            116 => ("PageUp", 0x4B),
            117 => ("Delete", 0x4C),
            118 => ("F4", 0x3D),
            119 => ("End", 0x4D),
            120 => ("F2", 0x3B),
            121 => ("PageDown", 0x4E),
            122 => ("F1", 0x3A),
            123 => ("Left", 0x50),
            124 => ("Right", 0x4F),
            125 => ("Down", 0x51),
            126 => ("Up", 0x52),
            _ => return Some((format!("KeyCode({code})"), 0x00)),
        };

        Some((name.to_string(), hid_code))
    }
}

#[cfg(not(target_os = "macos"))]
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

#[cfg(not(target_os = "macos"))]
fn key_name_to_code(name: &str) -> u32 {
    match name {
        "a" => 0x04,
        "b" => 0x05,
        "c" => 0x06,
        "d" => 0x07,
        "e" => 0x08,
        "f" => 0x09,
        "g" => 0x0A,
        "h" => 0x0B,
        "i" => 0x0C,
        "j" => 0x0D,
        "k" => 0x0E,
        "l" => 0x0F,
        "m" => 0x10,
        "n" => 0x11,
        "o" => 0x12,
        "p" => 0x13,
        "q" => 0x14,
        "r" => 0x15,
        "s" => 0x16,
        "t" => 0x17,
        "u" => 0x18,
        "v" => 0x19,
        "w" => 0x1A,
        "x" => 0x1B,
        "y" => 0x1C,
        "z" => 0x1D,
        "0" => 0x27,
        "1" => 0x1E,
        "2" => 0x1F,
        "3" => 0x20,
        "4" => 0x21,
        "5" => 0x22,
        "6" => 0x23,
        "7" => 0x24,
        "8" => 0x25,
        "9" => 0x26,
        "F1" => 0x3A,
        "F2" => 0x3B,
        "F3" => 0x3C,
        "F4" => 0x3D,
        "F5" => 0x3E,
        "F6" => 0x3F,
        "F7" => 0x40,
        "F8" => 0x41,
        "F9" => 0x42,
        "F10" => 0x43,
        "F11" => 0x44,
        "F12" => 0x45,
        "Shift" => 0xE1,
        "Ctrl" => 0xE0,
        "Alt" => 0xE2,
        "Meta" => 0xE3,
        "Up" => 0x52,
        "Down" => 0x51,
        "Left" => 0x50,
        "Right" => 0x4F,
        "Home" => 0x4A,
        "End" => 0x4D,
        "PageUp" => 0x4B,
        "PageDown" => 0x4E,
        "Backspace" => 0x2A,
        "Delete" => 0x4C,
        "Insert" => 0x49,
        "Enter" => 0x28,
        "Tab" => 0x2B,
        "Space" => 0x2C,
        "Escape" => 0x29,
        _ => 0x00,
    }
}
