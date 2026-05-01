import { useEffect, useRef } from 'react';
import type { TrayTimerState } from '@shared/types';
import type { TimerMode } from './use-timer';

interface TrayTimerHookProps {
  timeLeft: number;
  mode: TimerMode;
  isRunning: boolean;
  toggle: () => void;
  skip: () => void;
}

export function useTraySync({ timeLeft, mode, isRunning, toggle, skip }: TrayTimerHookProps) {
  // Keep stable refs so IPC listeners don't re-subscribe every render
  const toggleRef = useRef(toggle);
  const skipRef = useRef(skip);
  toggleRef.current = toggle;
  skipRef.current = skip;

  // Send timer state to main process for tray updates
  useEffect(() => {
    const state: TrayTimerState = { timeLeft, mode, isRunning };
    window.electronApi?.updateTrayState(state);
  }, [timeLeft, mode, isRunning]);

  // Listen for toggle/skip commands from tray menu (subscribe once, use ref to call latest)
  useEffect(() => {
    return window.electronApi?.onTrayToggle(() => toggleRef.current());
  }, []);

  useEffect(() => {
    return window.electronApi?.onTraySkip(() => skipRef.current());
  }, []);

  // Listen for mini mode from tray
  useEffect(() => {
    return window.electronApi?.onTraySetMiniMode((enabled) => {
      window.electronApi?.setMiniMode(enabled);
    });
  }, []);
}
