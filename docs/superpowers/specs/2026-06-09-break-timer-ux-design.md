# SP2 — Break & Timer UX (Design)

**Sana:** 2026-06-09
**Status:** Approved (design)
**Roadmap:** Sub-project 2/7 of the feature-improvement roadmap. SP1 (i18n) done. Builds on the i18n system (`getT`/`TFunc`/plural) and conventions established in SP1.

## 1. Maqsad va qamrov

To'rtta bog'liq "Break & Timer UX" yaxshilanishi (foydalanuvchi maksimal variantlarni tanladi):

- **A. Keyboard shortcuts** — sozlanadigan binding'lar + `?` bilan ochiladigan help overlay.
- **B. Break aktivliklari** — ko'proq tip (i18n) + tanlanadigan breathing patternlar.
- **C. Custom presetlar** — to'liq CRUD (settings ichida persist).
- **D. Restore-window** — sozlanadigan (hozir 2 soat hardcoded).

Hammasi `TimerSettings`ga 4 ta yangi maydon qo'shadi: `keybindings`, `breathingPattern`, `customPresets`, `restoreWindowMinutes`.

## 2. Mavjud arxitektura (tasdiqlangan, 2026-06-09)

- `useKeyboardShortcuts(...)` faqat `main.tsx:52`da (`MainLayout`) chaqiriladi. Hozir `e.code` `switch` bilan hardcoded (Space/KeyS/KeyM/KeyT) va input/textarea'da o'chirilgan.
- `MainLayout` (main.tsx) ushlaydigan holatlar: `settingsOpen`, `taskPanelOpen`; `toggle`/`skip` (timer context); `onToggleMusic`/`musicOpen` (prop, ota-komponentdan); `updateSettings` (focusMode uchun).
- **`statsOpen` `MainLayout`da EMAS** — u `index.tsx:243`da (ota Layout), `<WindowControl onOpenStats=...>` va `<StatsPanel>` o'sha yerda. Demak `toggleStats` shortcut'i uchun `MainLayout`ga yangi `onToggleStats` prop kerak (index.tsx `() => setStatsOpen(o=>!o)` uzatadi).
- `useSettings` settings'ni **faqat top-level shallow-merge** qiladi: `{...DEFAULT_TIMER_SETTINGS, ...stored}`. Ichki obyektlar (masalan `keybindings`) merge qilinmaydi.
- `BreathingCircle` (break-screen.tsx) hozir 3 fazali enum: `'in' | 'hold' | 'out'`, davomiyliklar `{ in: 4, hold: 7, out: 8 }` hardcoded.
- `DEFAULT_PRESETS` (types.ts) — 3 ta built-in, nomlari inglizcha string (`'Deep Work'` va h.k.). `preset-selector.tsx` ularni `settings.activePreset` bo'yicha highlight qiladi.
- `use-timer.ts`: `RESTORE_WINDOW_MS = 2*60*60*1000` hardcoded, restore mantig'i `Date.now() - s.savedAt < RESTORE_WINDOW_MS`.

## 3. Dizayn — Area A: Keyboard shortcuts

### Data model (types.ts)
```ts
export type ShortcutAction =
  | 'toggleTimer' | 'skip' | 'toggleMusic' | 'toggleTasks'
  | 'toggleSettings' | 'toggleStats' | 'toggleFocusMode';

// Value = KeyboardEvent.code (layout-stable, e.g. 'Space','KeyS')
export const DEFAULT_KEYBINDINGS: Record<ShortcutAction, string> = {
  toggleTimer: 'Space', skip: 'KeyS', toggleMusic: 'KeyM', toggleTasks: 'KeyT',
  toggleSettings: 'Comma', toggleStats: 'KeyB', toggleFocusMode: 'KeyF',
};
```
`TimerSettings` ga `keybindings: Record<ShortcutAction, string>` qo'shiladi; DEFAULT = `DEFAULT_KEYBINDINGS`. **Help (`?`) qattiq belgilangan** — sozlanmaydi.

### Matching model (advisor #1)
- Sozlanadigan binding'lar **`e.code` bo'yicha** solishtiriladi (layout-barqaror).
- Help — `?` bo'lib, `e.key === '?'` orqali alohida ishlanadi (chunki `?` = Shift+Slash, toza `code` yo'q).
- **Faqat oddiy (modifiersiz) klavishalar** qo'llab-quvvatlanadi. Agar `e.ctrlKey||e.metaKey||e.altKey` bo'lsa — e'tiborsiz qoldiriladi (oddiyroq, OS shortcut'lariga xalaqit bermaslik).

### Hook refactor (use-keyboard-shortcuts.ts)
```ts
interface ShortcutOptions {
  handlers: Partial<Record<ShortcutAction, () => void>>;
  bindings: Record<ShortcutAction, string>;
  onHelp: () => void;
  enabled: boolean;   // suppress while any overlay open / while capturing
}
```
- `enabled === false` bo'lsa darrov return (advisor #2, #UX flag).
- Input/textarea guard saqlanadi.
- `e.key === '?'` → `onHelp()`.
- Modifier bor bo'lsa skip. Aks holda: `bindings`dan `e.code`ga mos `action` topib, mos `handler`ni chaqiradi (`toggleTimer` uchun `preventDefault` — Space sahifani scroll qilmasligi uchun).
- **Per-action fallback (advisor #6):** hook ishlatadigan binding'lar `{ ...DEFAULT_KEYBINDINGS, ...(settings.keybindings ?? {}) }` bilan birlashtiriladi, shunda yangi action qo'shilganda `undefined` o'qilmaydi.

### Overlay suppression (advisor UX flag)
`MainLayout` `enabled = !(settingsOpen || taskPanelOpen || musicOpen || statsOpen || helpOpen)` ni hisoblab hook'ga uzatadi. Dialog ochiq bo'lganda shortcut'lar ishlamaydi (Radix Escape bilan yopiladi). `helpOpen` — yangi `MainLayout` holati.

### Capture mode (advisor #2)
Settings'dagi keybinding editor "Change" bosilganda **capture rejimi**ga kiradi: global hook `enabled=false` bo'ladi (capture davomida shortcut ishlamaydi). Keyingi `keydown` (modifiersiz, Escape=bekor) `e.code`ni oladi:
- **Konflikt:** agar `e.code` boshqa action'da band bo'lsa — qizil ogohlantirish, saqlamaydi (yoki almashtirishni so'raydi — MVP: rad etib ogohlantirish).
- Saqlangach `updateSettings({ keybindings: {...current, [action]: code} })`.
- "Reset to defaults" → `keybindings: DEFAULT_KEYBINDINGS`.
- Klavishani inson-o'qiydigan ko'rinishga aylantirish: kichik `formatKeyCode(code)` helper (`'Space'→'Space'`, `'KeyS'→'S'`, `'Comma'→','`).

### Help overlay (yangi komponent `keyboard-help.tsx`)
- Radix Dialog. `?` bilan ochiladi (`helpOpen`). Barcha action'lar ro'yxati: i18n yorlig'i + joriy binding (`formatKeyCode`). `?` = help qatori ham ko'rsatiladi.
- Action label'lari i18n: yangi kalitlar (masalan `scToggleTimer`, ...). Help sarlavhasi `keyboardShortcuts`.

### Files (Area A)
- modify `src/shared/types.ts` (ShortcutAction, DEFAULT_KEYBINDINGS, TimerSettings field+default)
- modify `src/renderer/hooks/use-keyboard-shortcuts.ts` (data-driven)
- create `src/renderer/components/keyboard-help.tsx`
- create `src/shared/lib/keys.ts` (`formatKeyCode`)
- modify `src/renderer/app/layout/main.tsx` (expanded handlers, helpOpen, enabled, render `<KeyboardHelp>`, accept `onToggleStats` prop)
- modify `src/renderer/app/layout/index.tsx` (pass `onToggleStats={() => setStatsOpen(o=>!o)}` to MainLayout)
- modify `src/renderer/components/settings-panel.tsx` (keybinding editor section)
- modify i18n locale files (action labels + help/editor strings)

## 4. Dizayn — Area B: Break aktivliklari

### Ko'proq tip
i18n'da tip massivlari (indeksli kalitlar, SP1 `stretchTip1..8` uslubida):
- `stretchTip1..N` (mavjud 8 ni saqlab, +qo'shimcha)
- `eyeTip1..M`, `hydrationTip1..M` — agar hozir eye-rest/hydration matni hardcoded bo'lsa, ularni ham massivga aylantirib variativlik berish. (Implementatsiya: break-screen'ni o'qib, har activity uchun tip kalit massivi + tasodifiy tanlash.)
Har bir yangi kalit 3 lokalda; parity gate.

### Breathing patternlar (advisor #4)
Pattern = **tartiblangan fazalar ro'yxati**, 3-fazali enum emas:
```ts
// types.ts
export type BreathingPatternId = '478' | 'box' | 'coherent';
interface BreathPhase { labelKey: 'breatheIn' | 'breatheHold' | 'breatheOut'; seconds: number; scale: 'in' | 'hold' | 'out'; }
export const BREATHING_PATTERNS: Record<BreathingPatternId, BreathPhase[]> = {
  '478':      [{labelKey:'breatheIn',seconds:4,scale:'in'},{labelKey:'breatheHold',seconds:7,scale:'hold'},{labelKey:'breatheOut',seconds:8,scale:'out'}],
  'box':      [{labelKey:'breatheIn',seconds:4,scale:'in'},{labelKey:'breatheHold',seconds:4,scale:'hold'},{labelKey:'breatheOut',seconds:4,scale:'out'},{labelKey:'breatheHold',seconds:4,scale:'hold'}],
  'coherent': [{labelKey:'breatheIn',seconds:5,scale:'in'},{labelKey:'breatheOut',seconds:5,scale:'out'}],
};
```
`BreathingCircle` ni fazalar massivi bo'ylab aylanadigan qilib qayta yozish: `phaseIndex` state, har faza tugagach `(phaseIndex+1) % phases.length`, `scale` mapping `{in:'scale-110', hold:'scale-110', out:'scale-90'}` (mavjud uslub). Settings: `breathingPattern: BreathingPatternId` (default `'478'`). Settings'da tanlovchi (3 tugma/segment).

### Files (Area B)
- modify `src/shared/types.ts` (BreathingPatternId, BREATHING_PATTERNS, field+default)
- modify `src/renderer/components/break-screen.tsx` (phase-list breathing + expanded tip arrays)
- modify `src/renderer/components/settings-panel.tsx` (breathing pattern selector)
- modify i18n (new tip keys + pattern labels)

## 5. Dizayn — Area C: Custom presetlar (CRUD)

### Data model (types.ts) — built-in/custom diskriminatori (advisor #5)
```ts
export interface TimerPreset {
  id: string; name: string;
  focusDuration: number; shortBreakDuration: number; longBreakDuration: number; sessionsBeforeLongBreak: number;
  isBuiltIn?: boolean;   // built-in → name is an i18n key id; custom → name is a user literal
}
```
`DEFAULT_PRESETS`ga `isBuiltIn: true` qo'shiladi. Built-in nom rendering: `preset.isBuiltIn ? t(preset.id as TranslationKey) : preset.name` — `id`lar (`deep-work`→kalit) i18n'da (kalitlar: `presetDeepWork`/`presetClassic`/`presetQuick`, yoki id'ni kalitga map qiluvchi kichik helper). **Qaror:** id→kalit map (`{'deep-work':'presetDeepWork',...}`), built-in nomi shu orqali; SP1'da kechiktirilgan built-in preset nomlari shu yerda lokallashtiriladi.

### Persistence (tasdiqlangan: settings ichida)
`TimerSettings` ga `customPresets: TimerPreset[]` (default `[]`). Mavjud `setSettings` orqali persist — **yangi Rust komanda kerak emas**. Custom preset'lar har doim `isBuiltIn` siz (`false`/yo'q).

### CRUD UI
- **Hammasi:** `[...DEFAULT_PRESETS, ...settings.customPresets]`.
- `preset-selector.tsx`: built-in + custom highlight (`activePreset === preset.id`); custom'da kichik o'chirish tugmasi (hover).
- Settings'da "Presetlar" boshqaruv bo'limi: "Yangi preset" formasi (nom + 4 ta NumberInput, mavjud `NumberInput` komponentidan), tahrir/o'chirish. Custom preset id: barqaror unique string (masalan `custom-` + monoton counter yoki `addedAt`). **`Date.now()`/`Math.random` ishlatish mumkin** (bu workflow scripti emas, oddiy app kodi).
- **Dangling guard (advisor #5):** custom preset o'chirilsa va u `activePreset` bo'lsa → `activePreset: null`. Foydalanuvchi vaqtni qo'lda o'zgartirsa (settings duration input) → `activePreset: null` (preset endi mos kelmaydi). Bu mantiqни `updateSettings` chaqiruvchi joyga emas, balki duration o'zgarishida amalga oshiramiz (settings-panel NumberInput onChange).

### Files (Area C)
- modify `src/shared/types.ts` (isBuiltIn, customPresets field+default, id→nameKey map)
- modify `src/renderer/components/preset-selector.tsx` (built-in+custom, localized built-in names, delete)
- modify `src/renderer/components/settings-panel.tsx` (preset manager + clear activePreset on manual duration change)
- modify i18n (built-in preset name keys + manager UI strings)

## 6. Dizayn — Area D: Restore-window sozlamasi

### Setting
`TimerSettings` ga `restoreWindowMinutes: number` (default `120`). UI tanlovlari (settings select/segment): o'chiq `0`, 1s `60`, 2s `120`, 8s `480`, doim `-1`.

### use-timer.ts (advisor #3 — sentinel bug trap)
Hardcoded `RESTORE_WINDOW_MS` o'rniga settings'dan o'qish. **Sentinel konversiya aniq:**
```ts
const mins = settings.restoreWindowMinutes ?? 120;
const windowMs = mins < 0 ? Infinity : mins * 60_000;   // -1 → Infinity (always), 0 → never
// restore shart:
if (windowMs > 0 && s.savedAt && Date.now() - s.savedAt < windowMs) { /* restore */ }
```
`mins===0` → `windowMs===0` → `windowMs > 0` false → hech qachon tiklamaydi. `mins===-1` → `Infinity` → doim tiklaydi. Naive `(-1)*60000` manfiy bo'lib teskari natija berardi — shuning uchun sentinel alohida.

> **Eslatma:** `use-timer` settings'ga kirishi kerak. Hozir u settings'ni qanday oladi (prop yoki useSettings) — implementatsiyada tekshiriladi; agar olmasa, `restoreWindowMinutes`ni argument sifatida uzatamiz.

### Files (Area D)
- modify `src/shared/types.ts` (field+default)
- modify `src/renderer/hooks/use-timer.ts` (read setting, sentinel conversion)
- modify `src/renderer/components/settings-panel.tsx` (restore-window selector)
- modify i18n (selector labels)

## 7. Xatoliklarni boshqarish
- Eski stored settings'da yangi maydonlar yo'q → shallow-merge default'lardan to'ldiradi; keybindings uchun qo'shimcha per-action merge (A).
- Noma'lum/buzilgan `keybindings` qiymati → default fallback.
- Capture rejimi Escape bilan bekor; konflikt → saqlamaydi.
- Custom preset o'chirish/duration o'zgarishi → `activePreset` dangling tozalanadi.

## 8. Testlash / verifikatsiya
- `bun run typecheck` + `bun run build:vite` green.
- `bun run check:i18n` parity OK (barcha yangi kalitlar 3 lokalda).
- **Manual (GUI `bun run dev`):**
  - Shortcuts: har action default klavishada ishlaydi; dialog ochiqligida bosilganda ishlamaydi; `?` help ochadi; binding o'zgartirib qayta tekshirish; konflikt ogohlantirishi; reset.
  - Breathing: 3 pattern (478/box/coherent) to'g'ri fazalar va davomiylik bilan aylanadi.
  - Presets: yangi yaratish/tahrir/o'chirish persist bo'ladi (qayta ochishda saqlanadi); built-in nomlar 3 lokalda lokallashadi; o'chirilgan active preset → null.
  - Restore: o'chiq=tiklamaydi, doim=tiklaydi, 2s default ishlaydi (savedAt vaqtini soxtalashtirib yoki kutib sinash).
- Leftover i18n sweep (SP1 uslubidagi `placeholder=`/`aria-label=`/`title=`/expr-form).

## 9. Qamrovdan tashqari (non-goals)
- Modifier-kombinatsiyali shortcut'lar (faqat oddiy klavishalar).
- Shortcut'larni global (OS-darajada, ilova fonida) qilish.
- Preset'larni import/export yoki bulutga sinxronlash.
- Yangi breathing pattern qo'shish UI (3 ta fixed pattern).
- Ambient/music o'zgarishlari (SP5).
