import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../stores/settingsStore';

export function useSettings() {
  const { setPrivacySettings } = useSettingsStore();

  useEffect(() => {
    async function loadSettings() {
      try {
        const privacy = await invoke('get_privacy_settings');
        setPrivacySettings(privacy as any);
      } catch (e) {
        console.log('Settings not available yet');
      }
    }

    loadSettings();
  }, [setPrivacySettings]);

  const savePrivacySettings = async (settings: any) => {
    await invoke('save_privacy_settings', { settings });
  };

  return { savePrivacySettings };
}
