import { ClipboardList } from 'lucide-react';
import { useTasks } from '@renderer/hooks/use-tasks';

interface TaskDisplayProps {
  onOpenPanel: () => void;
}

export function TaskDisplay({ onOpenPanel }: TaskDisplayProps) {
  const { activeTask } = useTasks();

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

  const { name, completedPomodoros, estimatedPomodoros } = activeTask;
  const progress = Math.min(completedPomodoros / estimatedPomodoros, 1);
  const isDone = completedPomodoros >= estimatedPomodoros;

  return (
    <button
      onClick={onOpenPanel}
      className="flex flex-col items-center gap-1.5 w-full max-w-52 group cursor-pointer"
    >
      <div className="flex items-center gap-1.5 text-xs text-foreground/70 group-hover:text-foreground/90 transition-colors duration-200 select-none">
        <ClipboardList className="size-3.5 shrink-0" />
        <span className="truncate max-w-44">{name}</span>
      </div>

      <div className="flex items-center gap-2 w-full">
        <div className="flex-1 h-1 rounded-full bg-border/50 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress * 100}%`,
              background: isDone
                ? 'var(--color-primary)'
                : 'oklch(from var(--color-primary) l c h / 0.7)',
              boxShadow: isDone ? '0 0 6px var(--color-primary)' : undefined,
            }}
          />
        </div>
        <span className="text-[10px] tabular-nums text-muted-foreground/60 shrink-0">
          {completedPomodoros} / {estimatedPomodoros}
        </span>
      </div>
    </button>
  );
}
