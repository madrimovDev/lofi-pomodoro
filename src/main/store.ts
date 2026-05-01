import { Store } from '@madrimov/electron-store-typed';
import {
  DEFAULT_MUSIC_CONFIG,
  DEFAULT_TIMER_SETTINGS,
  type DailyStat,
  type MusicConfig,
  type Task,
  type TimerSettings,
} from '../shared/types';

export interface AppConfig {
  theme: 'dark' | 'light';
  settings: TimerSettings;
  tasks: Task[];
  activeTaskId: string | null;
  music: MusicConfig;
  stats: DailyStat[];
}

let _store: Store<AppConfig> | null = null;

/** Apply forward migrations manually on first load. */
function applyMigrations(store: Store<AppConfig>): void {
  // v1.0.x → v1.1.0: autoStart, alwaysOnTop, dailyGoal, showBreakScreen, todoistToken
  const s = store.get('settings') as unknown as Record<string, unknown> | undefined;
  if (s && typeof s === 'object') {
    const defaults: Record<string, unknown> = {
      autoStartBreaks: false,
      autoStartFocus: false,
      alwaysOnTop: false,
      activePreset: null,
      dailyGoal: 0,
      showBreakScreen: true,
      todoistToken: null,
    };
    let needsPatch = false;
    for (const key of Object.keys(defaults)) {
      if (!(key in s)) { needsPatch = true; break; }
    }
    if (needsPatch) {
      store.set('settings', { ...defaults, ...s } as unknown as TimerSettings);
    }
  }
}

export function getAppStore(): Store<AppConfig> {
  if (!_store) {
    _store = new Store<AppConfig>({
      name: 'config',
      defaults: {
        theme: 'dark',
        settings: DEFAULT_TIMER_SETTINGS,
        tasks: [],
        activeTaskId: null,
        music: DEFAULT_MUSIC_CONFIG,
        stats: [],
      },
    });
    applyMigrations(_store);
  }
  return _store;
}
