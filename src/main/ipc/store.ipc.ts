import { ipcMain, dialog, net } from 'electron';
import { writeFile, readFile } from 'fs/promises';
import { getAppStore } from '../store';
import { IPC_CHANNELS, type DailyStat, type Task, type Theme, type TimerSettings } from '../../shared/types';
import log from '../logger';

export function setupStoreIpc(): void {
  const store = getAppStore();

  ipcMain.handle(IPC_CHANNELS.STORE_GET_THEME, () => store.get('theme'));
  ipcMain.handle(IPC_CHANNELS.STORE_SET_THEME, (_event, value: Theme) => {
    try { store.set('theme', value); } catch (err) { log.error('store set theme:', err); throw err; }
  });

  ipcMain.handle(IPC_CHANNELS.STORE_GET_SETTINGS, () => store.get('settings'));
  ipcMain.handle(IPC_CHANNELS.STORE_SET_SETTINGS, (_event, value: TimerSettings) => {
    try { store.set('settings', value); } catch (err) { log.error('store set settings:', err); throw err; }
  });

  ipcMain.handle(IPC_CHANNELS.STORE_GET_TASKS, () => store.get('tasks'));
  ipcMain.handle(IPC_CHANNELS.STORE_SET_TASKS, (_event, value: Task[]) => {
    try { store.set('tasks', value); } catch (err) { log.error('store set tasks:', err); throw err; }
  });

  ipcMain.handle(IPC_CHANNELS.STORE_GET_ACTIVE_TASK_ID, () => store.get('activeTaskId'));
  ipcMain.handle(IPC_CHANNELS.STORE_SET_ACTIVE_TASK_ID, (_event, value: string | null) => {
    try { store.set('activeTaskId', value); } catch (err) { log.error('store set activeTaskId:', err); throw err; }
  });

  // Stats
  ipcMain.handle(IPC_CHANNELS.STATS_GET, () => store.get('stats') ?? []);
  ipcMain.handle(IPC_CHANNELS.STATS_SET, (_event, value: DailyStat[]) => {
    try { store.set('stats', value); } catch (err) { log.error('store set stats:', err); throw err; }
  });

  // Tasks: export
  ipcMain.handle(IPC_CHANNELS.TASKS_EXPORT, async (_event): Promise<boolean> => {
    const tasks = store.get('tasks') ?? [];
    const { filePath } = await dialog.showSaveDialog({
      defaultPath: `zenfocus-tasks-${Date.now()}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (!filePath) return false;
    try {
      await writeFile(filePath, JSON.stringify(tasks, null, 2), 'utf-8');
      return true;
    } catch (err) {
      log.error('Tasks export error:', err);
      return false;
    }
  });

  // Tasks: import
  ipcMain.handle(IPC_CHANNELS.TASKS_IMPORT, async (_event): Promise<Task[] | null> => {
    const { filePaths } = await dialog.showOpenDialog({
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (!filePaths[0]) return null;
    try {
      const raw = await readFile(filePaths[0], 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      // Minimal validation: must be an array of objects with id and name
      if (!Array.isArray(parsed)) {
        log.warn('Tasks import: not an array');
        return null;
      }
      const valid = parsed.filter(
        (item): item is Task =>
          typeof item === 'object' && item !== null &&
          typeof (item as Record<string, unknown>).id === 'string' &&
          typeof (item as Record<string, unknown>).name === 'string',
      );
      return valid;
    } catch (err) {
      log.error('Tasks import error:', err);
      return null;
    }
  });

  // Settings: pick custom notification sound
  ipcMain.handle(IPC_CHANNELS.SETTINGS_PICK_SOUND, async (_event): Promise<string | null> => {
    const { filePaths } = await dialog.showOpenDialog({
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'flac', 'm4a'] }],
      properties: ['openFile'],
    });
    return filePaths[0] ?? null;
  });

  // Todoist import
  ipcMain.handle(IPC_CHANNELS.TODOIST_IMPORT, async (): Promise<unknown> => {
    const settings = store.get('settings');
    const token = settings?.todoistToken;
    if (!token) return { error: 'Token mavjud emas' };
    try {
      const res = await net.fetch('https://api.todoist.com/rest/v2/tasks', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { error: `API xatosi: ${res.status}` };
      const items = await res.json() as Array<{
        id: string;
        content: string;
        description?: string;
        priority: number;
        due?: { date: string } | null;
      }>;
      const mapPriority = (p: number): 'high' | 'medium' | 'low' | null => {
        if (p === 4) return 'high';
        if (p === 3) return 'medium';
        if (p === 2) return 'low';
        return null;
      };
      return items.map(item => ({
        id: crypto.randomUUID(),
        name: item.content,
        description: item.description ?? '',
        estimatedPomodoros: 4,
        completedPomodoros: 0,
        createdAt: Date.now(),
        priority: mapPriority(item.priority),
        dueDate: item.due?.date ? new Date(item.due.date).getTime() : null,
        subtasks: [],
      }));
    } catch (err) {
      log.error('Todoist import error:', err);
      return { error: String(err) };
    }
  });
}
