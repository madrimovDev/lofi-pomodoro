# SP4 — Stats & Gamification (Design)

**Sana:** 2026-06-10
**Status:** Approved (design)
**Roadmap:** Sub-project 4/7. SP1+SP2+SP3 done. Builds on i18n (plural, curated-array pattern from SP1), the `loaded` flag on `useSettings` (SP2), the Rust-settings persistence lesson (SP3), and the tasks export/import Rust pattern (SP3).

## 1. Maqsad va qamrov
- **1. Streak gamification:** grace period (survive a missed day) + milestone badges + all-time record.
- **2. All-time breakdown:** this-month / this-year totals + last-6-months mini bar chart.
- **3. Week-chart tooltips:** exact date + session count on hover (small).
- **4. Cleanup:** automatic retention (prune old entries) + manual reset-all button.
- **5. Export:** stats → JSON (mirrors tasks export).

## 2. Mavjud arxitektura (tasdiqlangan 2026-06-10)
- `use-stats.tsx` (`StatsProvider`, inside SettingsProvider → CAN `useSettings`): `stats: DailyStat[]`, `todayStat`, `streak`, `addFocusSession/addTaskCompleted/addSkippedSession`. `calculateStreak(stats)` breaks on first 0-session day (strict). Async hydration via `api.getStats().then(...)` with `hydratedRef` guarding persist.
- `DailyStat = { date:'YYYY-MM-DD', focusSessions, focusMinutes, tasksCompleted, skippedSessions? }` (TS + Rust `models::DailyStat`). Stored under store key `stats` via `get_stats`/`set_stats`.
- `stats-panel.tsx`: streak row (🔥 + `streakDay` plural), Today, This-week (`WeekBar` with `getLast7Days(locale)` using `formatWeekdayShort` curated labels from SP1), All-time (3 `StatBadge`s).
- `dateKey(d)` (`@shared/lib/date`) = LOCAL `YYYY-MM-DD` (UTC explicitly avoided — using `toISOString()` breaks streaks).
- `formatWeekdayShort`/`formatTime` in `@shared/lib/format` (SP1) use curated per-locale arrays (WebKitGTK `Intl('uz')` unreliable).
- `useSettings` exposes `loaded: boolean` (SP2) — true after settings async-load resolves.
- Tasks export pattern: Rust `export_tasks(app) -> bool` (dialog save_file + write JSON); registered in `lib.rs` `generate_handler!`; `dialogApi.exportTasks()`.
- **Rust `models::TimerSettings`** must mirror every TS `TimerSettings` field or it won't persist (SP3 lesson); SP3 added a `settings_roundtrip_preserves_new_fields` test.

## 3. Dizayn — Area 1: Streak grace + milestones + record

### New settings
`TimerSettings.streakGraceDays: number` (default `1`). Also used by record.

### Grace algorithm (CORRECTED — total missed-day budget, NOT per-gap)
The naive "reset miss-counter on each active day" bridges every isolated gap (alternating-day usage → huge fake streak). Instead: **a single missed-day budget for the whole run, never reset**; count ACTIVE days only.
```ts
// streak ending at `endKey` (a 'YYYY-MM-DD'), tolerating up to graceDays TOTAL missed days
function streakEndingAt(stats: DailyStat[], endKey: string, graceDays: number): number {
  const byDate = new Map(stats.map(s => [s.date, s]));
  let streak = 0, missed = 0;
  const d = parseKey(endKey); // local Date from 'YYYY-MM-DD'
  while (true) {
    const stat = byDate.get(dateKey(d));
    if (stat && stat.focusSessions > 0) {
      streak++;            // active day counts
    } else {
      missed++;            // budget consumed; NEVER reset
      if (missed > graceDays) break;
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
export const calculateStreak = (stats, graceDays) => streakEndingAt(stats, dateKey(new Date()), graceDays);
```
**Discriminating examples (graceDays=1):**
- Alternating `A . A . A …` → today A:streak1; -1 miss:budget1; -2 A:streak2; -3 miss:budget2>1 → break ⇒ **2** (not 50).
- `A A . A` (gap 1) → counts across the single gap.
- `. . (today, yesterday both missed)` → miss1, miss2>1 ⇒ **0**.
- Termination guaranteed: `missed` only grows; breaks within graceDays+1 missed days.

> **Grace meaning (settled):** with graceDays=1, NOT having focused *today* still shows the streak (today is the 1 allowed miss). Count = active days in the run.

### Record (all-time longest) — same grace rule (consistency)
`record = max over endKey ∈ {all stat dates} of streakEndingAt(stats, endKey, graceDays)` (0 if no stats). O(activeDays²) — trivial for a year of data. The displayed current streak is `streakEndingAt(today)`; reusing one function keeps them consistent.

### Milestones / badges
`export const STREAK_MILESTONES = [3, 7, 14, 30, 100];` Earned = those ≤ current streak. Stats panel shows the earned badges (🔥 row already exists; add a small badge strip — the HIGHEST earned milestone emphasized, e.g. `🏅 30`). i18n: a `bestStreak` label for the record line.

### use-stats changes
- `calculateStreak(stats, graceDays)` (signature gains graceDays); `StatsProvider` passes `settings.streakGraceDays ?? 1`.
- Expose `record: number` (computed) on the context.
- `StatsContextValue` gains `record`.

## 4. Dizayn — Area 2: All-time breakdown (month/year + 6-month chart)

### This-month / this-year (local prefixes — NOT UTC)
```ts
const todayK = dateKey(new Date());          // local
const monthPrefix = todayK.slice(0, 7);      // 'YYYY-MM'
const yearPrefix = todayK.slice(0, 4);       // 'YYYY'
const monthSessions = stats.filter(s => s.date.startsWith(monthPrefix)).reduce((a,s)=>a+s.focusSessions,0);
const yearSessions  = stats.filter(s => s.date.startsWith(yearPrefix )).reduce((a,s)=>a+s.focusSessions,0);
```
Show as a new "This month / This year" row (StatBadge-style: sessions + hours).

### Last-6-months mini bar chart (explicit buckets incl. empty months)
Generate 6 month buckets explicitly (like `getLast7Days` builds empty days — do NOT derive months from existing stats, or gaps mislabel the axis):
```ts
function getLast6Months(locale): { prefix: string; label: string }[] {
  const out = [];
  const d = new Date(); d.setDate(1);            // avoid month-length drift
  for (let i = 5; i >= 0; i--) {
    const m = new Date(d); m.setMonth(d.getMonth() - i);
    out.push({ prefix: `${m.getFullYear()}-${String(m.getMonth()+1).padStart(2,'0')}`, label: formatMonthShort(locale, m) });
  }
  return out;
}
```
A `MonthBar` component (mirrors `WeekBar`) sums `focusSessions` per month-prefix.

### Month labels — curated per-locale arrays (NOT Intl('uz'))
Add `formatMonthShort(locale, date)` to `@shared/lib/format` with curated 12-entry arrays per locale (consistent with SP1's weekday decision; WebKitGTK `Intl('uz')` is unreliable):
- uz: `['Yan','Fev','Mar','Apr','May','Iyn','Iyl','Avg','Sen','Okt','Noy','Dek']`
- en: `['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']`
- ru: `['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек']`

## 5. Dizayn — Area 3: Week-chart tooltip
Add a `title` attribute to each `WeekBar` bar: localized date + session count, e.g. `` `${formatDateShort(locale, d)} — ${sessions}` ``. **No Intl** — add `formatDateShort(locale, date)` to `@shared/lib/format` defined as `` `${date.getDate()} ${formatMonthShort(locale, date)}` `` (e.g. "5 Iyn"), reusing the curated month array (avoids the WebKitGTK `Intl('uz')` risk entirely). `getLast7Days` must also return the `Date` object per entry (add a `d: Date` field) so the tooltip has the day number. No new i18n keys (number + curated month abbrev).

## 6. Dizayn — Area 4: Cleanup (retention + reset)

### Automatic retention (DESTRUCTIVE — gated on settings.loaded)
`TimerSettings.statsRetentionDays: number` (default `365`, `0` = never prune).
**CRITICAL (SP2 timing trap, but it deletes data):** `StatsProvider` loads stats async AND `statsRetentionDays` loads async (settings). Pruning on stats-hydration would read the DEFAULT 365 before real settings arrive and silently truncate a user who chose 0/longer. So: prune ONLY when BOTH stats hydration is done AND `settings.loaded` is true, AND `statsRetentionDays > 0`.
```ts
// StatsProvider: add a hydrated STATE flag (set true in getStats().finally), keep hydratedRef for the persist guard.
const { settings } = useSettings();
const [hydrated, setHydrated] = useState(false);
useEffect(() => {
  if (!hydrated || !settings.loaded) return;
  const days = settings.statsRetentionDays ?? 365;
  if (days <= 0) return;
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
  const cutoffKey = dateKey(cutoff);
  setStatsState(prev => {
    const pruned = prev.filter(s => s.date >= cutoffKey); // lexicographic on 'YYYY-MM-DD' = chronological
    return pruned.length === prev.length ? prev : pruned; // idempotent; avoid needless persist
  });
}, [hydrated, settings.loaded, settings.statsRetentionDays]);
```

### Manual reset
New `clearStats()` method: `setStatsState([])`. Stats panel "Reset all" button with two-step confirm (mirror task-panel's `clearCompleted` confirm pattern). i18n `resetStats` + `confirmResetStats`.

## 7. Dizayn — Area 5: Stats export (JSON)
- Rust: `export_stats(app) -> bool` mirroring `export_tasks` (dialog `.set_file_name("zenfocus-stats-<ts>.json").add_filter("JSON",&["json"]).blocking_save_file()`, read `stats` from store via `deserialize_or_default`, write `to_string_pretty`). Register `commands::store::export_stats` (or `commands::stats::...` — place next to get_stats/set_stats in `store.rs`) in `lib.rs` `generate_handler!`.
- `dialog.ts`: `exportStats: () => invoke<boolean>('export_stats')`.
- Stats panel: export button (Download icon) next to the reset button; calls `dialogApi.exportStats()`.

## 8. Settings + Rust mirroring (SP3 LESSON — mandatory)
Two new `TimerSettings` fields: `streakGraceDays: number` (default 1), `statsRetentionDays: number` (default 365).
- TS: `src/shared/types.ts` interface + DEFAULT.
- **Rust `src-tauri/src/models.rs` `TimerSettings` struct + Default**: `pub streak_grace_days: i32,` (default 1), `pub stats_retention_days: i32,` (default 365). camelCase rename → streakGraceDays / statsRetentionDays.
- **Extend the SP3 `settings_roundtrip_preserves_new_fields` test** to assert these two survive the round-trip.
- Settings UI: `NumberInput` for `streakGraceDays` (min 0, max 7) and `statsRetentionDays` (min 0, max 3650; 0 = never) in `settings-panel.tsx`.

## 9. Components / files
- `src/shared/types.ts` — 2 settings + `STREAK_MILESTONES`.
- `src-tauri/src/models.rs` — 2 Rust fields + Default + roundtrip test.
- `src-tauri/src/commands/store.rs` — `export_stats`; `src-tauri/src/lib.rs` — register it.
- `src/shared/tauri/dialog.ts` — `exportStats`.
- `src/shared/lib/format.ts` — `formatMonthShort` (curated) + a small `formatDateShort` for tooltips.
- `src/renderer/hooks/use-stats.tsx` — grace param, `record`, `clearStats`, retention effect, `hydrated` state.
- `src/renderer/components/stats-panel.tsx` — badges + record line, month/year + `MonthBar`, week tooltips, reset + export buttons.
- `src/renderer/components/settings-panel.tsx` — 2 NumberInputs.
- `src/shared/i18n/{uz,en,ru}.ts` — new keys.

## 10. Xatoliklar / edge-cases
- Empty stats → streak 0, record 0, charts empty, breakdown 0; reset no-op.
- Retention prune never runs before settings.loaded (mandatory); `0` = keep all.
- Reset is two-step confirm; export cancel → false (no-op).
- All date math via local `dateKey` (never UTC).

## 11. Testlash / verifikatsiya
- `bash -c 'bun run typecheck'` + `bun run build:vite` green; `bun run check:i18n` parity OK; `bash -c 'cd src-tauri && cargo test'` (incl. extended roundtrip test) pass.
- **Streak unit reasoning (manual):** verify `streakEndingAt` against alternating-day, double-gap, and missed-today inputs (the discriminating cases in §3) — confirm bounded results.
- i18n leftover sweep (literal + expr).
- **Manual (`bun run dev`):** badges appear at milestones; record shows; grace keeps streak across one missed day; month/year totals correct; 6-month chart shows empty months; week tooltips show date+count localized; retention prune respects the setting (and does NOT wipe when set to 0 — restart with 0 keeps history); reset clears with confirm; export writes JSON.
- **WebKitGTK note:** month labels are curated arrays (no Intl('uz') risk); if a tooltip uses Intl, verify or switch to curated.

## 12. Non-goals
- Calendar heatmap (year grid) — 6-month bar chart only.
- Stats import (export only).
- Per-task time tracking / focus-minute charts (sessions only in charts).
- Configurable milestone thresholds (fixed [3,7,14,30,100]).
- Streak "freeze tokens" economy — simple total-budget grace only.
