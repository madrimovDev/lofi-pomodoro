# Majburiy tanaffus fullscreen overlay — Dizayn spetsifikatsiyasi

**Sana:** 2026-06-08
**Branch:** `tauri-migration`
**Status:** Tasdiqlangan (brainstorm) → planning

## Kontekst

Pomodoro tanaffusi boshlanganda to'liq ekranli break overlay chiqadi. Hozir bu faqat oyna NORMAL holatda bo'lsa ishlaydi (`index.tsx:291` `onBreakStart={isMiniMode ? undefined : handleBreakStart}` — mini'da bloklangan; tray'ga yashiringanda oyna ko'rinmaydi). Foydalanuvchi: kod yozayotganda (app mini/tray'da) tanaffus vaqti kelganda overlay **majburan** chiqib, barcha oynalar ustida ekranni band qilib, tanaffusga majbur qilsin.

## Qarorlar (brainstorm)

1. **Yoqish:** alohida yangi toggle `forceBreakFullscreen` (default `true`).
2. **Tanaffuslar:** qisqa + uzoq (ikkalasi).
3. **Skip:** qoladi (X tugmasi bilan o'tkazib yuborish mumkin).
4. **Oyna rejimi:** haqiqiy OS fullscreen (`set_fullscreen`).
5. **Hidden timer throttling:** Web Worker timer (yashirin sahifada throttle qilinmaydi → break o'z vaqtida).

## Komponentlar

### 1. Sozlama `forceBreakFullscreen`
- `src/shared/types.ts`: `TimerSettings.forceBreakFullscreen: boolean` + `DEFAULT_TIMER_SETTINGS` `true`.
- `src-tauri/src/models.rs`: `pub force_break_fullscreen: bool` (serde camelCase) + `Default` `true` + default test `assert_eq!(v["forceBreakFullscreen"], json!(true))`.
- Settings UI: `settings-panel.tsx` `ToggleRow` ("Tanaffusda majburiy fullscreen" / i18n `forceBreakFullscreen`). i18n en/ru/uz.
- `serde(default)` container darajasida → eski store JSON xavfsiz (default `true`).

### 2. Web Worker timer (robustlik)
- **Muammo:** tray'ga yashirilganda (`window.hide()`) sahifa `visibilityState='hidden'` → WebKitGTK main-thread `setInterval`ni throttle qilishi mumkin → break kech aniqlanadi.
- **Yechim:** tick manbasini Web Worker'ga ko'chirish. Worker yashirin sahifada ham deyarli throttle qilinmaydi.
- `src/renderer/workers/timer-worker.ts` (yangi): `setInterval(() => postMessage('tick'), 1000)` (start/stop xabarlari bilan). Vite worker: `new Worker(new URL('./workers/timer-worker.ts', import.meta.url), { type: 'module' })`.
- `src/renderer/hooks/use-timer.ts`: mavjud main-thread `setInterval` (qator ~101) o'rniga worker tick'iga obuna bo'ladi. Har tick'da mavjud wall-clock mantiq (`elapsed = (Date.now() - startAt)/1000`, qator 102) saqlanadi — worker faqat tick manbai, hisob o'zgarmaydi. Timer to'xtaganda worker'ga stop, ishga tushganда start.
- Natija: break o'tishi (`timeLeft → 0 → mode change`) yashirin/mini holatda ham o'z vaqtida aniqlanadi.

### 3. Trigger oqimi (renderer — `index.tsx`)
- `onBreakStart={isMiniMode ? undefined : handleBreakStart}` → `onBreakStart={handleBreakStart}` (mini guard olib tashlanadi; force yo'li mini'da ishlashi uchun).
- **`overlayActiveRef`** (`useRef(false)`) — overlay haqiqatan faollashtirilganini kuzatadi (advisor: spurious restore oldini olish).
- `handleBreakStart(breakMode)` (qisqa+uzoq):
  - `showBreakScreen` o'chiq → hech narsa.
  - `showBreakScreen` yoqiq:
    - `forceBreakFullscreen` yoqiq → `winApi.setBreakOverlay(true)`, `overlayActiveRef.current = true`, `setShowBreak(true)`, `setCurrentBreakMode(breakMode)`. **Har qanday holatda** (mini/yashirin/normal).
    - `forceBreakFullscreen` o'chiq → faqat `!isMiniMode` bo'lsa `setShowBreak(true)` (hozirgi xulq). `setBreakOverlay` CHAQIRILMAYDI.
- **Tanaffus tugashi/skip — yagona restore yo'li:**
  - Mavjud auto-close effect (`useEffect(() => { if (mode === 'focus') setShowBreak(false) }, [mode])`) HAR fokusga o'tishda ishlaydi — shuning uchun `setBreakOverlay(false)`ni FAQAT `overlayActiveRef.current` bo'lganda chaqirish (aks holda overlay faollashmagan normal holatda spurious chaqiriladi).
  - Skip (`onSkip`) va auto-close ikkalasi ham: `if (overlayActiveRef.current) { winApi.setBreakOverlay(false); overlayActiveRef.current = false; }` + `setShowBreak(false)`.

### 4. Rust command `set_break_overlay(app, active: bool)`
Barcha oyna manipulyatsiyasi Rust'da (AppState shu yerda). **Scoped-lock-then-call** (lock ushlab oyna metodini chaqirmaslik — deadlock oldini olish).

**`active = true`:**
1. **Idempotency:** agar `pre_break` allaqachon `Some` bo'lsa — qayta-capture QILMA (aks holda fullscreen holatini "oldingi" deb saqlab, mini/tray'ga tiklab bo'lmaydi). Faqat fullscreen/AOT/focus'ni qayta qo'llab chiqib ketadi.
2. Aks holda oldingi holatni saqlash (`pre_break = Some((was_hidden, was_mini, was_aot))`): `was_hidden = !win.is_visible()`, `was_mini = inner.mini_mode`, `was_aot = inner.always_on_top`. (Lock scoped: o'qib, lock bo'shatib, oyna metodlari chaqiriladi.)
3. Yashirin bo'lsa `win.show()`; `win.unminimize()`.
4. Mini bo'lsa mini o'lcham cheklovlarini bo'shatish: `set_min_size(0,0)` + `set_max_size(9999,9999)` (aks holda mini max 800×200 fullscreen'ni bloklaydi).
5. `win.set_fullscreen(true)` + `win.set_always_on_top(true)` + `win.set_focus()`.

**`active = false`:**
1. **Idempotency:** `pre_break` `None` bo'lsa — NO-OP (overlay faollashmagan).
2. `win.set_fullscreen(false)`.
3. `pre_break`'dan tiklash:
   - `was_mini` → mini cheklov/o'lcham qayta qo'llanadi (`set_min_size(200,54)`, `set_max_size(800,200)`, `set_size(320,72)`, `set_always_on_top(true)`) — mini'ga qaytadi. (normal_size qayta-capture QILINMAYDI — mavjud AppState.normal_size saqlanadi.)
   - aks holda normal min/max tiklanadi (`set_min_size(570,780)`, `set_max_size(9999,9999)`) + `set_always_on_top(was_aot)`.
4. `was_hidden` → `win.hide()` (tray'ga qaytadi).
5. `pre_break = None`.

### 5. AppState
`src-tauri/src/app_state.rs` `AppStateInner`ga: `pub pre_break: Option<(bool, bool, bool)>,` (was_hidden, was_mini, was_aot). Default `None`.

### 6. Capability
`src-tauri/capabilities/default.json`: `"core:window:allow-set-fullscreen"` qo'shiladi. (`allow-set-focus`/`allow-unminimize`/`allow-show`/`allow-hide`/`allow-set-size`/`allow-set-min-size`/`allow-set-max-size` allaqachon bor.)

### 7. Frontend wrapper
`src/shared/tauri/window.ts` `winApi`ga: `setBreakOverlay: (active: boolean) => invoke<void>('set_break_overlay', { active }),`. `lib.rs` `generate_handler!`ga `commands::window::set_break_overlay`.

### 8. BreakScreen render joyi
`index.tsx`'da `BreakScreen` `main` (mini-yashirin `hidden` konteyner) ichidan **top-level `<>`ga ko'chiriladi** — mini/normal holatdan qat'i nazar render bo'ladi. `fixed inset-0` bo'lgani uchun Rust oynani fullscreen qilganda butun ekranni qoplaydi.

## Verifikatsiya
- `cargo clippy`/`cargo test` (model default) toza; capability schema valid; `tsc` toza.
- **Runtime (foydalanuvchi):**
  - (a) Normal holatдa tanaffus → fullscreen overlay, barcha oynalar ustida.
  - (b) **Mini-rejimda** tanaffus → oyna fullscreen overlay chiqadi; skip/tugash → mini'ga qaytadi.
  - (c) **Tray'ga yashirilgan**da tanaffus → oyna qayta ochilib fullscreen; skip/tugash → tray'ga qaytadi.
  - (d) **Eng muhim — yashirin'da o'z vaqtida:** qisqa fokus qo'yib, tray'ga yashirib, tanaffus vaqti kelganda overlay **kech emas, o'z vaqtida** chiqishi (Web Worker timer).
  - (e) `forceBreakFullscreen` o'chiq → eski xulq (mini/yashirin'da overlay yo'q).
  - (f) Skip + auto-close birga ishlaganda spurious hide/restore bo'lmasligi (idempotency).

## Doirasidan tashqari (YAGNI)
- Skip yo'q / kechiktirilgan skip variantlari.
- Maximized+AOT (haqiqiy fullscreen tanlandi).
- Rust-side timer (Web Worker yetarli).

## Risklar
- **Idempotency (eng yuqori bug riski):** skip va auto-close ikkalasi ham fokusga o'tishda ishlashi mumkin → `overlayActiveRef` (renderer) + `pre_break` None/Some guard (Rust) ikkalasi SHART (advisor).
- **AppState deadlock:** scoped-lock-then-call (lock ushlab oyna metodi chaqirmaslik).
- **Fullscreen Wayland/NVIDIA:** WebKitGTK fullscreen + set_focus Wayland kompozitorida focus-steal cheklanishi mumkin — runtime'da tasdiqlanadi (fullscreen odatda grab qiladi).
- **Worker + Vite build:** `new URL(..., import.meta.url)` worker prod build'da to'g'ri bundle bo'lishini tasdiqlash (vite worker standarti).
