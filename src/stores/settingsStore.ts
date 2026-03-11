import { create } from 'zustand';
import { PrivacySettings } from '../types/settings';

interface SettingsState {
  privacySettings: PrivacySettings;
  setPrivacySettings: (settings: PrivacySettings) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  privacySettings: {
    pause_during_sensitive: true,
    exclude_apps: [],
  },
  setPrivacySettings: (settings) => set({ privacySettings: settings }),
}));
