import { invoke } from '@tauri-apps/api/core';
import type { Theme, TimerSettings, Task, MusicConfig, DailyStat } from '@shared/types';

/**
 * Faza 3 store backendiga type'langan invoke wrapper (12 metod).
 * DIQQAT: arg nomlari (`music`, `activeTaskId`, ...) backend kontrakti bilan
 * aynan mos kelishi shart — typecheck buni tekshirmaydi, faqat runtime tekshiradi.
 */
export const api = {
  getTheme: () => invoke<Theme>('get_theme'),
  setTheme: (theme: Theme) => invoke<void>('set_theme', { theme }),

  getSettings: () => invoke<TimerSettings>('get_settings'),
  setSettings: (settings: TimerSettings) => invoke<void>('set_settings', { settings }),

  getTasks: () => invoke<Task[]>('get_tasks'),
  setTasks: (tasks: Task[]) => invoke<void>('set_tasks', { tasks }),

  getActiveTaskId: () => invoke<string | null>('get_active_task_id'),
  setActiveTaskId: (activeTaskId: string | null) =>
    invoke<void>('set_active_task_id', { activeTaskId }),

  getMusic: () => invoke<MusicConfig>('get_music'),
  setMusic: (music: MusicConfig) => invoke<void>('set_music', { music }),

  getStats: () => invoke<DailyStat[]>('get_stats'),
  setStats: (stats: DailyStat[]) => invoke<void>('set_stats', { stats }),
};
