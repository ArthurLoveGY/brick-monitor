import { create } from 'zustand';
import { TodayStats, HourlyStats, DailyStats } from '../types/keystroke';

interface KeystrokeState {
  todayStats: TodayStats;
  hourlyStats: HourlyStats[];
  historyStats: DailyStats[];
  setTodayStats: (stats: TodayStats) => void;
  setHourlyStats: (stats: HourlyStats[]) => void;
  setHistoryStats: (stats: DailyStats[]) => void;
}

export const useKeystrokeStore = create<KeystrokeState>((set) => ({
  todayStats: { total: 0, char_count: 0, code_count: 0, browser_count: 0 },
  hourlyStats: [],
  historyStats: [],
  setTodayStats: (stats) => set({ todayStats: stats }),
  setHourlyStats: (stats) => set({ hourlyStats: stats }),
  setHistoryStats: (stats) => set({ historyStats: stats }),
}));
