import { useEffect } from 'react';

interface ShortcutHandlers {
  onToggleTimer: () => void;
  onSkip: () => void;
  onToggleMusic: () => void;
  onToggleTasks: () => void;
}

export function useKeyboardShortcuts({
  onToggleTimer,
  onSkip,
  onToggleMusic,
  onToggleTasks,
}: ShortcutHandlers) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          onToggleTimer();
          break;
        case 'KeyS':
          onSkip();
          break;
        case 'KeyM':
          onToggleMusic();
          break;
        case 'KeyT':
          onToggleTasks();
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onToggleTimer, onSkip, onToggleMusic, onToggleTasks]);
}
