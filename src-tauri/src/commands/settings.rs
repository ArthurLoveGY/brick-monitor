use tauri::State;
use std::sync::Mutex;
use crate::database::Database;
use crate::database::operations::PrivacySettings;

#[tauri::command]
pub fn get_privacy_settings(db: State<'_, Mutex<Database>>) -> Result<PrivacySettings, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.get_privacy_settings().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_privacy_settings(db: State<'_, Mutex<Database>>, settings: PrivacySettings) -> Result<(), String> {
    let mut db = db.lock().map_err(|e| e.to_string())?;
    db.save_privacy_settings(&settings).map_err(|e| e.to_string())
}
