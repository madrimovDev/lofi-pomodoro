import { cn } from '@shared/lib/utils';
import type { TimerMode } from '@renderer/hooks/use-timer';

const RADIUS = 110;
const STROKE = 5;
const SIZE = (RADIUS + STROKE) * 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface TimerRingProps {
  progress: number;
  isRunning: boolean;
  mode: TimerMode;
  children?: React.ReactNode;
}

export const TimerRing = ({ progress, isRunning, children }: TimerRingProps) => {
  const offset = CIRCUMFERENCE * (1 - progress);

  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      <svg
        width={SIZE}
        height={SIZE}
        className="rotate-[-90deg]"
        aria-hidden
      >
        {/* Track */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          className="text-border opacity-40"
        />
        {/* Progress */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          className={cn(
            'text-primary transition-colors duration-[600ms]',
            isRunning && 'timer-ring-glow',
          )}
          style={{ transition: 'stroke-dashoffset 1s linear, color 0.6s ease' }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
};
