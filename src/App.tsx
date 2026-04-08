import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { FloatingWidget } from './components/FloatingWidget';
import { Dashboard } from './components/Dashboard';
import { Settings } from './components/Settings';
import { invokeTauri, type AppErrorPayload } from './lib/tauri';
import type { MonitoringStatus } from './types/system';
import './App.css';

function App() {
  const [currentWindow, setCurrentWindow] = useState('floating');
  const [monitoringStatus, setMonitoringStatus] = useState<MonitoringStatus | null>(null);
  const [statusError, setStatusError] = useState<AppErrorPayload | null>(null);

  useEffect(() => {
    async function detectWindow() {
      const win = getCurrentWindow();
      setCurrentWindow(win.label);
    }

    async function loadMonitoringStatus() {
      try {
        const status = await invokeTauri<MonitoringStatus>('refresh_monitoring_status');
        setMonitoringStatus(status);
        setStatusError(null);
      } catch (error) {
        setStatusError(error as AppErrorPayload);
      }
    }

    const unlistenPromise = listen<MonitoringStatus>('monitoring-status-changed', (event) => {
      setMonitoringStatus(event.payload);
      setStatusError(null);
    });

    void detectWindow();
    void loadMonitoringStatus();

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    document.body.dataset.window = currentWindow;
    document.documentElement.dataset.window = currentWindow;
    const root = document.getElementById('root');
    if (root) {
      root.dataset.window = currentWindow;
    }
  }, [currentWindow]);

  const blocked = monitoringStatus ? !monitoringStatus.ready : false;
  const summary = [
    {
      label: '平台',
      value: monitoringStatus?.platform ?? 'macOS',
    },
    {
      label: '辅助功能',
      value: monitoringStatus?.accessibilityGranted ? '已授权' : '待授权',
    },
    {
      label: '输入监控',
      value: monitoringStatus?.inputMonitoringGranted ? '已授权' : '待授权',
    },
    {
      label: '监听器',
      value: monitoringStatus?.listenerStarted ? '已启动' : '未启动',
    },
  ];

  if (currentWindow === 'floating') {
    return <FloatingWidget />;
  }

  return (
    <div className="appShell">
      <div className="appFrame">
        <header className="topbar">
          <div className="brand">
            <span className="eyebrow">Brick Monitor</span>
            <h1>搬砖实时监控</h1>
            <p>把今天的工作状态、输入趋势和系统权限放在一个真正可读的桌面工作台里。</p>
          </div>

          <div className={`statusBadge ${blocked ? 'warning' : ''} ${statusError ? 'danger' : ''}`}>
            <span className="statusDot" />
            {statusError
              ? '状态读取失败'
              : blocked
                ? '监控未就绪'
                : monitoringStatus
                  ? '监控运行中'
                  : '正在检测'}
          </div>
        </header>

        <section className="summaryGrid">
          {summary.map((item) => (
            <article key={item.label} className="summaryCard">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </section>

        {statusError && (
          <section className="statusPanel danger">
            <span className="statusTitle">运行时错误</span>
            <p>{statusError.code}: {statusError.message}</p>
          </section>
        )}

        {blocked && monitoringStatus?.lastError && (
          <section className="statusPanel warning">
            <span className="statusTitle">权限阻断</span>
            <p>{monitoringStatus.lastError.code}: {monitoringStatus.lastError.message}</p>
          </section>
        )}

        <main className="workspace">
          <section className="workspaceMain">
            <Dashboard />
          </section>

          <aside className="workspaceSide">
            {monitoringStatus && (
              <Settings
                monitoringStatus={monitoringStatus}
                onMonitoringStatusChange={setMonitoringStatus}
              />
            )}
          </aside>
        </main>
      </div>
    </div>
  );
}

export default App;
