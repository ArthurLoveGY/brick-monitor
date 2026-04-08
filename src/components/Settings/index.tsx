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
  return (
    <div className={styles.settings}>
      <div className={styles.titleBlock}>
        <h3 className={styles.title}>系统面板</h3>
        <p className={styles.subtitle}>
          把每日薪资、权限和隐私偏好整理成一个固定侧边设置面板，避免关键配置被埋到页面下面。
        </p>
      </div>
      <div className={styles.sections}>
        <SalaryForm />
        <MacosAccessPanel monitoringStatus={monitoringStatus} onStatusChange={onMonitoringStatusChange} />
        <PrivacySettings />
      </div>
    </div>
  );
}
