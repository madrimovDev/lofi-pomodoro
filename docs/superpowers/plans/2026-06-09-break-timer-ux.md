# Break & Timer UX (SP2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add configurable keyboard shortcuts + a help overlay, richer break activities (more tips + selectable breathing patterns), full custom-preset CRUD, and a configurable timer restore-window.

**Architecture:** All four features add fields to `TimerSettings` (persisted via existing `setSettings`; no new Rust commands). Ordered smallest-to-largest: D (restore-window) → B (break activities) → C (presets) → A (shortcuts, the long pole, isolated last). Builds on SP1's i18n (`useSettings().t`, `getT`/`TFunc`, plural, `scripts/check-i18n.mjs`).

**Tech Stack:** TypeScript, React 19, Vite, Tauri v2. **BUN runtime** — verify with `bash -c 'bun run typecheck'`, `bash -c 'bun run check:i18n'`, `bash -c 'bun run build:vite'` (wrap in `bash -c` due to a zsh profile quirk that makes bare node/bun exit 126).

**Reference spec:** `docs/superpowers/specs/2026-06-09-break-timer-ux-design.md`

> **No test framework** (intentional, per SP1). Verification = typecheck + check:i18n + build + documented manual GUI checks. Do NOT add vitest/jest.

## Conventions (verified against codebase — do not deviate)
- Translator: `const { settings, updateSettings, t } = useSettings();` (`@renderer/hooks/use-settings`). `t` is `TFunc = (key, params?) => string`.
- Aliases: `@shared/*`, `@renderer/*`. **No `@/*`.**
- Settings persist via `updateSettings(patch)` (shallow-merges into the single settings blob, then `api.setSettings`). `useSettings` defaults missing fields from `DEFAULT_TIMER_SETTINGS` (top-level shallow-merge only).
- i18n locale files: `src/shared/i18n/{uz,en,ru}.ts`, flat `key: 'value',` before `} as const;`. `TranslationKey = keyof typeof uz` — any key passed to `t()` MUST exist in `uz.ts`. Plural base key required when using `t(key,{count})`.
- New i18n keys: add to ALL THREE locales; `bash -c 'bun run check:i18n'` enforces parity.
- Settings UI patterns (from `settings-panel.tsx`): `NumberInput`, `ToggleRow`, section = `<div className="flex flex-col gap-3"><p className="text-xs uppercase tracking-widest text-muted-foreground/60">{t('...')}</p>...</div>`, dividers `<div className="h-px bg-border/50" />`, segmented buttons (see the `language` section, lines ~175–192).

## File Structure
- `src/shared/types.ts` — all new fields/types/constants (touched by every area; sequential tasks, no conflict).
- `src/shared/lib/keys.ts` — NEW: `formatKeyCode`.
- `src/renderer/hooks/use-timer.ts` — restore-window read (D).
- `src/renderer/hooks/use-keyboard-shortcuts.ts` — data-driven rewrite (A).
- `src/renderer/components/break-screen.tsx` — breathing phase-list + tip variety + i18n leftover (B).
- `src/renderer/components/preset-selector.tsx` — built-in+custom, localized names, delete (C).
- `src/renderer/components/keyboard-help.tsx` — NEW: help overlay (A).
- `src/renderer/components/settings-panel.tsx` — selectors/editors for D, B, C, A.
- `src/renderer/app/layout/index.tsx` — timerConfig restore field (D); pass `onToggleStats` (A).
- `src/renderer/app/layout/main.tsx` — shortcut handlers, helpOpen, enabled, render help (A).
- `src/shared/i18n/{uz,en,ru}.ts` — new keys for all areas.

---

## Task 1 (Area D): Configurable restore-window

**Files:** modify `src/shared/types.ts`, `src/renderer/hooks/use-timer.ts`, `src/renderer/app/layout/index.tsx`, `src/renderer/components/settings-panel.tsx`, `src/shared/i18n/{uz,en,ru}.ts`

- [ ] **Step 1: Add the setting to types**

In `src/shared/types.ts`, add to `interface TimerSettings` (after `forceBreakFullscreen`):
```ts
  restoreWindowMinutes: number; // 0 = never restore, -1 = always, else minutes
```
And to `DEFAULT_TIMER_SETTINGS` (after `forceBreakFullscreen: true,`):
```ts
  restoreWindowMinutes: 120,
```
Also add to `interface TimerConfig` in `src/renderer/hooks/use-timer.ts` (after `autoStartFocus?`):
```ts
  restoreWindowMinutes?: number;
```

- [ ] **Step 2: Use the setting in use-timer (sentinel conversion)**

In `src/renderer/hooks/use-timer.ts`, DELETE the line `const RESTORE_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours`. In the `useState<TimerState>(() => {...})` initializer, replace the restore check:
```ts
    try {
      const raw = localStorage.getItem(TIMER_STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        const mins = config.restoreWindowMinutes ?? 120;
        const windowMs = mins < 0 ? Infinity : mins * 60_000; // -1 → always, 0 → never
        if (windowMs > 0 && s.savedAt && Date.now() - s.savedAt < windowMs) {
          return { timeLeft: s.timeLeft, isRunning: false, mode: s.mode as TimerMode, completedInCycle: s.completedInCycle };
        }
      }
    } catch { /* ignore */ }
```
(0 → `windowMs > 0` false → never restore. -1 → `Infinity` → always restore. Naive `-1*60000` would be negative and invert the logic, so the sentinel is special-cased.)

- [ ] **Step 3: Pass the field through timerConfig**

In `src/renderer/app/layout/index.tsx`, in the `const timerConfig = {...}` object (~line 330), add:
```ts
    restoreWindowMinutes: settings.restoreWindowMinutes,
```

- [ ] **Step 4: Add i18n keys (all 3 locales, before `} as const;`)**

uz.ts:
```ts
  restoreWindow: 'Holatni tiklash',
  restoreOff: 'O\'chiq',
  restore1h: '1 soat',
  restore2h: '2 soat',
  restore8h: '8 soat',
  restoreAlways: 'Doim',
```
en.ts:
```ts
  restoreWindow: 'Restore state',
  restoreOff: 'Off',
  restore1h: '1 hour',
  restore2h: '2 hours',
  restore8h: '8 hours',
  restoreAlways: 'Always',
```
ru.ts:
```ts
  restoreWindow: 'Восстановление',
  restoreOff: 'Выкл',
  restore1h: '1 час',
  restore2h: '2 часа',
  restore8h: '8 часов',
  restoreAlways: 'Всегда',
```

- [ ] **Step 5: Add the selector to settings-panel**

In `src/renderer/components/settings-panel.tsx`, inside the same section that has `dailyGoal`/`miniMode` (the block starting `{t('autoStartBreaks').split(' ')[0]}`), after the `miniMode` row's closing `</div>`, add a restore-window segmented selector following the `language` segmented-button pattern:
```tsx
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm text-foreground/80 select-none">{t('restoreWindow')}</label>
                <div className="flex gap-1 flex-wrap justify-end">
                  {([
                    { v: 0, key: 'restoreOff' as const },
                    { v: 60, key: 'restore1h' as const },
                    { v: 120, key: 'restore2h' as const },
                    { v: 480, key: 'restore8h' as const },
                    { v: -1, key: 'restoreAlways' as const },
                  ]).map(opt => (
                    <button
                      key={opt.v}
                      onClick={() => updateSettings({ restoreWindowMinutes: opt.v })}
                      className={`px-2 py-0.5 rounded-md text-[10px] transition-colors duration-150 border ${
                        (settings.restoreWindowMinutes ?? 120) === opt.v
                          ? 'bg-primary/20 border-primary/40 text-foreground'
                          : 'border-border/50 text-muted-foreground/60 hover:border-border hover:text-muted-foreground'
                      }`}
                    >
                      {t(opt.key)}
                    </button>
                  ))}
                </div>
              </div>
```

- [ ] **Step 6: Verify**

Run: `bash -c 'bun run check:i18n'` → parity OK. `bash -c 'bun run typecheck'` → PASS.

- [ ] **Step 7: Commit**

```bash
git add src/shared/types.ts src/renderer/hooks/use-timer.ts src/renderer/app/layout/index.tsx src/renderer/components/settings-panel.tsx src/shared/i18n/
git commit -m "feat(timer): configurable restore-window setting

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 (Area B1): Breathing-pattern data model

**Files:** modify `src/shared/types.ts`

- [ ] **Step 1: Add the pattern types + data + setting**

In `src/shared/types.ts`, add near the other timer types:
```ts
export type BreathingPatternId = '478' | 'box' | 'coherent';

export interface BreathPhase {
  labelKey: 'breatheIn' | 'breatheHold' | 'breatheOut';
  seconds: number;
  scale: 'in' | 'hold' | 'out';
}

export const BREATHING_PATTERNS: Record<BreathingPatternId, BreathPhase[]> = {
  '478': [
    { labelKey: 'breatheIn', seconds: 4, scale: 'in' },
    { labelKey: 'breatheHold', seconds: 7, scale: 'hold' },
    { labelKey: 'breatheOut', seconds: 8, scale: 'out' },
  ],
  box: [
    { labelKey: 'breatheIn', seconds: 4, scale: 'in' },
    { labelKey: 'breatheHold', seconds: 4, scale: 'hold' },
    { labelKey: 'breatheOut', seconds: 4, scale: 'out' },
    { labelKey: 'breatheHold', seconds: 4, scale: 'hold' },
  ],
  coherent: [
    { labelKey: 'breatheIn', seconds: 5, scale: 'in' },
    { labelKey: 'breatheOut', seconds: 5, scale: 'out' },
  ],
};
```
Add to `interface TimerSettings` (after `restoreWindowMinutes`):
```ts
  breathingPattern: BreathingPatternId;
```
And to `DEFAULT_TIMER_SETTINGS`:
```ts
  breathingPattern: '478',
```

- [ ] **Step 2: Verify + commit**

`bash -c 'bun run typecheck'` → PASS. (`breatheIn/Hold/Out` already exist as i18n keys.)
```bash
git add src/shared/types.ts
git commit -m "feat(break): breathing-pattern data model (478/box/coherent)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3 (Area B2): BreathingCircle phase-list rewrite + tip variety + i18n leftover

**Files:** modify `src/renderer/components/break-screen.tsx`, `src/shared/i18n/{uz,en,ru}.ts`

> Context: `break-screen.tsx:88` has a hardcoded Uzbek leftover from SP1: `20-20-20: 20 daqiqa ishlagach, 20 metr uzoqqa 20 soniya qarang`. Wire it here. Current `BreathingCircle` is a 3-phase enum — rewrite to iterate a phase list so `box` (4 phases) and `coherent` (2 phases) work.

- [ ] **Step 1: Add new i18n keys (all 3 locales, before `} as const;`)**

uz.ts:
```ts
  eye2020: '20-20-20: har 20 daqiqada 20 soniya 20 metr uzoqqa qarang',
  hydrationTip1: 'Bir stakan suv iching',
  hydrationTip2: 'Suv ichib, tanangizni namlang',
  hydrationTip3: 'Choy yoki suv — bir nima iching',
  eyeTip1: 'Ko\'zingizni 20 soniya yuming',
  eyeTip2: 'Uzoqdagi narsaga tikiling',
  eyeTip3: 'Ko\'zingizni aylantiring va dam bering',
  stretchTip9: 'Bo\'yningizni asta cho\'zing',
  stretchTip10: 'Bilaklaringizni aylantiring',
```
en.ts:
```ts
  eye2020: '20-20-20: every 20 min, look 20 m away for 20 s',
  hydrationTip1: 'Drink a glass of water',
  hydrationTip2: 'Hydrate — take a few sips',
  hydrationTip3: 'Have some water or tea',
  eyeTip1: 'Close your eyes for 20 seconds',
  eyeTip2: 'Focus on something far away',
  eyeTip3: 'Roll your eyes and let them rest',
  stretchTip9: 'Gently stretch your neck',
  stretchTip10: 'Rotate your wrists',
```
ru.ts:
```ts
  eye2020: '20-20-20: каждые 20 мин смотрите 20 с на 20 м вдаль',
  hydrationTip1: 'Выпейте стакан воды',
  hydrationTip2: 'Сделайте несколько глотков воды',
  hydrationTip3: 'Выпейте воды или чая',
  eyeTip1: 'Закройте глаза на 20 секунд',
  eyeTip2: 'Посмотрите на что-то вдали',
  eyeTip3: 'Поводите глазами и дайте им отдохнуть',
  stretchTip9: 'Мягко потяните шею',
  stretchTip10: 'Повращайте запястьями',
```

- [ ] **Step 2: Rewrite the tip key lists + BreathingCircle**

In `src/renderer/components/break-screen.tsx`:

a) Import the pattern data and settings type:
```ts
import { BREATHING_PATTERNS, type BreathingPatternId } from '@shared/types';
```

b) Extend `STRETCH_TIP_KEYS` to include the two new tips, and add hydration/eye key lists:
```ts
const STRETCH_TIP_KEYS = [
  'stretchTip1', 'stretchTip2', 'stretchTip3', 'stretchTip4', 'stretchTip5',
  'stretchTip6', 'stretchTip7', 'stretchTip8', 'stretchTip9', 'stretchTip10',
] as const;
const HYDRATION_TIP_KEYS = ['hydrationTip1', 'hydrationTip2', 'hydrationTip3'] as const;
const EYE_TIP_KEYS = ['eyeTip1', 'eyeTip2', 'eyeTip3'] as const;
```

c) Replace the whole `BreathingCircle` function with a phase-list version (takes the pattern id):
```tsx
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
```

d) Make `HydrationScreen`/`EyeRestScreen` take a random tip key and wire the 20-20-20 leftover:
```tsx
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
```

e) In `BreakScreen`, pull `settings` for the pattern, pick random tips per activity, and pass them down:
```tsx
export function BreakScreen({ onSkip, timeLeft }: BreakScreenProps) {
  const { settings, t } = useSettings();
  const [activityIndex] = useState(() => Math.floor(Math.random() * ACTIVITIES.length));
  const [stretchTipIndex] = useState(() => Math.floor(Math.random() * STRETCH_TIP_KEYS.length));
  const [hydrationTipIndex] = useState(() => Math.floor(Math.random() * HYDRATION_TIP_KEYS.length));
  const [eyeTipIndex] = useState(() => Math.floor(Math.random() * EYE_TIP_KEYS.length));

  const activity = ACTIVITIES[activityIndex];
  // ... keep the wrapper JSX, update the activity lines:
  // {activity === 'breathing' && <BreathingCircle t={t} pattern={settings.breathingPattern} />}
  // {activity === 'stretch' && <StretchScreen t={t} tipKey={STRETCH_TIP_KEYS[stretchTipIndex]} />}
  // {activity === 'hydration' && <HydrationScreen t={t} tipKey={HYDRATION_TIP_KEYS[hydrationTipIndex]} />}
  // {activity === 'eye-rest' && <EyeRestScreen t={t} tipKey={EYE_TIP_KEYS[eyeTipIndex]} />}
```
Keep the existing wrapper `<div>`, title, timer, and skip button unchanged — only swap the 4 activity render lines and add the `settings`/index hooks.

- [ ] **Step 3: Verify**

`bash -c 'bun run check:i18n'` → parity OK. `bash -c 'bun run typecheck'` → PASS.
`bash -c "grep -nE 'daqiqa ishlagach|20 metr' src/renderer/components/break-screen.tsx || echo CLEAN"` → CLEAN (leftover gone).

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/break-screen.tsx src/shared/i18n/
git commit -m "feat(break): phase-list breathing + tip variety + wire 20-20-20 i18n leftover

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4 (Area B3): Breathing-pattern selector in settings

**Files:** modify `src/renderer/components/settings-panel.tsx`, `src/shared/i18n/{uz,en,ru}.ts`

- [ ] **Step 1: Add i18n keys (all 3 locales)**

uz: `breathingPattern: 'Nafas patterni',` `pattern478: '4-7-8',` `patternBox: 'Box 4-4-4-4',` `patternCoherent: 'Coherent 5-5',`
en: `breathingPattern: 'Breathing pattern',` `pattern478: '4-7-8',` `patternBox: 'Box 4-4-4-4',` `patternCoherent: 'Coherent 5-5',`
ru: `breathingPattern: 'Дыхание',` `pattern478: '4-7-8',` `patternBox: 'Бокс 4-4-4-4',` `patternCoherent: 'Когерентное 5-5',`

- [ ] **Step 2: Add the selector**

In `settings-panel.tsx`, add a `breathingPattern` segmented selector in the section that contains `breakScreen`/`forceBreakFullscreen` (so it sits with break-related settings), after the `forceBreakFullscreen` ToggleRow:
```tsx
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm text-foreground/80 select-none">{t('breathingPattern')}</label>
                <div className="flex gap-1">
                  {([
                    { v: '478' as const, key: 'pattern478' as const },
                    { v: 'box' as const, key: 'patternBox' as const },
                    { v: 'coherent' as const, key: 'patternCoherent' as const },
                  ]).map(opt => (
                    <button
                      key={opt.v}
                      onClick={() => updateSettings({ breathingPattern: opt.v })}
                      className={`px-2 py-0.5 rounded-md text-[10px] transition-colors duration-150 border ${
                        (settings.breathingPattern ?? '478') === opt.v
                          ? 'bg-primary/20 border-primary/40 text-foreground'
                          : 'border-border/50 text-muted-foreground/60 hover:border-border hover:text-muted-foreground'
                      }`}
                    >
                      {t(opt.key)}
                    </button>
                  ))}
                </div>
              </div>
```

- [ ] **Step 3: Verify + commit**

`bash -c 'bun run check:i18n'` → parity OK. `bash -c 'bun run typecheck'` → PASS.
```bash
git add src/renderer/components/settings-panel.tsx src/shared/i18n/
git commit -m "feat(break): breathing-pattern selector in settings

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5 (Area C1): Preset model + localized built-in names + selector

**Files:** modify `src/shared/types.ts`, `src/renderer/components/preset-selector.tsx`, `src/shared/i18n/{uz,en,ru}.ts`

- [ ] **Step 1: Extend the preset model + custom-presets setting**

In `src/shared/types.ts`:
- Add `isBuiltIn?: boolean;` to `interface TimerPreset` (after `sessionsBeforeLongBreak`).
- Add `isBuiltIn: true` to each of the three `DEFAULT_PRESETS` entries.
- Add a name-key map after `DEFAULT_PRESETS`:
```ts
export const PRESET_NAME_KEYS: Record<string, string> = {
  'deep-work': 'presetDeepWork',
  'classic': 'presetClassic',
  'quick': 'presetQuick',
};
```
- Add to `interface TimerSettings` (after `breathingPattern`): `customPresets: TimerPreset[];`
- Add to `DEFAULT_TIMER_SETTINGS`: `customPresets: [],`

- [ ] **Step 2: i18n built-in preset names (all 3 locales)**

uz: `presetDeepWork: 'Chuqur ish',` `presetClassic: 'Klassik',` `presetQuick: 'Tezkor',`
en: `presetDeepWork: 'Deep Work',` `presetClassic: 'Classic',` `presetQuick: 'Quick',`
ru: `presetDeepWork: 'Глубокая работа',` `presetClassic: 'Классика',` `presetQuick: 'Быстрый',`

- [ ] **Step 3: Update preset-selector to show built-in + custom, localized**

Replace `src/renderer/components/preset-selector.tsx` with:
```tsx
import { DEFAULT_PRESETS, PRESET_NAME_KEYS, type TimerPreset } from '@shared/types';
import { useSettings } from '@renderer/hooks/use-settings';
import { cn } from '@shared/lib/utils';
import type { TranslationKey } from '@shared/i18n';
import { X } from 'lucide-react';

export function PresetSelector() {
  const { settings, updateSettings, t } = useSettings();
  const presets: TimerPreset[] = [...DEFAULT_PRESETS, ...(settings.customPresets ?? [])];

  const applyPreset = (preset: TimerPreset) => {
    updateSettings({
      focusDuration: preset.focusDuration,
      shortBreakDuration: preset.shortBreakDuration,
      longBreakDuration: preset.longBreakDuration,
      sessionsBeforeLongBreak: preset.sessionsBeforeLongBreak,
      activePreset: preset.id,
    });
  };

  const removeCustom = (id: string) => {
    updateSettings({
      customPresets: (settings.customPresets ?? []).filter(p => p.id !== id),
      ...(settings.activePreset === id ? { activePreset: null } : {}),
    });
  };

  const presetLabel = (p: TimerPreset) =>
    p.isBuiltIn ? t(PRESET_NAME_KEYS[p.id] as TranslationKey) : p.name;

  return (
    <div className="flex gap-1 flex-wrap justify-center">
      {presets.map(preset => (
        <div key={preset.id} className="group/preset relative">
          <button
            onClick={() => applyPreset(preset)}
            className={cn(
              'px-2 py-0.5 rounded-md text-[9px] uppercase tracking-wider transition-colors duration-150 border',
              settings.activePreset === preset.id
                ? 'bg-primary/20 border-primary/40 text-foreground'
                : 'border-border/30 text-muted-foreground/30 hover:border-border/60 hover:text-muted-foreground/60',
            )}
          >
            {presetLabel(preset)}
          </button>
          {!preset.isBuiltIn && (
            <button
              onClick={() => removeCustom(preset.id)}
              className="absolute -top-1 -right-1 opacity-0 group-hover/preset:opacity-100 transition-opacity rounded-full bg-background border border-border/50 p-0.5 text-muted-foreground/50 hover:text-destructive/70"
              aria-label={t('delete')}
            >
              <X className="size-2" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Verify + commit**

`bash -c 'bun run check:i18n'` → parity OK. `bash -c 'bun run typecheck'` → PASS.
```bash
git add src/shared/types.ts src/renderer/components/preset-selector.tsx src/shared/i18n/
git commit -m "feat(presets): built-in/custom model + localized names + selector delete

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6 (Area C2): Preset CRUD manager in settings + dangling guard

**Files:** modify `src/renderer/components/settings-panel.tsx`, `src/shared/i18n/{uz,en,ru}.ts`

- [ ] **Step 1: i18n keys (all 3 locales)**

uz: `presets: 'Presetlar',` `newPreset: 'Yangi preset',` `presetNamePlaceholder: 'Preset nomi...',` `savePreset: 'Saqlash',`
en: `presets: 'Presets',` `newPreset: 'New preset',` `presetNamePlaceholder: 'Preset name...',` `savePreset: 'Save',`
ru: `presets: 'Пресеты',` `newPreset: 'Новый пресет',` `presetNamePlaceholder: 'Название пресета...',` `savePreset: 'Сохранить',`
> Reuse existing keys where present: `focusDuration`, `shortBreakDuration`, `longBreakDuration`, `sessionsBeforeLongBreak` for the form field labels; `delete` for the delete aria. Grep `uz.ts` to confirm `presets` does not already exist (it may — if so, do not re-add it).

- [ ] **Step 2: Clear activePreset on manual duration change (dangling guard)**

In `settings-panel.tsx`, the 4 duration `NumberInput`s currently call e.g. `updateSettings({ focusDuration: v })`. Change each of the four to ALSO clear the active preset (a manual edit means the active preset no longer matches):
```tsx
              <NumberInput label={t('focusDuration')} value={settings.focusDuration} min={1} max={120}
                onChange={v => updateSettings({ focusDuration: v, activePreset: null })} />
              <NumberInput label={t('shortBreakDuration')} value={settings.shortBreakDuration} min={1} max={60}
                onChange={v => updateSettings({ shortBreakDuration: v, activePreset: null })} />
              <NumberInput label={t('longBreakDuration')} value={settings.longBreakDuration} min={1} max={60}
                onChange={v => updateSettings({ longBreakDuration: v, activePreset: null })} />
              <NumberInput label={t('sessionsBeforeLongBreak')} value={settings.sessionsBeforeLongBreak} min={1} max={10}
                onChange={v => updateSettings({ sessionsBeforeLongBreak: v, activePreset: null })} />
```

- [ ] **Step 3: Add the preset-manager section**

Add a new section (with a divider before it) after the durations section in `settings-panel.tsx`. It lists custom presets (name + delete) and an inline "new preset" form. Add this local component above `SettingsPanel` (after `ToggleRow`):
```tsx
function PresetManager() {
  const { settings, updateSettings, t } = useSettings();
  const custom = settings.customPresets ?? [];
  const [name, setName] = useState('');
  const [f, setF] = useState(25);
  const [sb, setSb] = useState(5);
  const [lb, setLb] = useState(15);
  const [n, setN] = useState(4);

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const preset = {
      id: `custom-${Date.now()}`,
      name: trimmed,
      focusDuration: f, shortBreakDuration: sb, longBreakDuration: lb, sessionsBeforeLongBreak: n,
    };
    updateSettings({ customPresets: [...custom, preset] });
    setName('');
  };

  const remove = (id: string) => {
    updateSettings({
      customPresets: custom.filter(p => p.id !== id),
      ...(settings.activePreset === id ? { activePreset: null } : {}),
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs uppercase tracking-widest text-muted-foreground/60">{t('presets')}</p>
      {custom.map(p => (
        <div key={p.id} className="flex items-center justify-between gap-2">
          <span className="text-sm text-foreground/80 truncate">{p.name}</span>
          <span className="text-xs text-muted-foreground/40 tabular-nums">{p.focusDuration}/{p.shortBreakDuration}/{p.longBreakDuration}</span>
          <Button variant="ghost" size="icon-xs" onClick={() => remove(p.id)} aria-label={t('delete')}>
            <X className="size-3" />
          </Button>
        </div>
      ))}
      <div className="flex flex-col gap-2 rounded-lg border border-border/40 p-2">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={t('presetNamePlaceholder')}
          className="w-full bg-background/20 border border-border/50 rounded-md px-2 py-1 text-sm placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <div className="grid grid-cols-2 gap-2">
          <NumberInput label={t('focusDuration')} value={f} min={1} max={120} onChange={setF} />
          <NumberInput label={t('shortBreakDuration')} value={sb} min={1} max={60} onChange={setSb} />
          <NumberInput label={t('longBreakDuration')} value={lb} min={1} max={60} onChange={setLb} />
          <NumberInput label={t('sessionsBeforeLongBreak')} value={n} min={1} max={10} onChange={setN} />
        </div>
        <Button variant="outline" size="xs" className="text-xs" onClick={add} disabled={!name.trim()}>
          {t('savePreset')}
        </Button>
      </div>
    </div>
  );
}
```
Then render `<div className="h-px bg-border/50" />` + `<PresetManager />` inside the settings layout (after the durations section). Ensure `useState`, `Button`, `X`, `NumberInput`, `useSettings` are imported/in scope (they are — `useState` and `X` and `Button` already imported; `NumberInput` is defined in this file).

- [ ] **Step 4: Verify + commit**

`bash -c 'bun run check:i18n'` → parity OK. `bash -c 'bun run typecheck'` → PASS.
Manual sanity (later): add a preset, reopen settings → it persists; delete the active one → activePreset clears.
```bash
git add src/renderer/components/settings-panel.tsx src/shared/i18n/
git commit -m "feat(presets): CRUD manager in settings + clear active preset on manual edit

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7 (Area A1): Keybinding model + formatKeyCode + data-driven hook

**Files:** modify `src/shared/types.ts`, create `src/shared/lib/keys.ts`, modify `src/renderer/hooks/use-keyboard-shortcuts.ts`

- [ ] **Step 1: Add keybinding types + defaults**

In `src/shared/types.ts`:
```ts
export type ShortcutAction =
  | 'toggleTimer' | 'skip' | 'toggleMusic' | 'toggleTasks'
  | 'toggleSettings' | 'toggleStats' | 'toggleFocusMode';

export const DEFAULT_KEYBINDINGS: Record<ShortcutAction, string> = {
  toggleTimer: 'Space',
  skip: 'KeyS',
  toggleMusic: 'KeyM',
  toggleTasks: 'KeyT',
  toggleSettings: 'Comma',
  toggleStats: 'KeyB',
  toggleFocusMode: 'KeyF',
};
```
Add to `interface TimerSettings` (after `customPresets`): `keybindings: Record<ShortcutAction, string>;`
Add to `DEFAULT_TIMER_SETTINGS`: `keybindings: DEFAULT_KEYBINDINGS,`

- [ ] **Step 2: Create `src/shared/lib/keys.ts`**

```ts
// Human-readable label for a KeyboardEvent.code value.
export function formatKeyCode(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);       // KeyS → S
  if (code.startsWith('Digit')) return code.slice(5);     // Digit1 → 1
  const map: Record<string, string> = {
    Space: 'Space', Comma: ',', Period: '.', Slash: '/', Semicolon: ';',
    BracketLeft: '[', BracketRight: ']', Enter: 'Enter', Escape: 'Esc',
  };
  return map[code] ?? code;
}
```

- [ ] **Step 3: Rewrite use-keyboard-shortcuts to be data-driven**

Replace `src/renderer/hooks/use-keyboard-shortcuts.ts` with:
```ts
import { useEffect } from 'react';
import { DEFAULT_KEYBINDINGS, type ShortcutAction } from '@shared/types';

interface ShortcutOptions {
  handlers: Partial<Record<ShortcutAction, () => void>>;
  bindings: Record<ShortcutAction, string>;
  onHelp: () => void;
  enabled: boolean;
}

export function useKeyboardShortcuts({ handlers, bindings, onHelp, enabled }: ShortcutOptions) {
  useEffect(() => {
    if (!enabled) return;
    // Per-action fallback so a missing/added binding never reads undefined.
    const active = { ...DEFAULT_KEYBINDINGS, ...bindings };
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === '?') { onHelp(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return; // plain keys only
      for (const action of Object.keys(active) as ShortcutAction[]) {
        if (active[action] === e.code) {
          const fn = handlers[action];
          if (fn) {
            if (action === 'toggleTimer') e.preventDefault(); // stop Space scroll
            fn();
          }
          return;
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handlers, bindings, onHelp, enabled]);
}
```

- [ ] **Step 4: Verify**

`bash -c 'bun run typecheck'` → will FAIL at the call site in `main.tsx` (old signature). That's expected — Task 8 updates the caller. Confirm the FAILURE is ONLY in `main.tsx` (the hook + types + keys compile). If other files error, investigate.

- [ ] **Step 5: Commit**

```bash
git add src/shared/types.ts src/shared/lib/keys.ts src/renderer/hooks/use-keyboard-shortcuts.ts
git commit -m "feat(shortcuts): keybinding model + formatKeyCode + data-driven hook

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```
> Note: typecheck is red between Task 7 and Task 8 (intentional staged refactor). Task 8 makes it green.

---

## Task 8 (Area A2): Wire main.tsx + help overlay + onToggleStats

**Files:** create `src/renderer/components/keyboard-help.tsx`, modify `src/renderer/app/layout/main.tsx`, `src/renderer/app/layout/index.tsx`, `src/shared/i18n/{uz,en,ru}.ts`

- [ ] **Step 1: i18n keys for action labels + help (all 3 locales)**

uz:
```ts
  keyboardShortcuts: 'Klavish yorliqlari',
  scToggleTimer: 'Boshlash / Pauza',
  scSkip: 'O\'tkazib yuborish',
  scToggleMusic: 'Musiqa',
  scToggleTasks: 'Ishlar',
  scToggleSettings: 'Sozlamalar',
  scToggleStats: 'Statistika',
  scToggleFocusMode: 'Focus mode',
  scHelp: 'Yordam',
```
en:
```ts
  keyboardShortcuts: 'Keyboard shortcuts',
  scToggleTimer: 'Start / Pause',
  scSkip: 'Skip',
  scToggleMusic: 'Music',
  scToggleTasks: 'Tasks',
  scToggleSettings: 'Settings',
  scToggleStats: 'Statistics',
  scToggleFocusMode: 'Focus mode',
  scHelp: 'Help',
```
ru:
```ts
  keyboardShortcuts: 'Горячие клавиши',
  scToggleTimer: 'Старт / Пауза',
  scSkip: 'Пропустить',
  scToggleMusic: 'Музыка',
  scToggleTasks: 'Задачи',
  scToggleSettings: 'Настройки',
  scToggleStats: 'Статистика',
  scToggleFocusMode: 'Focus mode',
  scHelp: 'Помощь',
```

- [ ] **Step 2: Create `src/renderer/components/keyboard-help.tsx`**

```tsx
import { Dialog } from 'radix-ui';
import { X } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { useSettings } from '@renderer/hooks/use-settings';
import { DEFAULT_KEYBINDINGS, type ShortcutAction } from '@shared/types';
import { formatKeyCode } from '@shared/lib/keys';
import type { TranslationKey } from '@shared/i18n';

const ACTION_LABEL_KEYS: Record<ShortcutAction, TranslationKey> = {
  toggleTimer: 'scToggleTimer', skip: 'scSkip', toggleMusic: 'scToggleMusic',
  toggleTasks: 'scToggleTasks', toggleSettings: 'scToggleSettings',
  toggleStats: 'scToggleStats', toggleFocusMode: 'scToggleFocusMode',
};

export function KeyboardHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { settings, t } = useSettings();
  const bindings = { ...DEFAULT_KEYBINDINGS, ...(settings.keybindings ?? {}) };
  const actions = Object.keys(ACTION_LABEL_KEYS) as ShortcutAction[];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm" />
        <Dialog.Content className="glass fixed left-1/2 top-1/2 z-50 w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-5 focus:outline-none">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-sm font-medium tracking-widest uppercase text-muted-foreground">{t('keyboardShortcuts')}</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon-xs" aria-label={t('close')}><X className="size-3.5" /></Button>
            </Dialog.Close>
          </div>
          <div className="flex flex-col gap-2">
            {actions.map(a => (
              <div key={a} className="flex items-center justify-between gap-4">
                <span className="text-sm text-foreground/70">{t(ACTION_LABEL_KEYS[a])}</span>
                <kbd className="rounded-md border border-border/60 bg-background/40 px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">{formatKeyCode(bindings[a])}</kbd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-foreground/70">{t('scHelp')}</span>
              <kbd className="rounded-md border border-border/60 bg-background/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">?</kbd>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```
> Confirm the Radix import style matches the project (settings-panel imports `{ Switch } from 'radix-ui'`; this uses `{ Dialog } from 'radix-ui'`). If the project exposes Dialog elsewhere, match that usage. The `glass` class is used by SettingsPanel — reuse it.

- [ ] **Step 3: Wire main.tsx**

In `src/renderer/app/layout/main.tsx`. **Important:** `statsOpen` is NOT owned by `MainLayout` (it lives in `index.tsx`). So both `statsOpen` and `onToggleStats` come in as props.
a) Add two props to `MainLayoutProps` and destructure them: `onToggleStats: () => void;` and `statsOpen: boolean;`.
b) Add `const [helpOpen, setHelpOpen] = useState(false);` next to the other open states (`settingsOpen`, `taskPanelOpen`).
c) Add imports: `import { KeyboardHelp } from '@renderer/components/keyboard-help';` and add `DEFAULT_KEYBINDINGS` to the existing `@shared/types` import (or a new import line).
d) Replace the `useKeyboardShortcuts({...})` call with:
```tsx
  useKeyboardShortcuts({
    handlers: {
      toggleTimer: toggle,
      skip,
      toggleMusic: onToggleMusic,
      toggleTasks: () => setTaskPanelOpen(o => !o),
      toggleSettings: () => setSettingsOpen(o => !o),
      toggleStats: onToggleStats,
      toggleFocusMode: () => updateSettings({ focusMode: !settings.focusMode }),
    },
    bindings: settings.keybindings ?? DEFAULT_KEYBINDINGS,
    onHelp: () => setHelpOpen(true),
    enabled: !(settingsOpen || taskPanelOpen || musicOpen || statsOpen || helpOpen),
  });
```
e) Render `<KeyboardHelp open={helpOpen} onOpenChange={setHelpOpen} />` near the other panels (next to `<SettingsPanel .../>`).

- [ ] **Step 4: Wire index.tsx to pass statsOpen + onToggleStats**

In `src/renderer/app/layout/index.tsx`, find where `<MainLayout ... />` is rendered (it's the component rendered inside the TimerProvider / main view). Pass:
```tsx
        statsOpen={statsOpen}
        onToggleStats={() => setStatsOpen(o => !o)}
```
`statsOpen`/`setStatsOpen` already exist at line ~243. (If `MainLayout` is rendered in more than one place, update each; grep `<MainLayout`.)

- [ ] **Step 5: Verify**

`bash -c 'bun run typecheck'` → PASS (now green again). `bash -c 'bun run check:i18n'` → parity OK.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/keyboard-help.tsx src/renderer/app/layout/main.tsx src/renderer/app/layout/index.tsx src/shared/i18n/
git commit -m "feat(shortcuts): data-driven shortcuts wiring + help overlay (?) + stats toggle

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9 (Area A3): Keybinding editor in settings (capture + conflict + reset)

**Files:** modify `src/renderer/components/settings-panel.tsx`, `src/shared/i18n/{uz,en,ru}.ts`

- [ ] **Step 1: i18n keys (all 3 locales)**

uz: `shortcuts: 'Klavish yorliqlari',` `changeKey: 'O\'zgartirish',` `pressKey: 'Klavishani bosing...',` `keyConflict: 'Bu klavisha band',` `resetShortcuts: 'Standartga qaytarish',`
en: `shortcuts: 'Keyboard shortcuts',` `changeKey: 'Change',` `pressKey: 'Press a key...',` `keyConflict: 'Key already in use',` `resetShortcuts: 'Reset to defaults',`
ru: `shortcuts: 'Горячие клавиши',` `changeKey: 'Изменить',` `pressKey: 'Нажмите клавишу...',` `keyConflict: 'Клавиша занята',` `resetShortcuts: 'Сбросить',`
> Reuse the `scToggleTimer..scToggleFocusMode` action-label keys from Task 8 for the editor rows.

- [ ] **Step 2: Add a `ShortcutEditor` component + capture logic**

Add above `SettingsPanel` in `settings-panel.tsx`:
```tsx
import { DEFAULT_KEYBINDINGS, type ShortcutAction } from '@shared/types';
import { formatKeyCode } from '@shared/lib/keys';
import type { TranslationKey } from '@shared/i18n';

const SC_LABEL_KEYS: Record<ShortcutAction, TranslationKey> = {
  toggleTimer: 'scToggleTimer', skip: 'scSkip', toggleMusic: 'scToggleMusic',
  toggleTasks: 'scToggleTasks', toggleSettings: 'scToggleSettings',
  toggleStats: 'scToggleStats', toggleFocusMode: 'scToggleFocusMode',
};

function ShortcutEditor() {
  const { settings, updateSettings, t } = useSettings();
  const bindings = { ...DEFAULT_KEYBINDINGS, ...(settings.keybindings ?? {}) };
  const [capturing, setCapturing] = useState<ShortcutAction | null>(null);
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    if (!capturing) return;
    setConflict(false);
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.key === 'Escape') { setCapturing(null); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return; // plain keys only
      const code = e.code;
      const taken = (Object.keys(bindings) as ShortcutAction[])
        .some(a => a !== capturing && bindings[a] === code);
      if (taken) { setConflict(true); return; }
      updateSettings({ keybindings: { ...bindings, [capturing]: code } });
      setCapturing(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [capturing, bindings, updateSettings]);

  const actions = Object.keys(SC_LABEL_KEYS) as ShortcutAction[];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-muted-foreground/60">{t('shortcuts')}</p>
        <Button variant="ghost" size="xs" className="text-[10px]" onClick={() => updateSettings({ keybindings: DEFAULT_KEYBINDINGS })}>
          {t('resetShortcuts')}
        </Button>
      </div>
      {conflict && <p className="text-[10px] text-destructive/70">{t('keyConflict')}</p>}
      {actions.map(a => (
        <div key={a} className="flex items-center justify-between gap-4">
          <label className="text-sm text-foreground/80 select-none">{t(SC_LABEL_KEYS[a])}</label>
          <Button
            variant={capturing === a ? 'outline' : 'ghost'}
            size="xs"
            className="text-[10px] min-w-[64px] gap-1"
            onClick={() => setCapturing(a)}
          >
            {capturing === a ? t('pressKey') : formatKeyCode(bindings[a])}
          </Button>
        </div>
      ))}
    </div>
  );
}
```
> **Capture vs global handler (key correctness):** while `capturing !== null`, the SettingsPanel sheet is open, so `MainLayout`'s `enabled` is already `false` (overlay-open suppression from Task 8) — the global shortcut handler is inert during capture. The capture listener uses `capture: true` to grab the key first. Escape cancels.

- [ ] **Step 3: Render the editor**

Add `<div className="h-px bg-border/50" />` + `<ShortcutEditor />` in the SettingsPanel layout (e.g. before the `language` section). Ensure `useEffect` is imported (it is, line 1).

- [ ] **Step 4: Verify + commit**

`bash -c 'bun run check:i18n'` → parity OK. `bash -c 'bun run typecheck'` → PASS.
```bash
git add src/renderer/components/settings-panel.tsx src/shared/i18n/
git commit -m "feat(shortcuts): rebinding editor with capture/conflict/reset

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Green gates**

```bash
cd /home/madrimov/Projects/lofi-pomodoro
bash -c 'bun run check:i18n' && bash -c 'bun run typecheck' && bash -c 'bun run build:vite'
```
Expected: parity OK, typecheck PASS, build succeeds.

- [ ] **Step 2: i18n leftover sweep (SP1-style, incl. expr-form)**

```bash
grep -rnE 'placeholder="|aria-label="|title="' src/renderer/components src/renderer/app || echo "NONE-literal"
grep -rnE "aria-label=\{[^}]*'[^']+'|title=\{[^}]*'[^']+'" src/renderer/components src/renderer/app | grep -vE "t\(|tFn\(|tr\(|\?:" || echo "NONE-expr"
```
Expected: NONE-literal, NONE-expr. Wire any real leftover (reuse key or add + parity).

- [ ] **Step 3: Manual GUI pass (`bash -c 'bun run dev'`)**
- **Restore (D):** set "Off" → start timer, close+reopen app → starts fresh; set "Always" → reopens with prior timeLeft; "2 hours" default works.
- **Breathing (B):** open a break (or trigger), switch pattern in settings: 4-7-8 (3 phases), Box (4 phases, second hold present), Coherent (2 phases) — counts and labels correct.
- **Tips (B):** stretch/hydration/eye-rest show varied tips across breaks; eye-rest shows the 20-20-20 line localized in all 3 languages.
- **Presets (C):** create a custom preset → appears in selector + persists after reopen; apply it; delete it (active one clears highlight); built-in names localize across uz/en/ru.
- **Shortcuts (A):** each default key works (Space/S/M/T/comma/B/F); `?` opens help; opening any dialog suppresses shortcuts; rebind a key (capture), conflict shows warning; reset restores defaults; rebind persists after reopen.

- [ ] **Step 4: Final commit (if sweep fixes were needed)**

```bash
git add -A && git commit -m "i18n/ux: SP2 final verification fixes

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review notes (author)
- **Spec coverage:** A=Tasks 7,8,9; B=Tasks 2,3,4 (+ SP1 leftover wired in 3); C=Tasks 5,6; D=Task 1. Final sweep+manual = Task 10.
- **Staged typecheck red (Task 7→8):** intentional and documented; the data-driven hook lands before its caller is updated. Reviewer should not treat the Task 7 red typecheck as a failure.
- **`enabled` needs `statsOpen`:** main.tsx does NOT own statsOpen — Task 8 passes both `statsOpen` and `onToggleStats` from index.tsx. Verified statsOpen lives in index.tsx:243.
- **Dangling activePreset:** cleared on custom-preset delete (Tasks 5,6) AND on manual duration edit (Task 6 step 2).
- **Plural/interp:** none of SP2's new keys use `{count}` plural — all are static labels, so no base-key-plus-variant complication.
- **No placeholders; exact paths; BUN commands throughout.**
