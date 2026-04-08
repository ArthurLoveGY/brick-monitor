use crate::autostart;
use crate::error::AppError;
use crate::permissions;
use tauri::AppHandle;

#[tauri::command]
pub fn get_monitoring_status(app: AppHandle) -> Result<permissions::MonitoringStatus, AppError> {
    permissions::current_status(&app)
}

#[tauri::command]
pub fn refresh_monitoring_status(app: AppHandle) -> Result<permissions::MonitoringStatus, AppError> {
    permissions::refresh_monitoring_status(&app, false)
}

#[tauri::command]
pub fn request_monitoring_permissions(app: AppHandle) -> Result<permissions::MonitoringStatus, AppError> {
    permissions::refresh_monitoring_status(&app, true)
}

#[tauri::command]
pub fn open_macos_privacy_settings() -> Result<(), AppError> {
    permissions::open_privacy_settings()
}

#[tauri::command]
pub fn get_autostart_status(app: AppHandle) -> Result<autostart::AutostartStatus, AppError> {
    let executable_path = std::env::current_exe().map_err(|error| {
        AppError::new(
            "CURRENT_EXECUTABLE_UNAVAILABLE",
            format!("无法解析当前可执行文件路径: {error}"),
        )
    })?;

    autostart::get_status(app.config().identifier.as_str(), &executable_path)
}

#[tauri::command]
pub fn set_autostart_enabled(app: AppHandle, enabled: bool) -> Result<autostart::AutostartStatus, AppError> {
    let executable_path = std::env::current_exe().map_err(|error| {
        AppError::new(
            "CURRENT_EXECUTABLE_UNAVAILABLE",
            format!("无法解析当前可执行文件路径: {error}"),
        )
    })?;

    autostart::set_enabled(app.config().identifier.as_str(), &executable_path, enabled)
}
