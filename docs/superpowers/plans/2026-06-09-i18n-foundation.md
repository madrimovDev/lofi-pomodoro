# i18n Foundation (SP1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all hardcoded user-facing strings into the i18n system, wire already-existing-but-bypassed keys, add minimal interpolation + plural support, and make date/time locale-aware — so EN/RU locales render fully translated.

**Architecture:** Extend the existing flat `Record<string,string>` i18n (`src/shared/i18n/`) with a `t(key, params?)` signature: `{param}` interpolation + a per-locale plural selector backed by `Intl.PluralRules`. Plural keys use suffix convention (`base_one`/`base_few`/`base_many`/`base_other`). Weekday labels use curated per-locale arrays (WebKitGTK `'uz'` is unreliable); time uses `Intl.DateTimeFormat`. A standalone Node script enforces key parity across locales.

**CRITICAL conventions (verified against the codebase — do not deviate):**
1. **Translator acquisition:** components get the translator from the settings hook: `const { settings, t } = useSettings();` (`useSettings` already returns `{ settings, t }` — see `stats-panel.tsx:62`, `app/layout/index.tsx:327`). Do NOT call `getT(...)` manually inside components. `getT` is only used by `useSettings` internally and by non-React helpers.
2. **Import aliases:** `@shared/*` → `src/shared/*`, `@renderer/*` → `src/renderer/*`. **There is NO `@/*` TS path mapping** (vite resolves `@`→`src` but `tsconfig.json` does not, so `@/...` imports FAIL `tsc`). Always use `@shared/...` and `@renderer/...`.
3. **Name clashes:** several files already bind a local `t` to something else (easing math var `app/layout/index.tsx:61`; loop var `task-panel.tsx:42`; `setTimeout` handle `task-panel.tsx:506`). When adding the translator to such a file, destructure as `const { settings, t: tr } = useSettings();` and use `tr(...)`, OR rename the conflicting local var. Pick one per file and be consistent.
4. **Module-level functions** (e.g. `task-panel.tsx` `formatDate`/due-label at lines ~35–58) live OUTSIDE the component and cannot see the component's translator — pass `tr` (and `locale` if needed) in as a parameter.

**Tech Stack:** TypeScript, React 19, Vite, Tauri v2. No new runtime dependencies (in-house i18n). Verification via `tsc --noEmit`, `vite build`, a Node parity script, and manual 3-locale UI check.

**Reference spec:** `docs/superpowers/specs/2026-06-09-i18n-foundation-design.md`

> **Note on testing:** This project has zero test framework (intentionally, per spec §6 — "simple script"). Do NOT add vitest/jest. Automated gates are: the parity script + `typecheck` + `build`. Pure-logic correctness (plural/interpolation) is verified with documented manual Node REPL checks showing exact expected output.

---

## File Structure

- `src/shared/i18n/index.ts` — **modify**: add `LOCALES`, `pluralCategory()`, change `getT` to return `t(key, params?)`.
- `src/shared/i18n/uz.ts`, `en.ts`, `ru.ts` — **modify**: add new keys (incl. plural-suffixed forms).
- `src/shared/lib/format.ts` — **create**: locale-aware `formatTime`, `formatWeekdayShort`, weekday arrays.
- `src/shared/lib/date.ts` — **modify** (if relative-day helper belongs there) or keep date-key logic; relative-day labels resolved via i18n in components.
- `scripts/check-i18n.mjs` — **create**: key-parity + plural-form completeness check.
- `package.json` — **modify**: add `"check:i18n"` script.
- Component wiring (modify): `break-screen.tsx`, `task-panel.tsx`, `music-side-panel.tsx`, `music-panel.tsx`, `stats-panel.tsx`, `current-time.tsx`, `preset-selector.tsx`, `app/layout/index.tsx`, `app/layout/main.tsx`, `window-control.tsx`, `settings-panel.tsx`.

---

## Task 1: Extend i18n core (interpolation + plural)

**Files:**
- Modify: `src/shared/i18n/index.ts`

- [ ] **Step 1: Replace `index.ts` with the extended implementation**

```ts
import uz from './uz';
import en from './en';
import ru from './ru';

export type Locale = 'uz' | 'en' | 'ru';
export type TranslationKey = keyof typeof uz;

export const LOCALES: Locale[] = ['uz', 'en', 'ru'];

const translations: Record<Locale, Record<string, string>> = {
  uz: uz as Record<string, string>,
  en: en as Record<string, string>,
  ru: ru as Record<string, string>,
};

export type PluralCategory = 'one' | 'few' | 'many' | 'other';

// Per-locale plural category via Intl.PluralRules (uz → always 'other').
const pluralRules: Partial<Record<Locale, Intl.PluralRules>> = {};
export function pluralCategory(locale: Locale, n: number): PluralCategory {
  if (locale === 'uz') return 'other';
  if (!pluralRules[locale]) pluralRules[locale] = new Intl.PluralRules(locale);
  const cat = pluralRules[locale]!.select(n) as PluralCategory;
  return cat;
}

type Params = Record<string, string | number>;

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    params[k] != null ? String(params[k]) : `{${k}}`
  );
}

export type TFunc = (key: TranslationKey, params?: Params) => string;

export function getT(locale: Locale): TFunc {
  const dict = translations[locale];
  const fallback = translations.uz;
  return (key, params) => {
    let resolvedKey: string = key;
    // Plural: if params.count is present and a `${key}_<cat>` form exists, use it.
    if (params && typeof params.count === 'number') {
      const cat = pluralCategory(locale, params.count);
      const candidates = [`${key}_${cat}`, `${key}_other`];
      for (const c of candidates) {
        if (dict[c] != null || fallback[c] != null) { resolvedKey = c; break; }
      }
    }
    const template = dict[resolvedKey] ?? fallback[resolvedKey] ?? dict[key] ?? fallback[key] ?? key;
    return interpolate(template, params);
  };
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS (existing `t('key')` call sites still valid — `params` is optional).

> If `tsc` complains that plural-suffixed keys (e.g. `videoCount_one`) are not in `TranslationKey`: that is expected only after Task 4 adds them. At this point no plural keys exist yet, so no error.

- [ ] **Step 3: Manual logic check (plural + interpolation)**

Create a temp check (delete after):
```bash
cat > /tmp/t-check.mjs <<'EOF'
const pr = (l) => new Intl.PluralRules(l);
for (const n of [1, 2, 5, 21]) {
  console.log('ru', n, pr('ru').select(n)); // 1=one 2=few 5=many 21=one
  console.log('en', n, pr('en').select(n)); // 1=one else other
}
EOF
bash -c 'node /tmp/t-check.mjs'
```
Expected output includes: `ru 1 one`, `ru 2 few`, `ru 5 many`, `ru 21 one`, `en 1 one`, `en 2 other`.
Then: `rm /tmp/t-check.mjs`

- [ ] **Step 4: Commit**

```bash
git add src/shared/i18n/index.ts
git commit -m "feat(i18n): t(key, params) with interpolation + plural selector

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Key-parity check script

**Files:**
- Create: `scripts/check-i18n.mjs`
- Modify: `package.json`

- [ ] **Step 1: Create the check script**

`scripts/check-i18n.mjs`:
```js
// Verifies uz/en/ru have identical key sets, by parsing the source files.
// No TS compilation needed — keys are matched by regex on `^\s*ident:` lines.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const i18nDir = join(here, '..', 'src', 'shared', 'i18n');
const locales = ['uz', 'en', 'ru'];

function extractKeys(locale) {
  const src = readFileSync(join(i18nDir, `${locale}.ts`), 'utf8');
  const keys = new Set();
  for (const m of src.matchAll(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*:/gm)) {
    keys.add(m[1]);
  }
  return keys;
}

const sets = Object.fromEntries(locales.map((l) => [l, extractKeys(l)]));
const base = sets.uz;
let failed = false;

for (const l of ['en', 'ru']) {
  const missing = [...base].filter((k) => !sets[l].has(k));
  const extra = [...sets[l]].filter((k) => !base.has(k));
  if (missing.length) {
    failed = true;
    console.error(`[${l}] MISSING ${missing.length} keys:`, missing.join(', '));
  }
  if (extra.length) {
    failed = true;
    console.error(`[${l}] EXTRA ${extra.length} keys:`, extra.join(', '));
  }
}

if (failed) {
  console.error('\ni18n parity check FAILED');
  process.exit(1);
}
console.log(`i18n parity OK — ${base.size} keys × ${locales.length} locales`);
```

- [ ] **Step 2: Add npm script**

In `package.json` `scripts`, add after `"format"`:
```json
"check:i18n": "node scripts/check-i18n.mjs",
```

- [ ] **Step 3: Run it (should pass on current keys)**

Run: `bash -c 'npm run check:i18n'`
Expected: `i18n parity OK — 97 keys × 3 locales`

> The `bash -c` wrapper avoids a zsh profile issue in this environment that makes bare `node` exit 126.

- [ ] **Step 4: Commit**

```bash
git add scripts/check-i18n.mjs package.json
git commit -m "test(i18n): key-parity check script + npm run check:i18n

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Locale-aware format helpers

**Files:**
- Create: `src/shared/lib/format.ts`

**Decision (spec §E):** Weekday short-labels use curated per-locale arrays — deterministic and avoids the WebKitGTK `'uz'` Intl uncertainty. Time uses `Intl.DateTimeFormat` (numeric, low-risk; Node confirms `uz → 14:05`).

- [ ] **Step 1: Create `src/shared/lib/format.ts`**

```ts
import type { Locale } from '@shared/i18n';

// Curated weekday short labels, index 0 = Sunday (matches Date.getDay()).
const WEEKDAY_SHORT: Record<Locale, string[]> = {
  uz: ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  ru: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
};

export function formatWeekdayShort(locale: Locale, date: Date): string {
  return WEEKDAY_SHORT[locale][date.getDay()];
}

const timeFmt: Partial<Record<Locale, Intl.DateTimeFormat>> = {};
export function formatTime(locale: Locale, date: Date): string {
  if (!timeFmt[locale]) {
    timeFmt[locale] = new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return timeFmt[locale]!.format(date);
}
```

> `@shared/i18n` resolves to `src/shared/i18n` (confirmed in `vite.config.ts` `pathAliases` + `tsconfig.json` `paths`).

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/shared/lib/format.ts
git commit -m "feat(i18n): locale-aware weekday/time format helpers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Add new i18n keys (uz/en/ru)

**Files:**
- Modify: `src/shared/i18n/uz.ts`, `src/shared/i18n/en.ts`, `src/shared/i18n/ru.ts`

Many hardcoded strings map to **existing** keys (wired in later tasks). This task only adds the genuinely NEW keys below.

- [ ] **Step 1: Append new keys to `uz.ts`** (before the closing `} as const;`)

```ts
  // Break stretch tips (moved as-is from break-screen.tsx)
  stretchTip1: 'Yelkangizni orqaga tortib, ko\'ksingizni kering',
  stretchTip2: 'Boshingizni asta-sekin chap va o\'ngga burting',
  stretchTip3: 'Qo\'llaringizni yuqoriga ko\'tarib cho\'zing',
  stretchTip4: 'O\'rnatingizdan turib, oyoqlaringizni silking',
  stretchTip5: 'Ko\'zingizni yumib, yuzingizni bo\'shashtirang',
  stretchTip6: 'Barmoqlaringizni burging va yozing',
  stretchTip7: 'Belingizni asta-sekin burang',
  stretchTip8: 'Chuqur nafas olib, asta chiqaring',
  // Mini-mode mode labels
  miniFocus: 'Fokus',
  miniShortBreak: 'Tanaffus',
  miniLongBreak: 'Uzoq tanaffus',
  // Tasks
  confirmClearTasks: 'Ishonchingiz komilmi?',
  clearCompleted: 'Barchasini o\'chirish',
  // Generic aria / actions
  edit: 'Tahrirlash',
  delete: 'O\'chirish',
  reset: 'Reset',
  normalMode: 'Normal rejimga qaytish',
  focusModeLabel: 'Focus mode',
  // Music
  tabFolder: 'Papka',
  changeFolder: 'Papkani o\'zgartirish',
  selectFolder: 'Papka tanlash',
  ytUrlPlaceholder: 'YouTube URL yoki playlist...',
  // Plural: video count (uz has a single form)
  videoCount_other: '{count} ta video',
  // Plural: streak day label
  streakDay_other: 'kun ketma-ket',
```

- [ ] **Step 2: Append the SAME keys to `en.ts`**

```ts
  stretchTip1: 'Pull your shoulders back and open your chest',
  stretchTip2: 'Slowly turn your head left and right',
  stretchTip3: 'Reach your arms up and stretch tall',
  stretchTip4: 'Stand up and shake out your legs',
  stretchTip5: 'Close your eyes and relax your face',
  stretchTip6: 'Bend and stretch your fingers',
  stretchTip7: 'Gently twist your waist side to side',
  stretchTip8: 'Take a deep breath and exhale slowly',
  miniFocus: 'Focus',
  miniShortBreak: 'Break',
  miniLongBreak: 'Long break',
  confirmClearTasks: 'Are you sure?',
  clearCompleted: 'Clear all',
  edit: 'Edit',
  delete: 'Delete',
  reset: 'Reset',
  normalMode: 'Back to normal mode',
  focusModeLabel: 'Focus mode',
  tabFolder: 'Folder',
  changeFolder: 'Change folder',
  selectFolder: 'Select folder',
  ytUrlPlaceholder: 'YouTube URL or playlist...',
  // Plural (en: one / other)
  videoCount_one: '{count} video',
  videoCount_other: '{count} videos',
  streakDay_one: 'day streak',
  streakDay_other: 'day streak',
```

- [ ] **Step 3: Append the SAME keys to `ru.ts`**

```ts
  stretchTip1: 'Отведите плечи назад и раскройте грудь',
  stretchTip2: 'Медленно поверните голову влево и вправо',
  stretchTip3: 'Поднимите руки вверх и потянитесь',
  stretchTip4: 'Встаньте и встряхните ноги',
  stretchTip5: 'Закройте глаза и расслабьте лицо',
  stretchTip6: 'Сожмите и разожмите пальцы',
  stretchTip7: 'Плавно поверните корпус из стороны в сторону',
  stretchTip8: 'Сделайте глубокий вдох и медленно выдохните',
  miniFocus: 'Фокус',
  miniShortBreak: 'Перерыв',
  miniLongBreak: 'Долгий перерыв',
  confirmClearTasks: 'Вы уверены?',
  clearCompleted: 'Очистить всё',
  edit: 'Редактировать',
  delete: 'Удалить',
  reset: 'Сброс',
  normalMode: 'Вернуться в обычный режим',
  focusModeLabel: 'Focus mode',
  tabFolder: 'Папка',
  changeFolder: 'Сменить папку',
  selectFolder: 'Выбрать папку',
  ytUrlPlaceholder: 'YouTube URL или плейлист...',
  // Plural (ru: one / few / many)
  videoCount_one: '{count} видео',
  videoCount_few: '{count} видео',
  videoCount_many: '{count} видео',
  streakDay_one: 'день подряд',
  streakDay_few: 'дня подряд',
  streakDay_many: 'дней подряд',
```

> **Note on parity:** plural keys differ per locale by design (uz/en lack `_few`/`_many`). The parity script (Task 2) will FAIL on these. Fix the script to ignore plural-suffixed keys — see Step 4.

- [ ] **Step 4: Make the parity script plural-aware**

In `scripts/check-i18n.mjs`, change `extractKeys` to strip plural suffixes from a key before adding, so only the BASE key is compared:
```js
function extractKeys(locale) {
  const src = readFileSync(join(i18nDir, `${locale}.ts`), 'utf8');
  const keys = new Set();
  for (const m of src.matchAll(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*:/gm)) {
    keys.add(m[1].replace(/_(one|few|many|other)$/, ''));
  }
  return keys;
}
```
Now `videoCount_one`/`videoCount_other`/etc. all collapse to base `videoCount`, so all three locales agree on the base-key set.

- [ ] **Step 5: Run parity + typecheck**

Run: `bash -c 'npm run check:i18n'`
Expected: `i18n parity OK — <N> keys × 3 locales` (N = base-key count, no failures).

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/shared/i18n/ scripts/check-i18n.mjs
git commit -m "feat(i18n): add keys for hardcoded strings (uz/en/ru) + plural-aware parity

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Wire `break-screen.tsx`

**Files:**
- Modify: `src/renderer/components/break-screen.tsx`

- [ ] **Step 1: Replace the `STRETCH_TIPS` array with i18n keys**

`break-screen.tsx` already receives `t` (BreathingCircle uses it). Replace:
```ts
const STRETCH_TIPS = [
  'Yelkangizni orqaga tortib, ko\'ksingizni kering',
  ...8 entries...
];
```
with a key list:
```ts
const STRETCH_TIP_KEYS = [
  'stretchTip1', 'stretchTip2', 'stretchTip3', 'stretchTip4',
  'stretchTip5', 'stretchTip6', 'stretchTip7', 'stretchTip8',
] as const;
```
At the site that picks a random tip, replace `STRETCH_TIPS[i]` with `t(STRETCH_TIP_KEYS[i])`. `break-screen.tsx` already imports `useSettings` (line 4) and passes a `t: (key: TranslationKey) => string` prop to subcomponents like `BreathingCircle`/`HydrationScreen`. The component that renders the stretch tip must have `t` available the same way — read the file and ensure the stretch screen receives `t` (destructured from `useSettings()` in the parent, or passed as a prop like the other activity screens). The `t` prop type stays `(key: TranslationKey) => string` (params optional, back-compatible with the new `TFunc`).

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/break-screen.tsx
git commit -m "i18n(break): stretch tips via i18n keys

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Wire `task-panel.tsx`

**Files:**
- Modify: `src/renderer/components/task-panel.tsx`

> **IMPORTANT:** `task-panel.tsx` currently uses **NO** i18n at all — every user-facing string is hardcoded. (The earlier impression that it "uses `t`" was a false positive: the only `t` symbols are a loop var at line 42 and a `setTimeout` handle at line 506, both non-translator.) So this task both **adds** the translator and **wires** every literal.

- [ ] **Step 1: Add the translator (mind the name clashes)**

In each React component within the file that renders literals, add:
```ts
import { useSettings } from '@renderer/hooks/use-settings';
// inside the component, alias to avoid the line-506 setTimeout `t`:
const { t: tr } = useSettings();
```
Use `tr(...)` for all translations in this file.

The module-level helpers `formatDate` (~line 35) and the due-label function (~lines 52–58) are OUTSIDE any component — give them a `tr: TFunc` parameter and pass the component's `tr` at each call site. Import the type: `import type { TFunc } from '@shared/i18n';`.

- [ ] **Step 2: Replace literals with `tr(...)` calls**

Apply these exact replacements (literal → key). Reuse existing keys where noted:

| Location (literal) | Replace with |
|---|---|
| `'Bugun'` (formatDate, line ~35) | `tr('dueDateToday')` *(existing: "Bugun")* |
| `'Kecha'` (line ~36) | new key — add `dateYesterday` (uz `'Kecha'`, en `'Yesterday'`, ru `'Вчера'`) to all locales + parity |
| `` `⚠ Kechikdi` `` (line ~56) | `` `⚠ ${tr('dueDateOverdue')}` `` *(existing)* |
| `'🗓 Bugun'` (line ~57) | `` `🗓 ${tr('dueDateToday')}` `` *(existing)* |
| `'🗓 Ertaga'` (line ~58) | `` `🗓 ${tr('dueDateTomorrow')}` `` *(existing)* |
| `aria-label="Bekor qilish"` (~130) | `aria-label={tr('cancel')}` *(existing)* |
| `Tugatish` text (~171) | `{tr('finish')}` *(existing)* |
| `placeholder="Kichik ish qo'shish..."` (~286) | `placeholder={tr('addSubtask')}` *(existing)* |
| `aria-label="Tanlash"` (~335) | `aria-label={tr('selectFile')}` *(existing "Tanlash")* |
| `aria-label="Tahrirlash"` (~374) | `aria-label={tr('edit')}` *(new)* |
| `aria-label="O'chirish"` (~381, ~541) | `aria-label={tr('delete')}` *(new)* |
| `aria-label="Bajarildi"` (~393) | `aria-label={tr('completed')}` *(existing)* |
| `'Quyida ish nomini kiriting'` (~422) | `tr('emptyStep1')` *(existing)* |
| `"Ro'yxatdan ishni tanlang"` (~423) | `tr('emptyStep2')` *(existing)* |
| `placeholder="Task nomi..."` (~460) | `placeholder={tr('taskNamePlaceholder')}` *(existing)* |
| `placeholder="Tasnif (ixtiyoriy)..."` (~468) | `placeholder={tr('descPlaceholder')}` *(existing)* |
| `placeholder="Tasnif..."` (~217) | `placeholder={tr('descPlaceholder')}` *(existing)* |
| `Qo'shish` text (~485) | `{tr('addTask')}` *(existing)* |
| `confirmClear ? 'Ishonchingiz komilmi?' : "Barchasini o'chirish"` (~528) | `confirmClear ? tr('confirmClearTasks') : tr('clearCompleted')` *(new keys)* |
| `aria-label="Qidirish"` (~627) | `aria-label={tr('search')}` *(existing)* |
| `aria-label="Eksport"` (~630) | `aria-label={tr('exportTasks')}` *(existing)* |
| `aria-label="Import"` (~633) | `aria-label={tr('importTasks')}` *(existing)* |
| `placeholder="Ish nomi..."` (~646) | `placeholder={tr('searchPlaceholder')}` *(existing)* |

> Line numbers are pre-change approximations — match by the literal string, not the line. `dueDateToday`/`dueDateTomorrow`/`dueDateOverdue` and the empty-step / placeholder keys ALREADY EXIST in the locale files (this is the "wire existing-but-bypassed keys" part of the spec).

Add the one new base key `dateYesterday` to uz/en/ru in this task.

- [ ] **Step 3: Verify parity + typecheck**

Run: `bash -c 'npm run check:i18n'` → Expected: parity OK.
Run: `npm run typecheck` → Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/task-panel.tsx src/shared/i18n/
git commit -m "i18n(tasks): wire task-panel strings to i18n (+ dateYesterday)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Wire `music-side-panel.tsx` + `music-panel.tsx`

**Files:**
- Modify: `src/renderer/components/music-side-panel.tsx`, `src/renderer/components/music-panel.tsx`

- [ ] **Step 1: Add the translator to both components**

Neither uses i18n yet. Add at top of each component body:
```ts
import { useSettings } from '@renderer/hooks/use-settings';
// inside component:
const { t } = useSettings();
```
> `music-panel.tsx` has a local `t` (the tab id) at ~line 303 — in THAT file destructure as `const { t: tFn } = useSettings();` and use `tFn(...)` everywhere (see Step 3). `music-side-panel.tsx` has no clash, use `t`.

- [ ] **Step 2: Replace literals in `music-side-panel.tsx`**

| Literal | Replace with |
|---|---|
| `TAB_LABELS = { folder: 'Papka', youtube: 'YouTube', radio: 'Radio' }` | `{ folder: t('tabFolder'), youtube: 'YouTube', radio: t('radio') }` *(radio existing; YouTube is a brand, keep literal)* |
| `"Papka qo'shish"` (~129) | `{t('addFolder')}` *(existing "Papka qo'shish")* |
| `placeholder="Stansiya nomi..."` (~257) | `placeholder={t('radioName')}` *(existing)* |
| `placeholder="Stream URL..."` (~264) | `placeholder={t('radioUrlPlaceholder')}` *(existing)* |
| `placeholder="YouTube URL yoki playlist..."` (~341) | `placeholder={t('ytUrlPlaceholder')}` *(new)* |
| `aria-label="Ortga"` (~385) | `aria-label={t('back')}` *(existing)* |
| `playlist.itemCount > 0 ? \`${playlist.itemCount} ta video\` : '1 ta video'` (~438) | `t('videoCount', { count: playlist.itemCount > 0 ? playlist.itemCount : 1 })` *(plural)* |

> `TAB_LABELS` is a module-level const; move it inside the component (so `t` is in scope) or convert to a function `tabLabels(t)`.

- [ ] **Step 3: Replace literals in `music-panel.tsx`**

| Literal | Replace with |
|---|---|
| `config.folderPath ? 'Papkani o\'zgartirish' : 'Papka tanlash'` (~103) | `config.folderPath ? t('changeFolder') : t('selectFolder')` *(new)* |
| `placeholder="YouTube URL yoki playlist..."` (~209) | `placeholder={t('ytUrlPlaceholder')}` *(new)* |
| `aria-label="Yopish"` (~284) | `aria-label={t('close')}` *(existing)* |
| `t === 'folder' ? '📁 Papka' : '▶ YouTube'` (~303) | `t === 'folder' ? \`📁 ${tFn('tabFolder')}\` : '▶ YouTube'` |

> **Name clash:** `music-panel.tsx` line ~303 uses a local variable `t` (the tab id) in the map. Name the translator `tFn` (or `tr`) in this file to avoid shadowing. Apply that name consistently for all replacements in this file.

- [ ] **Step 4: Verify parity + typecheck**

Run: `bash -c 'npm run check:i18n'` → parity OK.
Run: `npm run typecheck` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/music-side-panel.tsx src/renderer/components/music-panel.tsx
git commit -m "i18n(music): wire music panels to i18n (+ video-count plural)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Wire `stats-panel.tsx` (weekday labels)

**Files:**
- Modify: `src/renderer/components/stats-panel.tsx`

- [ ] **Step 1: Replace `DAY_LABELS` with the format helper**

`stats-panel.tsx` ALREADY destructures `const { settings, t } = useSettings();` (line ~62) — no need to add the translator. Import the helper: `import { formatWeekdayShort } from '@shared/lib/format';`.

Replace the module-level `const DAY_LABELS = ['Ya','Du','Se','Ch','Pa','Ju','Sh'];` (line ~14) and its use `label: DAY_LABELS[d.getDay()]` (line ~23) with `label: formatWeekdayShort(locale, d)`. If the week-data builder that contains line ~23 is a **module-level** function (outside the component), give it a `locale: Locale` parameter and pass `settings.locale` from the component; import `import type { Locale } from '@shared/i18n';`.

Also replace `aria-label="Yopish"` (~87) with `aria-label={t('close')}` (`t` already in scope).

- [ ] **Step 2: Wire the streak label as a plural (spec §D)**

At line ~99, `{t('streak')}` renders a static label next to the streak number. Replace with `{t('streakDay', { count: streak })}`. (`streak` value comes from `useStats()`.) The existing flat `streak` key becomes unused — leave it in all three locale files for now (removing it would break parity symmetry unnecessarily; a later cleanup can drop it).

- [ ] **Step 3: Verify parity + typecheck**

Run: `bash -c 'npm run check:i18n'` → parity OK.
Run: `npm run typecheck` → PASS.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/stats-panel.tsx
git commit -m "i18n(stats): locale-aware weekday labels + streak plural + close aria-label

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Wire layout, window-control, main, settings, current-time, preset-selector

**Files:**
- Modify: `src/renderer/app/layout/index.tsx`, `src/renderer/app/layout/main.tsx`, `src/renderer/components/window-control.tsx`, `src/renderer/components/settings-panel.tsx`, `src/renderer/components/current-time.tsx`, `src/renderer/components/preset-selector.tsx`

- [ ] **Step 1: `app/layout/index.tsx`**

> **Name clash:** this file has `const t = rawT * rawT * rawT` (easing math) at line ~61, AND `MainLayout` destructures `const { settings, t } = useSettings()` at line ~327. `MiniLayout` (line ~37) destructures only `const { settings } = useSettings()` at line ~248 — **it has no translator**. Add `t` there: `const { settings, t } = useSettings();`. The easing `t` at line 61 is in a DIFFERENT function scope (an easing helper), so no actual collision — but verify the scope before renaming anything. Import the type at top: `import type { TFunc } from '@shared/i18n';`.

`MINI_MODE_LABELS` is module-level. Convert to a function:
```ts
const miniModeLabel = (mode: string, t: TFunc) =>
  mode === 'focus' ? t('miniFocus') : mode === 'short-break' ? t('miniShortBreak') : t('miniLongBreak');
```
Replace usages of `MINI_MODE_LABELS[mode]` with `miniModeLabel(mode, t)`. Replace `aria-label="Skip"` (~205) → `aria-label={t('skip')}`, `aria-label="Normal rejimga qaytish"` (~215) → `aria-label={t('normalMode')}`. (These aria-labels are in `MiniLayout`, which now has `t`.)

- [ ] **Step 2: `app/layout/main.tsx`**

Add the translator: `const { t } = useSettings();` (import `useSettings` from `@renderer/hooks/use-settings`; if `useSettings` is already called, just add `t` to the destructure). Replace aria-labels: `'Skip'`→`t('skip')`, `'Ishlar'`→`t('tasks')`, `'Musiqa'`→`t('music')`, `'Focus mode'`→`t('focusModeLabel')`, `'Sozlamalar'`→`t('settings')`.

- [ ] **Step 3: `window-control.tsx`**

Add the translator: `const { t } = useSettings();` (import from `@renderer/hooks/use-settings`). Replace aria-labels: `'Statistika'`→`t('statistics')`, `'Mini mode'`→`t('miniMode')`, `'Always on top'`→`t('alwaysOnTop')`.

- [ ] **Step 4: `settings-panel.tsx`**

Replace `aria-label="Reset"` (~129) → `aria-label={t('reset')}` (file already destructures `t` from `useSettings`).

- [ ] **Step 5: `current-time.tsx` (locale-aware time)**

Make it use the app locale:
```tsx
import { useEffect, useState } from 'react';
import { useSettings } from '@renderer/hooks/use-settings';
import { formatTime } from '@shared/lib/format';

export const CurrentTime = () => {
  const { settings } = useSettings();
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="text-xs">{formatTime(settings.locale, time)}</span>;
};
```
> The 1s re-render is a known SP7 (perf) item — do NOT optimize it here.

- [ ] **Step 6: `preset-selector.tsx`**

`preset.name` comes from `DEFAULT_PRESETS` (e.g. "Deep Work", "Classic", "Quick"). These are English proper-ish names. **Leave preset names as-is** (out of SP1 scope — preset customization is SP2). No change unless a hardcoded Uzbek UI label exists; the grep showed only `{preset.name}`, so no change. Skip this file.

- [ ] **Step 7: Verify parity + typecheck**

Run: `bash -c 'npm run check:i18n'` → parity OK.
Run: `npm run typecheck` → PASS.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/app/layout/ src/renderer/components/window-control.tsx src/renderer/components/settings-panel.tsx src/renderer/components/current-time.tsx
git commit -m "i18n: wire layout/window/main/settings/current-time to i18n

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Leftover-literal sweep (any language)**

Run:
```bash
cd /home/madrimov/Projects/lofi-pomodoro
grep -rnE 'placeholder="|aria-label="' src/renderer/components src/renderer/app || echo "NONE — all dynamic"
```
Expected: `NONE — all dynamic` (every remaining `placeholder=` / `aria-label=` uses `{...}`). If any string literals remain, wire them (reuse existing key or add new + parity).

> Brand/symbol exceptions are allowed: `'YouTube'`, emoji prefixes like `'▶'`/`'📁'`/`'🗓'`/`'⚠'`. The translatable text after them must come from `t()`.

- [ ] **Step 2: Parity + typecheck + build**

```bash
bash -c 'npm run check:i18n' && npm run typecheck && bash -c 'npm run build:vite'
```
Expected: parity OK, typecheck PASS, build succeeds.

- [ ] **Step 3: WebKitGTK Intl verification (spec §D/E)**

Run the app (`bash -c 'npm run dev'` or built binary). In devtools console:
```js
new Intl.DateTimeFormat('uz', { hour: '2-digit', minute: '2-digit' }).format(new Date());
```
Expected: a `HH:MM` 24h string. If it throws or returns something malformed, the time path must fall back to a curated format — but weekday labels are already curated arrays, so only `formatTime` is at risk. If broken, change `formatTime` to a manual `HH:MM` builder. Record the result.

- [ ] **Step 4: Manual 3-locale UI pass**

Switch language in Settings to UZ, then EN, then RU. Verify these surfaces are fully translated (no Uzbek leftovers in EN/RU):
- Break screen (stretch tips, breathe labels, skip button)
- Task panel (placeholders, empty-state steps, due/date labels, clear-all confirm, aria via screen-reader/inspect)
- Music side panel + modal (tabs, add-folder, video count, placeholders)
- Stats panel (weekday labels localized, close)
- Mini mode (mode label), main controls (aria-labels), current time format

- [ ] **Step 5: Final commit (if any fixes were made)**

```bash
git add -A
git commit -m "i18n: final verification fixes (leftover sweep + WebKitGTK Intl)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review notes (author)

- **Spec coverage:** A hardcoded→i18n (Tasks 5–9), B existing-key wiring (Task 6 — most "existing" reuses live here), C new translations (Task 4 + `dateYesterday` in Task 6), D interpolation/plural (Task 1; exercised by `videoCount` in Task 7 and `streakDay` in Task 8), E date/time (Tasks 3, 8, 9 step 5; WebKitGTK verified Task 10 step 3), parity test (Task 2; plural-aware in Task 4 step 4), leftover sweep (Task 10 step 1).
- **streakDay plural** is wired in Task 8 step 2 (stats-panel — the only place with a streak text label; `window-control.tsx` renders just `🔥{streak}` with no label, so no change there).
- **Verified facts:** translator is always `const { t } = useSettings()` (NOT `getT` in components); aliases are `@shared`/`@renderer` (no `@/`); `task-panel.tsx` has zero prior i18n; `stats-panel`/`break-screen`/`layout` already have `useSettings`.
- **No placeholders:** confirmed. Line numbers are approximations — match by literal string.
