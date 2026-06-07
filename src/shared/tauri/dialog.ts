import { invoke } from '@tauri-apps/api/core';
import type { Task } from '@shared/types';

/**
 * Faza 6 dialog command'lari (export/import vazifalar, sound tanlash).
 * pickNotificationSound xom yo'l qaytaradi — ijro paytida convertFileSrc qo'llanadi.
 */
export const dialogApi = {
  exportTasks: () => invoke<boolean>('export_tasks'),
  importTasks: () => invoke<Task[] | null>('import_tasks'),
  pickNotificationSound: () => invoke<string | null>('pick_notification_sound'),
};
