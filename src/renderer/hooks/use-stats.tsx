import { createContext, useContext, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { type DailyStat } from '@shared/types';

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function calculateStreak(stats: DailyStat[]): number {
  let streak = 0;
  const d = new Date();
  while (true) {
    const key = d.toISOString().slice(0, 10);
    const stat = stats.find(s => s.date === key);
    if (!stat || stat.focusSessions === 0) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

interface StatsContextValue {
  stats: DailyStat[];
  todayStat: DailyStat;
  streak: number;
  addFocusSession: (minutes: number) => void;
  addTaskCompleted: () => void;
  addSkippedSession: () => void;
}

const EMPTY_TODAY: DailyStat = { date: todayKey(), focusSessions: 0, focusMinutes: 0, tasksCompleted: 0 };

const StatsContext = createContext<StatsContextValue>({
  stats: [],
  todayStat: EMPTY_TODAY,
  streak: 0,
  addFocusSession: () => {},
  addTaskCompleted: () => {},
  addSkippedSession: () => {},
});

export function StatsProvider({ children }: { children: ReactNode }): ReactElement {
  const [stats, setStatsState] = useState<DailyStat[]>([]);

  useEffect(() => {
    window.electronApi?.getStats()
      .then((s) => { if (s) setStatsState(s); })
      .catch(err => console.error('getStats failed:', err));
  }, []);

  function saveStats(next: DailyStat[]) {
    setStatsState(next);
    window.electronApi?.setStats(next);
  }

  function upsertToday(patch: Partial<Omit<DailyStat, 'date'>>) {
    const key = todayKey();
    const existing = stats.find((s) => s.date === key) ?? { date: key, focusSessions: 0, focusMinutes: 0, tasksCompleted: 0 };
    const updated: DailyStat = {
      ...existing,
      focusSessions: existing.focusSessions + (patch.focusSessions ?? 0),
      focusMinutes: existing.focusMinutes + (patch.focusMinutes ?? 0),
      tasksCompleted: existing.tasksCompleted + (patch.tasksCompleted ?? 0),
      skippedSessions: (existing.skippedSessions ?? 0) + (patch.skippedSessions ?? 0),
    };
    saveStats([...stats.filter((s) => s.date !== key), updated]);
  }

  const addFocusSession = (minutes: number) => {
    upsertToday({ focusSessions: 1, focusMinutes: minutes });
  };

  const addTaskCompleted = () => {
    upsertToday({ tasksCompleted: 1 });
  };

  const addSkippedSession = () => {
    upsertToday({ skippedSessions: 1 });
  };

  const todayStat = stats.find((s) => s.date === todayKey()) ?? { ...EMPTY_TODAY, date: todayKey() };
  const streak = calculateStreak(stats);

  return (
    <StatsContext.Provider value={{ stats, todayStat, streak, addFocusSession, addTaskCompleted, addSkippedSession }}>
      {children}
    </StatsContext.Provider>
  );
}

export const useStats = () => useContext(StatsContext);
