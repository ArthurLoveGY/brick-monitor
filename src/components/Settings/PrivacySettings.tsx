import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface PrivacySettings {
  pause_during_sensitive: boolean;
  exclude_apps: string[];
}

export function PrivacySettings() {
  const [settings, setSettings] = useState<PrivacySettings>({
    pause_during_sensitive: true,
    exclude_apps: [],
  });

  const [newApp, setNewApp] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const saved = await invoke<PrivacySettings>('get_privacy_settings');
      setSettings(saved);
    } catch (e) {
      console.log('Using default privacy settings');
    }
  }

  async function handleSave() {
    try {
      await invoke('save_privacy_settings', { settings });
    } catch (e) {
      console.error('Failed to save privacy settings:', e);
    }
  }

  function addApp() {
    if (newApp && !settings.exclude_apps.includes(newApp)) {
      setSettings({
        ...settings,
        exclude_apps: [...settings.exclude_apps, newApp],
      });
      setNewApp('');
    }
  }

  function removeApp(app: string) {
    setSettings({
      ...settings,
      exclude_apps: settings.exclude_apps.filter(a => a !== app),
    });
  }

  return (
    <div className="section">
      <h4>隐私设置</h4>

      <div className="toggle">
        <span className="toggleLabel">敏感应用时暂停记录</span>
        <div
          className={`toggleSwitch ${settings.pause_during_sensitive ? 'active' : ''}`}
          onClick={() => setSettings({ ...settings, pause_during_sensitive: !settings.pause_during_sensitive })}
        />
      </div>

      <div className="field">
        <label>排除的应用</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={newApp}
            onChange={e => setNewApp(e.target.value)}
            placeholder="输入应用名称"
            style={{ flex: 1 }}
          />
          <button
            className="saveBtn"
            style={{ width: 'auto', padding: '8px 16px' }}
            onClick={addApp}
          >
            添加
          </button>
        </div>
      </div>

      <div style={{ marginTop: '8px' }}>
        {settings.exclude_apps.map(app => (
          <div
            key={app}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '6px',
              marginBottom: '4px',
            }}
          >
            <span style={{ fontSize: '13px' }}>{app}</span>
            <button
              onClick={() => removeApp(app)}
              style={{
                background: 'none',
                border: 'none',
                color: '#f87171',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              移除
            </button>
          </div>
        ))}
      </div>

      <button className="saveBtn" onClick={handleSave}>
        保存设置
      </button>
    </div>
  );
}
