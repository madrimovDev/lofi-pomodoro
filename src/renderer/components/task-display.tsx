import { useEffect, useRef, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { useTasks } from '@renderer/hooks/use-tasks';
import { cn } from '@shared/lib/utils';

interface TaskDisplayProps {
  onOpenPanel: () => void;
}

export function TaskDisplay({ onOpenPanel }: TaskDisplayProps) {
  const { activeTask } = useTasks();
  const completedPomodoros = activeTask?.completedPomodoros ?? 0;

  // Flash "+1 🍅" when a pomodoro is earned (completedPomodoros increases).
  // Hooks must be before any conditional return.
  const prevCompletedRef = useRef(completedPomodoros);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (completedPomodoros > prevCompletedRef.current) {
      setFlash(true);
      const id = setTimeout(() => setFlash(false), 1600);
      return () => clearTimeout(id);
    }
    prevCompletedRef.current = completedPomodoros;
  }, [completedPomodoros]);

  if (!activeTask) {
    return (
      <button
        onClick={onOpenPanel}
        className="flex items-center gap-2 text-muted-foreground/50 hover:text-muted-foreground transition-colors duration-200 text-xs select-none cursor-pointer"
      >
        <ClipboardList className="size-3.5" />
        <span>Ish tanlash...</span>
      </button>
    );
  }

  const { name, estimatedPomodoros } = activeTask;
  const MAX_DOTS = 8;
  const displayCount = Math.min(estimatedPomodoros, MAX_DOTS);
  const overflow = estimatedPomodoros > MAX_DOTS ? estimatedPomodoros - MAX_DOTS : 0;
  const filled = Math.min(completedPomodoros, displayCount);

  return (
    <button
      onClick={onOpenPanel}
      className="relative flex flex-col items-center gap-1.5 w-full max-w-52 group cursor-pointer"
    >
      {flash && (
        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs text-primary pointer-events-none animate-in fade-in-0 zoom-in-75 duration-300">
          +1 🍅
        </span>
      )}
      <div className="flex items-center gap-1.5 text-xs text-foreground/70 group-hover:text-foreground/90 transition-colors duration-200 select-none w-full justify-center">
        <ClipboardList className="size-3.5 shrink-0" />
        <span className="truncate max-w-[160px]">{name}</span>
      </div>

      <div className="flex items-center gap-1">
        {Array.from({ length: displayCount }).map((_, i) => (
          <span
            key={i}
            className={cn(
              'inline-block w-2 h-2 rounded-full transition-all duration-300',
              i < filled
                ? 'bg-primary'
                : 'border border-primary/40 bg-transparent',
            )}
          />
        ))}
        {overflow > 0 && (
          <span className="text-[10px] text-muted-foreground/50 tabular-nums ml-0.5">
            +{overflow}
          </span>
        )}
      </div>
    </button>
  );
}
