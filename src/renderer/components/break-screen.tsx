import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { useSettings } from '@renderer/hooks/use-settings';
import type { TranslationKey } from '@shared/i18n/uz';
import { BREATHING_PATTERNS, type BreathingPatternId } from '@shared/types';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

interface BreakScreenProps {
  onSkip: () => void;
  timeLeft: number;
}

type BreakActivity = 'breathing' | 'stretch' | 'hydration' | 'eye-rest';

const ACTIVITIES: BreakActivity[] = ['breathing', 'stretch', 'hydration', 'eye-rest'];

const STRETCH_TIP_KEYS = [
  'stretchTip1', 'stretchTip2', 'stretchTip3', 'stretchTip4', 'stretchTip5',
  'stretchTip6', 'stretchTip7', 'stretchTip8', 'stretchTip9', 'stretchTip10',
] as const;
const HYDRATION_TIP_KEYS = ['hydrationTip1', 'hydrationTip2', 'hydrationTip3'] as const;
const EYE_TIP_KEYS = ['eyeTip1', 'eyeTip2', 'eyeTip3'] as const;

function BreathingCircle({ t, pattern }: { t: (key: TranslationKey) => string; pattern: BreathingPatternId }) {
  const phases = BREATHING_PATTERNS[pattern];
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [count, setCount] = useState(phases[0].seconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const phase = phases[phaseIndex];
    let remaining = phase.seconds;
    setCount(remaining);
    intervalRef.current = setInterval(() => {
      remaining--;
      setCount(remaining);
      if (remaining <= 0) {
        clearInterval(intervalRef.current!);
        setPhaseIndex(i => (i + 1) % phases.length);
      }
    }, 1000);
    return () => clearInterval(intervalRef.current!);
  }, [phaseIndex, phases]);

  const phase = phases[phaseIndex];
  const phaseLabel = t(phase.labelKey);
  const scale = phase.scale === 'out' ? 'scale-90' : 'scale-110';

  return (
    <div className="flex flex-col items-center gap-6">
      <div className={`w-28 h-28 rounded-full bg-primary/20 border-2 border-primary/30 flex items-center justify-center transition-transform duration-[4000ms] ${scale}`}>
        <div className="flex flex-col items-center">
          <span className="text-3xl font-extralight tabular-nums text-foreground/70">{count}</span>
        </div>
      </div>
      <p className="text-sm text-muted-foreground/60 select-none">{phaseLabel}</p>
    </div>
  );
}

function StretchScreen({ t, tipKey }: { t: (key: TranslationKey) => string; tipKey: TranslationKey }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-5xl">🧘</div>
      <p className="text-sm text-center text-foreground/70 max-w-[200px] leading-relaxed">{t(tipKey)}</p>
    </div>
  );
}

function HydrationScreen({ t, tipKey }: { t: (key: TranslationKey) => string; tipKey: TranslationKey }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-5xl">💧</div>
      <p className="text-sm text-center text-foreground/70">{t(tipKey)}</p>
    </div>
  );
}

function EyeRestScreen({ t, tipKey }: { t: (key: TranslationKey) => string; tipKey: TranslationKey }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-5xl">👁️</div>
      <p className="text-sm text-center text-foreground/70 max-w-[200px] leading-relaxed">{t(tipKey)}</p>
      <p className="text-xs text-muted-foreground/40 text-center max-w-[200px]">{t('eye2020')}</p>
    </div>
  );
}

export function BreakScreen({ onSkip, timeLeft }: BreakScreenProps) {
  const { settings, t } = useSettings();
  const [activityIndex] = useState(() => Math.floor(Math.random() * ACTIVITIES.length));
  const [stretchTipIndex] = useState(() => Math.floor(Math.random() * STRETCH_TIP_KEYS.length));
  const [hydrationTipIndex] = useState(() => Math.floor(Math.random() * HYDRATION_TIP_KEYS.length));
  const [eyeTipIndex] = useState(() => Math.floor(Math.random() * EYE_TIP_KEYS.length));

  const activity = ACTIVITIES[activityIndex];

  return (
    <div className="fixed inset-0 z-30 bg-background/90 backdrop-blur-md flex flex-col items-center justify-center gap-8">
      <p className="text-xs uppercase tracking-widest text-muted-foreground/40 select-none">
        {t('breakScreenTitle')}
      </p>

      {activity === 'breathing' && <BreathingCircle t={t} pattern={settings.breathingPattern} />}
      {activity === 'stretch' && <StretchScreen t={t} tipKey={STRETCH_TIP_KEYS[stretchTipIndex]} />}
      {activity === 'hydration' && <HydrationScreen t={t} tipKey={HYDRATION_TIP_KEYS[hydrationTipIndex]} />}
      {activity === 'eye-rest' && <EyeRestScreen t={t} tipKey={EYE_TIP_KEYS[eyeTipIndex]} />}

      <div className="flex flex-col items-center gap-3">
        <span className="text-sm tabular-nums text-muted-foreground/30 font-light tracking-widest">
          {formatTime(timeLeft)}
        </span>
        <Button variant="ghost" size="xs" onClick={onSkip} className="gap-1.5 text-muted-foreground/40 hover:text-muted-foreground">
          <X className="size-3" />
          {t('skipBreak')}
        </Button>
      </div>
    </div>
  );
}
