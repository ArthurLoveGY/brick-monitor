import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useKeystrokeStore } from '../stores/keystrokeStore';

export function useKeystrokeStats() {
  const { setTodayStats, setHourlyStats } = useKeystrokeStore();

  useEffect(() => {
    async function loadStats() {
      try {
        const stats = await invoke('get_today_stats');
        setTodayStats(stats as any);

        const hourly = await invoke('get_today_hourly');
        setHourlyStats(hourly as any);
      } catch (e) {
        console.log('Stats not available yet');
      }
    }

    loadStats();

    const unlisten = listen('keystroke', () => {
      loadStats();
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, [setTodayStats, setHourlyStats]);
}
