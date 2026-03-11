use tauri::State;
use std::sync::Mutex;
use crate::database::Database;

#[tauri::command]
pub fn get_today_stats(db: State<'_, Mutex<Database>>) -> Result<crate::database::operations::TodayStats, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.get_today_stats().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_today_hourly(db: State<'_, Mutex<Database>>) -> Result<Vec<crate::database::operations::HourlyStats>, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.get_today_hourly().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_history_stats(db: State<'_, Mutex<Database>>, days: i32) -> Result<Vec<crate::database::operations::DailyStats>, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.get_history_stats(days).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_app_breakdown(db: State<'_, Mutex<Database>>) -> Result<Vec<crate::database::operations::AppBreakdown>, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.get_app_breakdown().map_err(|e| e.to_string())
}
