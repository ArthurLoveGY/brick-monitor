use chrono::{DateTime, Local, Datelike, Timelike};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SalaryConfig {
    pub monthly_salary: f64,
    pub work_days_per_month: u32,
    pub work_hours_per_day: f64,
    pub work_start_time: String,  // "HH:MM"
    pub work_end_time: String,    // "HH:MM"
    pub lunch_break_minutes: u32, // 午休时间(分钟)
    pub currency: String,
}

#[derive(Debug, Serialize)]
pub struct SalaryInfo {
    pub daily_salary: f64,        // 日薪
    pub hourly_salary: f64,       // 时薪
    pub today_earnings: f64,      // 今日已赚
    pub month_earnings: f64,      // 本月已赚
    pub countdown_seconds: i64,   // 距下班秒数
    pub work_progress: f64,       // 今日工作进度百分比
}

impl SalaryConfig {
    // 根据上下班时间自动计算工作时长
    fn calculate_work_hours(&self) -> f64 {
        let start = parse_time(&self.work_start_time);
        let end = parse_time(&self.work_end_time);
        let total_minutes = (end.0 * 60 + end.1) as i32 - (start.0 * 60 + start.1) as i32;
        total_minutes as f64 / 60.0
    }

    pub fn calculate_daily_salary(&self) -> f64 {
        self.monthly_salary / self.work_days_per_month as f64
    }

    pub fn calculate_hourly_salary(&self) -> f64 {
        // 时薪 = 日薪 / (工作时长 - 午休时间)
        let work_hours = self.calculate_work_hours();
        let effective_hours = work_hours - (self.lunch_break_minutes as f64 / 60.0);
        self.calculate_daily_salary() / effective_hours
    }

    pub fn calculate_current_status(&self) -> SalaryInfo {
        let daily = self.calculate_daily_salary();
        let hourly = self.calculate_hourly_salary();

        // 使用本地时间
        let now = Local::now();
        let start = parse_time(&self.work_start_time);
        let end = parse_time(&self.work_end_time);

        // 自动计算工作时长
        let work_hours = self.calculate_work_hours();

        // 计算今日工作时间
        let work_start = now.with_hour(start.0).unwrap()
                           .with_minute(start.1).unwrap()
                           .with_second(0).unwrap();
        let work_end = now.with_hour(end.0).unwrap()
                         .with_minute(end.1).unwrap()
                         .with_second(0).unwrap();

        // 午休时间(小时)
        let lunch_hours = self.lunch_break_minutes as f64 / 60.0;
        let effective_hours = work_hours - lunch_hours;

        // 计算已工作时间(小时)
        let hours_worked = if now < work_start {
            0.0
        } else if now >= work_end {
            // 已下班，计算全天有效工作时间
            effective_hours
        } else {
            // 工作中：从上班到现在的时间
            let total_hours = now.signed_duration_since(work_start).num_seconds() as f64 / 3600.0;

            // 午休时间段计算（假设午休在工作日中间）
            // 午休开始时间 = 上班时间 + (工作时间 - 午休时间) / 2
            let work_minutes = (work_hours * 60.0) as i32;
            let lunch_minutes = self.lunch_break_minutes as i32;
            let morning_work_minutes = (work_minutes - lunch_minutes) / 2;

            let lunch_start_hour = start.0 as i32 + morning_work_minutes / 60;
            let lunch_start_min = start.1 as i32 + morning_work_minutes % 60;
            let lunch_start_hour = if lunch_start_min >= 60 { lunch_start_hour + 1 } else { lunch_start_hour };
            let lunch_start_min = lunch_start_min % 60;

            let lunch_end_hour = lunch_start_hour + lunch_minutes / 60;
            let lunch_end_min = lunch_start_min + lunch_minutes % 60;
            let lunch_end_hour = if lunch_end_min >= 60 { lunch_end_hour + 1 } else { lunch_end_hour };
            let lunch_end_min = lunch_end_min % 60;

            let lunch_start = now.with_hour(lunch_start_hour as u32).unwrap()
                                 .with_minute(lunch_start_min as u32).unwrap()
                                 .with_second(0).unwrap();
            let lunch_end = now.with_hour(lunch_end_hour as u32).unwrap()
                               .with_minute(lunch_end_min as u32).unwrap()
                               .with_second(0).unwrap();

            // 根据当前时间计算有效工作时间
            if now < lunch_start {
                // 午休前：直接计算
                total_hours
            } else if now < lunch_end {
                // 午休中：只算到午休开始
                lunch_start.signed_duration_since(work_start).num_seconds() as f64 / 3600.0
            } else {
                // 午休后：总时间 - 午休时长
                (total_hours - lunch_hours).max(0.0)
            }
        };

        // 今日已赚 = 有效工作时间 × 时薪
        let today_earnings = hours_worked * hourly;

        // 本月已赚 (简化计算: 已过工作日 × 日薪)
        let days_passed = count_work_days_this_month(now, self.work_days_per_month);
        let month_earnings = days_passed as f64 * daily;

        // 下班倒计时
        let countdown = if now < work_end {
            work_end.signed_duration_since(now).num_seconds()
        } else {
            0
        };

        // 工作进度 (基于有效工作时间)
        let progress = (hours_worked / effective_hours * 100.0).min(100.0);

        SalaryInfo {
            daily_salary: daily,
            hourly_salary: hourly,
            today_earnings,
            month_earnings,
            countdown_seconds: countdown,
            work_progress: progress,
        }
    }
}

fn parse_time(time_str: &str) -> (u32, u32) {
    let parts: Vec<&str> = time_str.split(':').collect();
    (parts[0].parse().unwrap_or(9), parts[1].parse().unwrap_or(0))
}

fn count_work_days_this_month(now: DateTime<Local>, total_work_days: u32) -> u32 {
    let current_day = now.day();
    // 简化: 假设均匀分布
    ((current_day as f64 / 30.0) * total_work_days as f64).floor() as u32
}
