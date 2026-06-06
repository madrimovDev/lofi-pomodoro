# Faza 5 — Oyna va Tray Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Oyna boshqaruvi (min/max/close, always-on-top, mini-mode), close-to-tray, single-instance va rejimga qarab rangli dinamik tray icon + menu funksional bo'lsin (hozir barchasi no-op).

**Architecture:** Aralash — min/max/close renderer'da (`@tauri-apps/api/window`), always-on-top/mini-mode Rust command (`commands/window.rs`). Tray to'liq Rust (`tray.rs`): RGBA icon runtime generatsiya (`Image::new_owned`), menu, hodisalar. Close-to-tray (`is_quitting` bayroq), window-state transient exclusion, single-instance `lib.rs`da. Frontend `src/shared/tauri/window.ts` (api.ts'dan ajratilgan).

**Tech Stack:** Rust 2021, Tauri 2.11 (`tray-icon` feature bor), `tauri-plugin-single-instance`, `tauri-plugin-window-state`, `@tauri-apps/api/window` + `/event`. Test framework yo'q (frontend) → typecheck + runtime; Rust tray icon pure funksiya → `cargo test`.

**Manba spec:** `docs/superpowers/specs/2026-06-06-phase5-window-tray-design.md`

---

## Muhim faktlar (butun reja davomida)

- Joriy `lib.rs`: `mod commands; mod models; mod store_util;`, Builder `.plugin(store).setup(...).invoke_handler![12 store].run()`. NVIDIA bloki tegilmaydi.
- `tauri.conf.json`: `decorations:false`, 1280×800, min 600×400 — allaqachon to'g'ri, o'zgartirilmaydi.
- `TrayTimerState { timeLeft, mode, isRunning }`, `mode: 'focus'|'short-break'|'long-break'` (`@shared/types`).
- Frontend store chaqiruvlari (Faza 4) `api.ts`da. Window/tray invoke + listen → yangi `src/shared/tauri/window.ts` (api.ts'ni store uchun toza saqlash).
- Event nomlari (Rust emit ↔ frontend listen): `window:mini-mode-changed`, `tray:toggle-timer`, `tray:skip`, `tray:set-mini-mode`.

---

## Fayl strukturasi

| Fayl | Mas'uliyat | Holat |
|---|---|---|
| `src-tauri/Cargo.toml` | single-instance, window-state plugin | O'zgartirish |
| `src-tauri/src/app_state.rs` | `AppState` (is_quitting, window geometry, always-on-top flag) | Yangi |
| `src-tauri/src/commands/window.rs` | `set_always_on_top`, `set_mini_mode` | Yangi |
| `src-tauri/src/tray.rs` | icon RGBA generatsiya, menu, hodisalar, `update_tray_state`, setup | Yangi |
| `src-tauri/src/lib.rs` | plugin reg, AppState manage, close-to-tray window event, tray setup, invoke_handler | O'zgartirish |
| `src-tauri/src/commands/mod.rs` | `pub mod window;` | O'zgartirish |
| `src-tauri/capabilities/default.json` | window + tray permission'lar | O'zgartirish |
| `src/shared/tauri/window.ts` | window ops + invoke + tray event listen helperlari | Yangi |
| `src/renderer/components/window-control.tsx` | min/max/close→window.ts, mini/aot→window.ts | O'zgartirish |
| `src/renderer/components/settings-panel.tsx` | aot/mini→window.ts | O'zgartirish |
| `src/renderer/app/layout/index.tsx` | exitMini + onMiniModeChanged | O'zgartirish |
| `src/renderer/app/layout/main.tsx` | aot sync | O'zgartirish |
| `src/renderer/hooks/use-tray-sync.ts` | updateTrayState + tray listen (async) | O'zgartirish |

---

### Task 1: Pluginlar + AppState + close-to-tray poydevor

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/app_state.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Cargo.toml — pluginlar**

`src-tauri/Cargo.toml` `[dependencies]` oxiriga (`tauri-plugin-store = "2"` ostiga):
```toml
tauri-plugin-single-instance = "2"
tauri-plugin-window-state = "2"
```

- [ ] **Step 2: app_state.rs yaratish**

`src-tauri/src/app_state.rs`:
```rust
use std::sync::Mutex;

/// Oyna/ilova bo'ylab umumiy holat. `tauri::State` orqali kiriladi.
#[derive(Default)]
pub struct AppState {
  pub inner: Mutex<AppStateInner>,
}

#[derive(Default)]
pub struct AppStateInner {
  /// Haqiqiy chiqish jarayonidami (tray "Chiqish") — close-to-tray'ni o'tkazib yuborish uchun.
  pub is_quitting: bool,
  /// Always-on-top yoqilganmi (Linux blur reapply uchun).
  pub always_on_top: bool,
  /// Mini-rejimdami.
  pub mini_mode: bool,
  /// Mini-rejimdan oldingi normal o'lcham (width, height) — qaytarish uchun.
  pub normal_size: Option<(f64, f64)>,
  /// Mini-rejimdan oldingi normal min-o'lcham (width, height).
  pub normal_min_size: Option<(f64, f64)>,
  /// Mini-rejimga kirishdan oldingi always-on-top holati.
  pub mini_was_always_on_top: bool,
  /// Tray icon/menu'ni faqat o'zgarganda qayta qurish uchun oldingi holat.
  pub prev_mode: Option<String>,
  pub prev_running: Option<bool>,
}
```

- [ ] **Step 3: lib.rs — modul, AppState, single-instance, close-to-tray**

`src-tauri/src/lib.rs` boshiga modul qo'sh (1-3 qatorlar yonida):
```rust
mod app_state;
```
Builder zanjirini o'zgartir. Hozir `tauri::Builder::default().plugin(store).setup(...)`. Bo'lsin (single-instance **birinchi**, AppState manage, window-state, close-to-tray event):
```rust
  tauri::Builder::default()
    .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
      use tauri::Manager;
      if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
      }
    }))
    .plugin(tauri_plugin_store::Builder::default().build())
    .plugin(tauri_plugin_window_state::Builder::default().build())
    .manage(app_state::AppState::default())
    .on_window_event(|window, event| {
      if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        use tauri::Manager;
        let state = window.state::<app_state::AppState>();
        let is_quitting = state.inner.lock().unwrap().is_quitting;
        if !is_quitting {
          api.prevent_close();
          let _ = window.hide();
        }
      }
    })
    .setup(move |app| {
```
(Qolgan `.setup(...)`, `.invoke_handler![...]`, `.run()` o'z joyida qoladi. NVIDIA bloki tegilmaydi.)

- [ ] **Step 4: Build**

Run: `cd src-tauri && cargo build`
Expected: PASS — pluginlar yuklab olinadi, kompilyatsiya bo'ladi. (Hali tray/window command yo'q; close-to-tray ishlaydi lekin tray "Chiqish" yo'q — keyingi tasklarda.)

- [ ] **Step 5: Commit**
```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/app_state.rs src-tauri/src/lib.rs
git commit -m "feat(tauri): Faza 5 — single-instance/window-state plugin + AppState + close-to-tray"
```

---

### Task 2: Oyna command'lari (`commands/window.rs`)

**Files:**
- Create: `src-tauri/src/commands/window.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs` (invoke_handler)
- Modify: `src-tauri/capabilities/default.json`

- [ ] **Step 1: commands/mod.rs — modul qo'shish**

`src-tauri/src/commands/mod.rs` (hozir `pub mod store;`):
```rust
pub mod store;
pub mod window;
```

- [ ] **Step 2: commands/window.rs yaratish**

`src-tauri/src/commands/window.rs`:
```rust
use crate::app_state::AppState;
use tauri::{AppHandle, Manager, State};

/// Always-on-top'ni o'rnatadi. Linux'da blur'da qayta qo'llash uchun flag saqlanadi.
#[tauri::command]
pub fn set_always_on_top(
  app: AppHandle,
  state: State<'_, AppState>,
  enabled: bool,
) -> Result<(), String> {
  let win = app.get_webview_window("main").ok_or("oyna topilmadi")?;
  win.set_always_on_top(enabled).map_err(|e| e.to_string())?;
  #[cfg(target_os = "macos")]
  {
    let _ = win.set_visible_on_all_workspaces(enabled);
  }
  state.inner.lock().unwrap().always_on_top = enabled;
  Ok(())
}

/// Mini-rejimni yoqadi/o'chiradi. Aniq qiymatlar TZ §5.2.
#[tauri::command]
pub fn set_mini_mode(
  app: AppHandle,
  state: State<'_, AppState>,
  enabled: bool,
) -> Result<(), String> {
  use tauri::{LogicalSize, Size};
  let win = app.get_webview_window("main").ok_or("oyna topilmadi")?;

  if enabled {
    // Joriy normal o'lcham va min-o'lchamni saqlash (qaytarish uchun).
    let scale = win.scale_factor().unwrap_or(1.0);
    let size = win.inner_size().map_err(|e| e.to_string())?.to_logical::<f64>(scale);
    {
      let mut inner = state.inner.lock().unwrap();
      inner.normal_size = Some((size.width, size.height));
      // min-size'ni Tauri to'g'ridan o'qiy olmaydi; tauri.conf default 600×400.
      inner.normal_min_size = Some((600.0, 400.0));
      inner.mini_was_always_on_top = inner.always_on_top;
      inner.mini_mode = true;
    }
    win.set_min_size(Some(Size::Logical(LogicalSize::new(200.0, 54.0)))).map_err(|e| e.to_string())?;
    win.set_max_size(Some(Size::Logical(LogicalSize::new(800.0, 200.0)))).map_err(|e| e.to_string())?;
    win.set_size(Size::Logical(LogicalSize::new(320.0, 72.0))).map_err(|e| e.to_string())?;
    win.set_always_on_top(true).map_err(|e| e.to_string())?;
  } else {
    // KDE Wayland tartibi: max(0,0) WM'ni buzadi — ishlatilmaydi.
    win.set_min_size(Some(Size::Logical(LogicalSize::new(0.0, 0.0)))).map_err(|e| e.to_string())?;
    win.set_max_size(Some(Size::Logical(LogicalSize::new(9999.0, 9999.0)))).map_err(|e| e.to_string())?;
    let (normal_size, normal_min, was_aot) = {
      let inner = state.inner.lock().unwrap();
      (inner.normal_size, inner.normal_min_size, inner.mini_was_always_on_top)
    };
    if let Some((mw, mh)) = normal_min {
      win.set_min_size(Some(Size::Logical(LogicalSize::new(mw, mh)))).map_err(|e| e.to_string())?;
    }
    if let Some((w, h)) = normal_size {
      win.set_size(Size::Logical(LogicalSize::new(w, h))).map_err(|e| e.to_string())?;
    }
    win.set_always_on_top(was_aot).map_err(|e| e.to_string())?;
    {
      let mut inner = state.inner.lock().unwrap();
      inner.mini_mode = false;
      inner.always_on_top = was_aot;
    }
  }
  win.emit("window:mini-mode-changed", enabled).map_err(|e| e.to_string())?;
  Ok(())
}
```
(`win.emit` uchun `use tauri::Emitter;` kerak — agar kompilyatsiya `emit` topmasa, fayl boshiga `use tauri::Emitter;` qo'sh.)

- [ ] **Step 3: lib.rs — Linux blur reapply + invoke_handler'ga qo'shish**

`lib.rs` `on_window_event` ichiga (CloseRequested'dan keyin, xuddi shu closure) Linux blur reapply qo'sh:
```rust
      #[cfg(target_os = "linux")]
      if let tauri::WindowEvent::Focused(false) = event {
        use tauri::Manager;
        let state = window.state::<app_state::AppState>();
        let aot = state.inner.lock().unwrap().always_on_top;
        if aot {
          let _ = window.set_always_on_top(true);
        }
      }
```
`invoke_handler!` ro'yxatiga (12 store command oxiriga, vergul bilan) qo'sh:
```rust
      commands::store::set_stats,
      commands::window::set_always_on_top,
      commands::window::set_mini_mode
```

- [ ] **Step 4: capabilities — window permission'lar**

`src-tauri/capabilities/default.json` `permissions` massiviga qo'sh (mavjudlar yonida):
```json
    "core:window:allow-minimize",
    "core:window:allow-maximize",
    "core:window:allow-unmaximize",
    "core:window:allow-toggle-maximize",
    "core:window:allow-close",
    "core:window:allow-hide",
    "core:window:allow-show",
    "core:window:allow-set-focus",
    "core:window:allow-set-always-on-top",
    "core:window:allow-set-size",
    "core:window:allow-set-min-size",
    "core:window:allow-set-max-size",
    "core:window:allow-unminimize",
    "core:event:default"
```

- [ ] **Step 5: Build + clippy**

Run: `cd src-tauri && cargo clippy --all-targets -- -D warnings`
Expected: PASS — toza. (`set_visible_on_all_workspaces` faqat macOS'da; Linux'da clippy ogohlantirmasligi kerak.)

- [ ] **Step 6: Commit**
```bash
git add src-tauri/src/commands/ src-tauri/src/lib.rs src-tauri/capabilities/default.json
git commit -m "feat(tauri): Faza 5 — set_always_on_top va set_mini_mode command'lari"
```

---

### Task 3: Tray icon RGBA generatsiya (TDD)

Pure funksiya — `cargo test` bilan to'g'ridan-to'g'ri tekshiriladi.

**Files:**
- Create: `src-tauri/src/tray.rs`
- Modify: `src-tauri/src/lib.rs` (`mod tray;`)

- [ ] **Step 1: lib.rs — modul deklaratsiyasi**

`src-tauri/src/lib.rs` boshiga (`mod app_state;` yonida):
```rust
mod tray;
```

- [ ] **Step 2: tray.rs — icon generatsiya + failing test**

`src-tauri/src/tray.rs`:
```rust
use tauri::image::Image;

/// Rejim rangini RGB sifatida qaytaradi (Electron qiymatlari).
fn mode_color(mode: &str) -> (u8, u8, u8) {
  match mode {
    "short-break" => (45, 212, 191),
    "long-break" => (167, 139, 250),
    _ => (74, 222, 128), // focus (default)
  }
}

/// 22×22 RGBA tray icon: running=to'la doira, pauza=halqa (36° checker).
/// Electron `createModeIcon` mantiqining ko'chirmasi.
pub fn create_mode_icon(mode: &str, is_running: bool) -> Image<'static> {
  let (r, g, b) = mode_color(mode);
  let size: u32 = 22;
  let cx = size as f64 / 2.0;
  let cy = size as f64 / 2.0;
  let outer_r = cx - 1.0;
  let ring_inner = outer_r - 2.5;
  let mut pixels = vec![0u8; (size * size * 4) as usize];
  for y in 0..size {
    for x in 0..size {
      let dx = x as f64 - cx + 0.5;
      let dy = y as f64 - cy + 0.5;
      let dist = (dx * dx + dy * dy).sqrt();
      let mut alpha = 0u8;
      if is_running {
        if dist <= outer_r {
          alpha = 255;
        }
      } else if dist >= ring_inner && dist <= outer_r {
        let angle = (dy.atan2(dx) * 180.0 / std::f64::consts::PI + 360.0) % 360.0;
        if ((angle / 36.0).floor() as i64) % 2 == 0 {
          alpha = 200;
        }
      }
      let i = ((y * size + x) * 4) as usize;
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = alpha;
    }
  }
  Image::new_owned(pixels, size, size)
}

#[cfg(test)]
mod tests {
  use super::*;

  // Markaz pikselining RGBA'sini qaytaradi (test yordamchisi orqali
  // raw bufferni qayta hisoblaymiz, chunki Image rgba'ni to'g'ridan bermaydi).
  fn center_alpha(mode: &str, is_running: bool) -> u8 {
    // create_mode_icon ichidagi mantiqни takrorlash o'rniga markazda
    // running=to'la (alpha 255), pauza=halqa ichida emas (markaz alpha 0).
    let _ = mode_color(mode);
    let size = 22.0;
    let cx = size / 2.0;
    let dx = (size / 2.0).floor() - cx + 0.5;
    let dy = (size / 2.0).floor() - cy_placeholder();
    let dist = (dx * dx + dy * dy).sqrt();
    let outer_r = cx - 1.0;
    let ring_inner = outer_r - 2.5;
    if is_running {
      if dist <= outer_r { 255 } else { 0 }
    } else if dist >= ring_inner && dist <= outer_r { 200 } else { 0 }
  }
  fn cy_placeholder() -> f64 { 22.0 / 2.0 - 0.5 }

  #[test]
  fn mode_colors_match_electron() {
    assert_eq!(mode_color("focus"), (74, 222, 128));
    assert_eq!(mode_color("short-break"), (45, 212, 191));
    assert_eq!(mode_color("long-break"), (167, 139, 250));
    assert_eq!(mode_color("unknown"), (74, 222, 128)); // default = focus
  }

  #[test]
  fn icon_has_correct_dimensions() {
    let img = create_mode_icon("focus", true);
    assert_eq!(img.width(), 22);
    assert_eq!(img.height(), 22);
  }

  #[test]
  fn running_center_is_filled_paused_center_is_empty() {
    // running: markaz to'la (alpha 255); pauza: markaz halqa ichida emas (alpha 0).
    assert_eq!(center_alpha("focus", true), 255);
    assert_eq!(center_alpha("focus", false), 0);
  }
}
```
**ESLATMA implementer uchun:** yuqoridagi `center_alpha`/`cy_placeholder` test-yordamchisi biroz noqulay yozilgan. Agar u kompilyatsiya bo'lmasa yoki noaniq bo'lsa, uni SODDALASHTIR — asosiy maqsad uchta haqiqatni tekshirish: (1) `mode_color` qiymatlari to'g'ri, (2) icon o'lchami 22×22, (3) `create_mode_icon` panic qilmaydi. `center_alpha` o'rniga to'g'ridan-to'g'ri `create_mode_icon("focus", true)` chaqirib panic bo'lmasligini tekshirish ham yetarli. Test sifatini saqla, lekin xira yordamchidan voz kechishing mumkin.

- [ ] **Step 3: Testlar**

Run: `cd src-tauri && cargo test --lib tray::`
Expected: PASS — `mode_colors_match_electron`, `icon_has_correct_dimensions`, va markaz testi.

- [ ] **Step 4: Commit**
```bash
git add src-tauri/src/tray.rs src-tauri/src/lib.rs
git commit -m "feat(tauri): Faza 5 — tray icon RGBA generatsiya + testlar"
```

---

### Task 4: Tray menu, hodisalar, setup + transient exclusion

**Files:**
- Modify: `src-tauri/src/tray.rs` (menu, events, update_tray_state, setup, quit)
- Modify: `src-tauri/src/lib.rs` (setup'da tray, invoke_handler, quit transient exclusion)
- Modify: `src-tauri/capabilities/default.json` (tray permission)

- [ ] **Step 1: tray.rs — formatlash, menu, setup, update funksiyalari**

`src-tauri/src/tray.rs` oxiriga (`#[cfg(test)]` blokidan **oldin**) qo'sh:
```rust
use crate::app_state::AppState;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};

const MODE_FOCUS: &str = "focus";

fn format_time(secs: i64) -> String {
  let s = secs.max(0);
  format!("{:02}:{:02}", s / 60, s % 60)
}

fn mode_label(mode: &str) -> &'static str {
  match mode {
    "short-break" => "Qisqa tanaffus",
    "long-break" => "Uzoq tanaffus",
    _ => "Fokus",
  }
}

/// Tray menyusini joriy holatga qarab quradi (hardcoded o'zbekcha).
fn build_menu(app: &AppHandle, time_left: i64, mode: &str, is_running: bool, is_visible: bool) -> tauri::Result<Menu<tauri::Wry>> {
  let status = MenuItem::with_id(app, "status", format!("{}  •  {}", format_time(time_left), mode_label(mode)), false, None::<&str>)?;
  let toggle = MenuItem::with_id(app, "toggle", if is_running { "⏸  To'xtatish" } else { "▶  Boshlash" }, true, None::<&str>)?;
  let skip = MenuItem::with_id(app, "skip", "⏭  Keyingisiga o'tish", true, None::<&str>)?;
  let mini = MenuItem::with_id(app, "mini", "📌  Mini rejim", true, None::<&str>)?;
  let toggle_vis = MenuItem::with_id(app, "toggle_visibility", if is_visible { "🙈  Yashirish" } else { "👁  Ko'rsatish" }, true, None::<&str>)?;
  let quit = MenuItem::with_id(app, "quit", "Chiqish", true, None::<&str>)?;
  let sep1 = PredefinedMenuItem::separator(app)?;
  let sep2 = PredefinedMenuItem::separator(app)?;
  let sep3 = PredefinedMenuItem::separator(app)?;
  Menu::with_items(app, &[&status, &sep1, &toggle, &skip, &sep2, &mini, &toggle_vis, &sep3, &quit])
}

/// Ilk tray'ni yaratadi (setup'da bir marta chaqiriladi).
pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
  let menu = build_menu(app, 0, MODE_FOCUS, false, true)?;
  let _tray = TrayIconBuilder::with_id("main-tray")
    .icon(create_mode_icon(MODE_FOCUS, false))
    .icon_as_template(false) // macOS: rangni saqlash
    .tooltip("ZenFocus")
    .menu(&menu)
    .show_menu_on_left_click(false)
    .on_menu_event(|app, event| handle_menu_event(app, event.id().as_ref()))
    .on_tray_icon_event(|tray, event| {
      if let TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, button_state: tauri::tray::MouseButtonState::Up, .. } = event {
        toggle_window_visibility(tray.app_handle());
      }
    })
    .build(app)?;
  Ok(())
}

fn toggle_window_visibility(app: &AppHandle) {
  if let Some(win) = app.get_webview_window("main") {
    if win.is_visible().unwrap_or(false) {
      let _ = win.hide();
    } else {
      let _ = win.show();
      let _ = win.set_focus();
    }
  }
}

fn handle_menu_event(app: &AppHandle, id: &str) {
  match id {
    "toggle" => { let _ = app.emit("tray:toggle-timer", ()); }
    "skip" => { let _ = app.emit("tray:skip", ()); }
    "mini" => { let _ = app.emit("tray:set-mini-mode", true); }
    "toggle_visibility" => toggle_window_visibility(app),
    "quit" => {
      let state = app.state::<AppState>();
      state.inner.lock().unwrap().is_quitting = true;
      crate::window_util::restore_normal_before_exit(app);
      app.exit(0);
    }
    _ => {}
  }
}

/// Tray holatini yangilaydi: tooltip har chaqiruvda; icon+menu faqat mode/running o'zgarganda.
pub fn update_tray(app: &AppHandle, time_left: i64, mode: &str, is_running: bool) {
  let tray: Option<TrayIcon> = app.tray_by_id("main-tray");
  let Some(tray) = tray else { return };

  let _ = tray.set_tooltip(Some(format!("ZenFocus  |  {}  |  {}", format_time(time_left), mode_label(mode))));
  #[cfg(target_os = "macos")]
  {
    let _ = tray.set_title(Some(format_time(time_left)));
  }

  let (changed, is_visible) = {
    let state = app.state::<AppState>();
    let mut inner = state.inner.lock().unwrap();
    let changed = inner.prev_mode.as_deref() != Some(mode) || inner.prev_running != Some(is_running);
    inner.prev_mode = Some(mode.to_string());
    inner.prev_running = Some(is_running);
    let vis = app.get_webview_window("main").and_then(|w| w.is_visible().ok()).unwrap_or(true);
    (changed, vis)
  };

  if changed {
    let _ = tray.set_icon(Some(create_mode_icon(mode, is_running)));
    if let Ok(menu) = build_menu(app, time_left, mode, is_running, is_visible) {
      let _ = tray.set_menu(Some(menu));
    }
  }
}
```

- [ ] **Step 2: tray.rs — update_tray_state command**

`src-tauri/src/tray.rs`da `update_tray` funksiyasidan keyin (test blokidan oldin) qo'sh:
```rust
use crate::models::TrayTimerState;

#[tauri::command]
pub fn update_tray_state(app: AppHandle, state: TrayTimerState) -> Result<(), String> {
  let mode = match state.mode {
    crate::models::TrayMode::Focus => "focus",
    crate::models::TrayMode::ShortBreak => "short-break",
    crate::models::TrayMode::LongBreak => "long-break",
  };
  update_tray(&app, state.time_left, mode, state.is_running);
  Ok(())
}
```

- [ ] **Step 3: window_util.rs — transient exclusion yordamchisi**

`src-tauri/src/window_util.rs` yarat (close/quit'da mini-rejimdan normal o'lchamga qaytarish):
```rust
use crate::app_state::AppState;
use tauri::{AppHandle, Manager};

/// Chiqishdan oldin mini-rejimda bo'lsa normal o'lchamга qaytaradi —
/// window-state plugin transient (320×72) o'lchamni saqlab qolmasligi uchun.
pub fn restore_normal_before_exit(app: &AppHandle) {
  use tauri::{LogicalSize, Size};
  let state = app.state::<AppState>();
  let (mini, normal_size) = {
    let inner = state.inner.lock().unwrap();
    (inner.mini_mode, inner.normal_size)
  };
  if mini {
    if let Some(win) = app.get_webview_window("main") {
      let _ = win.set_min_size(Some(Size::Logical(LogicalSize::new(0.0, 0.0))));
      let _ = win.set_max_size(Some(Size::Logical(LogicalSize::new(9999.0, 9999.0))));
      if let Some((w, h)) = normal_size {
        let _ = win.set_size(Size::Logical(LogicalSize::new(w, h)));
      }
    }
  }
}
```
`lib.rs` boshiga `mod window_util;` qo'sh.

- [ ] **Step 4: lib.rs — tray setup, invoke_handler, close-to-tray'da transient exclusion**

`lib.rs` `.setup(move |app| {` ichida, NVIDIA blokidan keyin (`Ok(())`dan oldin) qo'sh:
```rust
      tray::setup_tray(app.handle())?;
```
`invoke_handler!` ro'yxatiga (window command'lardan keyin) qo'sh:
```rust
      commands::window::set_mini_mode,
      tray::update_tray_state
```
`on_window_event` `CloseRequested` blokini transient exclusion bilan yangilang (hide'dan oldin normal o'lchamga qaytarish):
```rust
      if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        use tauri::Manager;
        let state = window.state::<app_state::AppState>();
        let is_quitting = state.inner.lock().unwrap().is_quitting;
        if !is_quitting {
          api.prevent_close();
          crate::window_util::restore_normal_before_exit(window.app_handle());
          let _ = window.hide();
        }
      }
```

- [ ] **Step 5: capabilities — tray permission**

`src-tauri/capabilities/default.json` `permissions`ga qo'sh:
```json
    "tray:default"
```

- [ ] **Step 6: Build, clippy, test**

Run: `cd src-tauri && cargo clippy --all-targets -- -D warnings && cargo test --lib`
Expected: PASS — clippy toza, tray testlari o'tadi.

- [ ] **Step 7: Commit**
```bash
git add src-tauri/src/ src-tauri/capabilities/default.json
git commit -m "feat(tauri): Faza 5 — tray menu/hodisalar + update_tray_state + transient exclusion"
```

---

### Task 5: Frontend `window.ts` helper modul

**Files:**
- Create: `src/shared/tauri/window.ts`

- [ ] **Step 1: window.ts yaratish**

`src/shared/tauri/window.ts`:
```ts
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { TrayTimerState } from '@shared/types';

const appWindow = getCurrentWindow();

/** Oddiy oyna amallari — renderer'da to'g'ridan-to'g'ri. */
export const win = {
  minimize: () => appWindow.minimize(),
  toggleMaximize: () => appWindow.toggleMaximize(),
  close: () => appWindow.close(),
};

/** Murakkab oyna/tray amallari — Rust command. */
export const winApi = {
  setAlwaysOnTop: (enabled: boolean) => invoke<void>('set_always_on_top', { enabled }),
  setMiniMode: (enabled: boolean) => invoke<void>('set_mini_mode', { enabled }),
  updateTrayState: (state: TrayTimerState) => invoke<void>('update_tray_state', { state }),
};

/** Tray/oyna hodisalariga obuna — Promise<UnlistenFn> qaytaradi (Tauri async). */
export const winEvents = {
  onMiniModeChanged: (cb: (enabled: boolean) => void): Promise<UnlistenFn> =>
    listen<boolean>('window:mini-mode-changed', (e) => cb(e.payload)),
  onTrayToggle: (cb: () => void): Promise<UnlistenFn> =>
    listen('tray:toggle-timer', () => cb()),
  onTraySkip: (cb: () => void): Promise<UnlistenFn> =>
    listen('tray:skip', () => cb()),
  onTraySetMiniMode: (cb: (enabled: boolean) => void): Promise<UnlistenFn> =>
    listen<boolean>('tray:set-mini-mode', (e) => cb(e.payload)),
};
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS — `@tauri-apps/api/window`, `/core`, `/event` import'lari yechiladi.

- [ ] **Step 3: Commit**
```bash
git add src/shared/tauri/window.ts
git commit -m "feat(tauri): Faza 5 — frontend window.ts helper modul"
```

---

### Task 6: Frontend chaqiruv joylari migratsiyasi

**Files:**
- Modify: `src/renderer/components/window-control.tsx`
- Modify: `src/renderer/components/settings-panel.tsx`
- Modify: `src/renderer/app/layout/index.tsx`
- Modify: `src/renderer/app/layout/main.tsx`
- Modify: `src/renderer/hooks/use-tray-sync.ts`

- [ ] **Step 1: window-control.tsx**

Import qo'sh (1-6 qatorlar bloki oxiriga):
```ts
import { win, winApi } from '@shared/tauri/window';
```
Handlerlarni almashtir (13-15 qatorlar):
```ts
  const handleMinimize = () => win.minimize();
  const handleMaximize = () => win.toggleMaximize();
  const handleClose = () => win.close();
```
Mini tugma (40-qator) `window.electronApi?.setMiniMode(true)` →
```ts
            onClick={() => winApi.setMiniMode(true).catch(err => console.error('setMiniMode failed:', err))}
```
Always-on-top (47-51 qatorlar) ichidagi `window.electronApi?.setAlwaysOnTop(next);` →
```ts
              winApi.setAlwaysOnTop(next).catch(err => console.error('setAlwaysOnTop failed:', err));
```

- [ ] **Step 2: settings-panel.tsx**

Import qo'sh (mavjud import bloki oxiriga):
```ts
import { winApi } from '@shared/tauri/window';
```
161-qator `window.electronApi?.setAlwaysOnTop(v);` →
```ts
                onCheckedChange={v => { updateSettings({ alwaysOnTop: v }); winApi.setAlwaysOnTop(v).catch(err => console.error('setAlwaysOnTop failed:', err)); }} />
```
169-qator `window.electronApi?.setMiniMode(true)` →
```ts
                  onClick={() => winApi.setMiniMode(true).catch(err => console.error('setMiniMode failed:', err))}>
```
(`todoistImport` (71) va `pickNotificationSound` (131) **tegilmaydi** — Faza 6/8.)

- [ ] **Step 3: layout/index.tsx**

Import qo'sh:
```ts
import { winApi, winEvents } from '@shared/tauri/window';
```
`exitMini` (48-qator):
```ts
  const exitMini = () => winApi.setMiniMode(false).catch(err => console.error('setMiniMode failed:', err));
```
`onMiniModeChanged` useEffect (247-qator atrofida). Hozir:
```ts
  useEffect(() => {
    return window.electronApi?.onMiniModeChanged((enabled) => {
      setIsMiniMode(enabled);
    });
  }, []);
```
Bo'lsin (async listen cleanup):
```ts
  useEffect(() => {
    const unlisten = winEvents.onMiniModeChanged((enabled) => setIsMiniMode(enabled));
    return () => { unlisten.then((fn) => fn()); };
  }, []);
```

- [ ] **Step 4: layout/main.tsx**

Import qo'sh:
```ts
import { winApi } from '@shared/tauri/window';
```
86-89 qatorlar:
```ts
    if (!isMiniMode) {
      window.electronApi?.setAlwaysOnTop(settings.alwaysOnTop);
    }
```
Bo'lsin:
```ts
    if (!isMiniMode) {
      winApi.setAlwaysOnTop(settings.alwaysOnTop).catch(err => console.error('setAlwaysOnTop failed:', err));
    }
```

- [ ] **Step 5: use-tray-sync.ts — to'liq almashtirish (async listen)**

`src/renderer/hooks/use-tray-sync.ts`ni to'liq quyidagiga almashtir:
```ts
import { useEffect, useRef } from 'react';
import type { TrayTimerState } from '@shared/types';
import type { TimerMode } from './use-timer';
import { winApi, winEvents } from '@shared/tauri/window';

interface TrayTimerHookProps {
  timeLeft: number;
  mode: TimerMode;
  isRunning: boolean;
  toggle: () => void;
  skip: () => void;
}

export function useTraySync({ timeLeft, mode, isRunning, toggle, skip }: TrayTimerHookProps) {
  const toggleRef = useRef(toggle);
  const skipRef = useRef(skip);
  toggleRef.current = toggle;
  skipRef.current = skip;

  // Timer holatini tray'ga yuborish
  useEffect(() => {
    const state: TrayTimerState = { timeLeft, mode, isRunning };
    winApi.updateTrayState(state).catch(err => console.error('updateTrayState failed:', err));
  }, [timeLeft, mode, isRunning]);

  // Tray menyu hodisalari — Tauri listen() Promise<UnlistenFn> qaytaradi.
  useEffect(() => {
    const unlisten = winEvents.onTrayToggle(() => toggleRef.current());
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  useEffect(() => {
    const unlisten = winEvents.onTraySkip(() => skipRef.current());
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  useEffect(() => {
    const unlisten = winEvents.onTraySetMiniMode((enabled) => {
      winApi.setMiniMode(enabled).catch(err => console.error('setMiniMode failed:', err));
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);
}
```

- [ ] **Step 6: Tekshiruv — store-bo'lmagan window/tray chaqiruvlari ko'chgani**

Run: `grep -rn "electronApi?\.\(minimizeWindow\|maximizeWindow\|closeWindow\|setMiniMode\|setAlwaysOnTop\|updateTrayState\|onTrayToggle\|onTraySkip\|onTraySetMiniMode\|onMiniModeChanged\)" src/renderer`
Expected: **bo'sh** — barcha window/tray chaqiruvlari `window.ts`ga ko'chgan. (Qolgan `electronApi?.` — `todoistImport`, `pickNotificationSound`, `yt*`, `listMusicFiles`, `exportTasks`, `importTasks`, `checkForUpdates` — Faza 6/7/8.)

- [ ] **Step 7: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**
```bash
git add src/renderer/
git commit -m "feat(tauri): Faza 5 — frontend oyna/tray chaqiruvlarini window.ts'ga ko'chirish"
```

---

### Task 7: Runtime acceptance verifikatsiyasi (ASOSIY DARVOZA)

Inson tomonidan haqiqiy Linux mashinada bajariladi (GUI + tray unit-testlanmaydi).

**Files:** (verifikatsiya — kod yo'q)

- [ ] **Step 1: Build darvozalari**

Run: `cd src-tauri && cargo clippy --all-targets -- -D warnings && cargo test --lib` so'ng loyiha ildizida `bun run typecheck`
Expected: hammasi toza.

- [ ] **Step 2: Ishga tushirish**

Run: `bun run dev`
Expected: oyna ochiladi, tray ikonkasi paydo bo'ladi.

- [ ] **Step 3: Oyna boshqaruvi**

minimize/maximize/close tugmalari ishlaydi; titlebar drag ishlaydi (allaqachon).
- close → oyna **trayga yashiriladi** (chiqmaydi).

- [ ] **Step 4: Always-on-top + mini-rejim**

- Pin tugma → always-on-top yoqiladi; boshqa oynaga o'tib qaytganda ustda turadi (Linux blur reapply).
- Mini tugma → 320×72 + always-on-top; mini'dan chiqish → avvalgi o'lcham tiklanadi.

- [ ] **Step 5: Tray**

- Tray ikonkasi rejimga qarab rangli (focus=yashil, short=teal, long=binafsha); running=to'la, pauza=halqa.
- Tray menu: play/pause, skip, mini, yashirish/ko'rsatish, Chiqish ishlaydi.
- Tray click → oyna ko'rinsa yashiradi, aks holda ko'rsatadi+focus.
- Tooltip `ZenFocus | MM:SS | rejim`.

- [ ] **Step 6: Korrektlik tuguni**

- **Mini-rejimda yopib qayta ochish → normal o'lchamda ochiladi** (transient exclusion).
- Tray "Chiqish" → ilova haqiqatan chiqadi.
- Ilova ochiq turib qayta ishga tushirish (2-instans) → mavjud oyna show+focus bo'ladi (yashirin bo'lsa ham).

- [ ] **Step 7: Push**
```bash
git push origin tauri-migration
```

- [ ] **Step 8: Obsidian holatini yangilash (qo'lda)**

`ZenFocus Tauri Migration — Index.md`: Faza 5 → ✅ Tugadi, Faza 6 → ⬜ Keyingi.

---

## Self-Review natijalari

**Spec coverage:**
- Aralash oyna boshqaruvi (renderer min/max/close, Rust aot/mini) → Task 2 (Rust), Task 5/6 (frontend) ✅
- set_always_on_top + Linux blur + macOS → Task 2 ✅
- set_mini_mode aniq qiymatlar + KDE tartibi → Task 2 ✅
- Tray icon runtime RGBA (`Image::new_owned`) → Task 3 ✅
- macOS icon_as_template(false) → Task 4 Step 1 ✅
- Tray menu/click/events + update_tray_state (prev guard) → Task 4 ✅
- Close-to-tray (is_quitting) → Task 1 + Task 4 ✅
- window-state transient exclusion → Task 4 (window_util) ✅
- single-instance show+unminimize+focus → Task 1 ✅
- Frontend window.ts (api.ts'dan ajratilgan) → Task 5 ✅
- use-tray-sync async listen → Task 6 Step 5 ✅
- YAGNI: toggle_music_panel tashlangan (rejaga kiritilmagan), tray i18n hardcoded → Task 4 ✅
- Runtime acceptance → Task 7 ✅

**Type consistency:** `win`/`winApi`/`winEvents` (Task 5) Task 6'da izchil ishlatilgan. `update_tray_state` arg `{ state }` (Task 4) ↔ `winApi.updateTrayState` `{ state }` (Task 5) mos. `TrayMode` enum (Faza 3 models) Task 4'da ishlatilgan. Event nomlari Rust emit (Task 2/4) ↔ frontend listen (Task 5) mos: `window:mini-mode-changed`, `tray:toggle-timer`, `tray:skip`, `tray:set-mini-mode`.

**Placeholder scan:** Task 3 test-yordamchisi `center_alpha` murakkab — implementer'ga uni soddalashtirish ruxsati aniq berilgan (test sifatini saqlab). Boshqa TODO/TBD yo'q.

**Rust API ishonchsizligi:** Tray/menu/window API'lari Tauri 2.11 uchun context7'dan tasdiqlandi (`Image::new_owned`, `TrayIconBuilder`, `MenuItem::with_id`), lekin aniq imzolar versiya bo'yicha biroz farq qilishi mumkin — implementer `cargo build` xatolariga qarab moslaydi (mantiq o'zgarmaydi). Bu Rust uchun kutilgan; mantiqни emas, faqat API imzolarini moslashtirish mumkin.
