# Faza 7 — yt-dlp sidecar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** YouTube musiqa manbasini (`yt_check`/`yt_get_stream`/`yt_get_playlist`) Electron `execFile`'dan Tauri shell sidecar'ga ko'chirish va renderer chaqiruvlarini `musicApi`'ga ulash.

**Architecture:** Spike avval audio dekod riskini hal qiladi. So'ng `commands/music.rs`'ga uchta sidecar command qo'shiladi — pure parse helper'lar TDD bilan, sidecar I/O qatlami runtime acceptance bilan tekshiriladi. Frontend `music.ts` wrapper'ga uch metod qo'shiladi va `use-music.tsx` `window.electronApi?.yt*` → `musicApi.yt*` ko'chiriladi.

**Tech Stack:** Tauri v2, `tauri-plugin-shell`, yt-dlp (sidecar binary), Rust, React/TypeScript.

**Spec:** `docs/superpowers/specs/2026-06-08-phase7-ytdlp-sidecar-design.md`

---

## Fayl xaritasi

| Fayl | O'zgarish | Mas'uliyat |
|---|---|---|
| `src-tauri/src/models.rs` | Modify | `YoutubeStreamInfo`, `YoutubePlaylistItem` struct'lari |
| `src-tauri/src/commands/music.rs` | Modify | 3 command + pure parse helper'lar + unit testlar |
| `src-tauri/Cargo.toml` | Modify | `tauri-plugin-shell = "2"` |
| `src-tauri/src/lib.rs` | Modify | shell plugin init + 3 command'ni `generate_handler!`ga |
| `src-tauri/tauri.conf.json` | Modify | `bundle.externalBin: ["bin/yt-dlp"]` |
| `src-tauri/capabilities/default.json` | Modify | shell sidecar execute permission |
| `scripts/download-ytdlp.mjs` | Modify | Linux binary'ni target-triple nom bilan `src-tauri/bin/`ga |
| `src/shared/tauri/music.ts` | Modify | `ytCheck`/`ytGetStream`/`ytGetPlaylist` |
| `src/renderer/hooks/use-music.tsx` | Modify | 7 chaqiruvni `musicApi.yt*`ga |

---

## Task 0: Spike — audio dekod riskini hal qilish

**Bu task kod yozmaydi.** Maqsad: production `yt_get_stream` qaysi format argumentlarini ishlatishini va kerakli GStreamer plagin'larini *qaror bilan* aniqlash. Sidecar qurishdan oldin bajariladi.

**Old shart:** ishlaydigan yt-dlp (mavjud Electron `bin/linux/yt-dlp` yoki tizim yt-dlp) va ishlab turgan Tauri app (`npm run tauri dev`).

- [ ] **Step 1: Dekod muhitini xarakterlash**

Run:
```bash
gst-inspect-1.0 2>/dev/null | grep -iE 'opus|aac|faad|libav|vorbis'
```
Natijani spec'ning "Spike deliverable" bo'limiga yozib qo'ying (qaysi dekoderlar mavjud). Eslatma: dev mashinada `faad`/`fdkaac`/`libav` bor — bu "false pass" beradi, shuning uchun xulosa toza mashina uchun kerakli plagin ro'yxati sifatida hujjatlanadi.

- [ ] **Step 2: Production argumentlar bilan VOD stream URL olish**

Bitta oddiy YouTube video URL bilan (`<VIDEO_URL>`):
```bash
./bin/linux/yt-dlp -g -x --audio-quality 0 --no-playlist '<VIDEO_URL>'
```
Chiqgan URL'ni saqlang (qisqa muddatda eskiradi — IP'ga bog'liq).

- [ ] **Step 3: Format matritsasini olish**

```bash
./bin/linux/yt-dlp -f 'bestaudio[ext=webm]' -g --no-playlist '<VIDEO_URL>'   # Opus/WebM
./bin/linux/yt-dlp -f 'bestaudio[ext=m4a]'  -g --no-playlist '<VIDEO_URL>'   # AAC/m4a
```
Har bir URL'ni va `yt-dlp -F '<VIDEO_URL>'` chiqishidan default `bestaudio` qaysi format (itag/ext) ekanini yozib oling.

- [ ] **Step 4: WebKitGTK'da dekodni sinash**

Tauri app devtools console'ida har bir URL uchun:
```js
const a = new Audio('<STREAM_URL>'); a.volume = 0.3; a.play().then(() => console.log('OK')).catch(e => console.error('FAIL', e));
```
Ovoz chiqsa → dekod bo'ldi. Default `bestaudio`, Opus, AAC — uchchovini belgilang.

- [ ] **Step 5: Jonli oqimni sinash (`isLive`)**

Bitta jonli oqim URL bilan (`<LIVE_URL>`) Step 2 va Step 4 takrorlanadi (jonli oqim ko'pincha HLS/m4a). Ovoz chiqishini belgilang.

- [ ] **Step 6: Qarorni hujjatlash**

Spec faylining "Spike deliverable" bo'limini to'ldiring:
- Production `yt_get_stream` argumentlari: **default `-x --audio-quality 0`** (agar Opus/AAC ikkalasi ham dev'da ishlasa) YOKI eng kam bog'liqlikli format flagi (masalan `-f 'bestaudio[ext=webm]'` agar Opus afzal bo'lsa).
- Toza AppImage uchun kerakli GStreamer plagin'lari ro'yxati.

```bash
git add docs/superpowers/specs/2026-06-08-phase7-ytdlp-sidecar-design.md
git commit -m "docs: Faza 7 spike natijasi — audio dekod qarori"
```

> **Eslatma:** Quyidagi task'lardagi `yt_get_stream` argumentlari Step 6 qaroriga ko'ra moslashtiriladi. Default holatda (eng ehtimoliy natija) Electron'dagi `-g -x --audio-quality 0 --no-playlist` saqlanadi.

---

## Task 1: Rust modellari

**Files:**
- Modify: `src-tauri/src/models.rs` (oxiriga qo'shish)

- [ ] **Step 1: Struct'larni qo'shish**

`src-tauri/src/models.rs` oxiriga (mavjud `use serde::{Deserialize, Serialize};` bor):

```rust
/// YouTube stream ma'lumoti (frontend YoutubeStreamInfo bilan mos: streamUrl/isLive camelCase).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct YoutubeStreamInfo {
  pub stream_url: String,
  pub title: String,
  pub is_live: bool,
}

/// Flat playlist elementi (frontend YoutubePlaylistItem bilan mos).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct YoutubePlaylistItem {
  pub id: String,
  pub title: String,
}
```

- [ ] **Step 2: Kompilyatsiyani tekshirish**

Run: `cd src-tauri && cargo check`
Expected: PASS (warning: ishlatilmagan struct bo'lishi mumkin — keyingi task'da ishlatiladi).

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/models.rs
git commit -m "feat(tauri): Faza 7 — YoutubeStreamInfo/YoutubePlaylistItem modellari"
```

---

## Task 2: Pure parse helper'lar (TDD)

**Files:**
- Modify: `src-tauri/src/commands/music.rs` (helper'lar + `#[cfg(test)] mod tests` ichiga test)

Sidecar I/O'siz testlash mumkin bo'lgan toza logika: playlist parse va stream natijasini yig'ish. Bu Electron logikasini mirror qiladi.

- [ ] **Step 1: Failing testlarni yozish**

`src-tauri/src/commands/music.rs` ichidagi mavjud `#[cfg(test)] mod tests` blokiga (mavjud `audio_extension_filter` testidan keyin) qo'shing:

```rust
  #[test]
  fn parse_playlist_splits_tab_lines() {
    let out = "id1\tBirinchi trek\nid2\tIkkinchi\ttab\tbor\n\n";
    let items = parse_playlist(out);
    assert_eq!(items.len(), 2);
    assert_eq!(items[0].id, "id1");
    assert_eq!(items[0].title, "Birinchi trek");
    // Birinchi tab ajratadi — title ichidagi tablar saqlanadi
    assert_eq!(items[1].id, "id2");
    assert_eq!(items[1].title, "Ikkinchi\ttab\tbor");
  }

  #[test]
  fn build_stream_info_takes_first_line_and_parses_live() {
    let info = build_stream_info("url1\nurl2", "Sarlavha\nignore", "True");
    assert_eq!(info.stream_url, "url1");
    assert_eq!(info.title, "Sarlavha");
    assert!(info.is_live);

    let vod = build_stream_info("only", "T", "False");
    assert!(!vod.is_live);
  }
```

- [ ] **Step 2: Testlar fail bo'lishini tekshirish**

Run: `cd src-tauri && cargo test parse_playlist parse_live 2>&1 | head; cargo test --lib 2>&1 | tail -20`
Expected: FAIL — `parse_playlist`/`build_stream_info` topilmadi (compile error).

- [ ] **Step 3: Helper'larni implementatsiya qilish**

`src-tauri/src/commands/music.rs`'da `is_audio_file` funksiyasidan keyin (model import'ini fayl tepasiga qo'shing: `use crate::models::{YoutubeStreamInfo, YoutubePlaylistItem};` — mavjud `use crate::models::AudioFileRaw;` qatorini kengaytiring):

```rust
/// yt-dlp `--flat-playlist --print %(id)s\t%(title)s` chiqishini parse qiladi.
/// Bo'sh satrlar tashlanadi; birinchi tab id'ni title'dan ajratadi.
fn parse_playlist(stdout: &str) -> Vec<YoutubePlaylistItem> {
  stdout
    .lines()
    .filter(|l| !l.is_empty())
    .filter_map(|line| {
      let tab_idx = line.find('\t')?;
      Some(YoutubePlaylistItem {
        id: line[..tab_idx].to_string(),
        title: line[tab_idx + 1..].to_string(),
      })
    })
    .collect()
}

/// stream/title/is_live xom chiqishlaridan YoutubeStreamInfo yig'adi.
/// Ko'p satrli chiqishdan birinchi satr olinadi (Electron xulqi).
fn build_stream_info(stream_out: &str, title_out: &str, live_out: &str) -> YoutubeStreamInfo {
  YoutubeStreamInfo {
    stream_url: stream_out.lines().next().unwrap_or("").to_string(),
    title: title_out.lines().next().unwrap_or("").to_string(),
    is_live: live_out.trim().to_lowercase().starts_with("true"),
  }
}
```

- [ ] **Step 4: Testlar pass bo'lishini tekshirish**

Run: `cd src-tauri && cargo test --lib 2>&1 | tail -15`
Expected: PASS — `parse_playlist_splits_tab_lines`, `build_stream_info_takes_first_line_and_parses_live`, va mavjud testlar yashil.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/music.rs
git commit -m "feat(tauri): Faza 7 — playlist/stream parse helper'lari + testlar"
```

---

## Task 3: Shell plagini infratuzilmasi

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/capabilities/default.json`

- [ ] **Step 1: Cargo dependency**

`src-tauri/Cargo.toml`'da mavjud `tauri-plugin-dialog = "2"` qatoridan keyin:
```toml
tauri-plugin-shell = "2"
```

- [ ] **Step 2: Plugin init**

`src-tauri/src/lib.rs`'da mavjud `.plugin(tauri_plugin_dialog::init())` qatoridan keyin:
```rust
    .plugin(tauri_plugin_shell::init())
```

- [ ] **Step 3: externalBin**

`src-tauri/tauri.conf.json`'da `bundle` obyektiga (agar `externalBin` yo'q bo'lsa) qo'shing:
```json
    "externalBin": ["bin/yt-dlp"]
```

- [ ] **Step 4: Capability permission (context7 bilan tasdiqlanadi)**

> **MUHIM:** Shell sidecar'ni ishlatish uchun `capabilities/default.json`'da ANIQ permission kerak — Cargo dep + plugin init + externalBin YETARLI EMAS. Token sintaksisi `tauri-plugin-shell` v2 versiyalarida o'zgargan. **Implementatsiyadan oldin context7'dan `tauri-plugin-shell` sidecar permission/scope sintaksisini oling** (`resolve-library-id` → `query-docs`, mavzu: "shell plugin sidecar capability permission v2").

Kutilayotgan shakl (context7 bilan tasdiqlang) — `capabilities/default.json`'ning `permissions` massiviga obyekt sifatida:
```json
{
  "identifier": "shell:allow-execute",
  "allow": [
    { "name": "bin/yt-dlp", "sidecar": true, "args": true }
  ]
}
```
`args: true` — URL argumentini uzatish uchun (foydalanuvchi kiritadi). Agar context7 boshqa sintaksis ko'rsatsa (masalan alohida `shell:default` + scope), uni qo'llang.

- [ ] **Step 5: Kompilyatsiya + permission generatsiyasini tekshirish**

Run: `cd src-tauri && cargo check 2>&1 | tail -15`
Expected: PASS (permission noto'g'ri bo'lsa build script schema xatosi beradi — context7 sintaksisini qayta tekshiring).

- [ ] **Step 6: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/lib.rs src-tauri/tauri.conf.json src-tauri/capabilities/default.json src-tauri/Cargo.lock
git commit -m "feat(tauri): Faza 7 — shell plugin + sidecar capability + externalBin"
```

---

## Task 4: Download skripti (Linux target-triple)

**Files:**
- Modify: `scripts/download-ytdlp.mjs`

- [ ] **Step 1: Skriptni Linux-only + target-triple'ga yangilash**

`scripts/download-ytdlp.mjs` to'liq mazmunini almashtiring:

```js
#!/usr/bin/env node
/**
 * Tauri sidecar uchun yt-dlp Linux binary'sini yuklaydi.
 * Tauri sidecar binary'ni target-triple suffiks bilan talab qiladi (dev'da ham).
 * Run: node scripts/download-ytdlp.mjs
 */
import { createWriteStream, mkdirSync, chmodSync } from 'fs';
import { pipeline } from 'stream/promises';

// Faqat Linux (dev + acceptance shu mashinada). Windows/macOS keyingi CI fazasida.
const BINARIES = [
  {
    url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp',
    dest: 'src-tauri/bin/yt-dlp-x86_64-unknown-linux-gnu',
    chmod: true,
  },
];

async function download({ url, dest, chmod }) {
  mkdirSync(dest.split('/').slice(0, -1).join('/'), { recursive: true });
  console.log(`⬇  Downloading ${dest}...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  await pipeline(res.body, createWriteStream(dest));
  if (chmod) chmodSync(dest, 0o755);
  console.log(`✓  ${dest}`);
}

for (const bin of BINARIES) {
  await download(bin);
}
console.log('\n✅ yt-dlp Linux sidecar binary tayyor.');
```

- [ ] **Step 2: Skriptni ishga tushirish va binary'ni tekshirish**

Run:
```bash
node scripts/download-ytdlp.mjs && ls -la src-tauri/bin/ && src-tauri/bin/yt-dlp-x86_64-unknown-linux-gnu --version
```
Expected: `yt-dlp-x86_64-unknown-linux-gnu` mavjud, executable, versiya raqami chiqadi.

- [ ] **Step 3: gitignore tekshiruvi**

Run: `git check-ignore src-tauri/bin/yt-dlp-x86_64-unknown-linux-gnu; echo "exit: $?"`
Expected: binary ignore qilingan bo'lsa (exit 0) — bu to'g'ri, binary repo'ga commit qilinmaydi. Agar ignore qilinmagan bo'lsa, `src-tauri/bin/*` ni `.gitignore`'ga qo'shing va skript commit'iga kiriting.

- [ ] **Step 4: Commit**

```bash
git add scripts/download-ytdlp.mjs .gitignore
git commit -m "build(tauri): Faza 7 — download-ytdlp Linux target-triple sidecar nomlash"
```

---

## Task 5: Uchta sidecar command

**Files:**
- Modify: `src-tauri/src/commands/music.rs` (command'lar)
- Modify: `src-tauri/src/lib.rs` (`generate_handler!`)

- [ ] **Step 1: Sidecar yordamchi + command'larni qo'shish**

`src-tauri/src/commands/music.rs` fayl tepasidagi `use` blokiga qo'shing:
```rust
use tauri_plugin_shell::ShellExt;
```

Faylga (helper'lardan keyin) command'larni qo'shing. **Argumentlar Task 0 Step 6 qaroriga moslashtiriladi** — quyida default (Electron mirror):

```rust
/// Bitta sidecar yt-dlp chaqiruvi → trim qilingan stdout. Status fail → Err.
async fn run_yt_dlp(app: &AppHandle, args: &[&str]) -> Result<String, String> {
  let output = app
    .shell()
    .sidecar("yt-dlp")
    .map_err(|e| format!("sidecar: {e}"))?
    .args(args)
    .output()
    .await
    .map_err(|e| format!("yt-dlp exec: {e}"))?;
  if !output.status.success() {
    return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
  }
  Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// yt-dlp sidecar mavjudligini tekshirish (--version).
#[tauri::command]
pub async fn yt_check(app: AppHandle) -> bool {
  run_yt_dlp(&app, &["--version"]).await.is_ok()
}

/// Bitta video/jonli oqim uchun stream URL + sarlavha + isLive.
#[tauri::command]
pub async fn yt_get_stream(app: AppHandle, url: String) -> Result<YoutubeStreamInfo, String> {
  let stream_args = ["-g", "-x", "--audio-quality", "0", "--no-playlist", &url];
  let title_args = ["--get-title", "--no-playlist", &url];
  let live_args = ["--print", "%(is_live)s", "--no-playlist", &url];

  let (stream, title, live) = tokio::join!(
    run_yt_dlp(&app, &stream_args),
    run_yt_dlp(&app, &title_args),
    run_yt_dlp(&app, &live_args),
  );

  let stream = stream.map_err(|e| {
    log::error!("yt-dlp stream error: {e}");
    "URL dan stream olishda xatolik yuz berdi.".to_string()
  })?;
  let title = title.unwrap_or_default();
  let live = live.unwrap_or_else(|_| "False".to_string());

  Ok(build_stream_info(&stream, &title, &live))
}

/// Flat playlist elementlari (yuklab olmasdan).
#[tauri::command]
pub async fn yt_get_playlist(app: AppHandle, url: String) -> Result<Vec<YoutubePlaylistItem>, String> {
  let out = run_yt_dlp(
    &app,
    &["--flat-playlist", "--print", "%(id)s\t%(title)s", &url],
  )
  .await
  .map_err(|e| {
    log::error!("yt-dlp playlist error: {e}");
    "Playlist ma'lumotlarini olishda xatolik.".to_string()
  })?;
  Ok(parse_playlist(&out))
}
```

> **Frontend kontrakt:** `Result<T, String>` Tauri'da JS tomonida muvaffaqiyatda `T`, xatoda `throw` bo'ladi. Lekin frontend `T | {error: string}` kutadi (Electron mirror). Buni Task 6 wrapper'ida `.catch()` bilan `{error}`'ga aylantiramiz.

- [ ] **Step 2: Command'larni ro'yxatga olish**

`src-tauri/src/lib.rs`'da `generate_handler!` ichida `commands::music::list_music_files` qatoridan keyin:
```rust
      commands::music::yt_check,
      commands::music::yt_get_stream,
      commands::music::yt_get_playlist,
```

- [ ] **Step 3: Kompilyatsiya + clippy**

Run: `cd src-tauri && cargo clippy --all-targets 2>&1 | tail -20`
Expected: PASS — warning/error yo'q. (`tokio::join!` uchun `tokio` allaqachon Tauri tranzitiv dep'i sifatida mavjud; topilmasa `Cargo.toml`'ga `tokio = { version = "1", features = ["macros"] }` qo'shing.)

- [ ] **Step 4: Testlar hali yashil**

Run: `cd src-tauri && cargo test --lib 2>&1 | tail -10`
Expected: PASS — Task 2 testlari buzilmagan.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/music.rs src-tauri/src/lib.rs src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "feat(tauri): Faza 7 — yt_check/yt_get_stream/yt_get_playlist sidecar command'lari"
```

---

## Task 6: Frontend `music.ts` wrapper

**Files:**
- Modify: `src/shared/tauri/music.ts`

- [ ] **Step 1: Tip import + uch metod qo'shish**

`src/shared/tauri/music.ts` fayl tepasidagi import'ni kengaytiring:
```ts
import type { AudioFile, YoutubeStreamInfo, YoutubePlaylistItem } from '@shared/types';
```

`musicApi` obyektiga (`listMusicFiles`'dan keyin) qo'shing:
```ts
  ytCheck: () => invoke<boolean>('yt_check'),

  ytGetStream: (url: string): Promise<YoutubeStreamInfo | { error: string }> =>
    invoke<YoutubeStreamInfo>('yt_get_stream', { url })
      .catch((e: unknown) => ({ error: typeof e === 'string' ? e : 'Xatolik yuz berdi' })),

  ytGetPlaylist: (url: string): Promise<YoutubePlaylistItem[] | { error: string }> =>
    invoke<YoutubePlaylistItem[]>('yt_get_playlist', { url })
      .catch((e: unknown) => ({ error: typeof e === 'string' ? e : 'Xatolik yuz berdi' })),
```

> Rust `Result<T, String>` xato'da JS `throw`'iga aylanadi; `.catch` uni Electron'dagi `{error}` union shakliga qaytaradi — hook logikasi o'zgarmaydi.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | tail -15`
Expected: PASS (use-music hali `window.electronApi`'da — keyingi task'da ko'chiriladi; bu task hech narsani buzmaydi).

- [ ] **Step 3: Commit**

```bash
git add src/shared/tauri/music.ts
git commit -m "feat(tauri): Faza 7 — music.ts yt wrapper'lari (Result→{error} union)"
```

---

## Task 7: `use-music.tsx` migratsiyasi

**Files:**
- Modify: `src/renderer/hooks/use-music.tsx` (7 chaqiruv joyi: 162, 245, 327, 340, 481, 487, 494)

- [ ] **Step 1: musicApi import borligini tekshirish**

Run: `grep -n "musicApi\|from '@shared/tauri/music'" src/renderer/hooks/use-music.tsx`
Expected: `musicApi` allaqachon import qilingan (Faza 6 folder chaqiruvlari uchun). Agar yo'q bo'lsa import qatorini qo'shing: `import { musicApi } from '@shared/tauri/music';`

- [ ] **Step 2: Uch chaqiruvni almashtirish**

`src/renderer/hooks/use-music.tsx`'da quyidagi almashtirish (har bir joyda `window.electronApi?.` olib tashlanadi, optional chaining endi kerak emas):

- `window.electronApi?.ytCheck()` → `musicApi.ytCheck()`
- `window.electronApi?.ytGetStream(` → `musicApi.ytGetStream(` (4 joy: ~245, ~340, ~487, ~494)
- `window.electronApi?.ytGetPlaylist(` → `musicApi.ytGetPlaylist(` (2 joy: ~327, ~481)

Run (almashtirishni avtomatlashtirish — keyin qo'lda tekshiring):
```bash
sed -i 's/window\.electronApi?\.ytCheck/musicApi.ytCheck/g; s/window\.electronApi?\.ytGetStream/musicApi.ytGetStream/g; s/window\.electronApi?\.ytGetPlaylist/musicApi.ytGetPlaylist/g' src/renderer/hooks/use-music.tsx
```

- [ ] **Step 3: Qoldiq electronApi yt chaqiruvlari yo'qligini tekshirish**

Run: `grep -n "electronApi.*yt" src/renderer/hooks/use-music.tsx; echo "exit: $?"`
Expected: hech narsa topilmaydi (grep exit 1).

- [ ] **Step 4: Optional-chaining natija tekshiruvi**

`musicApi.ytCheck()` endi `Promise<boolean>` qaytaradi (`window.electronApi?.` kabi `undefined` emas). `.then(ok => setYtAvailable(ok))` ishlaydi. `ytGetStream`/`ytGetPlaylist` natijalari `T | {error}` — mavjud `'error' in result` tekshiruvlari o'zgarmaydi. Faqat `!result` tekshiruvlari endi hech qachon true bo'lmaydi (Tauri har doim qaytaradi) — lekin zararsiz, qoldirilsin.

Run: `npx tsc --noEmit 2>&1 | tail -15`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/hooks/use-music.tsx
git commit -m "feat(tauri): Faza 7 — use-music yt chaqiruvlarini musicApi'ga ko'chirish"
```

---

## Task 8: Runtime acceptance

**Bu task kod yozmaydi** — `npm run tauri dev` bilan qo'lda tekshiriladi. Test framework yo'q; bu fazaning asl tasdiqlovchisi.

- [ ] **Step 1: Build + ishga tushirish**

Run: `npm run tauri dev`
Expected: ilova ochiladi, console'da yt-dlp/shell xatosi yo'q.

- [ ] **Step 2: Acceptance ro'yxati**

Quyidagilarni qo'lda tekshiring va natijani belgilang:
1. **yt mavjud** → musiqa panelida YouTube manbasi yoqilgan (`ytAvailable=true`).
2. **Single video** → YouTube video URL kiritilganda ovoz chiqadi.
3. **Playlist** → playlist URL → treklar ro'yxati, oldinga/orqaga navigatsiya ishlaydi.
4. **Jonli oqim** → `isLive` video ovoz chiqaradi.
5. **Radio (SomaFM)** → hali ishlaydi (regressiya yo'q).
6. **Graceful degrade** → (ixtiyoriy) sidecar binary'ni vaqtincha o'chirib, `ytAvailable=false` va UI buzilmasligini tekshiring.

- [ ] **Step 3: Muammo bo'lsa**

Agar audio chiqmasa (Task 0 spike yashil bo'lsa ham) — `yt_get_stream` argumentlarini spike qaroridagi format flagiga moslang (Task 5 Step 1) va qayta sinang.

- [ ] **Step 4: Acceptance natijasini hujjatlash + memory yangilash**

Acceptance o'tgach, `memory/tauri-migration.md`'ni yangilang: Faza 7 tugadi, runtime tasdiqlandi, ishlatilgan format argumentlari, keyingi qadam Faza 8.

---

## Self-review eslatmalari

- **Spec qamrovi:** Spike (Task 0), backend 3 command + shell infra (Task 1/3/5), download script (Task 4), frontend wrapper (Task 6), use-music migratsiya (Task 7), verification (Task 8), CSP (o'zgarmaydi — Task 8 Step 2.5 da tasdiqlanadi). Barcha spec bo'limlari qoplangan.
- **Capability permission:** aniq token context7'dan olinadi (Task 3 Step 4) — bu ataylab, advisor ogohlantirishi.
- **Tip izchilligi:** `YoutubeStreamInfo` (camelCase: streamUrl/isLive), `YoutubePlaylistItem` (id/title) — Rust modellari (Task 1) frontend tiplariga (`@shared/types`) mos; wrapper `T | {error}` union'ga moslaydi.
