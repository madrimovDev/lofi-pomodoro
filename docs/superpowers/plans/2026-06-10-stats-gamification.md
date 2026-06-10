# Stats & Gamification (SP4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gamify stats: streak grace period + milestone badges + all-time record; this-month/this-year totals + 6-month chart; week-chart tooltips; automatic retention + reset-all; JSON stats export.

**Architecture:** Two new persisted settings (with mandatory Rust-struct mirroring), streak/record/retention logic in `use-stats`, display + reset/export buttons in `stats-panel`, curated month/date label helpers in `format.ts`, and a Rust `export_stats` command mirroring `export_tasks`. Ordered foundation-first: settings → helpers → logic → display → export → verify.

**Tech Stack:** TypeScript, React 19, Vite, Tauri v2, Rust. **BUN**: `bash -c 'bun run typecheck'`, `bash -c 'bun run check:i18n'`, `bash -c 'bun run build:vite'`. Rust: `bash -c 'cd src-tauri && cargo test'` / `cargo build`. (`bash -c` avoids a zsh quirk.)

**Reference spec:** `docs/superpowers/specs/2026-06-10-stats-gamification-design.md`

## Conventions (verified)
- Translator: `const { settings, t } = useSettings()`; i18n keys → all 3 of `src/shared/i18n/{uz,en,ru}.ts` before `} as const;`; `bun run check:i18n` enforces parity; plural keys need a base key in uz.ts.
- Aliases `@shared/*`/`@renderer/*` (no `@/*`).
- **Rust-settings lesson (SP3):** every new `TimerSettings` TS field MUST be added to `src-tauri/src/models.rs` `TimerSettings` struct + its `Default` impl (camelCase serde rename), or `set_settings` drops it on round-trip and it won't persist. There is a `settings_roundtrip_preserves_new_fields` test in `models.rs` — extend it.
- `dateKey(d)` (`@shared/lib/date`) = LOCAL `YYYY-MM-DD`. Never use `toISOString()`/UTC for stats date math.
- `StatsProvider` is inside `SettingsProvider` (can `useSettings`); `useSettings` exposes `loaded: boolean` (SP2).
- `format.ts` (SP1) uses curated per-locale arrays (WebKitGTK `Intl('uz')` unreliable) — follow that for months.
- store.rs already imports `DialogExt`, `StoreExt`, `AppHandle`, `deserialize_or_default`, `Serialize`. `export_tasks` (in tasks.rs) is the dialog-save mirror; it uses `std::time::{SystemTime, UNIX_EPOCH}` for the timestamped default name.

## File Structure
- `src/shared/types.ts` — 2 settings (+defaults) + `STREAK_MILESTONES`.
- `src-tauri/src/models.rs` — 2 Rust fields + Default + extend roundtrip test.
- `src/shared/lib/format.ts` — `formatMonthShort`, `formatDateShort` (curated).
- `src/renderer/hooks/use-stats.tsx` — grace, `streakEndingAt`, `record`, `clearStats`, retention effect, `hydrated` state.
- `src/renderer/components/stats-panel.tsx` — badges + record, month/year + `MonthBar`, week tooltips, reset + export buttons.
- `src/renderer/components/settings-panel.tsx` — 2 NumberInputs.
- `src-tauri/src/commands/store.rs` — `export_stats`; `src-tauri/src/lib.rs` — register it.
- `src/shared/tauri/dialog.ts` — `exportStats`.
- `src/shared/i18n/{uz,en,ru}.ts` — new keys.

---

## Task 1: Settings (TS + Rust mirror) + milestones const + settings UI

**Files:** modify `src/shared/types.ts`, `src-tauri/src/models.rs`, `src/renderer/components/settings-panel.tsx`, `src/shared/i18n/{uz,en,ru}.ts`

- [ ] **Step 1: TS settings + milestones**

In `src/shared/types.ts`:
- Add to `interface TimerSettings` (after `autoCompleteOnSubtasks`): `streakGraceDays: number;` and `statsRetentionDays: number;`
- Add to `DEFAULT_TIMER_SETTINGS`: `streakGraceDays: 1,` and `statsRetentionDays: 365,`
- Add near `DailyStat`: `export const STREAK_MILESTONES = [3, 7, 14, 30, 100] as const;`

- [ ] **Step 2: Rust mirror (mandatory for persistence)**

In `src-tauri/src/models.rs`:
- Add to the `TimerSettings` struct (after `auto_complete_on_subtasks: bool,`): `pub streak_grace_days: i32,` and `pub stats_retention_days: i32,`
- Add to the `Default for TimerSettings` impl: `streak_grace_days: 1,` and `stats_retention_days: 365,`

- [ ] **Step 3: Extend the roundtrip test**

In `models.rs` `#[cfg(test)] mod tests`, in `settings_roundtrip_preserves_new_fields`, add to the input JSON object: `"streakGraceDays":2,"statsRetentionDays":90,` and add assertions:
```rust
    assert_eq!(s.streak_grace_days, 2);
    assert_eq!(s.stats_retention_days, 90);
    assert_eq!(back["streakGraceDays"], 2);
    assert_eq!(back["statsRetentionDays"], 90);
```

- [ ] **Step 4: i18n setting labels (all 3 locales)**

uz.ts: `streakGraceDays: 'Streak grace (kun)',` `statsRetentionDays: 'Statistika saqlash (kun, 0=cheksiz)',`
en.ts: `streakGraceDays: 'Streak grace (days)',` `statsRetentionDays: 'Stats retention (days, 0=∞)',`
ru.ts: `streakGraceDays: 'Льгота серии (дни)',` `statsRetentionDays: 'Хранение статистики (дни, 0=∞)',`

- [ ] **Step 5: Settings UI**

In `settings-panel.tsx`, add two `NumberInput`s in the misc/toggles section (near `dailyGoal`):
```tsx
              <NumberInput label={t('streakGraceDays')} value={settings.streakGraceDays ?? 1} min={0} max={7}
                onChange={v => updateSettings({ streakGraceDays: v })} />
              <NumberInput label={t('statsRetentionDays')} value={settings.statsRetentionDays ?? 365} min={0} max={3650}
                onChange={v => updateSettings({ statsRetentionDays: v })} />
```

- [ ] **Step 6: Verify**

`bash -c 'bun run typecheck'` → PASS. `bash -c 'bun run check:i18n'` → parity OK. `bash -c 'cd src-tauri && cargo test'` → all pass incl. extended roundtrip.

- [ ] **Step 7: Commit**

```bash
git add src/shared/types.ts src-tauri/src/models.rs src/renderer/components/settings-panel.tsx src/shared/i18n/
git commit -m "feat(stats): streakGraceDays + statsRetentionDays settings (TS + Rust persist)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: format.ts month/date helpers (curated)

**Files:** modify `src/shared/lib/format.ts`

- [ ] **Step 1: Add curated month-short + date-short helpers**

Append to `src/shared/lib/format.ts`:
```ts
// Curated month short labels, index 0 = January (matches Date.getMonth()).
const MONTH_SHORT: Record<Locale, string[]> = {
  uz: ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  ru: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
};

export function formatMonthShort(locale: Locale, date: Date): string {
  return MONTH_SHORT[locale][date.getMonth()];
}

// e.g. "5 Iyn" — curated, no Intl (avoids WebKitGTK uz uncertainty).
export function formatDateShort(locale: Locale, date: Date): string {
  return `${date.getDate()} ${formatMonthShort(locale, date)}`;
}
```
(`Locale` is already imported in this file from SP1.)

- [ ] **Step 2: Verify + commit**

`bash -c 'bun run typecheck'` → PASS.
```bash
git add src/shared/lib/format.ts
git commit -m "feat(stats): curated month-short + date-short format helpers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: use-stats — grace streak, record, clearStats, retention

**Files:** modify `src/renderer/hooks/use-stats.tsx`

- [ ] **Step 1: Replace `calculateStreak` with grace-aware `streakEndingAt` + a `record` helper**

In `use-stats.tsx`, replace the existing `calculateStreak` function with:
```ts
function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Streak ending at endKey, tolerating up to graceDays TOTAL missed days (budget never resets).
// Counts ACTIVE days only. Bounded: terminates within graceDays+1 missed days.
function streakEndingAt(byDate: Map<string, DailyStat>, endKey: string, graceDays: number): number {
  let streak = 0, missed = 0;
  const d = parseKey(endKey);
  while (true) {
    const stat = byDate.get(dateKey(d));
    if (stat && stat.focusSessions > 0) {
      streak++;
    } else {
      missed++;
      if (missed > graceDays) break;
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function calculateStreak(stats: DailyStat[], graceDays: number): number {
  const byDate = new Map(stats.map(s => [s.date, s]));
  return streakEndingAt(byDate, dateKey(new Date()), graceDays);
}

// All-time longest, same grace rule: max over all stat dates (+ today).
function longestStreak(stats: DailyStat[], graceDays: number): number {
  if (stats.length === 0) return 0;
  const byDate = new Map(stats.map(s => [s.date, s]));
  let best = 0;
  for (const s of stats) {
    if (s.focusSessions > 0) best = Math.max(best, streakEndingAt(byDate, s.date, graceDays));
  }
  return best;
}
```

- [ ] **Step 2: Wire grace + record + clearStats into the provider**

In `StatsProvider`:
- Pull settings: `import { useSettings } from '@renderer/hooks/use-settings';` then `const { settings } = useSettings();`
- Add a `hydrated` STATE (alongside `hydratedRef`) and set it in the load effect's `.finally`:
```ts
  const [hydrated, setHydrated] = useState(false);
  // in the getStats().finally:  .finally(() => { hydratedRef.current = true; setHydrated(true); });
```
- Compute streak + record with grace:
```ts
  const graceDays = settings.streakGraceDays ?? 1;
  const streak = calculateStreak(stats, graceDays);
  const record = longestStreak(stats, graceDays);
```
- Add `clearStats`:
```ts
  const clearStats = () => setStatsState([]);
```
- Add to `StatsContextValue`: `record: number;` and `clearStats: () => void;`
- Add to the default context: `record: 0, clearStats: () => {},`
- Add `record, clearStats` to the Provider `value={{ ... }}`.

- [ ] **Step 3: Retention prune effect (gated on settings.loaded — DESTRUCTIVE)**

Add this effect in `StatsProvider` (after the persist effect):
```ts
  useEffect(() => {
    if (!hydrated || !settings.loaded) return;
    const days = settings.statsRetentionDays ?? 365;
    if (days <= 0) return; // 0 = keep all
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffKey = dateKey(cutoff);
    setStatsState(prev => {
      const pruned = prev.filter(s => s.date >= cutoffKey); // lexicographic = chronological for YYYY-MM-DD
      return pruned.length === prev.length ? prev : pruned;  // idempotent; avoid needless persist
    });
  }, [hydrated, settings.loaded, settings.statsRetentionDays]);
```
> MUST gate on `settings.loaded` — pruning is destructive and `statsRetentionDays` loads async; reading it before settings arrive would use the default 365 and wipe a user who chose 0/longer (SP2 timing bug, but it deletes data).

- [ ] **Step 4: Verify**

`bash -c 'bun run typecheck'` → PASS.
**Reason through the streak logic** (no unit runner; verify by reading): for graceDays=1, alternating active/miss days → 2 (not all active days); double-gap breaks; missed-today-but-active-yesterday preserves streak.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/hooks/use-stats.tsx
git commit -m "feat(stats): grace-aware streak + all-time record + clearStats + retention prune

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: stats-panel — badges, record, month/year, 6-month chart, week tooltips

**Files:** modify `src/renderer/components/stats-panel.tsx`, `src/shared/i18n/{uz,en,ru}.ts`

- [ ] **Step 1: i18n keys (all 3 locales)**

uz.ts: `bestStreak: 'Eng uzun',` `thisMonth: 'Bu oy',` `thisYear: 'Bu yil',` `last6Months: 'Oxirgi 6 oy',`
en.ts: `bestStreak: 'Best',` `thisMonth: 'This month',` `thisYear: 'This year',` `last6Months: 'Last 6 months',`
ru.ts: `bestStreak: 'Рекорд',` `thisMonth: 'Этот месяц',` `thisYear: 'Этот год',` `last6Months: 'Последние 6 месяцев',`

- [ ] **Step 2: Imports + helpers**

In `stats-panel.tsx`:
- Add `record` to the `useStats()` destructure; import helpers: add `formatMonthShort, formatDateShort` to the existing `@shared/lib/format` import; add `STREAK_MILESTONES` to the `@shared/types` import.
- `getLast7Days` already returns `{date,label}` — change it to also return the `Date`:
```ts
function getLast7Days(locale: Locale): { date: string; label: string; d: Date }[] {
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    result.push({ date: dateKey(d), label: formatWeekdayShort(locale, d), d });
  }
  return result;
}
```
- Add a 6-month builder (explicit buckets, incl. empty months):
```ts
function getLast6Months(locale: Locale): { prefix: string; label: string }[] {
  const out = [];
  const base = new Date(); base.setDate(1); // avoid month-length drift
  for (let i = 5; i >= 0; i--) {
    const m = new Date(base); m.setMonth(base.getMonth() - i);
    out.push({ prefix: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`, label: formatMonthShort(locale, m) });
  }
  return out;
}
```

- [ ] **Step 3: Week-chart tooltip**

In `WeekBar`, change the `days` prop type to include `d: Date`, and add a `title` to the bar's container `div`:
```tsx
// days: { date: string; label: string; d: Date }[]
// on the per-day outer <div key={date} ...> add:
title={`${formatDateShort(locale, day.d)} — ${sessions}`}
```
`WeekBar` will need `locale` — pass it as a prop: `<WeekBar days={last7Days} stats={stats} locale={settings.locale} />` and add `locale: Locale` to its props. (Map var is currently destructured `{ date, label }` — change to `day` or add `d`; use `day.d` for the tooltip.)

- [ ] **Step 4: MonthBar component (mirrors WeekBar)**

Add a `MonthBar`:
```tsx
function MonthBar({ months, stats }: { months: { prefix: string; label: string }[]; stats: DailyStat[] }) {
  const sums = months.map(m => stats.filter(s => s.date.startsWith(m.prefix)).reduce((a, s) => a + s.focusSessions, 0));
  const max = Math.max(...sums, 1);
  return (
    <div className="flex items-end gap-1.5 h-16">
      {months.map((m, i) => {
        const sessions = sums[i];
        const heightPct = sessions === 0 ? 0 : Math.max(8, Math.round((sessions / max) * 100));
        return (
          <div key={m.prefix} className="flex flex-col items-center gap-1 flex-1" title={`${m.label} — ${sessions}`}>
            <div className="w-full flex items-end justify-center" style={{ height: '48px' }}>
              <div className="w-full rounded-t-sm bg-primary/25 transition-all duration-500" style={{ height: sessions === 0 ? '2px' : `${heightPct}%` }} />
            </div>
            <span className="text-[9px] select-none text-muted-foreground/40">{m.label}</span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Record line + milestone badges + month/year + 6-month chart in the panel body**

In `StatsPanel`:
- Compute breakdown + months:
```tsx
  const todayK = dateKey(new Date());
  const monthSessions = stats.filter(s => s.date.startsWith(todayK.slice(0, 7))).reduce((a, s) => a + s.focusSessions, 0);
  const yearSessions = stats.filter(s => s.date.startsWith(todayK.slice(0, 4))).reduce((a, s) => a + s.focusSessions, 0);
  const last6 = getLast6Months(settings.locale);
  const earnedMilestones = STREAK_MILESTONES.filter(m => streak >= m);
```
- In the streak block, after the existing `🔥 {streak} {streakDay}` row, add badges + record (when present):
```tsx
            {earnedMilestones.length > 0 && (
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                {earnedMilestones.map(m => (
                  <span key={m} className="text-[10px] rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 tabular-nums text-primary/80">🏅 {m}</span>
                ))}
              </div>
            )}
            {record > 0 && (
              <p className="text-[10px] text-center text-muted-foreground/40">🏆 {t('bestStreak')}: <span className="tabular-nums">{record}</span></p>
            )}
```
- Add a "This month / This year" row in the All-time section (or just above it):
```tsx
            <div className="flex items-center gap-4">
              <StatBadge value={monthSessions} label={t('thisMonth')} />
              <StatBadge value={yearSessions} label={t('thisYear')} />
            </div>
```
- Add the 6-month chart with a label:
```tsx
            <div className="flex flex-col gap-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground/60">{t('last6Months')}</p>
              <MonthBar months={last6} stats={stats} />
            </div>
```
Place these inside the existing `flex flex-col gap-5` body with `<div className="h-px bg-border/50" />` dividers consistent with the current sections.

- [ ] **Step 6: Verify**

`bash -c 'bun run check:i18n'` → parity OK. `bash -c 'bun run typecheck'` → PASS.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/stats-panel.tsx src/shared/i18n/
git commit -m "feat(stats): milestone badges + record + month/year + 6-month chart + week tooltips

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Stats export (Rust) + reset/export buttons in panel

**Files:** modify `src-tauri/src/commands/store.rs`, `src-tauri/src/lib.rs`, `src/shared/tauri/dialog.ts`, `src/renderer/components/stats-panel.tsx`, `src/shared/i18n/{uz,en,ru}.ts`

- [ ] **Step 1: Rust `export_stats`**

In `src-tauri/src/commands/store.rs`:
- Add the time import at the top: `use std::time::{SystemTime, UNIX_EPOCH};`
- Add the command (near `get_stats`/`set_stats`):
```rust
/// Statistikani JSON faylga eksport qilish. Bekor/xato → false.
#[tauri::command]
pub async fn export_stats(app: AppHandle) -> bool {
  let stats: Vec<DailyStat> = deserialize_or_default("stats", {
    let Ok(store) = app.store(STORE_FILE) else { return false; };
    store.get("stats")
  });
  let ts = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0);
  let default_name = format!("zenfocus-stats-{ts}.json");
  let file = app.dialog().file().set_file_name(&default_name).add_filter("JSON", &["json"]).blocking_save_file();
  let Some(path) = file.and_then(|f| f.into_path().ok()) else { return false; };
  match serde_json::to_string_pretty(&stats) {
    Ok(json) => std::fs::write(&path, json).is_ok(),
    Err(e) => { log::error!("export_stats serialize failed: {e}"); false }
  }
}
```
> `export_stats` is `async` (blocking dialog) like `pick_notification_sound`. If `deserialize_or_default`'s signature doesn't accept that inline-block form, read the store first into a local then call it — match how `get_stats`/`export_tasks` obtain the value (`export_tasks` does `let store = app.store(...)?; let tasks = deserialize_or_default("tasks", store.get("tasks"));`). Mirror that exact two-line form.

- [ ] **Step 2: Register in lib.rs**

In `src-tauri/src/lib.rs` `generate_handler!`, after `commands::store::set_stats` (~line 126): add `commands::store::export_stats,`

- [ ] **Step 3: dialog.ts**

In `src/shared/tauri/dialog.ts` `dialogApi`, add: `exportStats: () => invoke<boolean>('export_stats'),`

- [ ] **Step 4: i18n + reset/export buttons**

i18n (all 3 locales): uz `resetStats: 'Statistikani tozalash',` en `resetStats: 'Reset stats',` ru `resetStats: 'Сбросить статистику',`
(Reuse `confirmClearTasks`='Ishonchingiz komilmi?' for the reset confirm, `exportTasks`='Eksport' label, `delete` not needed.)

In `stats-panel.tsx`:
- Pull `clearStats` from `useStats()`; import `dialogApi` from `@shared/tauri/dialog`; import `Download`, `Trash2` (or `RotateCcw`) from `lucide-react` (whichever fits; `Download` for export). Add `useState` import if missing.
- Add a reset-confirm state + a footer action row at the bottom of the panel body:
```tsx
  const [confirmReset, setConfirmReset] = useState(false);
  // ... in JSX, after the last section:
            <div className="flex items-center justify-between gap-2 pt-1">
              <Button variant="ghost" size="xs" className="text-xs gap-1.5" onClick={() => dialogApi.exportStats()}>
                <Download className="size-3" /> {t('exportTasks')}
              </Button>
              <Button
                variant="ghost" size="xs"
                className={`text-xs ${confirmReset ? 'text-destructive' : 'text-muted-foreground/50'}`}
                onClick={() => { if (confirmReset) { clearStats(); setConfirmReset(false); } else { setConfirmReset(true); setTimeout(() => setConfirmReset(false), 3000); } }}
              >
                {confirmReset ? t('confirmClearTasks') : t('resetStats')}
              </Button>
            </div>
```
(Mirrors task-panel's two-click clear-confirm with a 3s auto-reset.)

- [ ] **Step 5: Verify**

`bash -c 'cd src-tauri && cargo test'` + `bash -c 'cd src-tauri && cargo build'` → pass/compile. `bash -c 'bun run check:i18n'` → parity OK. `bash -c 'bun run typecheck'` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/commands/store.rs src-tauri/src/lib.rs src/shared/tauri/dialog.ts src/renderer/components/stats-panel.tsx src/shared/i18n/
git commit -m "feat(stats): JSON export command + reset/export buttons

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Green gates**

```bash
cd /home/madrimov/Projects/lofi-pomodoro
bash -c 'bun run check:i18n' && bash -c 'bun run typecheck' && bash -c 'bun run build:vite'
bash -c 'cd src-tauri && cargo test'
```
Expected: parity OK, typecheck PASS, build succeeds, cargo tests pass (incl. extended `settings_roundtrip_preserves_new_fields`).

- [ ] **Step 2: i18n leftover sweep (literal + expr)**

```bash
grep -rnE 'placeholder="|aria-label="|title="' src/renderer/components src/renderer/app || echo "NONE-literal"
grep -rnE "aria-label=\{[^}]*'[^']+'|title=\{[^}]*'[^']+'" src/renderer/components src/renderer/app | grep -vE "t\(|tFn\(|tr\(|\?:|formatDateShort|formatMonthShort|\\\$\{" || echo "NONE-expr"
```
Expected: NONE (the new `title={...}` tooltips use template literals with `formatDateShort`/month label + a number — those are data, not hardcoded UI strings; confirm no hardcoded human-language words remain).

- [ ] **Step 3: Manual GUI pass (`bash -c 'bun run dev'`)**
- **Streak/grace:** with `streakGraceDays=1`, a single missed day keeps the streak; two consecutive misses break it; milestone badges (🏅) appear at 3/7/14/30/100; 🏆 record shows the all-time longest.
- **Breakdown:** This month / This year totals match; 6-month chart shows all 6 buckets including months with zero activity, labels localized (uz/en/ru).
- **Week tooltips:** hovering a weekday bar shows "<day> <month> — <count>" localized.
- **Retention:** set retention to 0 → restart → history NOT wiped; set to a small number with older fake data → old entries pruned only after settings load.
- **Reset/export:** reset asks confirm then clears; export writes a JSON file.

- [ ] **Step 4: Final commit (if sweep fixes needed)**

```bash
git add -A && git commit -m "stats: SP4 final verification fixes

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review notes (author)
- **Spec coverage:** §3 streak/grace/record/badges=T3+T4; §4 breakdown/chart=T2+T4; §5 tooltips=T4; §6 retention=T1(settings)+T3(effect), reset=T3(clearStats)+T5(button); §7 export=T5; §8 settings+Rust mirror+roundtrip=T1.
- **Advisor points pinned:** grace = total missed-budget (T3 streakEndingAt, bounded, with examples in spec); retention gated on `settings.loaded` + `hydrated` (T3 step 3, destructive); local `dateKey` prefixes (T4 step 5); explicit 6-month buckets (T4 step 2); curated month/date labels (T2, no Intl); roundtrip test extended (T1 step 3).
- **Rust lesson:** both new settings added to `models.rs` struct+Default (T1 step 2) — verified that's the persistence requirement.
- **No placeholders; exact paths; BUN + cargo commands.**
