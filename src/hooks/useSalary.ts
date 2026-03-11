import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSalaryStore } from '../stores/salaryStore';

export function useSalary() {
  const { setConfig, setInfo } = useSalaryStore();

  useEffect(() => {
    async function loadSalary() {
      try {
        const config = await invoke('get_salary_config');
        setConfig(config as any);

        const info = await invoke('get_salary_info');
        setInfo(info as any);
      } catch (e) {
        console.log('Salary not available yet');
      }
    }

    loadSalary();
  }, [setConfig, setInfo]);

  const saveConfig = async (config: any) => {
    await invoke('save_salary_config', { config });
  };

  return { saveConfig };
}
