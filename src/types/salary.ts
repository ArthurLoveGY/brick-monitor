export interface SalaryConfig {
  monthly_salary: number;
  work_days_per_month: number;
  work_hours_per_day: number;
  work_start_time: string;
  work_end_time: string;
  lunch_break_minutes: number;
  currency: string;
}

export interface SalaryInfo {
  daily_salary: number;
  hourly_salary: number;
  today_earnings: number;
  month_earnings: number;
  countdown_seconds: number;
  work_progress: number;
}
