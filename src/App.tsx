import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { FloatingWidget } from './components/FloatingWidget';
import { Dashboard } from './components/Dashboard';
import { Settings } from './components/Settings';
import './App.css';

function App() {
  const [currentWindow, setCurrentWindow] = useState<string>('floating');

  useEffect(() => {
    async function detectWindow() {
      const win = getCurrentWindow();
      const label = win.label;
      setCurrentWindow(label);
    }
    detectWindow();
  }, []);

  if (currentWindow === 'floating') {
    return <FloatingWidget />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Keyboard Tracker</h1>
      </header>
      <main className="app-main">
        <Dashboard />
        <Settings />
      </main>
    </div>
  );
}

export default App;
