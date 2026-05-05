import { useEffect, useMemo, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import {
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

const PIE_COLORS = ['#7390ff', '#5fc4a8', '#f1b87a', '#e0889a', '#8ba4de', '#8cc0d6'];

const FOCUS_COLORS: Record<string, string> = {
  Code: '#7390ff',
  Talk: '#5fc4a8',
  Other: '#bcc6de',
};

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
    if (!heartbeat) return '—';
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

  const focusBars = useMemo(() => {
    if (!heartbeat) return [];
    return [
      { label: 'Code', value: heartbeat.code_keystrokes, ratio: heartbeat.code_ratio },
      { label: 'Talk', value: heartbeat.talk_keystrokes, ratio: heartbeat.talk_ratio },
      { label: 'Other', value: heartbeat.other_keystrokes, ratio: Math.max(0, 100 - heartbeat.code_ratio - heartbeat.talk_ratio) },
    ];
  }, [heartbeat]);

  const maxFocusValue = useMemo(
    () => Math.max(...focusBars.map((f) => f.value), 1),
    [focusBars],
  );

  const TAB_ITEMS = [
    { key: 'today' as const, label: '今日走势' },
    { key: 'history' as const, label: '近 30 天' },
    { key: 'apps' as const, label: '应用分布' },
  ];

  return (
    <div className={styles.dashboard}>
      {/* ============================================
          KPI Row — 5 cards, all visible at a glance
          ============================================ */}
      <section className={styles.kpiRow}>
        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>今日收益</span>
          <strong className={styles.kpiValue}>
            <span className={styles.kpiCurrency}>¥</span>
            {salaryInfo ? salaryInfo.today_earnings.toFixed(1) : '—'}
          </strong>
        </article>

        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>工作进度</span>
          <div className={styles.kpiWithProgress}>
            <strong className={styles.kpiValue}>
              {Math.round(salaryInfo?.work_progress ?? 0)}%
            </strong>
            <div className={styles.miniProgress}>
              <div
                className={styles.miniProgressFill}
                style={{ width: `${Math.min(100, Math.round(salaryInfo?.work_progress ?? 0))}%` }}
              />
            </div>
          </div>
        </article>

        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>今日按键</span>
          <strong className={styles.kpiValue}>{todayStats.total.toLocaleString()}</strong>
        </article>

        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>代码占比</span>
          <div className={styles.kpiWithProgress}>
            <strong className={styles.kpiValue}>
              {heartbeat ? `${Math.round(heartbeat.code_ratio)}%` : '—'}
            </strong>
            <div className={styles.miniProgress}>
              <div
                className={`${styles.miniProgressFill} ${styles.codeFill}`}
                style={{ width: `${Math.min(100, Math.round(heartbeat?.code_ratio ?? 0))}%` }}
              />
            </div>
          </div>
        </article>

        <article className={styles.kpiCard}>
          <span className={styles.kpiLabel}>专注状态</span>
          <strong className={`${styles.kpiValue} ${styles.statusValue}`}>
            <span className={`${styles.statusDotInline} ${styles[`status_${heartbeat?.status?.toLowerCase() ?? 'idle'}`]}`} />
            {statusLabel}
          </strong>
        </article>
      </section>

      {/* Load error */}
      {loadError && (
        <div className={styles.errorBanner}>
          <strong>{loadError.code}</strong>: {loadError.message}
        </div>
      )}

      {/* ============================================
          Tab bar
          ============================================ */}
      <nav className={styles.tabBar}>
        {TAB_ITEMS.map((tab) => (
          <button
            key={tab.key}
            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* ============================================
          Tab: 今日走势 — hourly chart + focus breakdown
          ============================================ */}
      {activeTab === 'today' && (
        <section className={styles.chartRow}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <h3>分时输入</h3>
              <span className={styles.panelHint}>今日每小时按键分布</span>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={hourlyData}>
                <CartesianGrid vertical={false} stroke="rgba(115, 131, 164, 0.12)" />
                <XAxis
                  dataKey="hour"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#66748e', fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#66748e', fontSize: 11 }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(115, 144, 255, 0.06)' }}
                  contentStyle={{
                    borderRadius: 14,
                    border: '1px solid rgba(232, 238, 250, 0.9)',
                    background: 'rgba(255, 255, 255, 0.96)',
                    boxShadow: '0 12px 24px rgba(111, 128, 166, 0.14)',
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [value.toLocaleString(), '按键']}
                  labelFormatter={(label) => `${label}:00`}
                />
                <Bar dataKey="count" radius={[8, 8, 3, 3]} fill="#7390ff" maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <h3>专注构成</h3>
              <span className={styles.panelHint}>代码 / 沟通 / 其他</span>
            </div>
            <div className={styles.focusBars}>
              {focusBars.map((bar) => (
                <div key={bar.label} className={styles.focusRow}>
                  <div className={styles.focusMeta}>
                    <span
                      className={styles.focusSwatch}
                      style={{ background: FOCUS_COLORS[bar.label] ?? '#bcc6de' }}
                    />
                    <span className={styles.focusLabel}>{bar.label}</span>
                    <span className={styles.focusRatio}>{Math.round(bar.ratio)}%</span>
                  </div>
                  <div className={styles.focusTrack}>
                    <div
                      className={styles.focusFill}
                      style={{
                        width: `${(bar.value / maxFocusValue) * 100}%`,
                        background: FOCUS_COLORS[bar.label] ?? '#bcc6de',
                      }}
                    />
                  </div>
                  <span className={styles.focusCount}>{bar.value.toLocaleString()}</span>
                </div>
              ))}
              {focusBars.length === 0 && (
                <p className={styles.focusEmpty}>等待数据...</p>
              )}
            </div>
          </article>
        </section>
      )}

      {/* ============================================
          Tab: 近 30 天 — monthly trend line chart
          ============================================ */}
      {activeTab === 'history' && (
        <section className={styles.chartRow}>
          <article className={`${styles.panel} ${styles.panelFull}`}>
            <div className={styles.panelHeader}>
              <h3>月度趋势</h3>
              <span className={styles.panelHint}>最近 30 天每日输入总量</span>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={historyData}>
                <CartesianGrid vertical={false} stroke="rgba(115, 131, 164, 0.12)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => value.slice(5)}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#66748e', fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#66748e', fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 14,
                    border: '1px solid rgba(232, 238, 250, 0.9)',
                    background: 'rgba(255, 255, 255, 0.96)',
                    boxShadow: '0 12px 24px rgba(111, 128, 166, 0.14)',
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [value.toLocaleString(), '按键']}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#7390ff"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#7390ff', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#7390ff', strokeWidth: 2, stroke: '#fff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </article>
        </section>
      )}

      {/* ============================================
          Tab: 应用分布 — donut + ranked list
          ============================================ */}
      {activeTab === 'apps' && (
        <section className={styles.chartRow}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <h3>应用占比</h3>
              <span className={styles.panelHint}>今日各应用按键分布</span>
            </div>
            <div className={styles.pieWrap}>
              <PieChart width={240} height={240}>
                <Pie
                  data={appBreakdown}
                  dataKey="value"
                  cx={120}
                  cy={120}
                  innerRadius={64}
                  outerRadius={94}
                  paddingAngle={3}
                >
                  {appBreakdown.map((item, index) => (
                    <Cell key={item.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </div>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <h3>高频应用</h3>
              <span className={styles.panelHint}>按输入量排序</span>
            </div>
            <div className={styles.appList}>
              {appBreakdown.map((item, index) => (
                <div key={item.name} className={styles.appRow}>
                  <div className={styles.appInfo}>
                    <span
                      className={styles.appSwatch}
                      style={{ background: PIE_COLORS[index % PIE_COLORS.length] }}
                    />
                    <span className={styles.appName}>{item.name}</span>
                  </div>
                  <strong className={styles.appCount}>{item.value.toLocaleString()}</strong>
                </div>
              ))}
              {appBreakdown.length === 0 && (
                <p className={styles.appEmpty}>暂无应用数据</p>
              )}
            </div>
          </article>
        </section>
      )}
    </div>
  );
}
