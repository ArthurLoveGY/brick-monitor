use crate::error::{AppError, AppResult};
use crate::keyboard::KeyboardListener;
use serde::Serialize;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitoringStatus {
    pub platform: String,
    pub accessibility_granted: bool,
    pub input_monitoring_granted: bool,
    pub ready: bool,
    pub listener_started: bool,
    pub last_error: Option<AppError>,
}

pub struct MonitoringRuntimeState {
    listener_started: AtomicBool,
    status: Mutex<MonitoringStatus>,
}

impl Default for MonitoringRuntimeState {
    fn default() -> Self {
        Self {
            listener_started: AtomicBool::new(false),
            status: Mutex::new(MonitoringStatus {
                platform: std::env::consts::OS.to_string(),
                accessibility_granted: false,
                input_monitoring_granted: false,
                ready: false,
                listener_started: false,
                last_error: None,
            }),
        }
    }
}

impl MonitoringRuntimeState {
    pub fn listener_started(&self) -> bool {
        self.listener_started.load(Ordering::SeqCst)
    }

    pub fn set_listener_started(&self, started: bool) {
        self.listener_started.store(started, Ordering::SeqCst);
    }

    pub fn read_status(&self) -> AppResult<MonitoringStatus> {
        self.status
            .lock()
            .map(|status| status.clone())
            .map_err(|error| AppError::new("MONITORING_STATE_LOCK_FAILED", error.to_string()))
    }

    fn write_status(&self, status: MonitoringStatus) -> AppResult<()> {
        let mut guard = self
            .status
            .lock()
            .map_err(|error| AppError::new("MONITORING_STATE_LOCK_FAILED", error.to_string()))?;
        *guard = status;
        Ok(())
    }
}

pub fn initialize_monitoring(app: &AppHandle) -> AppResult<MonitoringStatus> {
    refresh_monitoring_status(app, false)
}

pub fn refresh_monitoring_status(app: &AppHandle, request_prompts: bool) -> AppResult<MonitoringStatus> {
    #[cfg(target_os = "macos")]
    {
        let accessibility_granted = if request_prompts {
            request_accessibility_permission()
        } else {
            accessibility_granted()
        };

        let input_monitoring_granted = if request_prompts {
            request_input_monitoring_permission()
        } else {
            input_monitoring_granted()
        };

        let runtime_state = app.state::<MonitoringRuntimeState>();
        let ready = accessibility_granted && input_monitoring_granted;

        if ready {
            let listener = KeyboardListener::new(app.clone());
            listener.start().map_err(|error| {
                AppError::new("KEYBOARD_LISTENER_START_FAILED", error.to_string())
            })?;
            runtime_state.set_listener_started(true);
            KeyboardListener::set_enabled(true);
        } else {
            KeyboardListener::set_enabled(false);
            runtime_state.set_listener_started(KeyboardListener::is_started());
        }

        let last_error = build_blocking_error(accessibility_granted, input_monitoring_granted);
        let status = MonitoringStatus {
            platform: "macos".to_string(),
            accessibility_granted,
            input_monitoring_granted,
            ready,
            listener_started: runtime_state.listener_started(),
            last_error,
        };

        runtime_state.write_status(status.clone())?;
        let _ = app.emit("monitoring-status-changed", &status);
        return Ok(status);
    }

    #[cfg(not(target_os = "macos"))]
    {
        let status = MonitoringStatus {
            platform: std::env::consts::OS.to_string(),
            accessibility_granted: false,
            input_monitoring_granted: false,
            ready: false,
            listener_started: false,
            last_error: Some(AppError::new(
                "MONITORING_PLATFORM_UNSUPPORTED",
                "当前平台未实现 macOS 监控能力",
            )),
        };
        let runtime_state = app.state::<MonitoringRuntimeState>();
        runtime_state.write_status(status.clone())?;
        return Ok(status);
    }
}

pub fn record_runtime_error(app: &AppHandle, error: AppError) -> AppResult<()> {
    let runtime_state = app.state::<MonitoringRuntimeState>();
    let current_status = runtime_state.read_status()?;
    let updated_status = MonitoringStatus {
        last_error: Some(error),
        ..current_status
    };
    runtime_state.write_status(updated_status.clone())?;
    let _ = app.emit("monitoring-status-changed", &updated_status);
    Ok(())
}

pub fn current_status(app: &AppHandle) -> AppResult<MonitoringStatus> {
    let runtime_state = app.state::<MonitoringRuntimeState>();
    runtime_state.read_status()
}

pub fn open_privacy_settings() -> AppResult<()> {
    #[cfg(target_os = "macos")]
    {
        let settings_url =
            "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility";
        let status = Command::new("open")
            .arg(settings_url)
            .status()
            .map_err(|error| {
                AppError::new(
                    "OPEN_PRIVACY_SETTINGS_FAILED",
                    format!("打开系统设置失败: {error}"),
                )
            })?;

        if !status.success() {
            return Err(AppError::new(
                "OPEN_PRIVACY_SETTINGS_FAILED",
                format!("open 命令返回非零状态: {status}"),
            ));
        }

        return Ok(());
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err(AppError::new(
            "OPEN_PRIVACY_SETTINGS_UNSUPPORTED",
            "只有 macOS 支持打开系统隐私设置",
        ))
    }
}

fn build_blocking_error(accessibility_granted: bool, input_monitoring_granted: bool) -> Option<AppError> {
    if accessibility_granted && input_monitoring_granted {
        return None;
    }

    if !accessibility_granted && !input_monitoring_granted {
        return Some(AppError::new(
            "MACOS_PERMISSIONS_REQUIRED",
            "缺少辅助功能和输入监控权限，键盘监听与活动窗口识别已被阻断",
        ));
    }

    if !accessibility_granted {
        return Some(AppError::new(
            "MACOS_ACCESSIBILITY_PERMISSION_REQUIRED",
            "缺少辅助功能权限，无法读取前台应用与窗口信息",
        ));
    }

    Some(AppError::new(
        "MACOS_INPUT_MONITORING_PERMISSION_REQUIRED",
        "缺少输入监控权限，无法开始全局键盘监听",
    ))
}

#[cfg(target_os = "macos")]
fn accessibility_granted() -> bool {
    unsafe { AXIsProcessTrusted() != 0 }
}

#[cfg(target_os = "macos")]
fn request_accessibility_permission() -> bool {
    use core_foundation::base::TCFType;
    use core_foundation::boolean::CFBoolean;
    use core_foundation::dictionary::CFDictionary;
    use core_foundation::string::CFString;

    let prompt_key = CFString::new("AXTrustedCheckOptionPrompt");
    let options = CFDictionary::from_CFType_pairs(&[(prompt_key, CFBoolean::true_value())]);
    unsafe { AXIsProcessTrustedWithOptions(options.as_concrete_TypeRef()) != 0 }
}

#[cfg(target_os = "macos")]
fn input_monitoring_granted() -> bool {
    unsafe { CGPreflightListenEventAccess() }
}

#[cfg(target_os = "macos")]
fn request_input_monitoring_permission() -> bool {
    unsafe { CGRequestListenEventAccess() }
}

#[cfg(target_os = "macos")]
use core_foundation::base::Boolean;

#[cfg(target_os = "macos")]
use core_foundation::dictionary::CFDictionaryRef;

#[cfg(target_os = "macos")]
#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn AXIsProcessTrusted() -> Boolean;
    fn AXIsProcessTrustedWithOptions(the_dict: CFDictionaryRef) -> Boolean;
}

#[cfg(target_os = "macos")]
#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGPreflightListenEventAccess() -> bool;
    fn CGRequestListenEventAccess() -> bool;
}
