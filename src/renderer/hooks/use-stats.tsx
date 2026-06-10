import { createContext, useContext, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { type DailyStat } from '@shared/types';
import { dateKey } from '@shared/lib/date';
import { api } from '@shared/tauri/api';
import { useSettings } from '@renderer/hooks/use-settings';

function todayKey(): string {
  return dateKey(new Date());
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Streak ending at endKey, tolerating up to graceDays TOTAL missed days (budget NEVER resets).
// Counts ACTIVE days only. Bounded: terminates within graceDays+1 missed days.
function streakEndingAt(byDate: Map<string, DailyStat>, endKey: string, graceDays: number): number {
  let streak = 0, missed = 0;
  const d = parseKey(endKey);
  while (true) {
    const stat = byDate.get(dateKey(d));
    if (stat && stat.focusSessions > 0) {
      streak++;
    } else {
      missed++;
      if (missed > graceDays) break;
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function calculateStreak(stats: DailyStat[], graceDays: number): number {
  const byDate = new Map(stats.map(s => [s.date, s]));
  return streakEndingAt(byDate, dateKey(new Date()), graceDays);
}

// All-time longest, same grace rule: max over all active stat dates.
function longestStreak(stats: DailyStat[], graceDays: number): number {
  if (stats.length === 0) return 0;
  const byDate = new Map(stats.map(s => [s.date, s]));
  let best = 0;
  for (const s of stats) {
    if (s.focusSessions > 0) best = Math.max(best, streakEndingAt(byDate, s.date, graceDays));
  }
  return best;
}

interface StatsContextValue {
  stats: DailyStat[];
  todayStat: DailyStat;
  streak: number;
  record: number;
  addFocusSession: (minutes: number) => void;
  addTaskCompleted: () => void;
  addSkippedSession: () => void;
  clearStats: () => void;
}

const EMPTY_TODAY: DailyStat = { date: todayKey(), focusSessions: 0, focusMinutes: 0, tasksCompleted: 0 };

const StatsContext = createContext<StatsContextValue>({
  stats: [],
  todayStat: EMPTY_TODAY,
  streak: 0,
  record: 0,
  addFocusSession: () => {},
  addTaskCompleted: () => {},
  addSkippedSession: () => {},
  clearStats: () => {},
});

export function StatsProvider({ children }: { children: ReactNode }): ReactElement {
  const [stats, setStatsState] = useState<DailyStat[]>([]);
  // Store'dan dastlabki yuklash tugaguncha persistlashni o'tkazib yuboramiz,
  // aks holda hydration paytida bo'sh massiv saqlangan ma'lumotni o'chirib yuboradi.
  const hydratedRef = useRef(false);
  const [hydrated, setHydrated] = useState(false);

  const { settings, loaded: settingsLoaded } = useSettings();

  useEffect(() => {
    api.getStats()
      .then((s) => { if (s) setStatsState(s); })
      .catch(err => console.error('getStats failed:', err))
      .finally(() => { hydratedRef.current = true; setHydrated(true); });
  }, []);

  // State o'zgarganda persistlash — functional update'lar bilan stale-closure'siz.
  useEffect(() => {
    if (!hydratedRef.current) return;
    api.setStats(stats).catch(err => console.error('setStats failed:', err));
  }, [stats]);

  // Retention pruning — gated on settingsLoaded to avoid using default before async load.
  useEffect(() => {
    if (!hydrated || !settingsLoaded) return;
    const days = settings.statsRetentionDays ?? 365;
    if (days <= 0) return; // 0 = keep all
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffKey = dateKey(cutoff);
    setStatsState(prev => {
      const pruned = prev.filter(s => s.date >= cutoffKey); // lexicographic = chronological for YYYY-MM-DD
      return pruned.length === prev.length ? prev : pruned;  // idempotent; avoid needless persist
    });
  }, [hydrated, settingsLoaded, settings.statsRetentionDays]);

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
  const graceDays = settings.streakGraceDays ?? 1;
  const streak = calculateStreak(stats, graceDays);
  const record = longestStreak(stats, graceDays);

  const clearStats = () => setStatsState([]);

  return (
    <StatsContext.Provider value={{ stats, todayStat, streak, record, addFocusSession, addTaskCompleted, addSkippedSession, clearStats }}>
      {children}
    </StatsContext.Provider>
  );
}

export const useStats = () => useContext(StatsContext);
