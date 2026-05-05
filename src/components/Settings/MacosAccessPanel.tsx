import { useEffect, useState } from 'react';
import styles from './styles.module.css';
import { invokeTauri, type AppErrorPayload } from '../../lib/tauri';
import type { AutostartStatus, MonitoringStatus } from '../../types/system';

interface MacosAccessPanelProps {
  monitoringStatus: MonitoringStatus;
  onStatusChange: (status: MonitoringStatus) => void;
}

export function MacosAccessPanel({ monitoringStatus, onStatusChange }: MacosAccessPanelProps) {
  const [autostartStatus, setAutostartStatus] = useState<AutostartStatus | null>(null);
  const [loadError, setLoadError] = useState<AppErrorPayload | null>(null);
  const [actionError, setActionError] = useState<AppErrorPayload | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    void loadAutostartStatus().catch((error: AppErrorPayload) => {
      setLoadError(error);
    });
  }, []);

  async function loadAutostartStatus() {
    const status = await invokeTauri<AutostartStatus>('get_autostart_status');
    setAutostartStatus(status);
    setLoadError(null);
  }

  async function refreshMonitoringStatus() {
    setBusyAction('refresh');
    setActionError(null);
    try {
      const status = await invokeTauri<MonitoringStatus>('refresh_monitoring_status');
      onStatusChange(status);
    } catch (error) {
      setActionError(error as AppErrorPayload);
    } finally {
      setBusyAction(null);
    }
  }

  async function requestPermissions() {
    setBusyAction('request');
    setActionError(null);
    try {
      const status = await invokeTauri<MonitoringStatus>('request_monitoring_permissions');
      onStatusChange(status);
    } catch (error) {
      setActionError(error as AppErrorPayload);
    } finally {
      setBusyAction(null);
    }
  }

  async function openPrivacySettings() {
    setBusyAction('settings');
    setActionError(null);
    try {
      await invokeTauri('open_macos_privacy_settings');
    } catch (error) {
      setActionError(error as AppErrorPayload);
    } finally {
      setBusyAction(null);
    }
  }

  async function toggleAutostart(enabled: boolean) {
    setBusyAction('autostart');
    setActionError(null);
    try {
      const status = await invokeTauri<AutostartStatus>('set_autostart_enabled', { enabled });
      setAutostartStatus(status);
    } catch (error) {
      setActionError(error as AppErrorPayload);
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHeader}>
        <h4>macOS 权限与启动</h4>
        <p>监控键盘活动需要"辅助功能"和"输入监控"两项权限，点击下方按钮授权后即可开始使用。</p>
      </div>

      <div className={styles.statusGrid}>
        <div className={styles.statusCard}>
          <span className={styles.statusLabel}>辅助功能</span>
          <strong className={monitoringStatus.accessibilityGranted ? styles.statusOk : styles.statusBlocked}>
            {monitoringStatus.accessibilityGranted ? '已授权' : '未授权'}
          </strong>
        </div>
        <div className={styles.statusCard}>
          <span className={styles.statusLabel}>输入监控</span>
          <strong className={monitoringStatus.inputMonitoringGranted ? styles.statusOk : styles.statusBlocked}>
            {monitoringStatus.inputMonitoringGranted ? '已授权' : '未授权'}
          </strong>
        </div>
        <div className={styles.statusCard}>
          <span className={styles.statusLabel}>监听器</span>
          <strong className={monitoringStatus.listenerStarted ? styles.statusOk : styles.statusBlocked}>
            {monitoringStatus.listenerStarted ? '已启动' : '未启动'}
          </strong>
        </div>
      </div>

      {(!monitoringStatus.accessibilityGranted || !monitoringStatus.inputMonitoringGranted) && (
        <div className={styles.helpBox}>
          <strong>如何授权？</strong>
          <ol>
            <li>点击下方"请求权限"，在弹出的系统对话框中确认授权。</li>
            <li>如果权限弹窗没有出现，点击"打开系统设置"进入隐私页面。</li>
            <li>在左侧列表中找到"辅助功能"和"输入监控"，在右侧勾选 <strong>"搬砖实时监控"</strong>。</li>
            <li>授权后可能需要重启本应用使其生效。</li>
          </ol>
        </div>
      )}

      <div className={styles.keyboardNote}>
        <span>当前版本仅适配 <strong>美式英文 (US QWERTY)</strong> 键盘布局，其他布局下按键名称可能显示不正确。</span>
      </div>

      {monitoringStatus.lastError && (
        <div className={styles.errorBox}>
          <strong>{monitoringStatus.lastError.code}</strong>
          <p>{monitoringStatus.lastError.message}</p>
        </div>
      )}

      <div className={styles.buttonRow}>
        <button className={styles.primaryButton} disabled={busyAction !== null} onClick={requestPermissions}>
          {busyAction === 'request' ? '请求中...' : '请求权限'}
        </button>
        <button className={styles.secondaryButton} disabled={busyAction !== null} onClick={openPrivacySettings}>
          打开系统设置
        </button>
        <button className={styles.secondaryButton} disabled={busyAction !== null} onClick={refreshMonitoringStatus}>
          重新检测
        </button>
      </div>

      <div className={styles.autostartRow}>
        <div className={styles.toggleMeta}>
          <span className={styles.fieldTitle}>登录时启动</span>
          <p className={styles.mutedText}>
            {autostartStatus
              ? autostartStatus.enabled
                ? '当前已写入 LaunchAgent。'
                : '当前未配置 LaunchAgent。'
              : '正在读取登录项状态。'}
          </p>
        </div>
        <div
          className={`${styles.toggleSwitch} ${autostartStatus?.enabled ? styles.active : ''}`}
          onClick={() => {
            if (autostartStatus) {
              void toggleAutostart(!autostartStatus.enabled);
            }
          }}
        />
      </div>

      {autostartStatus && (
        <div className={styles.pathBox}>
          <span>LaunchAgent: {autostartStatus.plistPath}</span>
          <span>Executable: {autostartStatus.executablePath}</span>
        </div>
      )}

      {loadError && (
        <div className={styles.errorBox}>
          <strong>{loadError.code}</strong>
          <p>{loadError.message}</p>
        </div>
      )}

      {actionError && (
        <div className={styles.errorBox}>
          <strong>{actionError.code}</strong>
          <p>{actionError.message}</p>
        </div>
      )}
    </section>
  );
}
