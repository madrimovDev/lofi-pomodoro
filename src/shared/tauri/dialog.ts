import { invoke } from '@tauri-apps/api/core';
import type { Task } from '@shared/types';

export interface ImportResult { status: 'ok' | 'invalid' | 'cancelled'; tasks: Task[]; total: number }

export const dialogApi = {
  exportTasks: () => invoke<boolean>('export_tasks'),
  exportStats: () => invoke<boolean>('export_stats'),
  importTasks: () => invoke<ImportResult>('import_tasks'),
  importTasksFromPath: (path: string) => invoke<ImportResult>('import_tasks_from_path', { path }),
  pickNotificationSound: () => invoke<string | null>('pick_notification_sound'),
};
