import { useEffect, useState } from 'react';
import { useSettings } from '@renderer/hooks/use-settings';
import { formatTime } from '@shared/lib/format';

export const CurrentTime = () => {
  const { settings } = useSettings();
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="text-xs">{formatTime(settings.locale, time)}</span>;
};
