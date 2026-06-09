import { createContext, useContext, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { DEFAULT_TIMER_SETTINGS, type TimerSettings } from '@shared/types';
import { getT, type TFunc } from '@shared/i18n';
import { api } from '@shared/tauri/api';

interface SettingsContextValue {
  settings: TimerSettings;
  updateSettings: (patch: Partial<TimerSettings>) => void;
  t: TFunc;
  loaded: boolean;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_TIMER_SETTINGS,
  updateSettings: () => {},
  t: (key) => key,
  loaded: true,
});

export function SettingsProvider({ children }: { children: ReactNode }): ReactElement {
  const [settings, setSettings] = useState<TimerSettings>(DEFAULT_TIMER_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.getSettings()
      .then(s => { if (s) setSettings({ ...DEFAULT_TIMER_SETTINGS, ...s }); })
      .catch(err => console.error('getSettings failed:', err))
      .finally(() => setLoaded(true));
  }, []);

  const updateSettings = (patch: Partial<TimerSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    api.setSettings(next).catch(err => console.error('setSettings failed:', err));
  };

  const t = getT(settings.locale ?? 'uz');

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, t, loaded }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
