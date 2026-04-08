import type { AppErrorPayload } from '../lib/tauri';

export interface MonitoringStatus {
  platform: string;
  accessibilityGranted: boolean;
  inputMonitoringGranted: boolean;
  ready: boolean;
  listenerStarted: boolean;
  lastError: AppErrorPayload | null;
}

export interface AutostartStatus {
  enabled: boolean;
  plistPath: string;
  executablePath: string;
}
