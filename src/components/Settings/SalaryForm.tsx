import { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';

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

  useEffect(() => {
    loadConfig();
  }, []);

  // 自动计算工作时长
  const workHours = useMemo(() => {
    const [startHour, startMin] = config.work_start_time.split(':').map(Number);
    const [endHour, endMin] = config.work_end_time.split(':').map(Number);
    const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    return totalMinutes / 60;
  }, [config.work_start_time, config.work_end_time]);

  // 有效工作时间
  const effectiveHours = useMemo(() => {
    return workHours - (config.lunch_break_minutes / 60);
  }, [workHours, config.lunch_break_minutes]);

  // 计算日薪和时薪
  const info = useMemo(() => {
    const daily_salary = config.monthly_salary / config.work_days_per_month;
    const hourly_salary = daily_salary / effectiveHours;
    return { daily_salary, hourly_salary };
  }, [config.monthly_salary, config.work_days_per_month, effectiveHours]);

  async function loadConfig() {
    try {
      const saved = await invoke<SalaryConfig>('get_salary_config');
      setConfig(saved);
    } catch (e) {
      console.log('Using default salary config');
    }
  }

  async function handleSave() {
    try {
      // 自动计算并保存工作时长
      const configToSave = {
        ...config,
        work_hours_per_day: workHours,
      };
      await invoke('save_salary_config', { config: configToSave });
    } catch (e) {
      console.error('Failed to save salary config:', e);
    }
  }

  function handleChange(field: keyof SalaryConfig, value: string | number) {
    setConfig(prev => ({ ...prev, [field]: value }));
  }

  return (
    <div className="section">
      <h4>工资配置</h4>

      <div className="field">
        <label>月薪 (元)</label>
        <input
          type="number"
          value={config.monthly_salary}
          onChange={e => handleChange('monthly_salary', Number(e.target.value))}
        />
      </div>

      <div className="field">
        <label>月工作日</label>
        <input
          type="number"
          value={config.work_days_per_month}
          onChange={e => handleChange('work_days_per_month', Number(e.target.value))}
        />
      </div>

      <div className="row">
        <div className="field">
          <label>上班时间</label>
          <input
            type="time"
            value={config.work_start_time}
            onChange={e => handleChange('work_start_time', e.target.value)}
          />
        </div>
        <div className="field">
          <label>下班时间</label>
          <input
            type="time"
            value={config.work_end_time}
            onChange={e => handleChange('work_end_time', e.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label>午休时间 (分钟)</label>
        <input
          type="number"
          step="15"
          value={config.lunch_break_minutes}
          onChange={e => handleChange('lunch_break_minutes', Number(e.target.value))}
        />
      </div>

      {/* 自动计算的工作时间显示 */}
      <div className="result">
        <div className="resultItem">
          <span>工作时长</span>
          <strong>{workHours.toFixed(1)} 小时</strong>
        </div>
        <div className="resultItem">
          <span>有效工作</span>
          <strong>{effectiveHours.toFixed(1)} 小时</strong>
        </div>
      </div>

      <div className="result">
        <div className="resultItem">
          <span>日薪</span>
          <strong>¥{info.daily_salary.toFixed(2)}</strong>
        </div>
        <div className="resultItem">
          <span>时薪</span>
          <strong>¥{info.hourly_salary.toFixed(2)}</strong>
        </div>
      </div>

      <button className="saveBtn" onClick={handleSave}>
        保存设置
      </button>
    </div>
  );
}
