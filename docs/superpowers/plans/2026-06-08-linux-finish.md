# Linux Migration Finish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ZenFocus Tauri migratsiyasini Linux uchun yakunlash — Electron tozalash, Todoist olib tashlash, native qoldiqlar (versiya/logging), webview polish, va AppImage packaging + CI.

**Architecture:** Bog'liqlik tartibi: avval cleanup (Task 1–3) toza daraxt yaratadi, keyin native bits (4–5), webview polish (6), oxirida packaging/CI (7–10) tayyor natijani paketlaydi. AppImage GStreamer bundllash artifakt ichidan tekshiriladi (false-pass tuzog'i).

**Tech Stack:** Tauri v2, React/TS, Rust, GitHub Actions, AppImage (bundleMediaFramework), tauri-plugin-log.

**Spec:** `docs/superpowers/specs/2026-06-08-linux-finish-design.md`

---

## Fayl xaritasi

| Fayl | O'zgarish | Mas'uliyat |
|---|---|---|
| `src/shared/types.ts` | Modify | `todoistToken`, `TODOIST_IMPORT` olib tashlash |
| `src/renderer/components/settings-panel.tsx` | Modify | Todoist UI olib tashlash; app versiya label |
| `src-tauri/src/models.rs` | Modify | `todoist_token` maydoni + testlar olib tashlash |
| `src-tauri/tauri.conf.json` | Modify | CSP todoist; bundle targets + bundleMediaFramework; window `visible:false` |
| `src/renderer/hooks/use-updater.ts` | Modify | no-op stub |
| `src/main/`, `src/preload/`, `electron-builder.yml` | Delete | Electron qoldiqlari |
| `package.json`, `tsconfig.json`, `index.html`, `README.md` | Modify | Electron deps/path/title/docs |
| `src-tauri/src/lib.rs` | Modify | logging (file+panic); flash fix (on_page_load show) |
| `.github/workflows/ci.yml`, `release.yml` | Modify | Tauri Linux CI/release |

---

## Task 1: Todoist to'liq olib tashlash

**Files:**
- Modify: `src/shared/types.ts`, `src/renderer/components/settings-panel.tsx`, `src-tauri/src/models.rs`, `src-tauri/tauri.conf.json`

- [ ] **Step 1: Frontend tiplari**

`src/shared/types.ts`:
- `todoistToken: string | null;` qatorini (interface ichida, ~27) o'chir.
- DEFAULT obyektidagi `todoistToken: null,` (~48) o'chir.
- `TODOIST_IMPORT: 'todoist:import',` (~201) va undan oldingi `// Todoist` izohini o'chir.

- [ ] **Step 2: settings-panel Todoist UI**

`src/renderer/components/settings-panel.tsx`:
- `window.electronApi?.todoistImport()` chaqiruvini (~73) va uni o'rab turgan handler funksiyani (masalan `handleTodoistImport`) o'chir.
- Todoist import tugmasi (button) va `todoistToken` kiritish maydoni (input) JSX'ini o'chir.
- Tegishli `todoistToken` o'qiydigan/yozadigan state yoki settings update'larni o'chir.

Run (qoldiqni topish uchun): `grep -n -i "todoist" src/renderer/components/settings-panel.tsx`
Expected: 0 natija.

- [ ] **Step 3: Rust model + testlar**

`src-tauri/src/models.rs`:
- `pub todoist_token: Option<String>,` (~81) qatorini `TimerSettings`'dan o'chir.
- `todoist_token: None,` (~104, Default impl) o'chir.
- Testlardagi `assert_eq!(v["todoistToken"], json!(null));` (~283) va `assert_eq!(s.todoist_token, None);` (~305) qatorlarini o'chir. ~290 dagi izohdan `todoistToken` so'zini olib tashla (yoki izohni moslashtir).

- [ ] **Step 4: CSP**

`src-tauri/tauri.conf.json` `app.security.csp` ichidagi `connect-src`'dan `https://api.todoist.com` ni o'chir (qolgani: `'self' asset: ipc: http://ipc.localhost`).

- [ ] **Step 5: Verifikatsiya**

Run: `grep -rn -i "todoist" src/ src-tauri/src/ src-tauri/tauri.conf.json; echo "exit:$?"`
Expected: 0 natija (exit 1).
Run: `cd src-tauri && cargo test --lib 2>&1 | tail -5`
Expected: testlar PASS (todoist test qatorlari olib tashlangani uchun buzilmaydi).
Run: `cd /home/madrimov/Projects/lofi-pomodoro && npx tsc --noEmit 2>&1 | grep -v compdef | grep -i error | head`
Expected: bo'sh (PASS).

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts src/renderer/components/settings-panel.tsx src-tauri/src/models.rs src-tauri/tauri.conf.json
git commit -m "feat(tauri): Linux finish — Todoist feature'ni to'liq olib tashlash"
```

---

## Task 2: use-updater no-op stub

**Files:**
- Modify: `src/renderer/hooks/use-updater.ts`

- [ ] **Step 1: Stub bilan almashtirish**

`src/renderer/hooks/use-updater.ts` to'liq mazmunini almashtir:

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

- [ ] **Step 2: Verifikatsiya**

Run: `grep -n "electronApi" src/renderer/hooks/use-updater.ts; echo "exit:$?"`
Expected: 0 natija (exit 1).
Run: `cd /home/madrimov/Projects/lofi-pomodoro && npx tsc --noEmit 2>&1 | grep -v compdef | grep -iE 'error|use-updater' | head`
Expected: bo'sh (PASS). (settings-panel `status &&` guard bilan ishlaydi; agar `status.type`/`status.version` guard'siz ishlatilgan bo'lsa tsc xato beradi — u holda settings-panel'da `status &&` guard qo'sh.)

- [ ] **Step 3: Commit**

```bash
git add src/renderer/hooks/use-updater.ts
git commit -m "refactor(tauri): Linux finish — use-updater no-op stub (auto-update Faza 12'gacha)"
```

---

## Task 3: Electron qoldiqlarini o'chirish

**Files:**
- Delete: `src/main/`, `src/preload/`, `electron-builder.yml`
- Modify: `package.json`, `tsconfig.json`, `index.html`, `README.md`

- [ ] **Step 1: Qoldiq electronApi referensi yo'qligini tasdiqlash**

Run: `grep -rn "electronApi" src/ | grep -vE "src/preload|src/main"; echo "exit:$?"`
Expected: 0 natija (exit 1) — Task 1+2 oxirgi referenslarni tozalagan. Agar qolsa, avval ularni hal qil.

- [ ] **Step 2: Papkalar va fayllarni o'chirish**

```bash
rm -rf src/main src/preload electron-builder.yml
```

- [ ] **Step 3: package.json electron deps**

```bash
bun remove electron electron-builder electron-log electron-updater vite-plugin-electron vite-plugin-electron-renderer @madrimov/electron-store-typed @madrimov/electron-window-state
```
`dotenv` — agar `grep -rn "dotenv" src/ vite.config.* 2>/dev/null` bo'sh bo'lsa: `bun remove dotenv`. Aks holda qoldir.
`package.json` `scripts`'da electron-builder'ga oid `publish:*` skriptlari bo'lsa, ularни qo'lda o'chir.

- [ ] **Step 4: tsconfig path alias**

`tsconfig.json` `paths`'dan o'chir:
```json
"@main/*": ["./src/main/*"],
"@preload/*": ["./src/preload/*"],
```
(`@renderer/*`, `@shared/*`, `@/*` qoladi.)

- [ ] **Step 5: index.html title**

`index.html`'da `<title>Electron</title>` → `<title>ZenFocus</title>`.

- [ ] **Step 6: README**

`README.md`'ni Tauri uchun yangila: dev (`bun run dev` = `tauri dev`), build (`bun run build` = `tauri build`), `bun run download-ytdlp` (sidecar). Linux runtime kodek eslatmasi: AppImage GStreamer'ni bundllaydi; manbadan build uchun `gstreamer1.0-plugins-good/bad gstreamer1.0-libav` tavsiya. (Electron'ga oid bo'limlarni olib tashla.)

- [ ] **Step 7: Verifikatsiya**

```bash
grep -rn "electron" src/ tsconfig.json index.html; echo "src exit:$?"
rm -rf node_modules && bun install
npx tsc --noEmit 2>&1 | grep -v compdef | grep -i error | head
bun run build:vite 2>&1 | tail -5
```
Expected: `src/`'da `electron` qoldig'i yo'q; `bun install` electron paketlarsiz; `tsc` toza; `build:vite` muvaffaqiyatli.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore(tauri): Linux finish — Electron qoldiqlarini olib tashlash (main/preload/deps)"
```

---

## Task 4: App versiya ko'rsatish

**Files:**
- Modify: `src/renderer/components/settings-panel.tsx`

- [ ] **Step 1: getVersion bilan versiya label**

`src/renderer/components/settings-panel.tsx`:
- Import qo'sh: `import { getVersion } from '@tauri-apps/api/app';`
- Komponent ichida state + effect:
```tsx
const [appVersion, setAppVersion] = useState<string>('');
useEffect(() => {
  getVersion().then(setAppVersion).catch(() => {});
}, []);
```
- Updater bo'limi yonida (yoki settings footer'ida) statik label render qil:
```tsx
{appVersion && <span className="text-xs opacity-60">v{appVersion}</span>}
```
(`useState`/`useEffect` allaqachon import qilingan bo'lsa qayta import qilma.)

- [ ] **Step 2: Verifikatsiya**

Run: `cd /home/madrimov/Projects/lofi-pomodoro && npx tsc --noEmit 2>&1 | grep -v compdef | grep -i error | head`
Expected: bo'sh (PASS).

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/settings-panel.tsx
git commit -m "feat(tauri): Linux finish — app versiyani getVersion bilan ko'rsatish"
```

---

## Task 5: Logging (fayl + konsol + panic)

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Log plugin'ni debug guard'dan chiqarish + targetlar**

`src-tauri/src/lib.rs` `.setup` ichidagi mavjud blokni:
```rust
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
```
quyidagiga almashtir (fayl: Info, konsol: Debug, har doim — release'da ham fayl logi bo'ladi):
```rust
      app.handle().plugin(
        tauri_plugin_log::Builder::default()
          .level(log::LevelFilter::Info)
          .targets([
            tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir { file_name: None }),
            tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
          ])
          .build(),
      )?;
```
> Aniq API (`Target`/`TargetKind` nomlari, `.level_for` bilan konsol Debug) `tauri-plugin-log` v2 docs'idan tasdiqlanadi — ARALASH: ToolSearch bilan context7 yukla (`tauri-plugin-log` → "targets LogDir Stdout level"). Yuqoridagi shakl v2.x uchun odatiy.

- [ ] **Step 2: Panic hook**

`src-tauri/src/lib.rs` `run()` boshida (builder'dan oldin) panic hook o'rnat:
```rust
  std::panic::set_hook(Box::new(|info| {
    log::error!("PANIC: {info}");
  }));
```

- [ ] **Step 3: Kompilyatsiya**

Run: `cd src-tauri && cargo clippy --all-targets -- -D warnings 2>&1 | tail -12`
Expected: PASS. (Agar `Target`/`TargetKind` import kerak bo'lsa qo'sh yoki to'liq yo'l ishlat.)
Run: `cd src-tauri && cargo test --lib 2>&1 | tail -5`
Expected: testlar PASS.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat(tauri): Linux finish — fayl logging (LogDir+Stdout) + panic hook"
```

---

## Task 6: Webview polish — flash fix + glass

**Files:**
- Modify: `src-tauri/tauri.conf.json`, `src-tauri/src/lib.rs`, `src/renderer/index.css`

- [ ] **Step 1: Oynani yashirin boshlash**

`src-tauri/tauri.conf.json` `app.windows[0]`'ga `"visible": false` qo'sh (mavjud bo'lmasa).

- [ ] **Step 2: Tayyor bo'lganda ko'rsatish (flash-siz)**

`src-tauri/src/lib.rs` builder zanjiriga `on_page_load` handler qo'sh — sahifa DOM tayyor bo'lganda oyna ko'rsatiladi (NVIDIA holatda `no-backdrop-blur` class allaqachon setup eval'i orqali qo'yilgan → oyna hech qachon blur'li frame ko'rsatmaydi):
```rust
    .on_page_load(|webview, _payload| {
      // on_page_load main webview uchun ishlaydi — o'z oynasini ko'rsatamiz
      let _ = webview.window().show();
    })
```
> `on_page_load` closure imzosi (`&Webview`/`&Window`) Tauri v2 versiyasiga qarab — kompilyatsiya xatosi bo'lsa context7 (`tauri` → "on_page_load v2 signature") bilan tasdiqla. Maqsad: main oynani DOM tayyor bo'lganda `.show()`. Mavjud `is_nvidia` setup eval bloki o'zgarmaydi.

- [ ] **Step 3: Glass fallback opaqligini sozlash**

`src/renderer/index.css` `.no-backdrop-blur` qoidasidagi opaque glass fon opaqligini ko'rib chiq (blur'siz dizayn izchilligi uchun). Joriy qiymatni saqlab, agar kerak bo'lsa biroz oshir/kamaytir. Bu kichik vizual tweak — runtime'da foydalanuvchi (NVIDIA) tasdiqlaydi.

- [ ] **Step 4: Kompilyatsiya + runtime**

Run: `cd src-tauri && cargo clippy --all-targets -- -D warnings 2>&1 | tail -10`
Expected: PASS.
Run (qo'lda — NVIDIA mashinada): `bun run dev` → oyna ochilganda **boshlanish flash'i yo'q** (darhol opaque glass), oyna ko'rinadi.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/tauri.conf.json src-tauri/src/lib.rs src/renderer/index.css
git commit -m "feat(tauri): Linux finish — flash-siz no-backdrop-blur (visible:false + on_page_load show)"
```

---

## Task 7: Bundle config — AppImage + GStreamer

**Files:**
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: Targets + bundleMediaFramework**

`src-tauri/tauri.conf.json` `bundle`:
- `"targets": ["appimage", "nsis", "dmg"]` → `"targets": ["appimage"]`.
- `bundle`'ga Linux AppImage GStreamer bundllash qo'sh:
```json
    "linux": {
      "appimage": {
        "bundleMediaFramework": true
      }
    }
```
> **ARALASH MAJBURIY:** `bundleMediaFramework` kaliti/joylashuvi Tauri v2 versiyasiga qarab o'zgargan bo'lishi mumkin — ToolSearch bilan context7 yukla (`tauri` yoki `@tauri-apps/cli` → "bundle linux appimage bundleMediaFramework gstreamer"), aniq shaklni tasdiqla. Agar farq qilsa context7'nikini ishlat.

- [ ] **Step 2: JSON valid + schema**

Run: `python3 -c "import json;json.load(open('src-tauri/tauri.conf.json'))" && echo VALID`
Expected: VALID.
Run: `cd src-tauri && cargo check 2>&1 | tail -8`
Expected: PASS (tauri-build config schema'ni validatsiya qiladi; noto'g'ri kalit → build script xatosi).

- [ ] **Step 3: Commit**

```bash
git add src-tauri/tauri.conf.json
git commit -m "build(tauri): Linux finish — AppImage-only target + bundleMediaFramework (GStreamer)"
```

---

## Task 8: ci.yml — Tauri Linux CI

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: ci.yml ni qayta yozish**

`.github/workflows/ci.yml` to'liq mazmunini almashtir:

```yaml
name: CI

on:
  push:
    branches: [tauri-migration]
  pull_request:
    branches: [tauri-migration]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - uses: dtolnay/rust-toolchain@stable
        with:
          components: clippy, rustfmt

      - uses: Swatinem/rust-cache@v2
        with:
          workspaces: src-tauri

      - name: Linux build deps
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev

      - name: Install JS deps
        run: bun install --frozen-lockfile

      - name: Download yt-dlp sidecar
        run: bun run download-ytdlp

      - name: Type check
        run: bun run typecheck

      - name: Rust format check
        run: cargo fmt --manifest-path src-tauri/Cargo.toml --check

      - name: Clippy
        run: cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings

      - name: Rust tests
        run: cargo test --manifest-path src-tauri/Cargo.toml --lib
```

> **Eslatma:** `download-ytdlp` `cargo`'dan OLDIN — `externalBin` resurs tekshiruvi sidecar binary mavjudligini talab qiladi, aks holda `cargo clippy`/`test` build script'da xato beradi.

- [ ] **Step 2: YAML lint**

Run: `python3 -c "import yaml;yaml.safe_load(open('.github/workflows/ci.yml'))" && echo VALID`
Expected: VALID. (`yaml` yo'q bo'lsa: `pip install pyyaml` yoki o'tkazib yubor, qo'lda tekshir.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci(tauri): Linux finish — ci.yml Tauri (typecheck+fmt+clippy+test, tauri-migration branch)"
```

---

## Task 9: release.yml — Linux AppImage release

**Files:**
- Modify: `.github/workflows/release.yml`

- [ ] **Step 1: release.yml ni qayta yozish (Linux-only)**

`.github/workflows/release.yml` to'liq mazmunini almashtir:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*.*.*'

jobs:
  release-linux:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - uses: dtolnay/rust-toolchain@stable

      - uses: Swatinem/rust-cache@v2
        with:
          workspaces: src-tauri

      - name: Linux build + GStreamer deps
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev \
            gstreamer1.0-plugins-base gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-libav

      - name: Install JS deps
        run: bun install --frozen-lockfile

      - name: Download yt-dlp sidecar
        run: bun run download-ytdlp

      - name: Build & release (AppImage)
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: 'ZenFocus ${{ github.ref_name }}'
          releaseDraft: true
          args: --bundles appimage
```

> **Eslatma:** GStreamer plugin'lari (`plugins-bad`/`libav`) build mashinasida bo'lishi SHART — `bundleMediaFramework` ularni AppImage ichiga shu yerdan ko'chiradi. `tauri-action` teg'dan release yaratib AppImage'ni yuklaydi. Auto-update artifaktlari (imzo/latest.json) YO'Q (Faza 12). Windows job olib tashlandi.

- [ ] **Step 2: YAML lint**

Run: `python3 -c "import yaml;yaml.safe_load(open('.github/workflows/release.yml'))" && echo VALID`
Expected: VALID.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci(tauri): Linux finish — release.yml AppImage (tauri-action, GStreamer bundle deps)"
```

---

## Task 10: AppImage build + GStreamer bundllash verifikatsiyasi

**Bu task artifaktni qurib, ICHIDAN tekshiradi** (false-pass tuzog'i: dev mashinada plugin'lar bor → shunchaki ishga tushirish bundllashni isbotlamaydi).

- [ ] **Step 1: Build deps + AppImage qurish**

Dev mashinada (Linux) GStreamer plugin'lari o'rnatilgan bo'lishi kerak (bundllash uchun). Agar yo'q bo'lsa o'rnat (Fedora/Nobara: `sudo dnf install gstreamer1-plugins-bad-free gstreamer1-libav`).
Run: `cd /home/madrimov/Projects/lofi-pomodoro && bun run download-ytdlp && bun run build 2>&1 | tail -20`
Expected: `tauri build` muvaffaqiyatli; AppImage hosil bo'ladi (`src-tauri/target/release/bundle/appimage/*.AppImage`). `bundleMediaFramework` linuxdeploy-plugin-gstreamer'ni yuklab ishga soladi (internet kerak).

- [ ] **Step 2: Artifakt ichidan GStreamer plugin'larini tekshirish (diskriminatsiya qiluvchi)**

```bash
cd src-tauri/target/release/bundle/appimage
APP=$(ls *.AppImage | head -1)
./"$APP" --appimage-extract >/dev/null
find squashfs-root -path '*gstreamer*' -name '*.so' | grep -iE 'libav|faad|aac|hls|tsdemux|opus|matroska' | head -20
```
Expected: AAC/HLS/Opus-relevant `.so` fayllar AppImage ichida (masalan `libgstlibav.so`, `libgstfaad.so` yoki `libgstisomp4.so`/`libgsttsdemux`, `libgstopus.so`, `libgstmatroska.so`). **Bo'sh natija → bundllash ishlamadi → FIXES_NEEDED** (Task 7 `bundleMediaFramework` kalitini context7 bilan qayta tekshir; build mashinada plugin'lar bormi).

- [ ] **Step 3: (Ixtiyoriy, kuchli) toza-muhit isboti**

Imkon bo'lsa, plugin'siz izolyatsiyada AppImage'ni ishga tushirib live oqim sina:
```bash
GST_PLUGIN_SYSTEM_PATH= GST_PLUGIN_PATH= ./"$APP"
```
(Bu tizim GStreamer yo'lini bo'sh qiladi → faqat AppImage ichidagi plugin'lar ishlatiladi.) App ichida live YouTube oqimi ovoz chiqarsa — haqiqiy toza-mashina isboti. Chiqmasa, bundllangan plugin to'plami yetishmaydi.

- [ ] **Step 4: Tozalash**

```bash
rm -rf src-tauri/target/release/bundle/appimage/squashfs-root
```

- [ ] **Step 5: Natijani hujjatlash**

Verifikatsiya natijasini (qaysi `.so` fayllar topildi, toza-muhit testi o'tdimi) `docs/superpowers/specs/2026-06-08-linux-finish-design.md` E bo'limiga yoki commit xabariga yoz. Bu task kod o'zgartirmasligi mumkin — agar shunday bo'lsa commit shart emas; aks holda topilgan muammo Task 7'ga qaytadi.

---

## Self-review eslatmalari

- **Spec qamrovi:** A (Task 1–3), B (Task 4–5), C (Task 6), D (Task 7–9), E (Task 10). Barcha bo'limlar qoplangan.
- **Bog'liqlik tartibi:** cleanup (1–3) → native (4–5) → polish (6) → packaging (7–9) → verify (10).
- **Context7 nuqtalari (ataylab):** Task 5 (log targets), Task 6 (on_page_load imzosi, agar xato bo'lsa), Task 7 (bundleMediaFramework kaliti) — versiya-bo'yicha o'zgaruvchi API'lar.
- **Tip izchilligi:** `todoistToken`/`todoist_token` hamma joydan (types/settings-panel/models+testlar/CSP) olib tashlanadi; `UpdaterStatus` saqlanadi (stub uchun).
- **False-pass himoyasi:** Task 10 artifakt-introspeksiya majburiy — oddiy ishga tushirish yetarli emas.
