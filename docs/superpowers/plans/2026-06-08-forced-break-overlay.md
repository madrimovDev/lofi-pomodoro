# Majburiy tanaffus fullscreen overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tanaffus boshlanganda (app mini/tray'da bo'lsa ham) oynani fullscreen overlay qilib ekranni band qilish; yashirin'da timer kechikmasligi uchun Web Worker.

**Architecture:** Web Worker timer (yashirin throttling'ga chidamli) → renderer break detektsiyasi → `set_break_overlay` Rust command (fullscreen + mini/yashirin'dan tiklash, `pre_break` idempotency guard) → BreakScreen top-level render. Yangi `forceBreakFullscreen` toggle.

**Tech Stack:** React/TS, Web Worker (Vite), Tauri v2 window API, Rust (AppState).

**Spec:** `docs/superpowers/specs/2026-06-08-forced-break-overlay-design.md`

---

## Fayl xaritasi

| Fayl | O'zgarish | Mas'uliyat |
|---|---|---|
| `src/renderer/workers/timer-worker.ts` | Create | Throttle'siz tick manbai |
| `src/renderer/hooks/use-timer.ts` | Modify | setInterval → worker tick |
| `src/shared/types.ts`, `src-tauri/src/models.rs` | Modify | `forceBreakFullscreen` |
| `src/renderer/components/settings-panel.tsx`, `src/shared/i18n/*` | Modify | Toggle UI + i18n |
| `src-tauri/src/app_state.rs` | Modify | `pre_break` maydoni |
| `src-tauri/src/commands/window.rs`, `lib.rs` | Modify | `set_break_overlay` command |
| `src-tauri/capabilities/default.json` | Modify | `allow-set-fullscreen` |
| `src/shared/tauri/window.ts` | Modify | `setBreakOverlay` wrapper |
| `src/renderer/app/layout/index.tsx` | Modify | trigger oqimi + BreakScreen ko'chirish |

---

## Task 1: Web Worker timer

**Files:**
- Create: `src/renderer/workers/timer-worker.ts`
- Modify: `src/renderer/hooks/use-timer.ts`

- [ ] **Step 1: timer-worker.ts**

`src/renderer/workers/timer-worker.ts`:
```ts
// Throttle'siz tick manbai — yashirin sahifada ham (tray'ga yashiringan oyna) ishlaydi.
// Main thread setInterval visibilityState='hidden' bo'lsa throttle qilinishi mumkin.
let id: ReturnType<typeof setInterval> | null = null;

self.onmessage = (e: MessageEvent<'start' | 'stop'>) => {
  if (e.data === 'start') {
    if (id === null) id = setInterval(() => self.postMessage('tick'), 500);
  } else if (e.data === 'stop') {
    if (id !== null) {
      clearInterval(id);
      id = null;
    }
  }
};
```

- [ ] **Step 2: use-timer.ts — worker ref**

`src/renderer/hooks/use-timer.ts` hook ichida (boshqa `useRef`lar yonida) worker yaratish:
```ts
const workerRef = useRef<Worker | null>(null);
useEffect(() => {
  const w = new Worker(new URL('../workers/timer-worker.ts', import.meta.url), { type: 'module' });
  workerRef.current = w;
  return () => {
    w.terminate();
    workerRef.current = null;
  };
}, []);
```
(`useRef`/`useEffect` allaqachon import qilingan.)

- [ ] **Step 3: use-timer.ts — setInterval → worker tick**

Mavjud interval effect (~96-112, "Date.now()-based interval"):
```ts
  useEffect(() => {
    if (!state.isRunning) return;
    const startAt = Date.now();
    const startTimeLeft = state.timeLeft;
    const id = setInterval(() => {
      const elapsed = Math.round((Date.now() - startAt) / 1000);
      const newTimeLeft = startTimeLeft - elapsed;
      setState(prev => {
        if (!prev.isRunning) return prev;
        if (newTimeLeft <= 0) return nextState(prev, config);
        return newTimeLeft === prev.timeLeft ? prev : { ...prev, timeLeft: newTimeLeft };
      });
    }, 500);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isRunning, config.focusDuration, config.shortBreakDuration, config.longBreakDuration, config.sessionsBeforeLongBreak]);
```
ni quyidagiga almashtir (tick manbai worker, wall-clock mantiq aynan saqlanadi):
```ts
  useEffect(() => {
    if (!state.isRunning) return;
    const worker = workerRef.current;
    if (!worker) return;
    const startAt = Date.now();
    const startTimeLeft = state.timeLeft;
    const onTick = () => {
      const elapsed = Math.round((Date.now() - startAt) / 1000);
      const newTimeLeft = startTimeLeft - elapsed;
      setState(prev => {
        if (!prev.isRunning) return prev;
        if (newTimeLeft <= 0) return nextState(prev, config);
        return newTimeLeft === prev.timeLeft ? prev : { ...prev, timeLeft: newTimeLeft };
      });
    };
    worker.addEventListener('message', onTick);
    worker.postMessage('start');
    return () => {
      worker.postMessage('stop');
      worker.removeEventListener('message', onTick);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isRunning, config.focusDuration, config.shortBreakDuration, config.longBreakDuration, config.sessionsBeforeLongBreak]);
```

- [ ] **Step 4: Verifikatsiya**

Run: `cd /home/madrimov/Projects/lofi-pomodoro && npx tsc --noEmit 2>&1 | grep -v compdef | grep -iE 'error|timer' | head`
Expected: bo'sh. (Vite `new URL(..., import.meta.url)` worker'ni tan oladi.)
Run: `bun run build:vite 2>&1 | tail -4`
Expected: build muvaffaqiyatli (worker chunk bundle bo'ladi).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/workers/timer-worker.ts src/renderer/hooks/use-timer.ts
git commit -m "feat(timer): Web Worker tick manbai (yashirin sahifada throttle'siz)"
```

---

## Task 2: forceBreakFullscreen sozlamasi

**Files:** Modify: `src-tauri/src/models.rs`, `src/shared/types.ts`, `src/renderer/components/settings-panel.tsx`, `src/shared/i18n/{en,ru,uz}.ts`

- [ ] **Step 1: Rust model + test**

`src-tauri/src/models.rs` `TimerSettings`ga (boshqa `pub ...: bool` yonida):
```rust
  pub force_break_fullscreen: bool,
```
`Default` impl'ga:
```rust
      force_break_fullscreen: true,
```
`timer_settings_default_matches_ts` testiga:
```rust
    assert_eq!(v["forceBreakFullscreen"], json!(true));
```

- [ ] **Step 2: Rust test**

Run: `cd src-tauri && cargo test --lib 2>&1 | tail -4`
Expected: PASS.

- [ ] **Step 3: Frontend tip**

`src/shared/types.ts` `TimerSettings` interface'ga `forceBreakFullscreen: boolean;`; `DEFAULT_TIMER_SETTINGS`'ga `forceBreakFullscreen: true,`.

- [ ] **Step 4: i18n**

`src/shared/i18n/en.ts`/`ru.ts`/`uz.ts`'ga `forceBreakFullscreen` kaliti: en `'Force fullscreen on break'`, ru `'Полный экран на перерыве'`, uz `'Tanaffusda majburiy fullscreen'`.

- [ ] **Step 5: Settings toggle**

`src/renderer/components/settings-panel.tsx`'da mavjud `ToggleRow` bilan (showBreakScreen toggle yonida):
```tsx
<ToggleRow
  label={t('forceBreakFullscreen')}
  checked={settings.forceBreakFullscreen}
  onCheckedChange={v => updateSettings({ forceBreakFullscreen: v })}
/>
```

- [ ] **Step 6: Verifikatsiya**

Run: `cd /home/madrimov/Projects/lofi-pomodoro && npx tsc --noEmit 2>&1 | grep -v compdef | grep -i error | head`
Expected: bo'sh.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/models.rs src/shared/types.ts src/renderer/components/settings-panel.tsx src/shared/i18n
git commit -m "feat(settings): forceBreakFullscreen toggle (default yoqiq)"
```

---

## Task 3: AppState pre_break maydoni

**Files:** Modify: `src-tauri/src/app_state.rs`

- [ ] **Step 1: Maydon qo'shish**

`src-tauri/src/app_state.rs` `AppStateInner` struct'iga (boshqa maydonlar yonida):
```rust
  /// Tanaffus overlay'idan oldingi holat: (was_hidden, was_mini, was_aot). None = overlay faol emas.
  pub pre_break: Option<(bool, bool, bool)>,
```
Agar `AppStateInner` `Default` derive qilmasa va qo'lda init qilinsa — init joyiga `pre_break: None,` qo'sh. (`#[derive(Default)]` bo'lsa `Option` avtomatik `None`.)

- [ ] **Step 2: Kompilyatsiya**

Run: `cd src-tauri && cargo check 2>&1 | tail -5`
Expected: PASS (warning: ishlatilmagan maydon — Task 4'da ishlatiladi).

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/app_state.rs
git commit -m "feat(tauri): AppState pre_break maydoni (tanaffus overlay holati)"
```

---

## Task 4: set_break_overlay command + capability

**Files:** Modify: `src-tauri/src/commands/window.rs`, `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json`

- [ ] **Step 1: Command qo'shish**

`src-tauri/src/commands/window.rs` oxiriga (mavjud `set_mini_mode` pattern'iga mos — `State<AppState>`, scoped lock):
```rust
/// Tanaffus fullscreen overlay'ini yoqadi/o'chiradi.
/// active=true: oldingi holatni (was_hidden, was_mini, was_aot) saqlab fullscreen + on-top + focus.
/// active=false: fullscreen'dan chiqib oldingi holatga tiklash. pre_break None bo'lsa no-op.
/// Idempotent: takroriy true qayta-capture qilmaydi (fullscreen holatini "oldingi" deb saqlamaslik uchun).
#[tauri::command]
pub fn set_break_overlay(
  app: AppHandle,
  state: State<'_, AppState>,
  active: bool,
) -> Result<(), String> {
  use tauri::{LogicalSize, Size};
  let win = app.get_webview_window("main").ok_or("oyna topilmadi")?;

  if active {
    let already = state.inner.lock().unwrap().pre_break.is_some();
    if !already {
      let was_hidden = !win.is_visible().unwrap_or(true);
      let (was_mini, was_aot) = {
        let inner = state.inner.lock().unwrap();
        (inner.mini_mode, inner.always_on_top)
      };
      state.inner.lock().unwrap().pre_break = Some((was_hidden, was_mini, was_aot));
    }
    let was_mini = state
      .inner
      .lock()
      .unwrap()
      .pre_break
      .map(|p| p.1)
      .unwrap_or(false);
    if !win.is_visible().unwrap_or(true) {
      win.show().map_err(|e| e.to_string())?;
    }
    let _ = win.unminimize();
    if was_mini {
      win
        .set_min_size(Some(Size::Logical(LogicalSize::new(0.0, 0.0))))
        .map_err(|e| e.to_string())?;
      win
        .set_max_size(Some(Size::Logical(LogicalSize::new(9999.0, 9999.0))))
        .map_err(|e| e.to_string())?;
    }
    win.set_fullscreen(true).map_err(|e| e.to_string())?;
    win.set_always_on_top(true).map_err(|e| e.to_string())?;
    let _ = win.set_focus();
  } else {
    let pre = state.inner.lock().unwrap().pre_break;
    let Some((was_hidden, was_mini, was_aot)) = pre else {
      return Ok(());
    };
    win.set_fullscreen(false).map_err(|e| e.to_string())?;
    if was_mini {
      win
        .set_min_size(Some(Size::Logical(LogicalSize::new(200.0, 54.0))))
        .map_err(|e| e.to_string())?;
      win
        .set_max_size(Some(Size::Logical(LogicalSize::new(800.0, 200.0))))
        .map_err(|e| e.to_string())?;
      win
        .set_size(Size::Logical(LogicalSize::new(320.0, 72.0)))
        .map_err(|e| e.to_string())?;
      win.set_always_on_top(true).map_err(|e| e.to_string())?;
    } else {
      win
        .set_min_size(Some(Size::Logical(LogicalSize::new(570.0, 780.0))))
        .map_err(|e| e.to_string())?;
      win
        .set_max_size(Some(Size::Logical(LogicalSize::new(9999.0, 9999.0))))
        .map_err(|e| e.to_string())?;
      win.set_always_on_top(was_aot).map_err(|e| e.to_string())?;
    }
    if was_hidden {
      win.hide().map_err(|e| e.to_string())?;
    }
    state.inner.lock().unwrap().pre_break = None;
  }
  Ok(())
}
```

- [ ] **Step 2: lib.rs ro'yxat**

`src-tauri/src/lib.rs` `generate_handler!`da `commands::window::set_mini_mode` qatoridan keyin:
```rust
      commands::window::set_break_overlay,
```

- [ ] **Step 3: Capability**

`src-tauri/capabilities/default.json` `permissions`ga (`core:window:allow-set-always-on-top` yonida):
```json
    "core:window:allow-set-fullscreen",
```

- [ ] **Step 4: Verifikatsiya**

Run: `python3 -c "import json;json.load(open('src-tauri/capabilities/default.json'))" && echo VALID`
Run: `cd src-tauri && cargo clippy --all-targets -- -D warnings 2>&1 | tail -8 && cargo test --lib 2>&1 | tail -3`
Expected: JSON VALID; clippy toza; test PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/window.rs src-tauri/src/lib.rs src-tauri/capabilities/default.json
git commit -m "feat(window): set_break_overlay command (fullscreen + mini/tray tiklash, idempotency)"
```

---

## Task 5: Frontend setBreakOverlay wrapper

**Files:** Modify: `src/shared/tauri/window.ts`

- [ ] **Step 1: Wrapper**

`src/shared/tauri/window.ts` `winApi` obyektiga (`setMiniMode` yonida):
```ts
  setBreakOverlay: (active: boolean) => invoke<void>('set_break_overlay', { active }),
```

- [ ] **Step 2: Verifikatsiya**

Run: `cd /home/madrimov/Projects/lofi-pomodoro && npx tsc --noEmit 2>&1 | grep -v compdef | grep -i error | head`
Expected: bo'sh.

- [ ] **Step 3: Commit**

```bash
git add src/shared/tauri/window.ts
git commit -m "feat(tauri): setBreakOverlay frontend wrapper"
```

---

## Task 6: Trigger oqimi + BreakScreen ko'chirish

**Files:** Modify: `src/renderer/app/layout/index.tsx`

- [ ] **Step 1: overlayActiveRef + handleBreakStart**

`src/renderer/app/layout/index.tsx`'da:
- `winApi` import qilinganini tasdiqla (yo'q bo'lsa `import { winApi } from '@shared/tauri/window';`).
- `useRef` import qilinganini tasdiqla.
- `LayoutInner` ichida `overlayActiveRef` qo'sh:
```tsx
const overlayActiveRef = useRef(false);
```
- Mavjud `handleBreakStart`ni almashtir:
```tsx
const handleBreakStart = (breakMode: 'short-break' | 'long-break') => {
  if (!settings.showBreakScreen) return;
  if (settings.forceBreakFullscreen) {
    winApi.setBreakOverlay(true).catch(err => console.error('setBreakOverlay failed:', err));
    overlayActiveRef.current = true;
    setCurrentBreakMode(breakMode);
    setShowBreak(true);
  } else if (!isMiniMode) {
    setCurrentBreakMode(breakMode);
    setShowBreak(true);
  }
};
```

- [ ] **Step 2: Restore yo'li (auto-close + skip)**

Mavjud auto-close effect:
```tsx
  useEffect(() => {
    if (mode === 'focus') setShowBreak(false);
  }, [mode]);
```
ni almashtir (overlayActiveRef guard bilan):
```tsx
  useEffect(() => {
    if (mode === 'focus') {
      setShowBreak(false);
      if (overlayActiveRef.current) {
        winApi.setBreakOverlay(false).catch(err => console.error('setBreakOverlay(false) failed:', err));
        overlayActiveRef.current = false;
      }
    }
  }, [mode]);
```
BreakScreen `onSkip`'ni (~295) shu mantiq bilan almashtir:
```tsx
onSkip={() => {
  setShowBreak(false);
  if (overlayActiveRef.current) {
    winApi.setBreakOverlay(false).catch(err => console.error('setBreakOverlay(false) failed:', err));
    overlayActiveRef.current = false;
  }
}}
```

- [ ] **Step 3: Mini guard olib tashlash + BreakScreen ko'chirish**

`MainLayout` propi:
```tsx
onBreakStart={isMiniMode ? undefined : handleBreakStart}
```
ni:
```tsx
onBreakStart={handleBreakStart}
```
ga o'zgartir.

`BreakScreen` render'ini `main` (mini-yashirin `hidden` konteyner) ichidan **top-level `<>`ga** ko'chir — `{isMiniMode && <MiniLayout/>}` va normal `<div>`dan keyin, `</>` oldidan:
```tsx
{showBreak && currentBreakMode && (
  <BreakScreen
    onSkip={() => {
      setShowBreak(false);
      if (overlayActiveRef.current) {
        winApi.setBreakOverlay(false).catch(err => console.error('setBreakOverlay(false) failed:', err));
        overlayActiveRef.current = false;
      }
    }}
    timeLeft={timeLeft}
  />
)}
```
(`main` ichidagi eski BreakScreen render'ini olib tashla — top-level'da bo'ladi.)

- [ ] **Step 4: Verifikatsiya**

Run: `cd /home/madrimov/Projects/lofi-pomodoro && npx tsc --noEmit 2>&1 | grep -v compdef | grep -i error | head`
Expected: bo'sh.
Run: `grep -n "onBreakStart={handleBreakStart}\|overlayActiveRef\|BreakScreen" src/renderer/app/layout/index.tsx`
Expected: mini guard yo'q; overlayActiveRef bor; BreakScreen bitta joyda (top-level).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/app/layout/index.tsx
git commit -m "feat(break): majburiy fullscreen overlay trigger (mini/tray'da ham) + idempotent restore"
```

---

## Task 7: Markaziy verifikatsiya + runtime

- [ ] **Step 1: To'liq quvvur**

```bash
cd /home/madrimov/Projects/lofi-pomodoro
npx tsc --noEmit 2>&1 | grep -v compdef | grep -i error | head
cd src-tauri && cargo clippy --all-targets -- -D warnings 2>&1 | tail -3 && cargo test --lib 2>&1 | tail -3 && cargo fmt && cargo fmt --check; echo "fmt:$?"
cd /home/madrimov/Projects/lofi-pomodoro && bun run build:vite 2>&1 | tail -3
```
Expected: tsc bo'sh; clippy toza; test PASS; fmt exit 0; vite build OK.

- [ ] **Step 2: Runtime acceptance (foydalanuvchida)**

`bun run dev`:
1. **Normal** holatda tanaffus → fullscreen overlay barcha oynalar ustida.
2. **Mini-rejimda** tanaffus → oyna fullscreen overlay; skip/tugash → mini'ga qaytadi.
3. **Tray'ga yashirilgan**da tanaffus → oyna qayta ochilib fullscreen; skip/tugash → tray'ga qaytadi.
4. **Yashirin'da o'z vaqtida** (eng muhim — Web Worker): qisqa fokus, tray'ga yashir, tanaffusda overlay KECH EMAS chiqsin.
5. `forceBreakFullscreen` o'chiq → eski xulq (mini/tray'da overlay yo'q).
6. Skip + auto-close birga → spurious hide/restore yo'q (idempotency).

---

## Self-review eslatmalari
- **Spec qamrovi:** 1 worker (Task 1), 2 setting (Task 2), 5 AppState (Task 3), 4 command+capability (Task 4), 7 wrapper (Task 5), 3+8 trigger+render (Task 6), verifikatsiya (Task 7).
- **Idempotency (advisor):** renderer `overlayActiveRef` (Task 6) + Rust `pre_break` None/Some guard (Task 4) — ikkalasi bor.
- **Lock xavfsizligi:** scoped lock, oyna metodlari lock tashqarisida (Task 4).
- **Tip izchilligi:** `forceBreakFullscreen`(TS)/`force_break_fullscreen`(Rust); `set_break_overlay`/`setBreakOverlay`; `pre_break: Option<(bool,bool,bool)>` (was_hidden, was_mini, was_aot) — Task 3/4 mos.
- **Mini qiymatlar:** Task 4 restore (200×54/800×200/320×72) `set_mini_mode` bilan mos; normal min 570×780 mos.
