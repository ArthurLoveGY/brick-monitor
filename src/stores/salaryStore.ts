import { create } from 'zustand';
import { SalaryConfig, SalaryInfo } from '../types/salary';

interface SalaryState {
  config: SalaryConfig;
  info: SalaryInfo;
  setConfig: (config: SalaryConfig) => void;
  setInfo: (info: SalaryInfo) => void;
}

export const useSalaryStore = create<SalaryState>((set) => ({
  config: {
    monthly_salary: 15000,
    work_days_per_month: 22,
    work_hours_per_day: 8,
    work_start_time: '09:00',
    work_end_time: '18:00',
    lunch_break_minutes: 60,
    currency: 'CNY',
  },
  info: {
    daily_salary: 0,
    hourly_salary: 0,
    today_earnings: 0,
    month_earnings: 0,
    countdown_seconds: 0,
    work_progress: 0,
  },
  setConfig: (config) => set({ config }),
  setInfo: (info) => set({ info }),
}));
