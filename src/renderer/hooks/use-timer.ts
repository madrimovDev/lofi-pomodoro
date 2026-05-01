import { useState, useEffect, useRef } from 'react';

export type TimerMode = 'focus' | 'short-break' | 'long-break';

export interface TimerConfig {
  focusDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
  autoStartBreaks?: boolean;
  autoStartFocus?: boolean;
}

interface TimerState {
  timeLeft: number;
  isRunning: boolean;
  mode: TimerMode;
  completedInCycle: number;
}

function buildDurations(config: TimerConfig): Record<TimerMode, number> {
  return {
    focus: config.focusDuration * 60,
    'short-break': config.shortBreakDuration * 60,
    'long-break': config.longBreakDuration * 60,
  };
}

const TIMER_STORAGE_KEY = 'zen-timer-state';
const RESTORE_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours

export function useTimer(
  config: TimerConfig,
  onSessionComplete?: (completedMode: TimerMode) => void,
  onSkip?: (skippedMode: TimerMode) => void,
) {
  const durations = buildDurations(config);

  const [state, setState] = useState<TimerState>(() => {
    try {
      const raw = localStorage.getItem(TIMER_STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.savedAt && Date.now() - s.savedAt < RESTORE_WINDOW_MS) {
          return { timeLeft: s.timeLeft, isRunning: false, mode: s.mode as TimerMode, completedInCycle: s.completedInCycle };
        }
      }
    } catch { /* ignore */ }
    return { timeLeft: durations.focus, isRunning: false, mode: 'focus' as TimerMode, completedInCycle: 0 };
  });

  const prevModeRef = useRef<TimerMode>(state.mode);
  const onSessionCompleteRef = useRef(onSessionComplete);
  onSessionCompleteRef.current = onSessionComplete;
  const onSkipRef = useRef(onSkip);
  onSkipRef.current = onSkip;
  // Tracks whether the last mode transition was a manual skip (not a natural completion)
  const skipRef = useRef(false);

  // Persist timer state to localStorage on every meaningful change
  useEffect(() => {
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify({
      timeLeft: state.timeLeft,
      mode: state.mode,
      completedInCycle: state.completedInCycle,
      isRunning: false,
      savedAt: Date.now(),
    }));
  }, [state.timeLeft, state.mode, state.completedInCycle]);

  // Detect mode transition and fire callback (skip does NOT count as a completed session)
  useEffect(() => {
    if (state.mode !== prevModeRef.current) {
      if (skipRef.current) {
        onSkipRef.current?.(prevModeRef.current);
      } else {
        onSessionCompleteRef.current?.(prevModeRef.current);
      }
      skipRef.current = false;
      prevModeRef.current = state.mode;
    }
  }, [state.mode]);

  // Update timeLeft when duration config changes (only if not running).
  // Preserves the current mode and session count — only adjusts the remaining time
  // so that pausing on a break and changing settings doesn't jump back to focus.
  useEffect(() => {
    setState(prev => {
      if (prev.isRunning) return prev;
      const durations = buildDurations(config);
      return { ...prev, timeLeft: durations[prev.mode] };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.focusDuration, config.shortBreakDuration, config.longBreakDuration]);

  // Date.now()-based interval — eliminates setInterval drift accumulation
  useEffect(() => {
    if (!state.isRunning) return;
    const startAt = Date.now();
    const startTimeLeft = state.timeLeft;
    const id = setInterval(() => {
      const elapsed = Math.round((Date.now() - startAt) / 1000);
      const newTimeLeft = startTimeLeft - elapsed;
      setState(prev => {
        if (!prev.isRunning) return prev;
        if (newTimeLeft <= 0) return nextState(prev, config);
        return newTimeLeft === prev.timeLeft ? prev : { ...prev, timeLeft: newTimeLeft };
      });
    }, 500);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isRunning, config.focusDuration, config.shortBreakDuration, config.longBreakDuration, config.sessionsBeforeLongBreak]);

  const toggle = () => setState(prev => ({ ...prev, isRunning: !prev.isRunning }));
  const skip = () => {
    skipRef.current = true;
    setState(prev => ({ ...nextState(prev, config), isRunning: false }));
  };

  const progress = 1 - state.timeLeft / durations[state.mode];

  return { ...state, progress, toggle, skip };
}

function nextState(prev: TimerState, config: TimerConfig): TimerState {
  const durations = buildDurations(config);

  if (prev.mode === 'focus') {
    const completed = prev.completedInCycle + 1;
    const shouldAutoStart = config.autoStartBreaks ?? false;
    if (completed >= config.sessionsBeforeLongBreak) {
      return { timeLeft: durations['long-break'], isRunning: shouldAutoStart, mode: 'long-break', completedInCycle: completed };
    }
    return { timeLeft: durations['short-break'], isRunning: shouldAutoStart, mode: 'short-break', completedInCycle: completed };
  }

  const completedInCycle = prev.mode === 'long-break' ? 0 : prev.completedInCycle;
  const shouldAutoStart = config.autoStartFocus ?? false;
  return { timeLeft: durations.focus, isRunning: shouldAutoStart, mode: 'focus', completedInCycle };
}
