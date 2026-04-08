import { useEffect, useState } from 'react';
import { invokeTauri, type AppErrorPayload } from '../../lib/tauri';
import styles from './styles.module.css';

interface PrivacySettingsState {
  pause_during_sensitive: boolean;
  exclude_apps: string[];
  sensitive_window_keywords: string[];
}

export function PrivacySettings() {
  const [settings, setSettings] = useState<PrivacySettingsState>({
    pause_during_sensitive: true,
    exclude_apps: [],
    sensitive_window_keywords: [],
  });
  const [newApp, setNewApp] = useState('');
  const [loadError, setLoadError] = useState<AppErrorPayload | null>(null);
  const [saveError, setSaveError] = useState<AppErrorPayload | null>(null);
  const [saveSuccess, setSaveSuccess] = useState('');

  useEffect(() => {
    void loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const saved = await invokeTauri<PrivacySettingsState>('get_privacy_settings');
      setSettings(saved);
      setLoadError(null);
    } catch (error) {
      setLoadError(error as AppErrorPayload);
    }
  }

  async function handleSave() {
    try {
      await invokeTauri('save_privacy_settings', { settings });
      setSaveError(null);
      setSaveSuccess('隐私设置已保存');
    } catch (error) {
      setSaveSuccess('');
      setSaveError(error as AppErrorPayload);
    }
  }

  function addApp() {
    if (!newApp || settings.exclude_apps.includes(newApp)) {
      return;
    }

    setSettings((prev) => ({
      ...prev,
      exclude_apps: [...prev.exclude_apps, newApp],
    }));
    setNewApp('');
  }

  function removeApp(app: string) {
    setSettings((prev) => ({
      ...prev,
      exclude_apps: prev.exclude_apps.filter((item) => item !== app),
    }));
  }

  return (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHeader}>
        <h4>隐私设置</h4>
        <p>明确哪些场景应该暂停记录，避免敏感应用和窗口标题被纳入统计。</p>
      </div>

      <div className={styles.toggleRow}>
        <div className={styles.toggleMeta}>
          <span className={styles.fieldTitle}>敏感应用时暂停记录</span>
          <span className={styles.mutedText}>当窗口标题命中敏感关键词时，立即停止记录输入。</span>
        </div>
        <div
          className={`${styles.toggleSwitch} ${settings.pause_during_sensitive ? styles.active : ''}`}
          onClick={() =>
            setSettings((prev) => ({
              ...prev,
              pause_during_sensitive: !prev.pause_during_sensitive,
            }))
          }
        />
      </div>

      <div className={`${styles.field} ${styles.fieldWide}`} style={{ marginTop: 16 }}>
        <label htmlFor="exclude-app">排除的应用</label>
        <div className={styles.inlineInputRow}>
          <input
            id="exclude-app"
            className={styles.input}
            type="text"
            value={newApp}
            onChange={(e) => setNewApp(e.target.value)}
            placeholder="例如 WeChat、Slack、1Password"
          />
          <button className={styles.smallButton} onClick={addApp}>
            添加
          </button>
        </div>
      </div>

      <div className={styles.list}>
        {settings.exclude_apps.length === 0 && (
          <div className={styles.pathBox}>
            <span>当前没有排除应用，默认会记录所有应用中的输入。</span>
          </div>
        )}

        {settings.exclude_apps.map((app) => (
          <div key={app} className={styles.listItem}>
            <span>{app}</span>
            <button className={styles.removeButton} onClick={() => removeApp(app)}>
              移除
            </button>
          </div>
        ))}
      </div>

      <div className={`${styles.buttonRow} ${styles.fullWidth}`} style={{ marginTop: 16 }}>
        <button className={styles.primaryButton} onClick={handleSave}>
          保存隐私设置
        </button>
      </div>

      {loadError && (
        <div className={styles.errorBox}>
          <strong>{loadError.code}</strong>
          <p>{loadError.message}</p>
        </div>
      )}

      {saveError && (
        <div className={styles.errorBox}>
          <strong>{saveError.code}</strong>
          <p>{saveError.message}</p>
        </div>
      )}

      {saveSuccess && <div className={styles.successBox}>{saveSuccess}</div>}
    </section>
  );
}
