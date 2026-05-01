import { Dialog } from 'radix-ui';
import { X, BarChart2 } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { useStats } from '@renderer/hooks/use-stats';
import { useSettings } from '@renderer/hooks/use-settings';
import type { DailyStat } from '@shared/types';

interface StatsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DAY_LABELS = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];

function getLast7Days(): { date: string; label: string }[] {
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    result.push({
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      label: DAY_LABELS[d.getDay()],
    });
  }
  return result;
}

function WeekBar({ days, stats }: { days: { date: string; label: string }[]; stats: DailyStat[] }) {
  const maxSessions = Math.max(...days.map((d) => stats.find((s) => s.date === d.date)?.focusSessions ?? 0), 1);

  return (
    <div className="flex items-end gap-1.5 h-16">
      {days.map(({ date, label }) => {
        const stat = stats.find((s) => s.date === date);
        const sessions = stat?.focusSessions ?? 0;
        const heightPct = sessions === 0 ? 0 : Math.max(8, Math.round((sessions / maxSessions) * 100));
        const td = new Date();
        const todayStr = `${td.getFullYear()}-${String(td.getMonth() + 1).padStart(2, '0')}-${String(td.getDate()).padStart(2, '0')}`;
        const isToday = date === todayStr;

        return (
          <div key={date} className="flex flex-col items-center gap-1 flex-1">
            <div className="w-full flex items-end justify-center" style={{ height: '48px' }}>
              <div
                className={`w-full rounded-t-sm transition-all duration-500 ${
                  isToday ? 'bg-primary/60' : 'bg-primary/25'
                }`}
                style={{ height: sessions === 0 ? '2px' : `${heightPct}%` }}
              />
            </div>
            <span className={`text-[9px] select-none ${isToday ? 'text-primary/80' : 'text-muted-foreground/40'}`}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function StatsPanel({ open, onOpenChange }: StatsPanelProps) {
  const { stats, todayStat, streak } = useStats();
  const { settings, t } = useSettings();
  const last7Days = getLast7Days();

  const totalSessions = stats.reduce((s, d) => s + d.focusSessions, 0);
  const totalHours = stats.reduce((s, d) => s + d.focusMinutes, 0) / 60;
  const totalTasks = stats.reduce((s, d) => s + d.tasksCompleted, 0);

  const weekSessions = last7Days.reduce(
    (s, d) => s + (stats.find((st) => st.date === d.date)?.focusSessions ?? 0),
    0,
  );

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
              <Button variant="ghost" size="icon-xs" aria-label="Yopish">
                <X className="size-3.5" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="flex flex-col gap-5">
            {/* Streak */}
            {streak > 0 && (
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-base">🔥</span>
                <span className="text-sm font-light text-foreground/80 tabular-nums">{streak}</span>
                <span className="text-xs text-muted-foreground/50">{t('streak')}</span>
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
                  {todayStat.skippedSessions} ta sessiya o'tkazib yuborildi
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
              <WeekBar days={last7Days} stats={stats} />
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
