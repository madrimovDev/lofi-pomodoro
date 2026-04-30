import { useEffect, useState } from 'react';
import { Play, Pause, SkipForward, Settings, ClipboardList, Music2 } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { TimerRing } from '@renderer/components/timer-ring';
import { SessionDots } from '@renderer/components/session-dots';
import { SettingsPanel } from '@renderer/components/settings-panel';
import { TaskDisplay } from '@renderer/components/task-display';
import { TaskPanel } from '@renderer/components/task-panel';
import { useTimer } from '@renderer/hooks/use-timer';
import { useSettings } from '@renderer/hooks/use-settings';
import { useTasks } from '@renderer/hooks/use-tasks';
import { useAmbient } from '@renderer/hooks/use-ambient';

const MODE_LABELS = {
  focus: 'FOCUS',
  'short-break': 'SHORT BREAK',
  'long-break': 'LONG BREAK',
} as const;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

interface MainLayoutProps {
  onToggleMusic: () => void;
  musicOpen: boolean;
}

export const MainLayout = ({ onToggleMusic, musicOpen }: MainLayoutProps) => {
  const { settings } = useSettings();
  const { incrementPomodoro, activeTaskId } = useTasks();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [taskPanelOpen, setTaskPanelOpen] = useState(false);

  const { timeLeft, isRunning, mode, completedInCycle, progress, toggle, skip } = useTimer(
    {
      focusDuration: settings.focusDuration,
      shortBreakDuration: settings.shortBreakDuration,
      longBreakDuration: settings.longBreakDuration,
      sessionsBeforeLongBreak: settings.sessionsBeforeLongBreak,
    },
    (completedMode) => {
      if (settings.soundEnabled) {
        new Audio('/bell.mp3').play().catch(() => {});
      }
      if (settings.notificationsEnabled && Notification.permission === 'granted') {
        const isFocus = completedMode === 'focus';
        new Notification(isFocus ? 'Focus tugadi!' : 'Dam olish tugadi!', {
          body: isFocus ? 'Dam olish vaqti keldi.' : 'Ishlash vaqti keldi.',
        });
      }
      if (completedMode === 'focus' && activeTaskId) {
        incrementPomodoro(activeTaskId);
      }
    },
  );

  useAmbient(
    settings.ambientSound,
    settings.ambientVolume,
    isRunning && mode === 'focus',
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-timer-mode', mode);
  }, [mode]);

  useEffect(() => {
    Notification.requestPermission();
  }, []);

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="glass px-16 py-12 flex flex-col items-center gap-6">

        <span className="uppercase tracking-[0.3em] text-xs text-muted-foreground transition-colors duration-[600ms] select-none">
          {MODE_LABELS[mode]}
        </span>

        <TimerRing progress={progress} isRunning={isRunning} mode={mode}>
          <span className="text-7xl font-extralight tabular-nums tracking-tight leading-none select-none transition-colors duration-[600ms]">
            {formatTime(timeLeft)}
          </span>
        </TimerRing>

        <TaskDisplay onOpenPanel={() => setTaskPanelOpen(true)} />

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="size-12 rounded-full"
            onClick={toggle}
            aria-label={isRunning ? 'Pause' : 'Start'}
          >
            {isRunning
              ? <Pause className="size-5" />
              : <Play className="size-5 translate-x-0.5" />
            }
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={skip} aria-label="Skip">
            <SkipForward className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => setTaskPanelOpen(true)} aria-label="Ishlar">
            <ClipboardList className="size-4" />
          </Button>
          <Button
            variant={musicOpen ? 'outline' : 'ghost'}
            size="icon-sm"
            onClick={onToggleMusic}
            aria-label="Musiqa"
          >
            <Music2 className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => setSettingsOpen(true)} aria-label="Sozlamalar">
            <Settings className="size-4" />
          </Button>
        </div>

        <SessionDots completed={completedInCycle} total={settings.sessionsBeforeLongBreak} />

      </div>

      <SettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} />
      <TaskPanel open={taskPanelOpen} onOpenChange={setTaskPanelOpen} />
    </div>
  );
};
