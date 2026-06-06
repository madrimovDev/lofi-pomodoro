import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import type { Theme } from '@shared/types';
import { api } from '@shared/tauri/api';

export const ToggleTheme = () => {
  const [theme, setTheme] = useState<Theme | undefined>();

  useEffect(() => {
    api.getTheme()
      .then(setTheme)
      .catch(err => {
        console.error('getTheme failed:', err);
        setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
      });
  }, []);

  useEffect(() => {
    if (!theme) return;
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const handleToggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    api.setTheme(next).catch(err => console.error('setTheme failed:', err));
  };

  return (
    <Button size="icon-xs" className="rounded-full mr-4" variant="outline" onClick={handleToggle}>
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  );
};
