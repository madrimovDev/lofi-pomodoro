import { ipcMain } from 'electron';
import { getAppStore } from '../store';
import { IPC_CHANNELS, type Task, type Theme, type TimerSettings } from '../../shared/types';

export function setupStoreIpc(): void {
  const store = getAppStore();

  ipcMain.handle(IPC_CHANNELS.STORE_GET_THEME, () => store.get('theme'));
  ipcMain.handle(IPC_CHANNELS.STORE_SET_THEME, (_event, value: Theme) => {
    store.set('theme', value);
  });

  ipcMain.handle(IPC_CHANNELS.STORE_GET_SETTINGS, () => store.get('settings'));
  ipcMain.handle(IPC_CHANNELS.STORE_SET_SETTINGS, (_event, value: TimerSettings) => {
    store.set('settings', value);
  });

  ipcMain.handle(IPC_CHANNELS.STORE_GET_TASKS, () => store.get('tasks'));
  ipcMain.handle(IPC_CHANNELS.STORE_SET_TASKS, (_event, value: Task[]) => {
    store.set('tasks', value);
  });

  ipcMain.handle(IPC_CHANNELS.STORE_GET_ACTIVE_TASK_ID, () => store.get('activeTaskId'));
  ipcMain.handle(IPC_CHANNELS.STORE_SET_ACTIVE_TASK_ID, (_event, value: string | null) => {
    store.set('activeTaskId', value);
  });
}
