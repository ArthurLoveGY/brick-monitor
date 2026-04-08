import { useEffect, useMemo, useState } from 'react';
import { invokeTauri, type AppErrorPayload } from '../../lib/tauri';
import styles from './styles.module.css';

interface SalaryConfig {
  monthly_salary: number;
  work_days_per_month: number;
  work_hours_per_day: number;
  work_start_time: string;
  work_end_time: string;
  lunch_break_minutes: number;
}

export function SalaryForm() {
  const [config, setConfig] = useState<SalaryConfig>({
    monthly_salary: 15000,
    work_days_per_month: 22,
    work_hours_per_day: 8,
    work_start_time: '09:00',
    work_end_time: '18:00',
    lunch_break_minutes: 60,
  });
  const [loadError, setLoadError] = useState<AppErrorPayload | null>(null);
  const [saveError, setSaveError] = useState<AppErrorPayload | null>(null);
  const [saveSuccess, setSaveSuccess] = useState('');

  useEffect(() => {
    void loadConfig();
  }, []);

  const workHours = useMemo(() => {
    const [startHour, startMin] = config.work_start_time.split(':').map(Number);
    const [endHour, endMin] = config.work_end_time.split(':').map(Number);
    const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    return totalMinutes / 60;
  }, [config.work_start_time, config.work_end_time]);

  const effectiveHours = useMemo(() => {
    return workHours - config.lunch_break_minutes / 60;
  }, [workHours, config.lunch_break_minutes]);

  const info = useMemo(() => {
    const dailySalary = config.monthly_salary / config.work_days_per_month;
    const hourlySalary = dailySalary / effectiveHours;
    return { dailySalary, hourlySalary };
  }, [config.monthly_salary, config.work_days_per_month, effectiveHours]);

  async function loadConfig() {
    try {
      const saved = await invokeTauri<SalaryConfig>('get_salary_config');
      setConfig(saved);
      setLoadError(null);
    } catch (error) {
      setLoadError(error as AppErrorPayload);
    }
  }

  async function handleSave() {
    try {
      await invokeTauri('save_salary_config', {
        config: {
          ...config,
          work_hours_per_day: workHours,
        },
      });
      setSaveError(null);
      setSaveSuccess('工资配置已保存');
    } catch (error) {
      setSaveSuccess('');
      setSaveError(error as AppErrorPayload);
    }
  }

  function handleChange(field: keyof SalaryConfig, value: string | number) {
    setConfig((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHeader}>
        <h4>工资配置</h4>
        <p>用更直观的方式查看工时、日薪和时薪，保证浮窗与主界面的收益统计有明确来源。</p>
      </div>

      <div className={styles.fieldGrid}>
        <div className={styles.field}>
          <label htmlFor="salary-monthly">月薪（元）</label>
          <input
            id="salary-monthly"
            className={styles.input}
            type="number"
            value={config.monthly_salary}
            onChange={(e) => handleChange('monthly_salary', Number(e.target.value))}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="salary-days">月工作日</label>
          <input
            id="salary-days"
            className={styles.input}
            type="number"
            value={config.work_days_per_month}
            onChange={(e) => handleChange('work_days_per_month', Number(e.target.value))}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="salary-start">上班时间</label>
          <input
            id="salary-start"
            className={styles.timeInput}
            type="time"
            value={config.work_start_time}
            onChange={(e) => handleChange('work_start_time', e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="salary-end">下班时间</label>
          <input
            id="salary-end"
            className={styles.timeInput}
            type="time"
            value={config.work_end_time}
            onChange={(e) => handleChange('work_end_time', e.target.value)}
          />
        </div>

        <div className={`${styles.field} ${styles.fieldWide}`}>
          <label htmlFor="salary-lunch">午休时间（分钟）</label>
          <input
            id="salary-lunch"
            className={styles.input}
            type="number"
            step="15"
            value={config.lunch_break_minutes}
            onChange={(e) => handleChange('lunch_break_minutes', Number(e.target.value))}
          />
        </div>
      </div>

      <div className={styles.resultGrid} style={{ marginTop: 14 }}>
        <div className={styles.statCard}>
          <span className={styles.fieldTitle}>工作时长</span>
          <strong>{workHours.toFixed(1)} 小时</strong>
          <small className={styles.mutedText}>从上下班时间自动计算</small>
        </div>
        <div className={styles.statCard}>
          <span className={styles.fieldTitle}>有效工作</span>
          <strong>{effectiveHours.toFixed(1)} 小时</strong>
          <small className={styles.mutedText}>已扣除午休</small>
        </div>
        <div className={styles.statCard}>
          <span className={styles.fieldTitle}>日薪</span>
          <strong>¥{info.dailySalary.toFixed(2)}</strong>
          <small className={styles.mutedText}>按月薪和工作日推算</small>
        </div>
        <div className={styles.statCard}>
          <span className={styles.fieldTitle}>时薪</span>
          <strong>¥{info.hourlySalary.toFixed(2)}</strong>
          <small className={styles.mutedText}>按有效工作时长推算</small>
        </div>
      </div>

      <div className={`${styles.buttonRow} ${styles.fullWidth}`} style={{ marginTop: 16 }}>
        <button className={styles.primaryButton} onClick={handleSave}>
          保存工资配置
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
