use tauri::State;
use std::sync::Mutex;
use crate::database::Database;
use crate::database::operations::PrivacySettings;
use crate::error::AppError;

#[tauri::command]
pub fn get_privacy_settings(db: State<'_, Mutex<Database>>) -> Result<PrivacySettings, AppError> {
    let db = db.lock().map_err(|e| AppError::new("DATABASE_LOCK_FAILED", e.to_string()))?;
    db.get_privacy_settings()
        .map_err(|e| AppError::new("PRIVACY_SETTINGS_READ_FAILED", e.to_string()))
}

#[tauri::command]
pub fn save_privacy_settings(db: State<'_, Mutex<Database>>, settings: PrivacySettings) -> Result<(), AppError> {
    let mut db = db.lock().map_err(|e| AppError::new("DATABASE_LOCK_FAILED", e.to_string()))?;
    db.save_privacy_settings(&settings)
        .map_err(|e| AppError::new("PRIVACY_SETTINGS_WRITE_FAILED", e.to_string()))
}
