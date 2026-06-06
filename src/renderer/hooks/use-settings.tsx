import { createContext, useContext, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { DEFAULT_TIMER_SETTINGS, type TimerSettings } from '@shared/types';
import { getT, type TranslationKey } from '@shared/i18n';
import { api } from '@shared/tauri/api';

interface SettingsContextValue {
  settings: TimerSettings;
  updateSettings: (patch: Partial<TimerSettings>) => void;
  t: (key: TranslationKey) => string;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_TIMER_SETTINGS,
  updateSettings: () => {},
  t: (key) => key,
});

export function SettingsProvider({ children }: { children: ReactNode }): ReactElement {
  const [settings, setSettings] = useState<TimerSettings>(DEFAULT_TIMER_SETTINGS);

  useEffect(() => {
    api.getSettings()
      .then(s => { if (s) setSettings({ ...DEFAULT_TIMER_SETTINGS, ...s }); })
      .catch(err => console.error('getSettings failed:', err));
  }, []);

  const updateSettings = (patch: Partial<TimerSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    api.setSettings(next).catch(err => console.error('setSettings failed:', err));
  };

  const t = getT(settings.locale ?? 'uz');

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, t }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
