import * as React from 'react';
import { Dialog } from 'radix-ui';
import { cn } from '@shared/lib/utils';

// Qaysi tomonga ochilishi (drawer yo'nalishi)
type Side = 'bottom' | 'left' | 'right';

// Har bir yo'nalish uchun Tailwind klasslari (tw-animate-css utilitilari)
const sideClasses: Record<Side, string> = {
  bottom:
    'inset-x-0 bottom-0 max-h-[85vh] rounded-t-xl border-t data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
  right:
    'inset-y-0 right-0 h-full w-3/4 sm:max-w-sm rounded-l-xl border-l data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
  left:
    'inset-y-0 left-0 h-full w-3/4 sm:max-w-sm rounded-r-xl border-r data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left',
};

// Asosiy Sheet komponenti — Radix Dialog.Root ustida
function Sheet(props: React.ComponentProps<typeof Dialog.Root>) {
  return <Dialog.Root {...props} />;
}

// Sheet panelining asosiy kontenti: overlay + yon panel
function SheetContent({
  side = 'bottom',
  className,
  children,
  title,
  ...props
}: React.ComponentProps<typeof Dialog.Content> & { side?: Side; title?: string }) {
  return (
    <Dialog.Portal>
      {/* Orqa fon overlay — ochilish/yopilish animatsiyasi bilan */}
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/10 supports-backdrop-filter:backdrop-blur-xs data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
      {/* Panel kontenti — yo'nalishga qarab sideClasses qo'llanadi */}
      <Dialog.Content
        className={cn(
          'fixed z-50 flex flex-col bg-popover text-sm text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out',
          sideClasses[side],
          className,
        )}
        {...props}
      >
        {/* Ekran o'quvchilar uchun yashirin sarlavha (a11y) */}
        <Dialog.Title className="sr-only">{title ?? 'Panel'}</Dialog.Title>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
}

// Yopish tugmasi (Dialog.Close wrapper)
const SheetClose = Dialog.Close;

// Sarlavha (Dialog.Title wrapper)
const SheetTitle = Dialog.Title;

export { Sheet, SheetContent, SheetClose, SheetTitle };
