import { cn } from '@shared/lib/utils';

interface SessionDotsProps {
  completed: number;
  total?: number;
}

export const SessionDots = ({ completed, total = 4 }: SessionDotsProps) => {
  return (
    <div className="flex items-center gap-2" aria-label={`${completed} of ${total} sessions completed`}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'size-1.5 rounded-full transition-all duration-500',
            i < completed
              ? 'bg-primary scale-110'
              : 'bg-border',
          )}
          style={i < completed ? { boxShadow: '0 0 5px var(--color-primary)' } : undefined}
        />
      ))}
    </div>
  );
};
