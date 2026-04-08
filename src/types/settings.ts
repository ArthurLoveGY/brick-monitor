export interface PrivacySettings {
  pause_during_sensitive: boolean;
  exclude_apps: string[];
  sensitive_window_keywords: string[];
}

export interface WorkSchedule {
  workStart: string;
  workEnd: string;
}
