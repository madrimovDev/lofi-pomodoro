import { useEffect, useRef } from 'react';
import type { TrayTimerState } from '@shared/types';
import type { TimerMode } from './use-timer';
import { winApi, winEvents } from '@shared/tauri/window';

interface TrayTimerHookProps {
  timeLeft: number;
  mode: TimerMode;
  isRunning: boolean;
  toggle: () => void;
  skip: () => void;
}

export function useTraySync({ timeLeft, mode, isRunning, toggle, skip }: TrayTimerHookProps) {
  const toggleRef = useRef(toggle);
  const skipRef = useRef(skip);
  toggleRef.current = toggle;
  skipRef.current = skip;

  // Timer holatini tray'ga yuborish
  useEffect(() => {
    const state: TrayTimerState = { timeLeft, mode, isRunning };
    winApi.updateTrayState(state).catch(err => console.error('updateTrayState failed:', err));
  }, [timeLeft, mode, isRunning]);

  // Tray menyu hodisalari — Tauri listen() Promise<UnlistenFn> qaytaradi.
  useEffect(() => {
    const unlisten = winEvents.onTrayToggle(() => toggleRef.current());
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  useEffect(() => {
    const unlisten = winEvents.onTraySkip(() => skipRef.current());
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  useEffect(() => {
    const unlisten = winEvents.onTraySetMiniMode((enabled) => {
      winApi.setMiniMode(enabled).catch(err => console.error('setMiniMode failed:', err));
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);
}
