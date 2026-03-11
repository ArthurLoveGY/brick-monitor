export interface PrivacySettings {
  pause_during_sensitive: boolean;
  exclude_apps: string[];
}

export interface WorkSchedule {
  workStart: string;
  workEnd: string;
}
