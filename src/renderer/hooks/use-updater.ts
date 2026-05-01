import { useEffect, useState } from 'react';
import type { UpdaterStatus } from '@shared/types';

export function useUpdater() {
  const [status, setStatus] = useState<UpdaterStatus | null>(null);

  useEffect(() => {
    const unsubscribe = window.electronApi?.onUpdateStatus(setStatus);
    return () => unsubscribe?.();
  }, []);

  const check = () => window.electronApi?.checkForUpdates();
  const install = () => window.electronApi?.installUpdate();

  return { status, check, install };
}
