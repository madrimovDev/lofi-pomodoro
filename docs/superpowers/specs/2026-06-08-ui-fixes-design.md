# UI Fixes & Improvements — Dizayn spetsifikatsiyasi

**Sana:** 2026-06-08
**Branch:** `tauri-migration`
**Status:** Tasdiqlangan (brainstorm) → planning

## Kontekst

ZenFocus Tauri (Linux) ilovasidagi 5 ta bug/yaxshilash. Foydalanuvchi bildirgan. Bitta konsolidatsiyalangan spec (o'zaro bog'liq UI/oyna o'zgarishlari).

## Qarorlar (brainstorm)

1. **Drawer drag:** `vaul` butunlay olib tashlanadi → drag'siz `Sheet` (radix Dialog asosida).
2. **Settings:** modal → **pastdan** ochiluvchi Sheet.
3. **Playlist ortga:** YouTube URL kiritish ekraniga qaytadi.
4. **Animatsiya toggle:** hamma animatsiya off, **faqat qo'lda** (NVIDIA auto YO'Q), default yoqiq.
5. **Resize:** 8 ta zona (4 chekka + 4 burchak), `startResizeDragging`.

---

## #1 + #4 — Draggable drawer olib tashlash + settings drawer

### Muammo
- `vaul` (drag-to-dismiss) `task-panel.tsx`, `music-side-panel.tsx`, `src/shared/components/ui/drawer.tsx`'da ishlatiladi. Desktop-only ilovada drag keraksiz va bug manbai (#1).
- `settings-panel.tsx` radix `Dialog` (modal) — oyna fullscreen bo'lmasa sig'maydi (#4).

### Yechim — `Sheet` komponenti (radix Dialog asosida, drag'siz)
**Yangi:** `src/shared/components/ui/sheet.tsx`:
- Radix `Dialog` (Root/Portal/Overlay/Content/Close/Title) asosida — drag YO'Q, focus-trap/ESC/overlay-click radix'dan.
- Yo'nalish variantlari `side`: `bottom` | `left` | `right` — CSS bilan pozitsiya + slide animatsiya (`data-[state=open]`/`data-[state=closed]` bilan `tw-animate-css` yoki keyframe).
- Eksportlar: `Sheet`, `SheetContent` (side prop bilan), `SheetHeader`, `SheetTitle`, `SheetClose`, `SheetFooter` — mavjud drawer API'ga yaqin (migratsiya oson).

### Migratsiya
- `task-panel.tsx`: `vaul` `DrawerPrimitive` + `DrawerPortal` → `Sheet`/`SheetContent` (joriy yo'nalish saqlanadi — hozir vaul default; Sheet'da mos `side`).
- `music-side-panel.tsx`: xuddi shunday → `Sheet` (drag'siz).
- `settings-panel.tsx`: radix `Dialog` → `Sheet` `side="bottom"`, `max-h-[85vh]` + ichki scroll. Mavjud X/minimize tugmalari saqlanadi.
- `src/shared/components/ui/drawer.tsx`: o'chiriladi (yoki `sheet.tsx`'ga re-export). Hech bir fayl `vaul`/`drawer`'ni import qilmasligi kerak.
- `package.json`: `vaul` dependency olib tashlanadi.

### Verifikatsiya
- `grep -rn "vaul" src/` → 0.
- Drawer'lar (task/music/settings) ochiladi/yopiladi, **drag bilan harakatlanmaydi**, ESC/overlay-click yopadi.
- Settings kichik (non-fullscreen) oynada sig'adi (bottom sheet + scroll).
- `tsc` toza.

---

## #2 — YouTube playlist'da "ortga"

### Muammo
`use-music.tsx`'da playlist URL kiritilsa `ytPlaylist` to'ladi, `source='youtube'`, lekin playlist'dan chiqish (ortga) yo'q.

### Yechim
- `use-music.tsx`ga `exitYtPlaylist()` action: `setYtPlaylist([])`, `setYtCurrentIndex(0)`, `setYtStreamInfo(null)`, `setYtError(null)`, playback to'xtaydi (audio pause/stop), `source` YouTube tab'ining bo'sh (URL kiritish) holatiga qaytadi. (Eslatma: aniq state nomlari `use-music.tsx`'dan tasdiqlanadi — `ytStreamInfo`/`ytError`/`source` mavjud.)
- `music-side-panel.tsx` YouTube bo'limi: `ytPlaylist.length > 0` (yoki faol playlist) bo'lganda **ArrowLeft** tugmasi ko'rsatiladi → `exitYtPlaylist()` → URL kiritish ekrani.

### Verifikatsiya
- Playlist URL → treklar; ortga o'qi → URL kiritish holati; yangi URL kiritish mumkin. `tsc` toza.

---

## #3 — Animatsiya o'chirish toggle'i (qo'lda)

### Yechim
- **Model:** `TimerSettings`'ga `animationsEnabled: boolean` (default `true`):
  - `src/shared/types.ts`: interface maydoni + `DEFAULT_TIMER_SETTINGS`.
  - `src-tauri/src/models.rs`: `pub animations_enabled: bool` (serde camelCase) + `Default` impl `true`.
- **Settings UI:** `settings-panel.tsx`ga `ToggleRow` ("Animatsiyalar" / i18n kalit) — `settings.animationsEnabled` ↔ `updateSettings({ animationsEnabled })`.
- **Qo'llash:** effect (`use-settings` yoki layout) `<html>`ga `no-animations` class qo'shadi/oladi `animationsEnabled` bo'yicha.
- **CSS** (`index.css`):
  ```css
  html.no-animations *,
  html.no-animations *::before,
  html.no-animations *::after {
    animation: none !important;
    transition: none !important;
  }
  ```
  Barcha dekorativ animatsiya (mini-aurora-breath, ring-breathe, marquee) va transitionlar o'chadi.
- **NVIDIA auto YO'Q** — toggle faqat qo'lda. (`no-backdrop-blur` `no-animations`'dan mustaqil.)

### Verifikatsiya
- Toggle off → aurora/ring/marquee/transitionlar to'xtaydi; on → qaytadi. Settings saqlanib, qayta ochishda tiklanadi. `cargo test` (model default) + `tsc` toza.

---

## #5 — Oyna resize qo'llari

### Muammo
`tauri.conf.json` window `decorations:false` + `resizable:true` — native resize chekkalari yo'q, shuning uchun chekka-drag resize ishlamaydi; faqat mini/fullscreen (programmatik) ishlaydi.

### Yechim
- **Wrapper:** `src/shared/tauri/window.ts`ga `startResizeDragging(direction)` — `getCurrentWindow().startResizeDragging(direction)` (Tauri v2 `@tauri-apps/api/window` `ResizeDirection`). Aniq tip/enum qiymatlari planning'da `@tauri-apps/api` v2'dan tasdiqlanadi (string literal: `'North'|'South'|'East'|'West'|'NorthEast'|'NorthWest'|'SouthEast'|'SouthWest'`).
- **Komponent:** `src/renderer/components/resize-handles.tsx` — 8 ta `position:fixed` ko'rinmas zona:
  - 4 chekka (top/bottom: balandlik 4px, kenglik 100%; left/right: kenglik 4px, balandlik 100%).
  - 4 burchak (10×10px) chekkalardan ustun `z-index`.
  - Har biri mos `cursor` (`ns-resize`/`ew-resize`/`nwse-resize`/`nesw-resize`), `onPointerDown` → `winApi.startResizeDragging(dir)`.
  - Yuqori `z-index` (overlay/drawerlardan past, lekin kontent ustida — masalan `z-40`; drawer overlay `z-50`dan past bo'lib, drawer ochiq bo'lsa to'sib qo'ymaydi). `data-tauri-drag-region` bilan konflikt qilmasligi uchun chekkada.
- **Render:** layout'da, **mini-rejimda EMAS** (`!isMiniMode`). Fullscreen'da WM resize'ni rad etadi (zararsiz).

### Capability
Tauri v2'da `startResizeDragging` `core:window:allow-start-resize-dragging` permission talab qilishi mumkin — `capabilities/default.json`'ga qo'shiladi (planning'da tasdiqlanadi; `allow-start-dragging` allaqachon bor).

### Verifikatsiya
- Normal rejimda oyna chekkasi/burchagidan tortib resize qilinadi (kursor o'zgaradi). Mini-rejimda handle'lar yo'q. `tsc`/`cargo` toza.

---

## Doirasidan tashqari (YAGNI)
- Tablet/telefon (touch) qo'llab-quvvatlash (drag aynan shuning uchun olib tashlanadi).
- Animatsiya toggle'ining NVIDIA auto-yoqilishi.
- Mini-rejim/fullscreen resize (allaqachon ishlaydi).

## Risklar va eslatmalar
- **vaul→Sheet migratsiyasi:** task-panel/music-side-panel vaul'ni to'g'ridan-to'g'ri ishlatadi (Content/Header) — Sheet API'ga ehtiyotkor migratsiya; har panel ochilish/yopilish runtime'da tekshiriladi.
- **resize handle z-index:** drawer ochiq bo'lganda handle'lar overlay'ni to'smasligi kerak (drawer `z-50`, handle past).
- **`startResizeDragging` capability:** Tauri v2 permission — busiz runtime'da jim ishlamaydi (Faza 7 sidecar gotcha'siga o'xshash).
- **`animations_enabled` serde:** yangi maydon — eski store JSON `#[serde(default)]` bilan xavfsiz (yo'q bo'lsa default `true`).
- Runtime acceptance (drag yo'qligi, resize, settings sig'ishi, playlist ortga, animatsiya toggle) foydalanuvchida.
