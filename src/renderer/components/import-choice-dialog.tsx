import { Dialog } from 'radix-ui';
import { Button } from '@shared/components/ui/button';
import { useTasks } from '@renderer/hooks/use-tasks';
import { useSettings } from '@renderer/hooks/use-settings';

export function ImportChoiceDialog() {
  const { pendingImport, importError, resolveImport, dismissImport, clearImportError } = useTasks();
  const { t } = useSettings();
  const open = pendingImport !== null || importError !== null;
  const onOpenChange = (o: boolean) => { if (!o) { dismissImport(); clearImportError(); } };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm" />
        <Dialog.Content className="glass fixed left-1/2 top-1/2 z-50 w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-5 focus:outline-none">
          {importError ? (
            <>
              <Dialog.Title className="text-sm text-foreground/80 mb-4">{t('invalidFile')}</Dialog.Title>
              <div className="flex justify-end">
                <Button variant="outline" size="xs" onClick={() => clearImportError()}>{t('close')}</Button>
              </div>
            </>
          ) : pendingImport ? (
            <>
              <Dialog.Title className="text-sm text-foreground/80 mb-4">{t('importFound', { count: pendingImport.total })}</Dialog.Title>
              <div className="flex flex-col gap-2">
                <Button variant="outline" size="xs" onClick={() => resolveImport('merge')}>{t('importMerge')}</Button>
                <Button variant="outline" size="xs" onClick={() => resolveImport('replace')}>{t('importReplace')}</Button>
                <Button variant="ghost" size="xs" onClick={() => dismissImport()}>{t('cancel')}</Button>
              </div>
            </>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
