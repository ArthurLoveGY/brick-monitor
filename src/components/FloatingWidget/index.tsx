import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { motion } from 'framer-motion';
import styles from './styles.module.css';
import { invokeTauri, type AppErrorPayload } from '../../lib/tauri';
import type { MonitoringStatus } from '../../types/system';

interface WidgetData {
  todayKeystrokes: number;
  todayEarnings: number;
  countdown: string;
}

interface HeartbeatData {
  code_ratio: number;
  talk_ratio: number;
  status: 'Coding' | 'Talking' | 'Idle' | 'Balanced';
  heartbeat_bpm: number;
}

export function FloatingWidget() {
  const [data, setData] = useState<WidgetData>({
    todayKeystrokes: 0,
    todayEarnings: 0,
    countdown: '00:00',
  });
  const [heartbeat, setHeartbeat] = useState<HeartbeatData>({
    code_ratio: 0,
    talk_ratio: 0,
    status: 'Idle',
    heartbeat_bpm: 40,
  });
  const [monitoringStatus, setMonitoringStatus] = useState<MonitoringStatus | null>(null);
  const [loadError, setLoadError] = useState<AppErrorPayload | null>(null);

  useEffect(() => {
    const unlistenKeystroke = listen('keystroke', () => {
      void updateStats();
      void updateHeartbeat();
    });
    const unlistenMonitoring = listen<MonitoringStatus>('monitoring-status-changed', (event) => {
      setMonitoringStatus(event.payload);
    });

    const timer = setInterval(() => {
      void updateCountdown();
    }, 1000);

    void loadMonitoringStatus();

    return () => {
      unlistenKeystroke.then((fn) => fn());
      unlistenMonitoring.then((fn) => fn());
      clearInterval(timer);
    };
  }, []);

  async function loadMonitoringStatus() {
    try {
      const status = await invokeTauri<MonitoringStatus>('refresh_monitoring_status');
      setMonitoringStatus(status);
      if (status.ready) {
        await Promise.all([updateStats(), updateHeartbeat(), updateCountdown()]);
      }
      setLoadError(null);
    } catch (error) {
      setLoadError(error as AppErrorPayload);
    }
  }

  async function updateStats() {
    try {
      const stats = await invokeTauri<{ total: number }>('get_today_stats');
      const salary = await invokeTauri<{ today_earnings: number }>('get_salary_info');

      setData((prev) => ({
        ...prev,
        todayKeystrokes: stats.total,
        todayEarnings: salary.today_earnings,
      }));
      setLoadError(null);
    } catch (error) {
      setLoadError(error as AppErrorPayload);
    }
  }

  async function updateHeartbeat() {
    try {
      const hb = await invokeTauri<HeartbeatData>('get_heartbeat_data');
      setHeartbeat(hb);
      setLoadError(null);
    } catch (error) {
      setLoadError(error as AppErrorPayload);
    }
  }

  async function updateCountdown() {
    try {
      const config = await invokeTauri<{ work_end: string }>('get_work_schedule');
      const [endHour, endMinute] = config.work_end.split(':').map(Number);
      const now = new Date();
      const end = new Date();
      end.setHours(endHour, endMinute, 0, 0);

      const diff = end.getTime() - now.getTime();
      if (diff <= 0) {
        setData((prev) => ({ ...prev, countdown: 'Off' }));
      } else {
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        setData((prev) => ({
          ...prev,
          countdown: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
        }));
      }
      setLoadError(null);
    } catch (error) {
      setLoadError(error as AppErrorPayload);
    }
  }

  const focusStateLabel = {
    Coding: 'Code',
    Talking: 'Talk',
    Idle: 'Idle',
    Balanced: 'Balance',
  }[heartbeat.status];

  if (monitoringStatus && !monitoringStatus.ready) {
    return (
      <div className={`${styles.widget} ${styles.statusWidget}`}>
        <div className={styles.topLine}>
          <span className={styles.kicker}>Monitor</span>
          <span className={styles.badgeWarning}>Blocked</span>
        </div>
        <p className={styles.statusText}>
          {monitoringStatus.lastError?.message ?? '监控权限尚未就绪'}
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={`${styles.widget} ${styles.statusWidget}`}>
        <div className={styles.topLine}>
          <span className={styles.kicker}>Monitor</span>
          <span className={styles.badgeDanger}>Error</span>
        </div>
        <p className={styles.statusText}>{loadError.code}</p>
      </div>
    );
  }

  return (
    <div
      className={styles.widget}
      onMouseDown={async (event) => {
        event.preventDefault();
        try {
          await getCurrentWindow().startDragging();
        } catch (error) {
          console.error('Drag failed:', error);
        }
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className={styles.topLine}>
        <span className={styles.kicker}>Daily Capsule</span>
        <span className={styles.focusBadge}>{focusStateLabel}</span>
      </div>

      <div className={styles.metrics}>
        <div className={styles.metricBlock}>
          <span className={styles.metricLabel}>Time Left</span>
          <strong>{data.countdown}</strong>
        </div>
        <div className={styles.metricDivider} />
        <div className={styles.metricBlock}>
          <span className={styles.metricLabel}>Earned</span>
          <strong>¥{data.todayEarnings.toFixed(1)}</strong>
        </div>
        <div className={styles.metricDivider} />
        <div className={styles.metricBlock}>
          <span className={styles.metricLabel}>Keys</span>
          <strong>{data.todayKeystrokes.toLocaleString()}</strong>
        </div>
      </div>

      <div className={styles.progressSection}>
        <div className={styles.progressMeta}>
          <span>Flow</span>
          <div className={styles.progressStats}>
            <span>{Math.round(heartbeat.code_ratio)}%</span>
            <span>Talk {Math.round(heartbeat.talk_ratio)}%</span>
          </div>
        </div>
        <div className={styles.progressBar}>
          <motion.div
            className={styles.progressFill}
            animate={{ width: `${heartbeat.code_ratio}%` }}
            transition={{ type: 'spring', stiffness: 110, damping: 20 }}
          />
        </div>
      </div>
    </div>
  );
}
