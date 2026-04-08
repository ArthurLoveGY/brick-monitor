use rusqlite::{Connection, params};
use crate::keyboard::KeyEvent;
use crate::window::AppCategory;
use chrono::Local;
use serde::{Serialize, Deserialize};
use rusqlite::types::Type;

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new() -> Result<Self, rusqlite::Error> {
        let db_path = dirs::data_dir()
            .ok_or_else(|| {
                rusqlite::Error::InvalidPath("无法解析系统数据目录".into())
            })?
            .join("keyboard-tracker")
            .join("data.db");

        let parent_dir = db_path.parent().ok_or_else(|| {
            rusqlite::Error::InvalidPath("无法解析数据库父目录".into())
        })?;
        std::fs::create_dir_all(parent_dir)
            .map_err(|_| rusqlite::Error::InvalidPath(parent_dir.to_path_buf()))?;
        let conn = Connection::open(db_path)?;
        conn.execute_batch(crate::database::schema::SCHEMA)?;

        // 迁移: 为现有数据库添加 lunch_break_minutes 列
        let has_lunch_break: bool = conn.query_row(
            "SELECT COUNT(*) FROM pragma_table_info('salary_config') WHERE name='lunch_break_minutes'",
            [],
            |row| row.get::<_, i32>(0),
        ).unwrap_or(0) > 0;

        if !has_lunch_break {
            conn.execute(
                "ALTER TABLE salary_config ADD COLUMN lunch_break_minutes INTEGER DEFAULT 60",
                [],
            )?;
        }

        Ok(Self { conn })
    }

    /// 批量插入按键记录
    pub fn insert_keystrokes(
        &mut self,
        events: &[KeyEvent],
        app_name: &str,
        app_category: &AppCategory
    ) -> Result<(), rusqlite::Error> {
        let tx = self.conn.transaction()?;

        for event in events {
            tx.execute(
                "INSERT INTO keystrokes (timestamp, key_code, key_name, key_type, app_name, app_category)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    event.timestamp,
                    event.key_code,
                    event.key_name,
                    format!("{:?}", event.key_type),
                    app_name,
                    format!("{:?}", app_category),
                ],
            )?;
        }

        tx.commit()
    }

    /// 插入单个按键记录
    pub fn insert_single_keystroke(
        &mut self,
        event: &KeyEvent,
        app_name: &str,
        app_category: &AppCategory
    ) -> Result<(), rusqlite::Error> {
        self.conn.execute(
            "INSERT INTO keystrokes (timestamp, key_code, key_name, key_type, app_name, app_category)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                event.timestamp,
                event.key_code,
                event.key_name,
                format!("{:?}", event.key_type),
                app_name,
                format!("{:?}", app_category),
            ],
        )?;
        Ok(())
    }

    /// 获取今日统计
    pub fn get_today_stats(&self) -> Result<TodayStats, rusqlite::Error> {
        // 使用本地时间获取今日日期
        let today = Local::now().format("%Y-%m-%d").to_string();

        // 使用 'unixepoch', 'localtime' 将 UTC 时间戳转换为本地时间
        self.conn.query_row(
            "SELECT COUNT(*),
                    COALESCE(SUM(CASE WHEN key_type = 'Char' THEN 1 ELSE 0 END), 0),
                    COALESCE(SUM(CASE WHEN app_category IN ('IDE', 'Terminal') THEN 1 ELSE 0 END), 0),
                    COALESCE(SUM(CASE WHEN app_category = 'Browser' THEN 1 ELSE 0 END), 0)
             FROM keystrokes
             WHERE date(timestamp/1000, 'unixepoch', 'localtime') = ?1",
            params![today],
            |row| Ok(TodayStats {
                total: row.get(0)?,
                char_count: row.get(1)?,
                code_count: row.get(2)?,
                browser_count: row.get(3)?,
            }),
        )
    }

    /// 获取今日分时统计
    pub fn get_today_hourly(&self) -> Result<Vec<HourlyStats>, rusqlite::Error> {
        let today = Local::now().format("%Y-%m-%d").to_string();

        let mut stmt = self.conn.prepare(
            "SELECT strftime('%H', datetime(timestamp/1000, 'unixepoch', 'localtime')) as hour, COUNT(*)
             FROM keystrokes
             WHERE date(timestamp/1000, 'unixepoch', 'localtime') = ?1
             GROUP BY hour
             ORDER BY hour"
        )?;

        let stats = stmt.query_map(params![today], |row| {
            Ok(HourlyStats {
                hour: row.get(0)?,
                count: row.get(1)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(stats)
    }

    /// 获取历史统计 (最近N天)
    pub fn get_history_stats(&self, days: i32) -> Result<Vec<DailyStats>, rusqlite::Error> {
        let mut stmt = self.conn.prepare(
            "SELECT date(timestamp/1000, 'unixepoch', 'localtime') as date, COUNT(*)
             FROM keystrokes
             WHERE date(timestamp/1000, 'unixepoch', 'localtime') >= date('now', 'localtime', ?1)
             GROUP BY date
             ORDER BY date"
        )?;

        let stats = stmt.query_map(
            params![format!("-{} days", days)],
            |row| Ok(DailyStats {
                date: row.get(0)?,
                total: row.get(1)?,
            })
        )?.collect::<Result<Vec<_>, _>>()?;

        Ok(stats)
    }

    /// 获取应用分类统计
    pub fn get_app_breakdown(&self) -> Result<Vec<AppBreakdown>, rusqlite::Error> {
        let today = Local::now().format("%Y-%m-%d").to_string();

        let mut stmt = self.conn.prepare(
            "SELECT app_name, COUNT(*) as count
             FROM keystrokes
             WHERE date(timestamp/1000, 'unixepoch', 'localtime') = ?1 AND app_name IS NOT NULL
             GROUP BY app_name
             ORDER BY count DESC
             LIMIT 10"
        )?;

        let stats = stmt.query_map(params![today], |row| {
            Ok(AppBreakdown {
                name: row.get(0)?,
                value: row.get(1)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;

        Ok(stats)
    }

    /// 获取今日分类统计
    pub fn get_category_stats_today(&self) -> Result<CategoryStats, rusqlite::Error> {
        let today = Local::now().format("%Y-%m-%d").to_string();

        self.conn.query_row(
            "SELECT
                COALESCE(SUM(CASE WHEN app_category = 'IDE' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN app_category = 'Terminal' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN app_category = 'Chat' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN app_category NOT IN ('IDE', 'Terminal', 'Chat') THEN 1 ELSE 0 END), 0)
             FROM keystrokes
             WHERE date(timestamp/1000, 'unixepoch', 'localtime') = ?1",
            params![today],
            |row| Ok(CategoryStats {
                ide_count: row.get(0)?,
                terminal_count: row.get(1)?,
                chat_count: row.get(2)?,
                other_count: row.get(3)?,
            }),
        )
    }

    /// 获取工资配置
    pub fn get_salary_config(&self) -> Result<SalaryConfig, rusqlite::Error> {
        self.conn.query_row(
            "SELECT monthly_salary, work_days_per_month, work_hours_per_day, work_start_time, work_end_time, lunch_break_minutes, currency
             FROM salary_config WHERE id = 1",
            [],
            |row| Ok(SalaryConfig {
                monthly_salary: row.get(0)?,
                work_days_per_month: row.get(1)?,
                work_hours_per_day: row.get(2)?,
                work_start_time: row.get(3)?,
                work_end_time: row.get(4)?,
                lunch_break_minutes: row.get(5)?,
                currency: row.get(6)?,
            }),
        )
    }

    /// 保存工资配置
    pub fn save_salary_config(&mut self, config: &SalaryConfig) -> Result<(), rusqlite::Error> {
        self.conn.execute(
            "UPDATE salary_config SET
                monthly_salary = ?1,
                work_days_per_month = ?2,
                work_hours_per_day = ?3,
                work_start_time = ?4,
                work_end_time = ?5,
                lunch_break_minutes = ?6,
                currency = ?7
             WHERE id = 1",
            params![
                config.monthly_salary,
                config.work_days_per_month,
                config.work_hours_per_day,
                config.work_start_time,
                config.work_end_time,
                config.lunch_break_minutes,
                config.currency,
            ],
        )?;
        Ok(())
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TodayStats {
    pub total: i64,
    pub char_count: i64,
    pub code_count: i64,
    pub browser_count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HourlyStats {
    pub hour: String,
    pub count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyStats {
    pub date: String,
    pub total: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppBreakdown {
    pub name: String,
    pub value: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryStats {
    pub ide_count: i64,
    pub terminal_count: i64,
    pub chat_count: i64,
    pub other_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SalaryConfig {
    pub monthly_salary: f64,
    pub work_days_per_month: i32,
    pub work_hours_per_day: f64,
    pub work_start_time: String,
    pub work_end_time: String,
    pub lunch_break_minutes: i32,
    pub currency: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivacySettings {
    pub pause_during_sensitive: bool,
    pub exclude_apps: Vec<String>,
    pub sensitive_window_keywords: Vec<String>,
}

impl Database {
    /// 获取隐私设置
    pub fn get_privacy_settings(&self) -> Result<PrivacySettings, rusqlite::Error> {
        self.conn.query_row(
            "SELECT pause_during_sensitive, exclude_apps, sensitive_window_keywords
             FROM privacy_settings WHERE id = 1",
            [],
            |row| {
                let exclude_apps_json: String = row.get(1)?;
                let keywords_json: String = row.get(2)?;
                Ok(PrivacySettings {
                    pause_during_sensitive: row.get(0)?,
                    exclude_apps: parse_string_array(&exclude_apps_json, 1)?,
                    sensitive_window_keywords: parse_string_array(&keywords_json, 2)?,
                })
            },
        )
    }

    /// 保存隐私设置
    pub fn save_privacy_settings(&mut self, settings: &PrivacySettings) -> Result<(), rusqlite::Error> {
        self.conn.execute(
            "UPDATE privacy_settings SET
                pause_during_sensitive = ?1,
                exclude_apps = ?2,
                sensitive_window_keywords = ?3,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = 1",
            params![
                settings.pause_during_sensitive,
                serde_json::to_string(&settings.exclude_apps).unwrap_or_else(|_| "[]".to_string()),
                serde_json::to_string(&settings.sensitive_window_keywords).unwrap_or_else(|_| "[]".to_string()),
            ],
        )?;
        Ok(())
    }
}

fn parse_string_array(value: &str, column_index: usize) -> Result<Vec<String>, rusqlite::Error> {
    serde_json::from_str(value).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(column_index, Type::Text, Box::new(error))
    })
}
