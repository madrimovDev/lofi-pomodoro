import { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipForward, Settings, ClipboardList, Music2, Moon } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { TimerRing } from '@renderer/components/timer-ring';
import { SessionDots } from '@renderer/components/session-dots';
import { SettingsPanel } from '@renderer/components/settings-panel';
import { TaskDisplay } from '@renderer/components/task-display';
import { TaskPanel } from '@renderer/components/task-panel';
import { MusicMiniWidget } from '@renderer/components/music-mini-widget';
import { PresetSelector } from '@renderer/components/preset-selector';
import { useTimerContext } from '@renderer/contexts/timer-context';
import { useSettings } from '@renderer/hooks/use-settings';
import { useAmbient } from '@renderer/hooks/use-ambient';
import { useKeyboardShortcuts } from '@renderer/hooks/use-keyboard-shortcuts';
import { useStats } from '@renderer/hooks/use-stats';
import { winApi } from '@shared/tauri/window';

const MODE_KEY = {
  focus: 'focus',
  'short-break': 'shortBreak',
  'long-break': 'longBreak',
} as const;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

interface MainLayoutProps {
  onToggleMusic: () => void;
  musicOpen: boolean;
  isMiniMode?: boolean;
  onBreakStart?: (mode: 'short-break' | 'long-break') => void;
}

export const MainLayout = ({ onToggleMusic, musicOpen, isMiniMode, onBreakStart }: MainLayoutProps) => {
  const { settings, updateSettings, t } = useSettings();
  const { todayStat } = useStats();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [taskPanelOpen, setTaskPanelOpen] = useState(false);

  // Timer state comes from TimerProvider (in Layout), shared with MiniLayout
  const { timeLeft, isRunning, mode, completedInCycle, progress, toggle, skip } = useTimerContext();

  useAmbient(
    settings.ambientSound,
    settings.ambientVolume,
    isRunning && mode === 'focus',
  );

  useKeyboardShortcuts({
    onToggleTimer: toggle,
    onSkip: skip,
    onToggleMusic,
    onToggleTasks: () => setTaskPanelOpen((o) => !o),
  });

  // A1: Update window title with timer
  useEffect(() => {
    if (isRunning) {
      document.title = `${formatTime(timeLeft)} | ${t(MODE_KEY[mode])} — ZenFocus`;
    } else {
      document.title = 'ZenFocus — Pomodoro';
    }
  }, [timeLeft, isRunning, mode, t]);

  // C3: Trigger break screen when entering a break mode
  const prevModeRef = useRef(mode);
  useEffect(() => {
    if (prevModeRef.current === 'focus' && (mode === 'short-break' || mode === 'long-break')) {
      onBreakStart?.(mode);
    }
    prevModeRef.current = mode;
  }, [mode, onBreakStart]);

  useEffect(() => {
    document.documentElement.setAttribute('data-timer-mode', mode);
  }, [mode]);

  useEffect(() => {
    Notification.requestPermission();
  }, []);

  // A2: Sync always-on-top from settings (skip in mini mode — it forces its own pin)
  useEffect(() => {
    if (!isMiniMode) {
      winApi.setAlwaysOnTop(settings.alwaysOnTop).catch(err => console.error('setAlwaysOnTop failed:', err));
    }
  }, [settings.alwaysOnTop, isMiniMode]);

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="glass px-16 py-12 flex flex-col items-center gap-6 w-[340px]">

        <PresetSelector />

        <span className="uppercase tracking-[0.3em] text-xs text-muted-foreground transition-colors duration-[600ms] select-none">
          {t(MODE_KEY[mode])}
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
          <Button
            variant={settings.focusMode ? 'outline' : 'ghost'}
            size="icon-sm"
            onClick={() => updateSettings({ focusMode: !settings.focusMode })}
            aria-label="Focus mode"
            title={settings.focusMode ? 'Focus mode: yoqiq' : 'Focus mode: o\'chiq'}
          >
            <Moon className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => setSettingsOpen(true)} aria-label="Sozlamalar">
            <Settings className="size-4" />
          </Button>
        </div>

        <SessionDots completed={completedInCycle} total={settings.sessionsBeforeLongBreak} />

        {settings.dailyGoal > 0 && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/40 select-none">
            <span className="tabular-nums">{todayStat.focusSessions}/{settings.dailyGoal}</span>
            <span>🎯</span>
            {todayStat.focusSessions >= settings.dailyGoal && (
              <span className="text-primary/70">{t('goalReached')}</span>
            )}
          </div>
        )}

        <MusicMiniWidget onOpenDrawer={onToggleMusic} />

      </div>

      <SettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} />
      <TaskPanel open={taskPanelOpen} onOpenChange={setTaskPanelOpen} />
    </div>
  );
};
