import { Button } from '@shared/components/ui/button';
import { Maximize2, Minus, X, BarChart2, Pin, Minimize2 } from 'lucide-react';
import { ToggleTheme } from './toggle-theme';
import { CurrentTime } from './current-time';
import { useSettings } from '@renderer/hooks/use-settings';
import { useStats } from '@renderer/hooks/use-stats';

interface WindowControlProps {
  onOpenStats?: () => void;
}

export const WindowControl = ({ onOpenStats }: WindowControlProps) => {
  const handleMinimize = () => window.electronApi?.minimizeWindow();
  const handleMaximize = () => window.electronApi?.maximizeWindow();
  const handleClose = () => window.electronApi?.closeWindow();
  const { settings, updateSettings } = useSettings();
  const { streak } = useStats();

  return (
    <div
      id="window-control"
      className="fixed inset-x-0 z-50 grid grid-cols-[1fr_auto_1fr] items-center w-full px-2 py-2 h-10 bg-background/40 backdrop-blur-2xl"
    >
      <div className="flex items-center gap-1.5">
        <h3 className="text-sm text-primary">ZenFocus</h3>
        {streak > 0 && (
          <span className="text-[10px] text-muted-foreground/50 select-none">🔥{streak}</span>
        )}
      </div>
      <CurrentTime />
      <div className="flex justify-end">
        <div id="window-controls-button">
          {onOpenStats && (
            <Button onClick={onOpenStats} variant="ghost" size="icon-xs" aria-label="Statistika">
              <BarChart2 className="size-3.5" />
            </Button>
          )}
          <Button
            onClick={() => window.electronApi?.setMiniMode(true)}
            variant="ghost" size="icon-xs" aria-label="Mini mode"
            title="Mini rejim"
          >
            <Minimize2 className="size-3.5" />
          </Button>
          <Button
            onClick={() => {
              const next = !settings.alwaysOnTop;
              updateSettings({ alwaysOnTop: next });
              window.electronApi?.setAlwaysOnTop(next);
            }}
            variant={settings.alwaysOnTop ? 'outline' : 'ghost'}
            size="icon-xs"
            aria-label="Always on top"
            title={settings.alwaysOnTop ? 'Har doim ustda: yoqiq' : 'Har doim ustda: o\'chiq'}
          >
            <Pin className="size-3.5" />
          </Button>
          <ToggleTheme />
          <Button onClick={handleMinimize} variant="ghost" size="icon-xs">
            <Minus />
          </Button>
          <Button onClick={handleMaximize} variant="ghost" size="icon-xs">
            <Maximize2 />
          </Button>
          <Button onClick={handleClose} variant="ghost" size="icon-xs" className="hover:bg-destructive/50">
            <X />
          </Button>
        </div>
      </div>
    </div>
  );
};
