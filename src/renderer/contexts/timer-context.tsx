import { createContext, useContext, useRef, type ReactNode } from 'react';
import { useTimer, type TimerMode, type TimerConfig } from '@renderer/hooks/use-timer';

export interface TimerContextValue {
  timeLeft: number;
  isRunning: boolean;
  mode: TimerMode;
  completedInCycle: number;
  progress: number;
  toggle: () => void;
  skip: () => void;
}

export const TimerContext = createContext<TimerContextValue>({
  timeLeft: 0,
  isRunning: false,
  mode: 'focus',
  completedInCycle: 0,
  progress: 0,
  toggle: () => {},
  skip: () => {},
});

export const useTimerContext = () => useContext(TimerContext);

interface TimerProviderProps {
  config: TimerConfig;
  onSessionComplete?: (mode: TimerMode) => void;
  onSkip?: (mode: TimerMode) => void;
  children: ReactNode;
}

export function TimerProvider({ config, onSessionComplete, onSkip, children }: TimerProviderProps) {
  // Keep callbacks in refs so stale closures never capture outdated values
  const onCompleteRef = useRef(onSessionComplete);
  onCompleteRef.current = onSessionComplete;
  const onSkipRef = useRef(onSkip);
  onSkipRef.current = onSkip;

  const timer = useTimer(
    config,
    (mode) => onCompleteRef.current?.(mode),
    (mode) => onSkipRef.current?.(mode),
  );

  return (
    <TimerContext.Provider value={timer}>
      {children}
    </TimerContext.Provider>
  );
}
