import { useState } from 'react';
import type { UpdaterStatus } from '@shared/types';

/** Auto-update Faza 12'gacha qoldirilgan — no-op stub. UI qobig'i saqlanadi. */
export function useUpdater() {
  const [status] = useState<UpdaterStatus | null>(null);
  const check = () => {};
  const install = () => {};
  return { status, check, install };
}
