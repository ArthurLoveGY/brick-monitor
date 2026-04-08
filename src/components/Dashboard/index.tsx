import { useEffect, useMemo, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import styles from './styles.module.css';
import { invokeTauri, type AppErrorPayload } from '../../lib/tauri';

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

interface HeartbeatData {
  code_ratio: number;
  talk_ratio: number;
  code_keystrokes: number;
  talk_keystrokes: number;
  other_keystrokes: number;
  status: 'Coding' | 'Talking' | 'Idle' | 'Balanced';
  heartbeat_bpm: number;
}

interface SalaryInfo {
  today_earnings: number;
  work_progress: number;
}

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<'today' | 'history' | 'apps'>('today');
  const [todayStats, setTodayStats] = useState<TodayStats>({ total: 0, charCount: 0, codeCount: 0 });
  const [hourlyData, setHourlyData] = useState<HourlyStats[]>([]);
  const [historyData, setHistoryData] = useState<DailyStats[]>([]);
  const [appBreakdown, setAppBreakdown] = useState<AppBreakdown[]>([]);
  const [heartbeat, setHeartbeat] = useState<HeartbeatData | null>(null);
  const [salaryInfo, setSalaryInfo] = useState<SalaryInfo | null>(null);
  const [loadError, setLoadError] = useState<AppErrorPayload | null>(null);

  useEffect(() => {
    void loadStats();
    const unlistenPromise = listen('keystroke-batch', () => {
      void loadStats();
    });
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  async function loadStats() {
    try {
      const [stats, hourly, history, apps, heartbeatData, salary] = await Promise.all([
        invokeTauri<TodayStats>('get_today_stats'),
        invokeTauri<HourlyStats[]>('get_today_hourly'),
        invokeTauri<DailyStats[]>('get_history_stats', { days: 30 }),
        invokeTauri<AppBreakdown[]>('get_app_breakdown'),
        invokeTauri<HeartbeatData>('get_heartbeat_data'),
        invokeTauri<SalaryInfo>('get_salary_info'),
      ]);

      setTodayStats(stats);
      setHourlyData(hourly);
      setHistoryData(history);
      setAppBreakdown(apps);
      setHeartbeat(heartbeatData);
      setSalaryInfo(salary);
      setLoadError(null);
    } catch (error) {
      setLoadError(error as AppErrorPayload);
    }
  }

  const statusLabel = useMemo(() => {
    if (!heartbeat) {
      return '待分析';
    }
    switch (heartbeat.status) {
      case 'Coding':
        return '深度编码';
      case 'Talking':
        return '沟通偏多';
      case 'Balanced':
        return '节奏平衡';
      default:
        return '尚未开始';
    }
  }, [heartbeat]);

  const pieColors = ['#7390ff', '#66c3b0', '#f1b270', '#d98a9c', '#8aa0d4', '#8fbcd2'];

  return (
    <div className={styles.dashboard}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>Today Summary</span>
          <h2>今天的工作节奏</h2>
          <p>先把最重要的信息放到第一屏：输入量、收益、专注状态和工作进度。</p>
        </div>

        <div className={styles.heroStats}>
          <div className={styles.heroStat}>
            <span>当前状态</span>
            <strong>{statusLabel}</strong>
          </div>
          <div className={styles.heroStat}>
            <span>今日收益</span>
            <strong>¥{salaryInfo ? salaryInfo.today_earnings.toFixed(1) : '0.0'}</strong>
          </div>
          <div className={styles.heroStat}>
            <span>工作进度</span>
            <strong>{Math.round(salaryInfo?.work_progress ?? 0)}%</strong>
          </div>
        </div>
      </section>

      {loadError && (
        <section className={styles.errorCard}>
          <strong>{loadError.code}</strong>
          <p>{loadError.message}</p>
        </section>
      )}

      <section className={styles.metricGrid}>
        <article className={styles.metricCard}>
          <span>今日按键</span>
          <strong>{todayStats.total.toLocaleString()}</strong>
          <small>全部记录输入量</small>
        </article>
        <article className={styles.metricCard}>
          <span>字符输入</span>
          <strong>{todayStats.charCount.toLocaleString()}</strong>
          <small>自然语言与通用输入</small>
        </article>
        <article className={styles.metricCard}>
          <span>代码输入</span>
          <strong>{todayStats.codeCount.toLocaleString()}</strong>
          <small>IDE / Terminal 场景</small>
        </article>
        <article className={styles.metricCard}>
          <span>浏览器输入</span>
          <strong>{(todayStats.browserCount ?? 0).toLocaleString()}</strong>
          <small>网页内键盘操作</small>
        </article>
      </section>

      <section className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'today' ? styles.active : ''}`}
          onClick={() => setActiveTab('today')}
        >
          今日走势
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'history' ? styles.active : ''}`}
          onClick={() => setActiveTab('history')}
        >
          近 30 天
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'apps' ? styles.active : ''}`}
          onClick={() => setActiveTab('apps')}
        >
          应用分布
        </button>
      </section>

      {activeTab === 'today' && (
        <section className={styles.chartGrid}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <span className={styles.eyebrow}>Hourly Flow</span>
              <h3>今日分时输入</h3>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={hourlyData}>
                <CartesianGrid vertical={false} stroke="rgba(115, 131, 164, 0.18)" />
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: '#66748e', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#66748e', fontSize: 11 }} />
                <Tooltip
                  cursor={{ fill: 'rgba(115, 144, 255, 0.08)' }}
                  contentStyle={{
                    borderRadius: 16,
                    border: '1px solid rgba(232, 238, 250, 0.94)',
                    background: 'rgba(255, 255, 255, 0.96)',
                    boxShadow: '0 16px 28px rgba(111, 128, 166, 0.16)',
                  }}
                  formatter={(value: number) => [value.toLocaleString(), '按键']}
                  labelFormatter={(label) => `${label}:00`}
                />
                <Bar dataKey="count" radius={[10, 10, 4, 4]} fill="#7390ff" />
              </BarChart>
            </ResponsiveContainer>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <span className={styles.eyebrow}>Focus Mix</span>
              <h3>专注构成</h3>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart
                data={[
                  { name: 'Code', value: heartbeat?.code_ratio ?? 0 },
                  { name: 'Talk', value: heartbeat?.talk_ratio ?? 0 },
                  {
                    name: 'Other',
                    value: Math.max(0, 100 - (heartbeat?.code_ratio ?? 0) - (heartbeat?.talk_ratio ?? 0)),
                  },
                ]}
              >
                <defs>
                  <linearGradient id="focusArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7390ff" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="#7390ff" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(115, 131, 164, 0.18)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#66748e', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#66748e', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 16,
                    border: '1px solid rgba(232, 238, 250, 0.94)',
                    background: 'rgba(255, 255, 255, 0.96)',
                  }}
                  formatter={(value: number) => [`${Math.round(value)}%`, '占比']}
                />
                <Area type="monotone" dataKey="value" stroke="#7390ff" strokeWidth={2.5} fill="url(#focusArea)" />
              </AreaChart>
            </ResponsiveContainer>
          </article>
        </section>
      )}

      {activeTab === 'history' && (
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.eyebrow}>Monthly Trend</span>
            <h3>最近 30 天输入趋势</h3>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={historyData}>
              <CartesianGrid vertical={false} stroke="rgba(115, 131, 164, 0.18)" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => value.slice(5)}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#66748e', fontSize: 11 }}
              />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#66748e', fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  borderRadius: 16,
                  border: '1px solid rgba(232, 238, 250, 0.94)',
                  background: 'rgba(255, 255, 255, 0.96)',
                }}
                formatter={(value: number) => [value.toLocaleString(), '按键']}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#7390ff"
                strokeWidth={3}
                dot={{ r: 3.5, fill: '#7390ff', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </article>
      )}

      {activeTab === 'apps' && (
        <section className={styles.chartGrid}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <span className={styles.eyebrow}>App Mix</span>
              <h3>今日应用占比</h3>
            </div>
            <div className={styles.pieWrap}>
              <PieChart width={280} height={280}>
                <Pie
                  data={appBreakdown}
                  dataKey="value"
                  cx={140}
                  cy={140}
                  innerRadius={74}
                  outerRadius={104}
                  paddingAngle={4}
                >
                  {appBreakdown.map((item, index) => (
                    <Cell key={item.name} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
              </PieChart>
            </div>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <span className={styles.eyebrow}>Top Apps</span>
              <h3>高频应用清单</h3>
            </div>
            <div className={styles.appList}>
              {appBreakdown.map((item, index) => (
                <div key={item.name} className={styles.appRow}>
                  <div className={styles.appInfo}>
                    <span className={styles.appSwatch} style={{ background: pieColors[index % pieColors.length] }} />
                    <span className={styles.appName}>{item.name}</span>
                  </div>
                  <strong>{item.value.toLocaleString()}</strong>
                </div>
              ))}
            </div>
          </article>
        </section>
      )}
    </div>
  );
}
