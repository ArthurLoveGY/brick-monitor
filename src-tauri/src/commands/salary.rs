use tauri::State;
use std::sync::Mutex;
use crate::database::Database;
use crate::database::operations::SalaryConfig;

#[tauri::command]
pub fn get_salary_config(db: State<'_, Mutex<Database>>) -> Result<SalaryConfig, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.get_salary_config().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_salary_config(db: State<'_, Mutex<Database>>, config: SalaryConfig) -> Result<(), String> {
    let mut db = db.lock().map_err(|e| e.to_string())?;
    db.save_salary_config(&config).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_salary_info(db: State<'_, Mutex<Database>>) -> Result<crate::salary::SalaryInfo, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    let config = db.get_salary_config().map_err(|e| e.to_string())?;
    drop(db);

    let salary_config = crate::salary::SalaryConfig {
        monthly_salary: config.monthly_salary,
        work_days_per_month: config.work_days_per_month as u32,
        work_hours_per_day: config.work_hours_per_day,
        work_start_time: config.work_start_time,
        work_end_time: config.work_end_time,
        lunch_break_minutes: config.lunch_break_minutes as u32,
        currency: config.currency,
    };

    Ok(salary_config.calculate_current_status())
}

#[tauri::command]
pub fn get_work_schedule(db: State<'_, Mutex<Database>>) -> Result<WorkSchedule, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    let config = db.get_salary_config().map_err(|e| e.to_string())?;

    Ok(WorkSchedule {
        work_start: config.work_start_time,
        work_end: config.work_end_time,
    })
}

#[derive(Debug, serde::Serialize)]
pub struct WorkSchedule {
    pub work_start: String,
    pub work_end: String,
}
