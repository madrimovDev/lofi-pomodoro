import { useState, useEffect } from 'react';
import { Play, Pause, Maximize2, SkipForward } from 'lucide-react';
import { WindowControl } from '@renderer/components/window-control';
import { MusicSidePanel } from '@renderer/components/music-side-panel';
import { StatsPanel } from '@renderer/components/stats-panel';
import { BreakScreen } from '@renderer/components/break-screen';
import { MainLayout } from './main';
import { TimerProvider, useTimerContext } from '@renderer/contexts/timer-context';
import type { TimerMode } from '@renderer/hooks/use-timer';
import { useSettings } from '@renderer/hooks/use-settings';
import { useStats } from '@renderer/hooks/use-stats';
import { useTasks } from '@renderer/hooks/use-tasks';
import { useMusic } from '@renderer/hooks/use-music';
import { useTraySync } from '@renderer/hooks/use-tray-sync';
import { Button } from '@shared/components/ui/button';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const MINI_MODE_LABELS: Record<string, string> = {
  focus: 'Fokus',
  'short-break': 'Tanaffus',
  'long-break': 'Uzoq tanaffus',
};

// MiniLayout reads timer state from the TimerContext provided by MainLayout
// (which is kept mounted but hidden). This prevents timer resets on mode switch.
// OKLCH hue values per mode
const MODE_HUES: Record<string, number> = { focus: 120, 'short-break': 185, 'long-break': 285 };

function MiniLayout({ sessionsBeforeLongBreak }: { sessionsBeforeLongBreak: number }) {
  const { timeLeft, isRunning, mode, completedInCycle, progress, toggle, skip } = useTimerContext();
  const { source, files, currentFileIndex, ytStreamInfo, currentRadio } = useMusic();
  const { activeTask } = useTasks();

  const trackName =
    source === 'folder'
      ? (files[currentFileIndex]?.name.replace(/\.[^.]+$/, '') ?? null)
      : source === 'radio'
        ? (currentRadio?.name ?? null)
        : (ytStreamInfo?.title ?? null);

  const activeTaskName = activeTask?.name ?? null;

  const exitMini = () => window.electronApi?.setMiniMode(false);

  // ── Aurora gradient: anticipates the next mode color ──────────────────────
  const currentHue = MODE_HUES[mode] ?? 120;
  const nextModeIsLong = mode === 'focus' && completedInCycle === sessionsBeforeLongBreak - 1;
  const nextHue = mode === 'focus' ? (nextModeIsLong ? 285 : 185) : 120;

  // Primary t: cubic ease-in starting at 60% — dramatic buildup near end
  const EASE_START = 0.60;
  const rawT = progress < EASE_START ? 0 : (progress - EASE_START) / (1 - EASE_START);
  const t = rawT * rawT * rawT;

  // Text tint t: quadratic ease starting at 70%
  const rawTText = progress < 0.70 ? 0 : (progress - 0.70) / 0.30;
  const tText = rawTText * rawTText;

  const blendedHue = currentHue + (nextHue - currentHue) * t;

  // 1. First aurora layer — right side, next mode color, breathing
  const ambientStyle: React.CSSProperties = {
    background: `radial-gradient(ellipse 85% 135% at 115% 50%, oklch(0.67 0.10 ${blendedHue} / ${(t * 0.08).toFixed(3)}) 0%, transparent 62%)`,
    animation: `mini-aurora-breath ${mode === 'focus' ? '3.5s' : '5s'} ease-in-out infinite`,
    animationPlayState: isRunning && t > 0 ? 'running' : 'paused',
    transformOrigin: 'right center',
  };

  // 2. Second aurora layer — bottom-left, current mode color (subtle base presence)
  const aurora2Style: React.CSSProperties = {
    background: `radial-gradient(ellipse 65% 85% at -10% 90%, oklch(0.67 0.09 ${currentHue} / ${(progress * 0.022 + t * 0.018).toFixed(3)}) 0%, transparent 58%)`,
    animation: `mini-aurora-breath ${mode === 'focus' ? '4.5s' : '6.5s'} ease-in-out infinite reverse`,
    animationPlayState: isRunning ? 'running' : 'paused',
    transformOrigin: 'left bottom',
  };

  // 3. Progress bar fill — comet (sharply bright at tip)
  const fillStyle: React.CSSProperties = {
    width: `${progress * 100}%`,
    background: progress > 0.01
      ? `linear-gradient(90deg, oklch(0.66 0.09 ${currentHue} / 0.52) 0%, oklch(0.66 0.09 ${blendedHue} / 0.65) 74%, oklch(0.84 0.14 ${blendedHue} / 0.92) 100%)`
      : undefined,
  };

  // 4. Glowing tip dot — intensifies with t
  const tipGlow = t > 0 ? 4 + t * 9 : 3;
  const tipStyle: React.CSSProperties = {
    background: `oklch(0.78 0.12 ${blendedHue})`,
    boxShadow: `0 0 ${tipGlow.toFixed(1)}px ${(tipGlow * 0.5).toFixed(1)}px oklch(0.67 0.10 ${blendedHue} / ${(0.55 + t * 0.40).toFixed(2)})`,
  };

  // 5. Border glow — inset shadow grows with t
  const borderGlow = t * 10;
  const borderGlowStyle: React.CSSProperties = {
    boxShadow: t > 0
      ? `inset 0 0 ${borderGlow.toFixed(1)}px ${(borderGlow * 0.35).toFixed(1)}px oklch(0.67 0.10 ${blendedHue} / ${(t * 0.22).toFixed(3)})`
      : undefined,
  };

  // 6. Timer text — color-mix toward next mode (theme-aware via CSS variable)
  const timerTextStyle: React.CSSProperties = tText > 0 ? {
    color: `color-mix(in oklch, var(--color-foreground) ${(100 - tText * 22).toFixed(1)}%, oklch(0.67 0.10 ${blendedHue}) ${(tText * 22).toFixed(1)}%)`,
  } : {};
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div
      className="h-full w-full flex flex-col select-none overflow-hidden relative"
      style={{ WebkitAppRegion: 'drag', ...borderGlowStyle } as React.CSSProperties}
    >
      {/* Aurora layer 1 — right side, next mode color, breathing */}
      <div className="absolute inset-0 pointer-events-none" style={ambientStyle} />
      {/* Aurora layer 2 — bottom-left, current mode color, reverse breathing */}
      <div className="absolute inset-0 pointer-events-none" style={aurora2Style} />
      {/* Main row */}
      <div className="flex-1 flex items-center px-3 gap-2 min-h-0">

        {/* Mode color dot */}
        <div className="size-1.5 rounded-full bg-primary shrink-0 opacity-75 transition-colors duration-500" />

        {/* Timer */}
        <span
          className="text-2xl font-extralight tabular-nums tracking-tight leading-none shrink-0 transition-colors duration-500"
          style={{ WebkitAppRegion: 'no-drag', ...timerTextStyle } as React.CSSProperties}
        >
          {formatTime(timeLeft)}
        </span>

        {/* Mode label */}
        <span
          className="text-[10px] text-muted-foreground/40 uppercase tracking-widest leading-none shrink-0 hidden min-[260px]:block"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {MINI_MODE_LABELS[mode]}
        </span>

        {/* Active task or track name (fills remaining space; task takes priority) */}
        <div
          className="flex-1 min-w-0 overflow-hidden"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {activeTaskName ? (
            <span className="block text-[10px] text-muted-foreground/35 truncate leading-none">
              ✓ {activeTaskName}
            </span>
          ) : trackName ? (
            <span className="block text-[10px] text-muted-foreground/35 truncate leading-none">
              ♪ {trackName}
            </span>
          ) : null}
        </div>

        {/* Session dots */}
        <div
          className="flex items-center gap-[3px] shrink-0 hidden min-[300px]:flex"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {Array.from({ length: sessionsBeforeLongBreak }, (_, i) => {
            const isNextDot = i === completedInCycle && t > 0.5;
            const dotT = isNextDot ? (t - 0.5) * 2 : 0;
            return (
              <div
                key={i}
                className={`size-1 rounded-full transition-colors duration-300 ${
                  i < completedInCycle ? 'bg-primary/80' : 'bg-border/60'
                }`}
                style={isNextDot ? {
                  boxShadow: `0 0 ${(dotT * 5).toFixed(1)}px ${(dotT * 2).toFixed(1)}px oklch(0.67 0.10 ${nextHue} / ${(dotT * 0.75).toFixed(2)})`,
                  opacity: 0.35 + dotT * 0.65,
                } : undefined}
              />
            );
          })}
        </div>

        {/* Controls */}
        <div
          className="flex items-center gap-0.5 shrink-0"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={toggle}
            aria-label={isRunning ? 'Pause' : 'Play'}
          >
            {isRunning
              ? <Pause className="size-3.5" />
              : <Play className="size-3.5 translate-x-px" />
            }
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={skip}
            aria-label="Skip"
            title="Keyingiga o'tish"
            className="hidden min-[280px]:flex"
          >
            <SkipForward className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={exitMini}
            aria-label="Normal rejimga qaytish"
            title="Normal rejimga qaytish"
          >
            <Maximize2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-[2px] w-full bg-border/25 shrink-0 relative">
        <div
          className="h-full transition-[width] duration-1000 ease-linear"
          style={fillStyle}
        />
        {/* Glowing tip — glow intensifies as session nears end */}
        {progress > 0.02 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 size-[5px] rounded-full pointer-events-none"
            style={{ left: `calc(${progress * 100}% - 2.5px)`, ...tipStyle }}
          />
        )}
      </div>
    </div>
  );
}

// Inner component that has access to TimerContext
function LayoutInner() {
  const [musicOpen, setMusicOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [isMiniMode, setIsMiniMode] = useState(false);
  const [showBreak, setShowBreak] = useState(false);
  const [currentBreakMode, setCurrentBreakMode] = useState<'short-break' | 'long-break' | null>(null);
  const { settings } = useSettings();

  useEffect(() => {
    return window.electronApi?.onMiniModeChanged((enabled) => {
      setIsMiniMode(enabled);
    });
  }, []);

  const { timeLeft, isRunning, mode, toggle, skip } = useTimerContext();
  useTraySync({ timeLeft, mode, isRunning, toggle, skip });

  // Auto-close break screen when focus resumes (handles autoStartFocus case)
  useEffect(() => {
    if (mode === 'focus') setShowBreak(false);
  }, [mode]);

  const handleBreakStart = (breakMode: 'short-break' | 'long-break') => {
    if (settings.showBreakScreen) {
      setCurrentBreakMode(breakMode);
      setShowBreak(true);
    }
  };

  return (
    <>
      {/* MiniLayout reads from TimerProvider via useTimerContext */}
      {isMiniMode && (
        <MiniLayout sessionsBeforeLongBreak={settings.sessionsBeforeLongBreak} />
      )}

      {/* MainLayout is ALWAYS mounted so its effects (ambient, shortcuts, title) keep running.
          Hidden visually in mini mode. */}
      <div className={`h-full flex flex-col ${isMiniMode ? 'hidden' : ''}`}>
        <WindowControl onOpenStats={() => setStatsOpen(true)} />
        <main className="flex-1 flex pt-10 min-h-0 overflow-hidden relative">
          <MainLayout
            onToggleMusic={() => setMusicOpen((o) => !o)}
            musicOpen={musicOpen}
            isMiniMode={isMiniMode}
            onBreakStart={isMiniMode ? undefined : handleBreakStart}
          />
          <MusicSidePanel open={musicOpen} onOpenChange={setMusicOpen} />
          {showBreak && currentBreakMode && (
            <BreakScreen onSkip={() => setShowBreak(false)} timeLeft={timeLeft} />
          )}
        </main>
        <StatsPanel open={statsOpen} onOpenChange={setStatsOpen} />
      </div>
    </>
  );
}

export const Layout = () => {
  const { settings, t } = useSettings();
  const { addFocusSession, addSkippedSession } = useStats();
  const { activeTaskId, incrementPomodoro } = useTasks();

  const timerConfig = {
    focusDuration: settings.focusDuration,
    shortBreakDuration: settings.shortBreakDuration,
    longBreakDuration: settings.longBreakDuration,
    sessionsBeforeLongBreak: settings.sessionsBeforeLongBreak,
    autoStartBreaks: settings.autoStartBreaks,
    autoStartFocus: settings.autoStartFocus,
  };

  const handleSessionComplete = (completedMode: TimerMode) => {
    if (settings.soundEnabled) {
      const soundSrc = settings.notificationSoundPath
        ? `localfile://${settings.notificationSoundPath}`
        : '/bell.mp3';
      new Audio(soundSrc).play().catch(() => {});
    }
    if (settings.notificationsEnabled && !settings.focusMode && Notification.permission === 'granted') {
      const isFocus = completedMode === 'focus';
      new Notification(isFocus ? t('focusDone') : t('breakDone'), {
        body: isFocus ? t('focusDoneBody') : t('breakDoneBody'),
      });
    }
    if (completedMode === 'focus') {
      addFocusSession(settings.focusDuration);
      if (activeTaskId) incrementPomodoro(activeTaskId);
    }
  };

  const handleSkip = (skippedMode: TimerMode) => {
    if (skippedMode === 'focus') addSkippedSession();
  };

  return (
    <TimerProvider config={timerConfig} onSessionComplete={handleSessionComplete} onSkip={handleSkip}>
      <LayoutInner />
    </TimerProvider>
  );
};
