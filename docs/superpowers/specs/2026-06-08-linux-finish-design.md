# Linux Migration Finish — Dizayn spetsifikatsiyasi

**Sana:** 2026-06-08
**Branch:** `tauri-migration`
**Status:** Tasdiqlangan (brainstorm) → planning

## Kontekst

ZenFocus Electron→Tauri v2 migratsiyasi. Faza 1–7 tugagan (store, oyna/tray, dialog/fs/audio, yt-dlp sidecar — hammasi runtime tasdiqlangan). Bu spec **qolgan ishni Linux uchun yakunlaydi** — bitta konsolidatsiyalangan spec sifatida, lekin aniq bo'limlarga ajratilgan.

Obsidian faza rejasidan olingan, quyidagi **istisnolar** bilan (foydalanuvchi qarori):
- **Windows/macOS** platforma ishi — kelajak fazada (target-triple binary'lar, NSIS/DMG, WebView2/WKWebView vizual test).
- **Auto-update** (Faza 12) — kelajakda; bu yerda updater no-op stub qilinadi.
- **Todoist** — feature sifatida **butunlay tashlanadi** (kerak emas).
- **Ikonka almashtirish** — descope (joriy ikonka bilan ship; haqiqiy logo keyinroq).

Qamrab oladi: Faza 8 qoldig'i (app versiya + logging), Faza 9 (Electron tozalash), Faza 10 Linux qismi (webview polish), Faza 11 Linux qismi (build/packaging + CI).

## Qarorlar (brainstorm)

1. Struktura: **bitta spec** (A+B+C+D+E bo'limlari).
2. Todoist: **to'liq olib tashlash** (UI + token maydoni + CSP).
3. Ikonka: **descope** (joriy ikonka qoladi).
4. Updater: **no-op stub** (UI qobig'i Faza 12 uchun saqlanadi).
5. Linux artifakt: **faqat AppImage** (o'zini-o'zi ta'minlovchi, GStreamer bundllangan).

## Doirasidan tashqari (YAGNI)

- Windows/macOS build, target-triple binary'lar, NSIS/DMG.
- Auto-update implementatsiyasi (faqat stub).
- Todoist'ni saqlash yoki qisman qoldirish.
- Ikonka generatsiyasi.
- OKLCH/`color-mix` `@supports` fallback (faqat WebView2 muammosi topilsa — Windows fazasida).
- `.deb`/`.rpm` artifaktlari.

---

## A. Electron tozalash + istisno feature'lar

### A.1 Todoist to'liq olib tashlash
- **Frontend:** `src/renderer/components/settings-panel.tsx` — Todoist import tugmasi, `todoistImport()` chaqiruvi (~73-qator), va `todoist_token` kiritish maydoni (agar bo'lsa) olib tashlanadi.
- **Tiplar:** `src/shared/types.ts` — `todoistToken` (interface maydoni ~27, DEFAULT ~48), `TODOIST_IMPORT` channel const (~201) olib tashlanadi.
- **Rust:** `src-tauri/src/models.rs` — `TimerSettings.todoist_token: Option<String>` maydoni olib tashlanadi.
- **CSP:** `src-tauri/tauri.conf.json` `connect-src`'dan `https://api.todoist.com` olib tashlanadi.
- **Store migratsiyasi:** kerak emas — serde (container `#[serde(default)]` bilan) noma'lum kalitlarni (`todoistToken`) e'tiborsiz qoldiradi; eski store JSON xavfsiz o'qiladi.

### A.2 use-updater.ts → no-op stub
`src/renderer/hooks/use-updater.ts` `window.electronApi` chaqiruvlarisiz qayta yoziladi:
```ts
import { useState } from 'react';
import type { UpdaterStatus } from '@shared/types';

/** Auto-update Faza 12'gacha qoldirilgan — no-op stub. UI qobig'i saqlanadi. */
export function useUpdater() {
  const [status] = useState<UpdaterStatus | null>(null);
  const check = () => {};
  const install = () => {};
  return { status, check, install };
}
```
`status` doim `null` → settings updater bo'limi hech narsa render qilmaydi (mavjud JSX `status &&` guard'lari bilan). `UpdaterStatus` type `@shared/types`'da qoladi (Faza 12 uchun).

### A.3 Electron qoldiqlarini o'chirish
- O'chirish: `src/main/`, `src/preload/` papkalari; `electron-builder.yml`.
- `package.json` `dependencies`/`devDependencies`'dan: `electron`, `electron-builder`, `electron-log`, `electron-updater`, `vite-plugin-electron`, `vite-plugin-electron-renderer`, `@madrimov/electron-store-typed`, `@madrimov/electron-window-state`. (`dotenv` — agar boshqa joyda ishlatilmasa.) Eski `publish:*` skriptlari (electron-builder) ham olib tashlanadi.
- `tsconfig.json`: `@main/*`, `@preload/*` path alias'lari olib tashlanadi (`@renderer`, `@shared`, `@` qoladi).
- `index.html`: `<title>` "Electron" → "ZenFocus".
- `.env`: electron-ga oid o'zgaruvchilar (agar bo'lsa) olib tashlanadi.
- `README.md`: Tauri uchun yangilanadi (build/run ko'rsatmalari, Linux runtime kodek eslatmasi).
- `window.electronApi` global type deklaratsiyasi (preload'da edi) o'chadi — renderer'da qoldiq referens BO'LMASLIGI shart.

### A.4 Verifikatsiya (A bo'limi)
- `grep -rn "electronApi" src/` → 0 natija.
- `grep -rn "todoist\|Todoist" src/ src-tauri/src/` → 0 natija (yoki faqat ataylab qoldirilgan izoh yo'q).
- `bun run typecheck` → toza.
- `bun run build:vite` → toza.
- `rm -rf node_modules && bun install` → electron paketlari o'rnatilmaydi.
- `cargo clippy` → toza (`todoist_token` olib tashlanishi store o'qishni buzmaydi).

---

## B. Native kichik qismlar

### B.1 App versiya ko'rsatish
- `@tauri-apps/api/app` `getVersion()` (Cargo.toml/tauri.conf versiyasidan) → `settings-panel.tsx`'da statik versiya label sifatida ko'rsatiladi (masalan updater bo'limi yonida `vX.Y.Z`). Hozir versiya faqat updater status ichida (`v${status.version}`) ko'rinardi; stub bilan u yo'qoladi, shuning uchun mustaqil label qo'shiladi.
- `getVersion()` `Promise<string>` qaytaradi → `useEffect`'da olinadi va state'ga yoziladi.

### B.2 Logging
- `src-tauri/src/lib.rs` `tauri_plugin_log::Builder` hozir faqat `.level(LevelFilter::Info)`. Yangilanadi:
  - Fayl target (`Target::new(TargetKind::LogDir { file_name: None })`) — level Info.
  - Stdout target — level Debug.
  - Aniq API (`.target(...)`/`.level_for(...)`) tauri-plugin-log v2 docs'idan (planning'da context7).
- **Panic hook:** `std::panic::set_hook` o'rnatiladi → panic xabarini `log::error!` orqali yozadi (TZ "uncaught panic'lar log'ga").

---

## C. Webview polish (Linux)

### C.1 Flash-siz no-backdrop-blur
- **Muammo:** `src-tauri/src/lib.rs` (~93-qator) NVIDIA aniqlanganda oyna yuklangach `win.eval("document.documentElement.classList.add('no-backdrop-blur')")` ishlatadi. Sahifa avval blur (capable) holatda render bo'lib, keyin class qo'shiladi → **boshlanish flash'i**.
- **Yechim:** class **birinchi paint'dan oldin** qo'yiladi. NVIDIA aniqlansa, `no-backdrop-blur` ni qo'shuvchi JS **initialization script** sifatida ro'yxatdan o'tkaziladi (Tauri v2 `WebviewWindowBuilder::initialization_script` yoki teng mexanizm — webview'ning o'z skriptlaridan oldin, hujjat yuklanishidan oldin ishlaydi).
- **Aniq mexanizm planning'da context7'dan:** main oyna `tauri.conf.json`'da deklarativ yaratiladi; init script'ni shartli (faqat NVIDIA) qo'shish uchun variantlar: (a) oynani Rust'da `WebviewWindowBuilder`/`from_config` bilan yaratish + `.initialization_script()`, (b) Tauri builder darajasida init script. Tanlov v2 docs asosida.
- **Capable mashinalar (Intel/AMD)** tegilmaydi — init script faqat NVIDIA aniqlanганда qo'shiladi.

### C.2 Glass fallback sozlash
- `src/renderer/index.css` `.no-backdrop-blur` opaque glass fallback'ining opaqlik darajasi vizual sozlanadi (blur'siz ham dizayn izchilligi). Foydalanuvchi (NVIDIA mashinasi) runtime'da tasdiqlaydi. Kichik CSS tweak.

### C.3 Verifikatsiya (C bo'limi)
- NVIDIA mashinada `bun run dev` → boshlanish flash'i YO'Q (sahifa darhol opaque glass bilan ochiladi).
- Glass fallback ko'rinishi capable holatga yaqin (foydalanuvchi tasdig'i).

---

## D. Build/Packaging (Linux) + CI

### D.1 Bundle config
- `src-tauri/tauri.conf.json`:
  - `bundle.targets` → `["appimage"]` (Win/macOS o'z fazasida `nsis`/`dmg` qaytadi).
  - `bundle.linux.appimage.bundleMediaFramework: true` — **AppImage'ga GStreamer plugin'larini bundllash** (linuxdeploy-plugin-gstreamer orqali). Aniq kalit/shakl tauri v2 config docs'idan (planning'da context7 — versiya bo'yicha o'zgargan bo'lishi mumkin).

### D.2 ci.yml (qayta yoziladi)
- **Trigger:** `push`/`pull_request` → `tauri-migration` branch (hozir `main` — Electron; faol dev `tauri-migration`da).
- **Job (ubuntu-latest):**
  - `oven-sh/setup-bun` + `bun install --frozen-lockfile`.
  - Rust toolchain (`dtolnay/rust-toolchain` stable) + `Swatinem/rust-cache`.
  - Linux build deps: `sudo apt-get install -y libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev` (+ tauri standart ro'yxati).
  - **`bun run download-ytdlp`** — sidecar binary `src-tauri/bin/yt-dlp-x86_64-unknown-linux-gnu` (externalBin resurs tekshiruvi `cargo` build/clippy'ni bloklaydi).
  - `bun run typecheck`.
  - `cargo fmt --check` (`src-tauri`'da).
  - `cargo clippy --all-targets -- -D warnings`.
  - `cargo test --lib`.

### D.3 release.yml (qayta yoziladi)
- **Trigger:** `push` teg `v*.*.*`.
- **Job (ubuntu-latest):** windows job olib tashlanadi; eski `publish:linux`/`publish:win` o'chiriladi.
  - Checkout + setup-bun + `bun install` + Rust toolchain.
  - Linux build deps (D.2 kabi) **+ GStreamer plugin'lar** (bundllash uchun build mashinada bo'lishi SHART): `gstreamer1.0-plugins-base gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-libav`.
  - `bun run download-ytdlp`.
  - Build + release: `tauri-apps/tauri-action` (tavsiya) yoki qo'lda `tauri build --bundles appimage` + `gh release`. `tauri-action` teg'dan release yaratadi va AppImage'ni yuklaydi. `GITHUB_TOKEN` ishlatiladi.
- **Eslatma:** auto-update artifaktlari (imzo, latest.json) YO'Q (Faza 12).

### D.4 Kodek hujjati
- `README.md` (yoki `docs/`): AppImage GStreamer'ni bundllaydi (toza mashinada audio ishlaydi); manbadan Linux build uchun runtime deps (`gstreamer1.0-plugins-good/bad/libav`) eslatiladi.

---

## E. Verifikatsiya — false-pass tuzog'i (packaging qatlami)

⚠️ **Dev mashinada `plugins-bad`/`libav` bor** — AppImage'ni shunchaki ishga tushirib live AAC/HLS ijro etilishi bundllash ishlaganini **ISBOTLAMAYDI** (tizim plugin'lari ishlatiladi). Bu Faza 7 false-pass tuzog'ining packaging qatlamida qaytishi (TZ §9.1).

**Diskriminatsiya qiluvchi tekshiruvlar (artifakt ichini ko'r, shunchaki ishga tushirma):**
1. `./ZenFocus*.AppImage --appimage-extract` → `find squashfs-root -path '*gstreamer*' -name '*.so' | grep -iE 'libav|faad|aac|hls|tsdemux|opus|matroska'` — AAC/HLS-relevant plugin'lar fizik AppImage ichida ekanini tasdiqlash. Bo'sh natija → bundllash ishlamadi (FIXES_NEEDED).
2. **Kuchliroq (ixtiyoriy, eng ishonchli):** plugin'siz muhitda (Docker container yoki `GST_PLUGIN_SYSTEM_PATH=` bilan izolyatsiya) AppImage'ni ishga tushirib live oqim ijro etish — haqiqiy toza-mashina isboti.

**Boshqa verifikatsiya:**
- ci.yml/release.yml YAML valid (`actionlint` yoki qo'lda).
- `tauri build --bundles appimage` muvaffaqiyatli AppImage hosil qiladi.
- Paketlangan AppImage ishga tushadi — sidecar (`yt_check`), store, tray ishlaydi.
- Teg push'da release.yml AppImage'ni GitHub Release'ga yuklaydi (yoki dry-run tekshiruvi).

---

### E.1 Verifikatsiya natijasi (BAJARILDI — 2026-06-08)

AppImage qurildi (`ZenFocus_0.1.0_amd64.AppImage`, 181MB) va ICHIDAN tekshirildi. **Task 10 ikkita kritik kamchilikni ushladi** (aynan false-pass tuzog'i):

1. **`patchelf` SHART** — `linuxdeploy-plugin-gstreamer.sh` uni talab qiladi; busiz butun AppImage bundling fail bo'ladi (`Error: patchelf not found`). release.yml'ga `patchelf` apt-deps'ga qo'shildi; lokal uchun README'da hujjatlandi.
2. **`GSTREAMER_INCLUDE_BAD_PLUGINS=1` SHART** — bu flag DEFAULT DISABLED. Busiz `plugins-bad` (faad/hlsdemux/mpegtsdemux) bundllanmaydi → AppImage muvaffaqiyatli qurilsa ham **live AAC/HLS jimgina ishlamaydi** (toza mashinada). release.yml build step env'iga qo'shildi.

Flag bilan qayta qurilgach, artifakt ichida tasdiqlandi (253 plugin): `libgstfaad.so`, `libgstfdkaac.so` (AAC dekod), `libgsthls.so` + `libgstmpegtsdemux.so` (live HLS/MPEG-TS), `libgstisomp4.so` (m4a), `libgstmatroska.so` + `libgstopus.so` + `libgstopusparse.so` (VOD Opus). **Live AAC/HLS yo'li to'liq qoplangan: hls → mpegtsdemux → faad.** (libav bundllanmadi, lekin faad/fdkaac AAC dekodni qoplaydi.)

## Risklar va eslatmalar

- **GStreamer bundllash false-pass (eng muhim):** E bo'limidagi artifakt-introspeksiya majburiy — aks holda faza "yashil" da o'tib, toza mashinada jim buziladi.
- **`bundleMediaFramework` kaliti:** versiya-bo'yicha o'zgaruvchi — context7'dan olinadi, xotiradan emas.
- **Init-script mexanizmi:** Tauri v2 `initialization_script` API'si planning'da context7'dan tasdiqlanadi.
- **externalBin CI bloki:** `download-ytdlp` cargo build'dan OLDIN ishlashi shart (resurs tekshiruvi).
- **ci.yml branch o'zgarishi:** `main` → `tauri-migration`; `main`dagi Electron CI tegilmaydi (alohida branch).
- **Bog'liqliklar tartibi:** A (cleanup) avval — packaging toza daraxtni build qiladi; C/D oxirida.
