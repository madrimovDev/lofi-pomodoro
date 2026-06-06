# Faza 5 — Oyna va Tray — Design

> Status: approved (brainstorm) · Sana: 2026-06-06 · Branch: `tauri-migration`
> Manba reja: Obsidian `ZenFocus Tauri Migration/Faza 5 — Oyna va Tray.md`, repo `docs/TZ-tauri-migratsiya.md` (§5.1–5.5, §5.10)
> Bog'liq: Faza 4 (`docs/superpowers/specs/2026-06-06-phase4-frontend-api-design.md`) — frontend api qatlami tayyor.

## Maqsad

Oyna boshqaruvi va tray funksional bo'lsin (hozir tugmalar no-op, `window.electronApi` Tauri'da `undefined`). Natija: minimize/maximize/close, always-on-top, mini-rejim, close-to-tray, single-instance, va rejimga qarab rangli dinamik tray icon + menu ishlaydi.

## Qabul qilingan qarorlar (brainstorm)

1. **Dekompozitsiya:** Bitta yaxlit spec/plan (oyna + tray birga — close-to-tray ikkalasiga tegishli).
2. **Oyna boshqaruvi:** Aralash — min/max/close renderer'da (`@tauri-apps/api/window` `getCurrentWindow()`); always-on-top/mini-mode Rust command (platforma logikasi). Tray to'liq Rust.
3. **Tray icon:** Runtime Rust generatsiya — RGBA buffer qo'lda hisoblanadi (Electron loop ko'chiriladi), `tauri::image::Image::new_owned` ga beriladi. Alohida `image` crate kerak emas.
4. **`toggle_music_panel`:** Tashlanadi (frontend chaqirmaydi).
5. **Tray menu i18n:** Hardcoded o'zbekcha (Electron'dagidek); locale-aware keyinroq.

## Arxitektura va fayl strukturasi

| Fayl | Mas'uliyat | Holat |
|---|---|---|
| `src-tauri/src/commands/window.rs` | `set_always_on_top`, `set_mini_mode` command'lar | Yangi |
| `src-tauri/src/tray.rs` | Tray icon RGBA generatsiya, menu, hodisalar, `update_tray_state` | Yangi |
| `src-tauri/src/commands/mod.rs` | `pub mod window;` qo'shish | O'zgartirish |
| `src-tauri/src/lib.rs` | single-instance + window-state plugin, tray setup, window event (close-to-tray), invoke_handler | O'zgartirish |
| `src-tauri/tauri.conf.json` | tasdiqlash: `decorations: false`, min-size 600×400 | O'zgartirish (kerak bo'lsa) |
| `src-tauri/Cargo.toml` | `tauri-plugin-single-instance`, `tauri-plugin-window-state` | O'zgartirish |
| `src-tauri/capabilities/default.json` | window (set-always-on-top, set-size, ...) va tray permission'lar | O'zgartirish |
| `package.json` | `@tauri-apps/plugin-window-state` (agar frontend kerak qilsa) | O'zgartirish |
| `src/shared/tauri/window.ts` | renderer oyna/tray helperlari: `getCurrentWindow()` wrapper'lari + `setAlwaysOnTop`/`setMiniMode`/`updateTrayState` invoke'lari + tray hodisa `listen()` helperlari | Yangi |
| `src/renderer/components/window-control.tsx` | min/max/close → `getCurrentWindow()`, mini → `api` | O'zgartirish |
| `src/renderer/app/layout/index.tsx` | MiniLayout exit + `onMiniModeChanged` listen | O'zgartirish |
| `src/renderer/app/layout/main.tsx` | always-on-top sync → `api` | O'zgartirish |
| `src/renderer/components/settings-panel.tsx` | always-on-top/mini → `api` | O'zgartirish |
| `src/renderer/hooks/use-tray-sync.ts` | `updateTrayState` → `api`; tray hodisalar `listen()` (async) | O'zgartirish |

**Toza ajratish:** `api.ts` (Faza 4) faqat store metodlari uchun qoladi. Window/tray invoke command'lari (`setAlwaysOnTop`, `setMiniMode`, `updateTrayState`), oyna helperlari (`getCurrentWindow()` o'ramlari) va tray hodisa `listen()` helperlari yangi `src/shared/tauri/window.ts`ga joylashtiriladi.

## 1. Oyna boshqaruvi

### Renderer (oddiy amallar)
`@tauri-apps/api/window` `getCurrentWindow()`:
- minimize → `getCurrentWindow().minimize()`
- maximize/unmaximize → `getCurrentWindow().toggleMaximize()`
- close → `getCurrentWindow().close()` (close-to-tray hodisasini tetiklaydi — 4-bo'lim)

### Rust command'lar (`commands/window.rs`)
- **`set_always_on_top(enabled: bool)`:**
  - `window.set_always_on_top(enabled)`
  - **Linux:** flag yoqiq bo'lsa `WindowEvent::Focused(false)` (blur) da qayta qo'llash — kompozitor stacking'ni reset qiladi (TZ §5.3). Flag holati Rust state'da (`Mutex`/`State`) saqlanadi.
  - **macOS:** `set_visible_on_all_workspaces(enabled, ...)`
  - Startup'da `settings.alwaysOnTop` o'qib tiklanadi (store'dan).
- **`set_mini_mode(enabled: bool)`:**
  - Yoqilganda: joriy `inner_size`+`min_size` saqlanadi (Rust state), `set_min_size(200×54)`, `set_max_size(800×200)`, `set_size(320×72)`, always-on-top **majburan yoqiladi**.
  - O'chirilganda: KDE Wayland tartibi — `set_min_size(None/0,0)` → `set_max_size(9999,9999)` → saqlangan min/o'lcham qaytariladi (`set_max_size(0,0)` KDE'ni buzadi, ishlatilmaydi). Oldingi always-on-top holati qaytariladi.
  - Oxirida `window:mini-mode-changed` event emit (renderer `listen`).

## 2. Tray (`src-tauri/src/tray.rs`)

### Icon — runtime RGBA generatsiya
Electron `createModeIcon` loop'i Rust'ga ko'chiriladi:
- 22×22 RGBA buffer (`Vec<u8>`, row-major).
- Ranglar: `focus` = (74,222,128), `short-break` = (45,212,191), `long-break` = (167,139,250).
- `is_running` → to'la doira (`dist <= outerR`); pauza → halqa checker pattern (36° sektor, `atan2`).
- `tauri::image::Image::new_owned(rgba, 22, 22)` → `tray.set_icon(Some(image))`.
- **macOS:** `TrayIconBuilder::icon_as_template(false)` — rangni saqlash uchun (aks holda macOS monoxrom template'ga majburlaydi). Dev mashina Linux; macOS xulqi release'da tekshiriladi (latent).

### Menu (`tauri::menu`)
Tartib (Electron'dan, hardcoded o'zbekcha):
1. Status satri (disabled): `"MM:SS  •  <rejim>"`
2. separator
3. `▶  Boshlash` / `⏸  To'xtatish` (running holatiga qarab) → `tray:toggle-timer` emit
4. `⏭  Keyingisiga o'tish` → `tray:skip` emit
5. separator
6. `📌  Mini rejim` → `tray:set-mini-mode` (true) emit
7. `🙈  Yashirish` / `👁  Ko'rsatish` → to'g'ridan show/hide+focus (Rust ichida)
8. separator
9. `Chiqish` → `is_quitting=true` + `app.exit(0)`

`on_menu_event` menu id bo'yicha tarmoqlanadi.

### Click
`on_tray_icon_event` → `TrayIconEvent::Click` (left, Up) → oyna ko'rinsa `hide()`, aks holda `show()` + `set_focus()`.

### `update_tray_state(state: TrayTimerState)` (Rust command)
- tooltip `ZenFocus | MM:SS | <rejim>` va macOS `set_title(MM:SS)` — **har chaqiruvda** (har tick).
- icon + menu rebuild — **faqat** `state.mode`/`state.is_running` oldingisidan farq qilganda (Rust state'da `prev_mode`/`prev_running` guard — har sekund PNG regeneratsiya qilmaslik uchun).

## 3. Close-to-tray × window-state × mini-mode (korrektlik tuguni)

- **Close-to-tray:** `lib.rs` `on_window_event` `WindowEvent::CloseRequested { api, .. }` → agar `is_quitting` o'rnatilmagan bo'lsa `api.prevent_close()` + `window.hide()`. Tray "Chiqish" → `is_quitting=true` keyin `app.exit(0)`. Bayroq nomi **`is_quitting`** (Electron `isQuiting` typo'si ko'chirilMAYDI). Bayroq `AppHandle` state'da (`Mutex<bool>` yoki `AtomicBool`).
- **window-state plugin:** `tauri-plugin-window-state` normal width/height/x/y saqlaydi.
  - **Wayland:** x/y o'tkazib yuborish (kompozitorlar e'tiborsiz) — `StateFlags`dan `POSITION`ni Linux/Wayland'da chiqarish yoki qabul qilish.
  - **Transient exclusion (KRITIK):** hide-on-close VA quit'dan oldin, agar mini-mode yoki panel-expanded bo'lsa, avval normal o'lchamga qaytariladi — aks holda plugin 320×72 ni saqlaydi va ilova mini holatda ochiladi (TZ §5.1). Amalga oshirish: close/quit yo'lida mini-mode holatини tekshirib, kerak bo'lsa saqlangan normal o'lchamni tiklab, keyin hide/save.
- **single-instance** (`tauri-plugin-single-instance::init`, **birinchi** plugin sifatida ro'yxatdan o'tkaziladi): ikkinchi instans → `show()` + `unminimize()` + `set_focus()` (close-to-tray sababli oyna ko'pincha **yashirin**, nafaqat minimized — Electron faqat minimized'ni boshqargan edi).

## 4. Frontend o'zgarishlar

- **`window-control.tsx`:** min/max/close → `getCurrentWindow()`; mini → `api.setMiniMode(true)`.
- **`app/layout/index.tsx`:** MiniLayout exit → `api.setMiniMode(false)`; `onMiniModeChanged` → `listen('window:mini-mode-changed', ...)`.
- **`app/layout/main.tsx`:** always-on-top sync → `api.setAlwaysOnTop(...)` (mini-mode'da skip).
- **`settings-panel.tsx`:** always-on-top/mini → `api`.
- **`use-tray-sync.ts` — yagona nomexanik fayl:**
  - `updateTrayState(state)` → `window.ts` helperi (invoke).
  - Tray hodisa listener'lari: Tauri `listen()` **`Promise<UnlistenFn>`** qaytaradi (Electron sinxron `()=>void` emas). `useEffect` cleanup async unlisten'ni to'g'ri boshqaradi — listener Promise'ini saqlab, cleanup'da `.then(fn => fn())`. React strict-mode double-mount'da stale/double-subscribe oldini olinadi (mounted bayrog'i yoki Promise tracking).
  - Hodisalar: `tray:toggle-timer`, `tray:skip`, `tray:set-mini-mode`, `window:mini-mode-changed`.

`set` chaqiruvlariga `.catch(console.error)` (Faza 4 konventsiyasi).

## 5. Tashlangan narsalar (YAGNI — aniq qarorlar)

- **`toggle_music_panel`:** Tashlanadi. Frontend uni umuman chaqirmaydi (music panel React state bilan boshqariladi, window resize'siz). Obsidian rejada vazifa bor, lekin ko'chirish keraksiz.
- **Tray menu i18n:** Hardcoded o'zbekcha (Electron'dagidek). Locale-aware tray keyinroq. Yorliqlar holat bilan o'zgaradi (Boshlash/To'xtatish, Yashirish/Ko'rsatish).

## 6. Pluginlar va permission'lar

- `Cargo.toml`: `tauri-plugin-single-instance = "2"`, `tauri-plugin-window-state = "2"`.
- `lib.rs` plugin tartibi: **single-instance birinchi**, keyin store (Faza 3), window-state, log.
- `capabilities/default.json`: window permission'lar (`core:window:allow-minimize`, `allow-maximize`, `allow-unmaximize`, `allow-toggle-maximize`, `allow-close`, `allow-hide`, `allow-show`, `allow-set-focus`, `allow-set-always-on-top`, `allow-set-size`, `allow-set-min-size`, `allow-set-max-size`, `allow-start-dragging` (bor)), tray default permission, `core:event` (listen/emit).

## 7. Verifikatsiya (runtime acceptance — yagona haqiqiy darvoza)

Unit-test infra yo'q; clippy/typecheck + qo'lda runtime (haqiqiy Linux mashinada):
- [ ] `cargo clippy --all-targets -- -D warnings` toza, `bun run typecheck` toza
- [ ] minimize/maximize/close ishlaydi; titlebar drag (allaqachon ishlaydi)
- [ ] always-on-top: boshqa oynaga o'tib qaytganda ustda turadi (Linux blur reapply)
- [ ] mini-rejim: 320×72 + always-on-top; chiqishda avvalgi o'lcham tiklanadi
- [ ] tray: rangli icon rejimga qarab o'zgaradi (focus/short/long; running/pauza); menu amallari ishlaydi; tooltip to'g'ri
- [ ] yopish → trayga yashiradi (chiqmaydi); tray "Chiqish" → haqiqatan chiqadi
- [ ] **mini-rejimda yopib qayta ochish → normal o'lchamda ochiladi** (transient exclusion ishlaydi)
- [ ] 2-marta ochishda mavjud (yashirin/minimized) oyna show+focus bo'ladi
- [ ] tray icon har sekund regeneratsiya bo'lmaydi (faqat mode/running o'zgarishda)
