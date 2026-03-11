import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import styles from './styles.module.css';

interface TodayStats {
  total: number;
  charCount: number;
  codeCount: number;
  browserCount?: number;
}

interface HourlyStats {
  hour: string;
  count: number;
}

interface DailyStats {
  date: string;
  total: number;
}

interface AppBreakdown {
  name: string;
  value: number;
}

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<'today' | 'history' | 'apps'>('today');
  const [todayStats, setTodayStats] = useState<TodayStats>({ total: 0, charCount: 0, codeCount: 0 });
  const [hourlyData, setHourlyData] = useState<HourlyStats[]>([]);
  const [historyData, setHistoryData] = useState<DailyStats[]>([]);
  const [appBreakdown, setAppBreakdown] = useState<AppBreakdown[]>([]);

  useEffect(() => {
    loadStats();
  }, [activeTab]);

  async function loadStats() {
    try {
      if (activeTab === 'today') {
        const stats = await invoke<TodayStats>('get_today_stats');
        setTodayStats(stats);

        const hourly = await invoke<HourlyStats[]>('get_today_hourly');
        setHourlyData(hourly);
      } else if (activeTab === 'history') {
        const history = await invoke<DailyStats[]>('get_history_stats', { days: 30 });
        setHistoryData(history);
      } else {
        const apps = await invoke<AppBreakdown[]>('get_app_breakdown');
        setAppBreakdown(apps);
      }
    } catch (e) {
      console.log('Stats not available yet');
    }
  }

  const COLORS = ['#4ade80', '#60a5fa', '#f472b6', '#facc15', '#a78bfa'];

  return (
    <div className={styles.dashboard}>
      <div className={styles.tabs}>
        <button
          className={activeTab === 'today' ? styles.active : ''}
          onClick={() => setActiveTab('today')}
        >
          今日统计
        </button>
        <button
          className={activeTab === 'history' ? styles.active : ''}
          onClick={() => setActiveTab('history')}
        >
          历史趋势
        </button>
        <button
          className={activeTab === 'apps' ? styles.active : ''}
          onClick={() => setActiveTab('apps')}
        >
          应用分布
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === 'today' && (
          <>
            <div className={styles.statsCards}>
              <div className={styles.card}>
                <span className={styles.cardLabel}>今日按键</span>
                <span className={styles.cardValue}>{(todayStats.total ?? 0).toLocaleString()}</span>
              </div>
              <div className={styles.card}>
                <span className={styles.cardLabel}>字符输入</span>
                <span className={styles.cardValue}>{(todayStats.charCount ?? 0).toLocaleString()}</span>
              </div>
              <div className={styles.card}>
                <span className={styles.cardLabel}>代码编写</span>
                <span className={styles.cardValue}>{(todayStats.codeCount ?? 0).toLocaleString()}</span>
              </div>
            </div>
            <div className={styles.chart}>
              <h4>今日按键分布</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={hourlyData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis
                    dataKey="hour"
                    label={{ value: '时间 (小时)', position: 'bottom', offset: -5 }}
                    tick={{ fill: '#666' }}
                  />
                  <YAxis
                    label={{ value: '按键次数', angle: -90, position: 'insideLeft' }}
                    tick={{ fill: '#666' }}
                  />
                  <Tooltip
                    formatter={(value: number) => [value.toLocaleString(), '按键次数']}
                    labelFormatter={(label) => `${label}:00`}
                  />
                  <Bar dataKey="count" fill="#4ade80" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {activeTab === 'history' && (
          <div className={styles.chart}>
            <h4>最近30天趋势</h4>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={historyData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#666', fontSize: 11 }}
                  tickFormatter={(value) => value.slice(5)}
                />
                <YAxis
                  label={{ value: '按键次数', angle: -90, position: 'insideLeft' }}
                  tick={{ fill: '#666' }}
                />
                <Tooltip
                  formatter={(value: number) => [value.toLocaleString(), '按键次数']}
                />
                <Line type="monotone" dataKey="total" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {activeTab === 'apps' && (
          <div className={styles.chart}>
            <h4>应用按键占比</h4>
            <PieChart width={400} height={300}>
              <Pie data={appBreakdown} dataKey="value" cx={200} cy={150} outerRadius={100}>
                {appBreakdown.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
            <div className={styles.legend}>
              {appBreakdown.map((item, index) => (
                <span key={item.name} className={styles.legendItem}>
                  <span style={{ background: COLORS[index % COLORS.length] }} />
                  {item.name}: {item.value}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
