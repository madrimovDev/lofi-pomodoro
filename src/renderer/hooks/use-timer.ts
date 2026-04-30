import { useState, useEffect, useRef } from 'react';

export type TimerMode = 'focus' | 'short-break' | 'long-break';

export interface TimerConfig {
  focusDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
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

export function useTimer(config: TimerConfig, onSessionComplete?: (completedMode: TimerMode) => void) {
  const durations = buildDurations(config);

  const [state, setState] = useState<TimerState>({
    timeLeft: durations.focus,
    isRunning: false,
    mode: 'focus',
    completedInCycle: 0,
  });

  const prevModeRef = useRef<TimerMode>('focus');
  const onSessionCompleteRef = useRef(onSessionComplete);
  onSessionCompleteRef.current = onSessionComplete;

  // Detect mode transition and fire callback
  useEffect(() => {
    if (state.mode !== prevModeRef.current) {
      onSessionCompleteRef.current?.(prevModeRef.current);
      prevModeRef.current = state.mode;
    }
  }, [state.mode]);

  // Reset timer when config changes (only if not running)
  useEffect(() => {
    setState(prev => {
      if (prev.isRunning) return prev;
      return {
        timeLeft: config.focusDuration * 60,
        isRunning: false,
        mode: 'focus',
        completedInCycle: 0,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.focusDuration, config.shortBreakDuration, config.longBreakDuration, config.sessionsBeforeLongBreak]);

  useEffect(() => {
    if (!state.isRunning) return;
    const id = setInterval(() => {
      setState(prev => {
        if (prev.timeLeft <= 1) return nextState(prev, config);
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isRunning, config.focusDuration, config.shortBreakDuration, config.longBreakDuration, config.sessionsBeforeLongBreak]);

  const toggle = () => setState(prev => ({ ...prev, isRunning: !prev.isRunning }));
  const skip = () => setState(prev => ({ ...nextState(prev, config), isRunning: false }));

  const progress = 1 - state.timeLeft / durations[state.mode];

  return { ...state, progress, toggle, skip };
}

function nextState(prev: TimerState, config: TimerConfig): TimerState {
  const durations = buildDurations(config);

  if (prev.mode === 'focus') {
    const completed = prev.completedInCycle + 1;
    if (completed >= config.sessionsBeforeLongBreak) {
      return { timeLeft: durations['long-break'], isRunning: true, mode: 'long-break', completedInCycle: completed };
    }
    return { timeLeft: durations['short-break'], isRunning: true, mode: 'short-break', completedInCycle: completed };
  }

  const completedInCycle = prev.mode === 'long-break' ? 0 : prev.completedInCycle;
  return { timeLeft: durations.focus, isRunning: true, mode: 'focus', completedInCycle };
}
