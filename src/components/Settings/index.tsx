import { SalaryForm } from './SalaryForm';
import { PrivacySettings } from './PrivacySettings';
import styles from './styles.module.css';

export function Settings() {
  return (
    <div className={styles.settings}>
      <h3 className={styles.title}>设置</h3>
      <div className={styles.sections}>
        <SalaryForm />
        <PrivacySettings />
      </div>
    </div>
  );
}
