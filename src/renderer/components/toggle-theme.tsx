import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import type { Theme } from '@shared/types';

export const ToggleTheme = () => {
  const [theme, setTheme] = useState<Theme | undefined>();

  useEffect(() => {
    if (window.electronApi) {
      window.electronApi.getTheme().then(setTheme).catch(err => console.error('getTheme failed:', err));
    } else {
      setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    }
  }, []);

  useEffect(() => {
    if (!theme) return;
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const handleToggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    window.electronApi?.setTheme(next);
  };

  return (
    <Button size="icon-xs" className="rounded-full mr-4" variant="outline" onClick={handleToggle}>
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  );
};
