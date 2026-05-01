import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { useSettings } from '@renderer/hooks/use-settings';
import type { TranslationKey } from '@shared/i18n/uz';

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

const STRETCH_TIPS = [
  'Yelkangizni orqaga tortib, ko\'ksingizni kering',
  'Boshingizni asta-sekin chap va o\'ngga burting',
  'Qo\'llaringizni yuqoriga ko\'tarib cho\'zing',
  'O\'rnatingizdan turib, oyoqlaringizni silking',
  'Ko\'zingizni yumib, yuzingizni bo\'shashtirang',
  'Barmoqlaringizni burging va yozing',
  'Belingizni asta-sekin burang',
  'Chuqur nafas olib, asta chiqaring',
];

function BreathingCircle({ t }: { t: (key: TranslationKey) => string }) {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in');
  const [count, setCount] = useState(4);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const durations: Record<typeof phase, number> = { in: 4, hold: 7, out: 8 };

    let remaining = durations[phase];
    setCount(remaining);

    intervalRef.current = setInterval(() => {
      remaining--;
      setCount(remaining);
      if (remaining <= 0) {
        clearInterval(intervalRef.current!);
        setPhase(p => p === 'in' ? 'hold' : p === 'hold' ? 'out' : 'in');
      }
    }, 1000);

    return () => clearInterval(intervalRef.current!);
  }, [phase]);

  const phaseLabel = phase === 'in' ? t('breatheIn') : phase === 'hold' ? t('breatheHold') : t('breatheOut');
  const scale = phase === 'in' ? 'scale-110' : phase === 'hold' ? 'scale-110' : 'scale-90';

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

function StretchScreen({ tip }: { tip: string }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-5xl">🧘</div>
      <p className="text-sm text-center text-foreground/70 max-w-[200px] leading-relaxed">{tip}</p>
    </div>
  );
}

function HydrationScreen({ t }: { t: (key: TranslationKey) => string }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-5xl">💧</div>
      <p className="text-sm text-center text-foreground/70">{t('hydration')}</p>
    </div>
  );
}

function EyeRestScreen({ t }: { t: (key: TranslationKey) => string }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-5xl">👁️</div>
      <p className="text-sm text-center text-foreground/70 max-w-[200px] leading-relaxed">{t('eyeRest')}</p>
      <p className="text-xs text-muted-foreground/40 text-center max-w-[200px]">20-20-20: 20 daqiqa ishlagach, 20 metr uzoqqa 20 soniya qarang</p>
    </div>
  );
}

export function BreakScreen({ onSkip, timeLeft }: BreakScreenProps) {
  const { t } = useSettings();
  const [activityIndex] = useState(() => Math.floor(Math.random() * ACTIVITIES.length));
  const [stretchTipIndex] = useState(() => Math.floor(Math.random() * STRETCH_TIPS.length));

  const activity = ACTIVITIES[activityIndex];

  return (
    <div className="absolute inset-0 z-30 bg-background/90 backdrop-blur-md flex flex-col items-center justify-center gap-8">
      <p className="text-xs uppercase tracking-widest text-muted-foreground/40 select-none">
        {t('breakScreenTitle')}
      </p>

      {activity === 'breathing' && <BreathingCircle t={t} />}
      {activity === 'stretch' && <StretchScreen tip={STRETCH_TIPS[stretchTipIndex]} />}
      {activity === 'hydration' && <HydrationScreen t={t} />}
      {activity === 'eye-rest' && <EyeRestScreen t={t} />}

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
