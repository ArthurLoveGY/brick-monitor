import { useCallback, useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { AnimatePresence, motion } from 'framer-motion';
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
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Keyboard shortcut: Escape closes drawer
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && drawerOpen) {
        closeDrawer();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [drawerOpen, closeDrawer]);

  if (currentWindow === 'floating') {
    return <FloatingWidget />;
  }

  const blocked = monitoringStatus ? !monitoringStatus.ready : false;
  const hasAlert = Boolean(statusError || (blocked && monitoringStatus?.lastError));

  return (
    <div className="appShell">
      <div className="appFrame">
        {/* Compact header bar */}
        <header className="topbar">
          <div className="brand">
            <svg className="brandMark" width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="8" fill="url(#brandGrad)" />
              <rect x="6" y="10" width="4" height="12" rx="2" fill="white" opacity="0.9" />
              <rect x="12" y="6" width="4" height="16" rx="2" fill="white" opacity="0.9" />
              <rect x="18" y="9" width="4" height="13" rx="2" fill="white" opacity="0.7" />
              <defs>
                <linearGradient id="brandGrad" x1="0" y1="0" x2="28" y2="28">
                  <stop stopColor="#7390ff" />
                  <stop offset="1" stopColor="#5b7ce6" />
                </linearGradient>
              </defs>
            </svg>
            <h1>搬砖实时监控</h1>
          </div>

          <div className="topbarRight">
            <div className={`statusPill ${statusError ? 'danger' : ''} ${blocked && !statusError ? 'warning' : ''}`}>
              <span className="statusDot" />
              <span className="statusText">
                {statusError ? '状态异常' : blocked ? '监控未就绪' : monitoringStatus ? '监控运行中' : '检测中'}
              </span>
            </div>

            <button className="settingsTrigger" onClick={openDrawer} aria-label="打开设置">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <circle cx="9" cy="9" r="2.5" />
                <path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M3.7 14.3l1.4-1.4M12.9 5.1l1.4-1.4" />
              </svg>
              <span>设置</span>
            </button>
          </div>
        </header>

        {/* Alert banner — compact, dismissible */}
        {hasAlert && (
          <div className={`alertBanner ${statusError ? 'danger' : 'warning'}`}>
            <svg className="alertIcon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
              <path d="M8 4.5v3.5M8 11v.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <span className="alertText">
              {statusError
                ? `${statusError.code}: ${statusError.message}`
                : monitoringStatus?.lastError
                  ? `${monitoringStatus.lastError.code}: ${monitoringStatus.lastError.message}`
                  : '监控服务尚未就绪，请在设置中完成权限配置'}
            </span>
          </div>
        )}

        {/* Dashboard — full width */}
        <main className="workspace">
          <Dashboard />
        </main>

        {/* Settings drawer */}
        <AnimatePresence>
          {drawerOpen && (
            <>
              <motion.div
                className="drawerOverlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
                onClick={closeDrawer}
              />
              <motion.aside
                className="drawer"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              >
                <div className="drawerHeader">
                  <h2>系统设置</h2>
                  <button className="drawerClose" onClick={closeDrawer} aria-label="关闭设置">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M5 5l10 10M15 5L5 15" />
                    </svg>
                  </button>
                </div>
                <div className="drawerBody">
                  {monitoringStatus && (
                    <Settings
                      monitoringStatus={monitoringStatus}
                      onMonitoringStatusChange={setMonitoringStatus}
                    />
                  )}
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default App;
