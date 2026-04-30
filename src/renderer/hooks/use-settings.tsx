import { createContext, useContext, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { DEFAULT_TIMER_SETTINGS, type TimerSettings } from '@shared/types';

interface SettingsContextValue {
  settings: TimerSettings;
  updateSettings: (patch: Partial<TimerSettings>) => void;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_TIMER_SETTINGS,
  updateSettings: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }): ReactElement {
  const [settings, setSettings] = useState<TimerSettings>(DEFAULT_TIMER_SETTINGS);

  useEffect(() => {
    window.electronApi?.getSettings().then(s => {
      if (s) setSettings({ ...DEFAULT_TIMER_SETTINGS, ...s });
    });
  }, []);

  const updateSettings = (patch: Partial<TimerSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    window.electronApi?.setSettings(next);
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
