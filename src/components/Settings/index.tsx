import type { MonitoringStatus } from '../../types/system';
import { MacosAccessPanel } from './MacosAccessPanel';
import { SalaryForm } from './SalaryForm';
import { PrivacySettings } from './PrivacySettings';
import styles from './styles.module.css';

interface SettingsProps {
  monitoringStatus: MonitoringStatus;
  onMonitoringStatusChange: (status: MonitoringStatus) => void;
}

export function Settings({ monitoringStatus, onMonitoringStatusChange }: SettingsProps) {
  const statusItems = [
    {
      label: '平台',
      value: monitoringStatus.platform ?? 'macOS',
      ok: true,
    },
    {
      label: '辅助功能',
      value: monitoringStatus.accessibilityGranted ? '已授权' : '待授权',
      ok: monitoringStatus.accessibilityGranted,
    },
    {
      label: '输入监控',
      value: monitoringStatus.inputMonitoringGranted ? '已授权' : '待授权',
      ok: monitoringStatus.inputMonitoringGranted,
    },
    {
      label: '监听器',
      value: monitoringStatus.listenerStarted ? '已启动' : '未启动',
      ok: monitoringStatus.listenerStarted,
    },
  ];

  const allReady = statusItems.every((item) => item.ok);

  return (
    <div className={styles.settings}>
      {/* System status grid */}
      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitleRow}>
            <h4>系统状态</h4>
            <span className={`${styles.readyBadge} ${allReady ? styles.readyBadgeOk : styles.readyBadgeWarn}`}>
              {allReady ? '全部就绪' : '部分未授权'}
            </span>
          </div>
          <p>监控系统各组件运行状态，有异常时请点击下方按钮授权。</p>
        </div>

        <div className={styles.statusGrid}>
          {statusItems.map((item) => (
            <div key={item.label} className={styles.statusCard}>
              <span className={styles.statusLabel}>{item.label}</span>
              <strong className={item.ok ? styles.statusOk : styles.statusBlocked}>{item.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <div className={styles.sections}>
        <SalaryForm />
        <MacosAccessPanel monitoringStatus={monitoringStatus} onStatusChange={onMonitoringStatusChange} />
        <PrivacySettings />
      </div>
    </div>
  );
}
