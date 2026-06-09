import { useEffect } from 'react';
import { DEFAULT_KEYBINDINGS, type ShortcutAction } from '@shared/types';

interface ShortcutOptions {
  handlers: Partial<Record<ShortcutAction, () => void>>;
  bindings: Record<ShortcutAction, string>;
  onHelp: () => void;
  enabled: boolean;
}

export function useKeyboardShortcuts({ handlers, bindings, onHelp, enabled }: ShortcutOptions) {
  useEffect(() => {
    if (!enabled) return;
    // Per-action fallback so a missing/added binding never reads undefined.
    const active = { ...DEFAULT_KEYBINDINGS, ...bindings };
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === '?') { onHelp(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return; // plain keys only
      for (const action of Object.keys(active) as ShortcutAction[]) {
        if (active[action] === e.code) {
          const fn = handlers[action];
          if (fn) {
            if (action === 'toggleTimer') e.preventDefault(); // stop Space scroll
            fn();
          }
          return;
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handlers, bindings, onHelp, enabled]);
}
