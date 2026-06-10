import { Dialog } from 'radix-ui';
import { X, BarChart2 } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { useStats } from '@renderer/hooks/use-stats';
import { useSettings } from '@renderer/hooks/use-settings';
import { dateKey } from '@shared/lib/date';
import { formatWeekdayShort, formatMonthShort, formatDateShort } from '@shared/lib/format';
import type { Locale } from '@shared/i18n';
import type { DailyStat } from '@shared/types';
import { STREAK_MILESTONES } from '@shared/types';

interface StatsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getLast7Days(locale: Locale): { date: string; label: string; d: Date }[] {
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    result.push({ date: dateKey(d), label: formatWeekdayShort(locale, d), d });
  }
  return result;
}

function getLast6Months(locale: Locale): { prefix: string; label: string }[] {
  const out = [];
  const base = new Date(); base.setDate(1);
  for (let i = 5; i >= 0; i--) {
    const m = new Date(base); m.setMonth(base.getMonth() - i);
    out.push({ prefix: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`, label: formatMonthShort(locale, m) });
  }
  return out;
}

function WeekBar({ days, stats, locale }: { days: { date: string; label: string; d: Date }[]; stats: DailyStat[]; locale: Locale }) {
  const maxSessions = Math.max(...days.map((d) => stats.find((s) => s.date === d.date)?.focusSessions ?? 0), 1);

  return (
    <div className="flex items-end gap-1.5 h-16">
      {days.map((day) => {
        const stat = stats.find((s) => s.date === day.date);
        const sessions = stat?.focusSessions ?? 0;
        const heightPct = sessions === 0 ? 0 : Math.max(8, Math.round((sessions / maxSessions) * 100));
        const isToday = day.date === dateKey(new Date());

        return (
          <div key={day.date} className="flex flex-col items-center gap-1 flex-1" title={`${formatDateShort(locale, day.d)} — ${sessions}`}>
            <div className="w-full flex items-end justify-center" style={{ height: '48px' }}>
              <div
                className={`w-full rounded-t-sm transition-all duration-500 ${
                  isToday ? 'bg-primary/60' : 'bg-primary/25'
                }`}
                style={{ height: sessions === 0 ? '2px' : `${heightPct}%` }}
              />
            </div>
            <span className={`text-[9px] select-none ${isToday ? 'text-primary/80' : 'text-muted-foreground/40'}`}>
              {day.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MonthBar({ months, stats }: { months: { prefix: string; label: string }[]; stats: DailyStat[] }) {
  const sums = months.map(m => stats.filter(s => s.date.startsWith(m.prefix)).reduce((a, s) => a + s.focusSessions, 0));
  const max = Math.max(...sums, 1);
  return (
    <div className="flex items-end gap-1.5 h-16">
      {months.map((m, i) => {
        const sessions = sums[i];
        const heightPct = sessions === 0 ? 0 : Math.max(8, Math.round((sessions / max) * 100));
        return (
          <div key={m.prefix} className="flex flex-col items-center gap-1 flex-1" title={`${m.label} — ${sessions}`}>
            <div className="w-full flex items-end justify-center" style={{ height: '48px' }}>
              <div className="w-full rounded-t-sm bg-primary/25 transition-all duration-500" style={{ height: sessions === 0 ? '2px' : `${heightPct}%` }} />
            </div>
            <span className="text-[9px] select-none text-muted-foreground/40">{m.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function StatsPanel({ open, onOpenChange }: StatsPanelProps) {
  const { stats, todayStat, streak, record } = useStats();
  const { settings, t } = useSettings();
  const last7Days = getLast7Days(settings.locale);

  const totalSessions = stats.reduce((s, d) => s + d.focusSessions, 0);
  const totalHours = stats.reduce((s, d) => s + d.focusMinutes, 0) / 60;
  const totalTasks = stats.reduce((s, d) => s + d.tasksCompleted, 0);

  const weekSessions = last7Days.reduce(
    (s, d) => s + (stats.find((st) => st.date === d.date)?.focusSessions ?? 0),
    0,
  );

  const todayK = dateKey(new Date());
  const monthSessions = stats.filter(s => s.date.startsWith(todayK.slice(0, 7))).reduce((a, s) => a + s.focusSessions, 0);
  const yearSessions = stats.filter(s => s.date.startsWith(todayK.slice(0, 4))).reduce((a, s) => a + s.focusSessions, 0);
  const last6 = getLast6Months(settings.locale);
  const earnedMilestones = STREAK_MILESTONES.filter(m => streak >= m);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 glass w-80 rounded-2xl p-6 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <BarChart2 className="size-3.5 text-muted-foreground/60" />
              <Dialog.Title className="text-sm font-medium tracking-widest uppercase text-muted-foreground">
                {t('statistics')}
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon-xs" aria-label={t('close')}>
                <X className="size-3.5" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="flex flex-col gap-5">
            {/* Streak */}
            {streak > 0 && (
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-base">🔥</span>
                  <span className="text-sm font-light text-foreground/80 tabular-nums">{streak}</span>
                  <span className="text-xs text-muted-foreground/50">{t('streakDay', { count: streak })}</span>
                </div>
                {earnedMilestones.length > 0 && (
                  <div className="flex items-center justify-center gap-1.5 flex-wrap">
                    {earnedMilestones.map(m => (
                      <span key={m} className="text-[10px] rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 tabular-nums text-primary/80">🏅 {m}</span>
                    ))}
                  </div>
                )}
                {record > 0 && (
                  <p className="text-[10px] text-center text-muted-foreground/40">🏆 {t('bestStreak')}: <span className="tabular-nums">{record}</span></p>
                )}
              </div>
            )}

            {/* Today */}
            <div className="flex flex-col gap-2">
              <p className="text-xs uppercase tracking-widest text-muted-foreground/60">{t('today')}</p>
              <div className="flex items-center gap-4">
                <StatBadge value={todayStat.focusSessions} label={t('sessionLabel')} />
                <StatBadge value={`${todayStat.focusMinutes}m`} label={t('timeLabel')} />
                <StatBadge value={todayStat.tasksCompleted} label={t('taskLabel')} />
              </div>
              {(todayStat.skippedSessions ?? 0) > 0 && (
                <p className="text-[10px] text-muted-foreground/35 text-center">
                  {t('skippedSessionsCount', { count: todayStat.skippedSessions ?? 0 })}
                </p>
              )}
              {settings.dailyGoal > 0 && (
                <div className="flex flex-col gap-1 mt-1">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground/40">
                    <span>{todayStat.focusSessions} / {settings.dailyGoal} {t('sessionUnit')}</span>
                    {todayStat.focusSessions >= settings.dailyGoal && (
                      <span className="text-primary/70">🎯 {t('goalReached')}</span>
                    )}
                  </div>
                  <div className="h-1 rounded-full bg-border/40 overflow-hidden">
                    <div
                      className="h-full bg-primary/50 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (todayStat.focusSessions / settings.dailyGoal) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="h-px bg-border/50" />

            {/* This week */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-widest text-muted-foreground/60">{t('thisWeek')}</p>
                <span className="text-xs text-muted-foreground/40 tabular-nums">{weekSessions} {t('sessionUnit')}</span>
              </div>
              <WeekBar days={last7Days} stats={stats} locale={settings.locale} />
            </div>

            <div className="h-px bg-border/50" />

            {/* All time */}
            <div className="flex flex-col gap-2">
              <p className="text-xs uppercase tracking-widest text-muted-foreground/60">{t('allTime')}</p>
              <div className="flex items-center gap-4">
                <StatBadge value={totalSessions} label={t('sessionUnit')} />
                <StatBadge value={`${totalHours.toFixed(1)}h`} label={t('sessionLabel')} />
                <StatBadge value={totalTasks} label={t('taskLabel')} />
              </div>
              <div className="flex items-center gap-4">
                <StatBadge value={monthSessions} label={t('thisMonth')} />
                <StatBadge value={yearSessions} label={t('thisYear')} />
              </div>
            </div>

            <div className="h-px bg-border/50" />

            <div className="flex flex-col gap-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground/60">{t('last6Months')}</p>
              <MonthBar months={last6} stats={stats} />
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function StatBadge({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-lg font-light tabular-nums text-foreground">{value}</span>
      <span className="text-[9px] uppercase tracking-widest text-muted-foreground/40">{label}</span>
    </div>
  );
}
