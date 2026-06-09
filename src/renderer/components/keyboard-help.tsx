import { Dialog } from 'radix-ui';
import { X } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { useSettings } from '@renderer/hooks/use-settings';
import { DEFAULT_KEYBINDINGS, type ShortcutAction } from '@shared/types';
import { formatKeyCode } from '@shared/lib/keys';
import type { TranslationKey } from '@shared/i18n';

const ACTION_LABEL_KEYS: Record<ShortcutAction, TranslationKey> = {
  toggleTimer: 'scToggleTimer', skip: 'scSkip', toggleMusic: 'scToggleMusic',
  toggleTasks: 'scToggleTasks', toggleSettings: 'scToggleSettings',
  toggleStats: 'scToggleStats', toggleFocusMode: 'scToggleFocusMode',
};

export function KeyboardHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { settings, t } = useSettings();
  const bindings = { ...DEFAULT_KEYBINDINGS, ...(settings.keybindings ?? {}) };
  const actions = Object.keys(ACTION_LABEL_KEYS) as ShortcutAction[];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm" />
        <Dialog.Content className="glass fixed left-1/2 top-1/2 z-50 w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-5 focus:outline-none">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-sm font-medium tracking-widest uppercase text-muted-foreground">{t('keyboardShortcuts')}</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon-xs" aria-label={t('close')}><X className="size-3.5" /></Button>
            </Dialog.Close>
          </div>
          <div className="flex flex-col gap-2">
            {actions.map(a => (
              <div key={a} className="flex items-center justify-between gap-4">
                <span className="text-sm text-foreground/70">{t(ACTION_LABEL_KEYS[a])}</span>
                <kbd className="rounded-md border border-border/60 bg-background/40 px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">{formatKeyCode(bindings[a])}</kbd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-foreground/70">{t('scHelp')}</span>
              <kbd className="rounded-md border border-border/60 bg-background/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">?</kbd>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
