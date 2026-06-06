import { createContext, useContext, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { type DailyStat } from '@shared/types';
import { dateKey } from '@shared/lib/date';

function todayKey(): string {
  return dateKey(new Date());
}

function calculateStreak(stats: DailyStat[]): number {
  let streak = 0;
  const d = new Date();
  while (true) {
    const key = dateKey(d);
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
  // Store'dan dastlabki yuklash tugaguncha persistlashni o'tkazib yuboramiz,
  // aks holda hydration paytida bo'sh massiv saqlangan ma'lumotni o'chirib yuboradi.
  const hydratedRef = useRef(false);

  useEffect(() => {
    window.electronApi?.getStats()
      .then((s) => { if (s) setStatsState(s); })
      .catch(err => console.error('getStats failed:', err))
      .finally(() => { hydratedRef.current = true; });
  }, []);

  // State o'zgarganda persistlash — functional update'lar bilan stale-closure'siz.
  useEffect(() => {
    if (!hydratedRef.current) return;
    window.electronApi?.setStats(stats);
  }, [stats]);

  function upsertToday(patch: Partial<Omit<DailyStat, 'date'>>) {
    const key = todayKey();
    setStatsState((prev) => {
      const existing = prev.find((s) => s.date === key) ?? { date: key, focusSessions: 0, focusMinutes: 0, tasksCompleted: 0 };
      const updated: DailyStat = {
        ...existing,
        focusSessions: existing.focusSessions + (patch.focusSessions ?? 0),
        focusMinutes: existing.focusMinutes + (patch.focusMinutes ?? 0),
        tasksCompleted: existing.tasksCompleted + (patch.tasksCompleted ?? 0),
        skippedSessions: (existing.skippedSessions ?? 0) + (patch.skippedSessions ?? 0),
      };
      return [...prev.filter((s) => s.date !== key), updated];
    });
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
