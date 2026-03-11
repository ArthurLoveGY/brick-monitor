export interface KeyEvent {
  key_code: number;
  key_name: string;
  key_type: KeyType;
  timestamp: number;
  is_key_down: boolean;
}

export type KeyType = 'Char' | 'Function' | 'Modifier' | 'Navigation' | 'Editing' | 'System';

export interface TodayStats {
  total: number;
  char_count: number;
  code_count: number;
  browser_count: number;
}

export interface HourlyStats {
  hour: string;
  count: number;
}

export interface DailyStats {
  date: string;
  total: number;
}
