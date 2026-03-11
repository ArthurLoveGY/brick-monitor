import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { motion } from 'framer-motion';
import styles from './styles.module.css';

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
    countdown: '00:00:00',
  });

  const [heartbeat, setHeartbeat] = useState<HeartbeatData>({
    code_ratio: 0,
    talk_ratio: 0,
    status: 'Idle',
    heartbeat_bpm: 40,
  });

  useEffect(() => {
    const unlisten = listen('keystroke', () => {
      updateStats();
      updateHeartbeat();
    });

    const timer = setInterval(() => {
      updateCountdown();
    }, 1000);

    updateStats();
    updateHeartbeat();

    return () => {
      unlisten.then(fn => fn());
      clearInterval(timer);
    };
  }, []);

  async function updateStats() {
    try {
      const stats = await invoke<{ total: number }>('get_today_stats');
      const salary = await invoke<{ today_earnings: number }>('get_salary_info');

      setData(prev => ({
        ...prev,
        todayKeystrokes: stats.total,
        todayEarnings: salary.today_earnings,
      }));
    } catch (e) {
      console.log('Stats not available yet');
    }
  }

  async function updateHeartbeat() {
    try {
      const hb = await invoke<HeartbeatData>('get_heartbeat_data');
      setHeartbeat(hb);
    } catch (e) {
      console.log('Heartbeat not available yet');
    }
  }

  async function updateCountdown() {
    try {
      const config = await invoke<{ work_end: string }>('get_work_schedule');
      const [endHour, endMin] = config.work_end.split(':').map(Number);

      const now = new Date();
      const end = new Date();
      end.setHours(endHour, endMin, 0, 0);

      const diff = end.getTime() - now.getTime();

      if (diff > 0) {
        const hours = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        setData(prev => ({
          ...prev,
          countdown: `${hours}h${mins}m`,
        }));
      } else {
        setData(prev => ({
          ...prev,
          countdown: '下班了',
        }));
      }
    } catch (e) {
      console.log('Work schedule not available yet');
    }
  }

  return (
    <div
      className={styles.widget}
      onMouseDown={async (e) => {
        e.preventDefault();
        try {
          await getCurrentWindow().startDragging();
        } catch (err) {
          console.error('Drag failed:', err);
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
      style={{ cursor: 'grab' }}
    >
      {/* 第一行：倒计时 + 收入 */}
      <div className={styles.row}>
        <div className={`${styles.item} ${styles.leftItem}`}>
          <span className={styles.icon}>🕒</span>
          <span className={styles.value}>{data.countdown}</span>
        </div>
        <div className={styles.divider} />
        <div className={styles.item}>
          <span className={styles.icon}>💰</span>
          <span className={styles.value}>{data.todayEarnings.toFixed(1)}元</span>
        </div>
      </div>

      {/* 第二行：按键数 + 工作占比进度条 */}
      <div className={styles.row}>
        <div className={`${styles.item} ${styles.leftItem}`}>
          <span className={styles.icon}>⌨️</span>
          <span className={styles.value}>{data.todayKeystrokes.toLocaleString()}</span>
        </div>
        <div className={styles.divider} />
        <div className={styles.item}>
          <div className={styles.progressContainer}>
            <span className={styles.progressEmoji}>💻</span>
            <div className={styles.progressWrapper}>
              <div className={styles.progressBar}>
                <motion.div
                  className={styles.progressFill}
                  animate={{ width: `${heartbeat.code_ratio}%` }}
                  transition={{ type: 'spring', stiffness: 100 }}
                />
              </div>
              <span className={styles.progressPercent}>{Math.round(heartbeat.code_ratio)}%</span>
            </div>
            <span className={styles.progressEmoji}>🐟</span>
          </div>
        </div>
      </div>
    </div>
  );
}
