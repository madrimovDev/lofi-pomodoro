# Faza 6 — Dialog, FS, Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ZenFocus Tauri build'iga lokal musiqa papkasi tanlash/ro'yxatlash, vazifalarni export/import va custom bildirishnoma ovozini tanlashni qo'shish — asset-protokol orqali lokal audio ijro bilan.

**Architecture:** 5 ta Rust command (`#[tauri::command]`) Electron IPC'ni mirror qiladi; dialog `app.dialog()` (tauri-plugin-dialog) Rust API'si orqali, fayl I/O `std::fs` orqali (fs plugin yo'q). Lokal audio xavfsizligi **dinamik tor asset scope** bilan: faqat tanlangan yo'llar runtime'da `asset_protocol_scope()` ga qo'shiladi, startup'da store'dan qayta ro'yxatdan o'tkaziladi. Frontend `music.ts` + `dialog.ts` wrapperlari `convertFileSrc` ni qo'llaydi.

**Tech Stack:** Rust (Tauri v2.11, tauri-plugin-dialog, serde_json, std::fs), TypeScript/React (`@tauri-apps/api/core` `invoke`/`convertFileSrc`).

**Spec:** `docs/superpowers/specs/2026-06-08-phase6-dialog-fs-audio-design.md`

**Test holati:** Frontend test framework yo'q → `tsc` + `npm run build` + runtime acceptance. Rust uchun **pure helper'lar TDD bilan** (`cargo test`), dialog/scope qismlar runtime acceptance bilan.

---

## Task 1: Audio dekod smoke test (codec gate — MANUAL RUNTIME)

**Maqsad:** Plumbing'dan oldin WebKitGTK + NVIDIA mashinada MP3 dekodi (GStreamer) ishlashini isbotlash. `asset://` va `tauri://` bir xil GStreamer pipeline' idan o'tgani uchun mavjud `public/bell.mp3` + ambient ovozlar codec riskini izolyatsiya qiladi (asset-protokol yo'li Task 11'da tekshiriladi).

**Files:** (kod o'zgarmaydi — runtime tekshiruv)

- [ ] **Step 1: Dev build'ni ishga tushirish**

Run: `npm run tauri dev`
Expected: Oyna ochiladi (NVIDIA opaque-glass fallback bilan).

- [ ] **Step 2: MP3 dekodini tekshirish**

Ilovada:
1. Settings → ambient sound `rain` (yoki `forest`/`cafe`) ni yoqing → ovoz chiqishi kerak.
2. Bitta fokus sessiyasini tugatib bell (`/bell.mp3`) chalinishini eshiting (yoki devtools konsolda: `new Audio('/bell.mp3').play()`).

Expected: Ikkala MP3 ham **ovoz chiqaradi**.

- [ ] **Step 3: Codec gate qarori**

- ✅ Ovoz chiqsa → GStreamer MP3 codec bor, davom etamiz (Task 2).
- ❌ Ovoz chiqmasa → **TO'XTANG**. `gstreamer1.0-plugins-good` o'rnatilganini tekshiring (`gst-inspect-1.0 mad` yoki `flump3dec`). Foydalanuvchi bilan codec strategiyasini hal qiling (paket o'rnatish / AppImage'ga bundllash). Bu hal bo'lmaguncha qolgan task'lar bekor.

> Bu task'da commit yo'q (kod o'zgarmaydi). Natijani foydalanuvchiga xabar qiling.

---

## Task 2: tauri-plugin-dialog qo'shish

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs:52-54` (plugin zanjiriga qo'shish)

- [ ] **Step 1: Cargo dependency qo'shish**

`src-tauri/Cargo.toml` da `[dependencies]` bo'limida, `tauri-plugin-window-state = "2"` qatoridan keyin:

```toml
tauri-plugin-dialog = "2"
```

- [ ] **Step 2: Plugin'ni init qilish**

`src-tauri/src/lib.rs` da `.plugin(tauri_plugin_window_state::Builder::default().build())` (53-qator) dan keyin yangi qator:

```rust
    .plugin(tauri_plugin_dialog::init())
```

- [ ] **Step 3: Build tekshirish**

Run: `cd src-tauri && cargo build`
Expected: Xatosiz kompilyatsiya (yangi plugin yuklanadi).

- [ ] **Step 4: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/lib.rs
git commit -m "feat(tauri): Faza 6 — tauri-plugin-dialog qo'shish"
```

---

## Task 3: Asset scope util (`asset_scope.rs`)

**Files:**
- Create: `src-tauri/src/asset_scope.rs`
- Modify: `src-tauri/src/lib.rs` (`mod asset_scope;` + setup'da `reregister_from_store`)

- [ ] **Step 1: asset_scope.rs yaratish**

Create `src-tauri/src/asset_scope.rs`:

```rust
use tauri::{AppHandle, Manager};
use tauri_plugin_store::StoreExt;

use crate::models::MusicConfig;
use crate::store_util::deserialize_or_default;

const STORE_FILE: &str = "config.json";

/// Berilgan yo'lni asset-protokol scope'iga qo'shadi (dinamik tor scope).
/// Papka bo'lsa rekursiv, fayl bo'lsa yakka. Xatoni log qiladi, panic qilmaydi.
pub fn allow_path(app: &AppHandle, path: &str) {
  let scope = app.asset_protocol_scope();
  let p = std::path::Path::new(path);
  let result = if p.is_dir() {
    scope.allow_directory(p, true)
  } else {
    scope.allow_file(p)
  };
  if let Err(e) = result {
    log::warn!("asset scope allow_path('{path}') failed: {e}");
  }
}

/// Startup'da store'dagi saqlangan yo'llarni scope'ga qayta qo'shadi:
/// joriy musiqa papkasi, saqlangan papkalar, custom bildirishnoma ovozi.
pub fn reregister_from_store(app: &AppHandle) {
  let Ok(store) = app.store(STORE_FILE) else {
    return;
  };

  let music: MusicConfig = deserialize_or_default("music", store.get("music"));
  if let Some(folder) = &music.folder_path {
    allow_path(app, folder);
  }
  for f in &music.saved_folders {
    allow_path(app, &f.path);
  }

  // Custom bildirishnoma ovozi settings.notificationSoundPath ichida.
  if let Some(settings) = store.get("settings") {
    if let Some(path) = settings.get("notificationSoundPath").and_then(|v| v.as_str()) {
      allow_path(app, path);
    }
  }
}
```

- [ ] **Step 2: lib.rs da modulni e'lon qilish**

`src-tauri/src/lib.rs` boshida (1-6 qatorlardagi `mod` ro'yxatiga, alifbo tartibida `app_state` dan keyin):

```rust
mod asset_scope;
```

- [ ] **Step 3: setup'da reregister chaqirish**

`src-tauri/src/lib.rs` setup bloki ichida, `tray::setup_tray(app.handle())?;` (93-qator) dan oldin:

```rust
      asset_scope::reregister_from_store(app.handle());
```

- [ ] **Step 4: Build tekshirish**

Run: `cd src-tauri && cargo build`
Expected: Xatosiz kompilyatsiya.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/asset_scope.rs src-tauri/src/lib.rs
git commit -m "feat(tauri): Faza 6 — dinamik asset scope util + startup re-register"
```

---

## Task 4: Music command'lar (`pick_music_folder`, `list_music_files`)

**Files:**
- Create: `src-tauri/src/commands/music.rs`
- Modify: `src-tauri/src/models.rs` (`AudioFileRaw` struct + test)
- Modify: `src-tauri/src/commands/mod.rs` (`pub mod music;`)
- Modify: `src-tauri/src/lib.rs` (invoke_handler'ga 2 command)

- [ ] **Step 1: `is_audio_file` helper + test bilan music.rs yaratish**

Create `src-tauri/src/commands/music.rs`:

```rust
const AUDIO_EXTENSIONS: &[&str] = &[
  "mp3", "wav", "ogg", "flac", "m4a", "aac", "opus", "weba", "webm",
];

/// Fayl nomi audio kengaytmaga egami (katta-kichik harfga befarq).
fn is_audio_file(name: &str) -> bool {
  std::path::Path::new(name)
    .extension()
    .and_then(|e| e.to_str())
    .map(|ext| AUDIO_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
    .unwrap_or(false)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn audio_extension_filter() {
    assert!(is_audio_file("song.mp3"));
    assert!(is_audio_file("track.FLAC")); // katta harf
    assert!(is_audio_file("a.opus"));
    assert!(!is_audio_file("cover.jpg"));
    assert!(!is_audio_file("notes.txt"));
    assert!(!is_audio_file("noext"));
  }
}
```

- [ ] **Step 2: `commands/mod.rs` ga modul qo'shish**

`src-tauri/src/commands/mod.rs` (modul `mod.rs` da e'lon qilinmaguncha test ishga tushmaydi — shuning uchun avval shu):

```rust
pub mod music;
pub mod store;
pub mod window;
```

- [ ] **Step 3: Helper testini ishga tushirish (yashil)**

Run: `cd src-tauri && cargo test --lib music`
Expected: `test result: ok. 1 passed` (audio_extension_filter).

> Eslatma: bu pure helper, TDD'ning "qizil" bosqichi zaif (logika sodda) — asosiy qiymat regressiyani ushlash.

- [ ] **Step 4: `AudioFileRaw` modelini qo'shish**

`src-tauri/src/models.rs` da `AudioFile` struct (190-195 qator) dan keyin:

```rust
/// list_music_files xom natijasi — frontend convertFileSrc bilan AudioFile{name,url} hosil qiladi.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioFileRaw {
  pub name: String,
  pub path: String,
}
```

- [ ] **Step 5: Command'larni yozish**

`src-tauri/src/commands/music.rs` da, helper'dan keyin va `#[cfg(test)]` blokidan oldin:

```rust
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

use crate::asset_scope;
use crate::models::AudioFileRaw;

/// Musiqa papkasini tanlash dialogi. Bekor qilinsa None.
/// async — blocking dialog asosiy thread'da ishlamasligi uchun.
#[tauri::command]
pub async fn pick_music_folder(app: AppHandle) -> Option<String> {
  let folder = app.dialog().file().blocking_pick_folder();
  let path = folder.and_then(|f| f.into_path().ok())?;
  let path_str = path.to_string_lossy().to_string();
  asset_scope::allow_path(&app, &path_str);
  Some(path_str)
}

/// Papkadagi audio fayllarni ro'yxatlash (xom yo'l bilan).
/// O'qish xatosida bo'sh vektor (Electron xulqini mirror).
#[tauri::command]
pub fn list_music_files(app: AppHandle, folder_path: String) -> Vec<AudioFileRaw> {
  asset_scope::allow_path(&app, &folder_path);
  let Ok(entries) = std::fs::read_dir(&folder_path) else {
    return Vec::new();
  };
  // Tartiblash yo'q — Electron ham tartiblamaydi; frontend sortFiles re-sort qiladi.
  entries
    .flatten()
    .filter(|e| e.file_type().map(|t| t.is_file()).unwrap_or(false))
    .filter_map(|e| {
      let name = e.file_name().to_string_lossy().to_string();
      if is_audio_file(&name) {
        Some(AudioFileRaw {
          name,
          path: e.path().to_string_lossy().to_string(),
        })
      } else {
        None
      }
    })
    .collect()
}
```

- [ ] **Step 6: Command'larni registratsiya qilish**

`src-tauri/src/lib.rs` `invoke_handler` ichida, `commands::store::set_stats,` (108-qator) dan keyin:

```rust
      commands::music::pick_music_folder,
      commands::music::list_music_files,
```

- [ ] **Step 7: To'liq build + test**

Run: `cd src-tauri && cargo test && cargo clippy`
Expected: Barcha testlar PASS, clippy warning yo'q.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/commands/music.rs src-tauri/src/commands/mod.rs src-tauri/src/models.rs src-tauri/src/lib.rs
git commit -m "feat(tauri): Faza 6 — pick_music_folder + list_music_files command'lari"
```

---

## Task 5: Tasks command'lar (`export_tasks`, `import_tasks`)

**Files:**
- Create: `src-tauri/src/commands/tasks.rs`
- Modify: `src-tauri/src/commands/mod.rs` (`pub mod tasks;`)
- Modify: `src-tauri/src/lib.rs` (invoke_handler'ga 2 command)

- [ ] **Step 1: `validate_imported_tasks` uchun failing test yozish**

`src-tauri/src/commands/tasks.rs` yaratib, helper + test bilan boshlang:

```rust
use crate::models::Task;

/// Import qilingan JSON'dan haqiqiy vazifalarni filtrlaydi (Electron'ni mirror):
/// massiv bo'lishi shart; har element obyekt + id:string + name:string bo'lganlari
/// Task'ga deserialize qilinadi. Massiv emas → None.
fn validate_imported_tasks(raw: &str) -> Option<Vec<Task>> {
  let value: serde_json::Value = serde_json::from_str(raw).ok()?;
  let arr = value.as_array()?;
  let tasks = arr
    .iter()
    .filter(|item| {
      item.is_object()
        && item.get("id").and_then(|v| v.as_str()).is_some()
        && item.get("name").and_then(|v| v.as_str()).is_some()
    })
    .filter_map(|item| serde_json::from_value::<Task>(item.clone()).ok())
    .collect();
  Some(tasks)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn valid_array_parses() {
    let raw = r#"[
      {"id":"1","name":"A","description":"","estimatedPomodoros":1,"completedPomodoros":0,"createdAt":0,"priority":null,"dueDate":null},
      {"id":"2","name":"B","description":"","estimatedPomodoros":2,"completedPomodoros":0,"createdAt":0,"priority":null,"dueDate":null}
    ]"#;
    let tasks = validate_imported_tasks(raw).unwrap();
    assert_eq!(tasks.len(), 2);
    assert_eq!(tasks[0].name, "A");
  }

  #[test]
  fn non_array_returns_none() {
    assert!(validate_imported_tasks(r#"{"id":"1"}"#).is_none());
    assert!(validate_imported_tasks("not json").is_none());
  }

  #[test]
  fn invalid_items_filtered() {
    // id yo'q yoki name yo'q elementlar tashlanadi
    let raw = r#"[
      {"id":"1","name":"Keeps","description":"","estimatedPomodoros":1,"completedPomodoros":0,"createdAt":0,"priority":null,"dueDate":null},
      {"id":"2"},
      {"name":"NoId"}
    ]"#;
    let tasks = validate_imported_tasks(raw).unwrap();
    assert_eq!(tasks.len(), 1);
    assert_eq!(tasks[0].id, "1");
  }
}
```

- [ ] **Step 2: `commands/mod.rs` ga modul qo'shish**

`src-tauri/src/commands/mod.rs`:

```rust
pub mod music;
pub mod store;
pub mod tasks;
pub mod window;
```

- [ ] **Step 3: Testni ishga tushirish (yashil)**

Run: `cd src-tauri && cargo test --lib tasks`
Expected: `3 passed` (valid_array_parses, non_array_returns_none, invalid_items_filtered).

- [ ] **Step 4: Command'larni yozish**

`src-tauri/src/commands/tasks.rs` da, helper'dan keyin va `#[cfg(test)]` blokidan oldin:

```rust
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_store::StoreExt;

use crate::store_util::deserialize_or_default;

const STORE_FILE: &str = "config.json";

/// Vazifalarni JSON faylga eksport qilish. Bekor/xato → false.
#[tauri::command]
pub async fn export_tasks(app: AppHandle) -> bool {
  let Ok(store) = app.store(STORE_FILE) else {
    return false;
  };
  let tasks: Vec<Task> = deserialize_or_default("tasks", store.get("tasks"));

  let ts = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_millis())
    .unwrap_or(0);
  let default_name = format!("zenfocus-tasks-{ts}.json");

  let file = app
    .dialog()
    .file()
    .set_file_name(&default_name)
    .add_filter("JSON", &["json"])
    .blocking_save_file();
  let Some(path) = file.and_then(|f| f.into_path().ok()) else {
    return false;
  };

  match serde_json::to_string_pretty(&tasks) {
    Ok(json) => match std::fs::write(&path, json) {
      Ok(_) => true,
      Err(e) => {
        log::error!("export_tasks write failed: {e}");
        false
      }
    },
    Err(e) => {
      log::error!("export_tasks serialize failed: {e}");
      false
    }
  }
}

/// JSON fayldan vazifalarni import qilish. Bekor/xato/yaroqsiz → None.
#[tauri::command]
pub async fn import_tasks(app: AppHandle) -> Option<Vec<Task>> {
  let file = app
    .dialog()
    .file()
    .add_filter("JSON", &["json"])
    .blocking_pick_file();
  let path = file.and_then(|f| f.into_path().ok())?;

  let raw = match std::fs::read_to_string(&path) {
    Ok(s) => s,
    Err(e) => {
      log::error!("import_tasks read failed: {e}");
      return None;
    }
  };
  validate_imported_tasks(&raw)
}
```

- [ ] **Step 5: Command'larni registratsiya qilish**

`src-tauri/src/lib.rs` `invoke_handler` ichida, Task 4'da qo'shilgan `commands::music::list_music_files,` dan keyin:

```rust
      commands::tasks::export_tasks,
      commands::tasks::import_tasks,
```

- [ ] **Step 6: To'liq build + test + clippy**

Run: `cd src-tauri && cargo test && cargo clippy`
Expected: Barcha testlar PASS, clippy toza.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/commands/tasks.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat(tauri): Faza 6 — export_tasks + import_tasks command'lari"
```

---

## Task 6: `pick_notification_sound` command

**Files:**
- Modify: `src-tauri/src/commands/store.rs` (yangi command)
- Modify: `src-tauri/src/lib.rs` (invoke_handler'ga 1 command)

- [ ] **Step 1: Command'ni yozish**

`src-tauri/src/commands/store.rs` da, importlarni yangilang (1-5 qatorlar) — `DialogExt` va `asset_scope` qo'shing:

```rust
use crate::asset_scope;
use crate::models::{DailyStat, MusicConfig, Task, Theme, TimerSettings};
use crate::store_util::deserialize_or_default;
use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_store::StoreExt;
```

Fayl oxiriga (set_stats dan keyin):

```rust
/// Custom bildirishnoma ovozi faylini tanlash. Xom yo'l qaytaradi (None=bekor).
/// async — blocking dialog uchun.
#[tauri::command]
pub async fn pick_notification_sound(app: AppHandle) -> Option<String> {
  let file = app
    .dialog()
    .file()
    .add_filter("Audio", &["mp3", "wav", "ogg", "flac", "m4a"])
    .blocking_pick_file();
  let path = file.and_then(|f| f.into_path().ok())?;
  let path_str = path.to_string_lossy().to_string();
  asset_scope::allow_path(&app, &path_str);
  Some(path_str)
}
```

- [ ] **Step 2: Command'ni registratsiya qilish**

`src-tauri/src/lib.rs` `invoke_handler` ichida, Task 5'da qo'shilgan `commands::tasks::import_tasks,` dan keyin:

```rust
      commands::store::pick_notification_sound,
```

- [ ] **Step 3: Build + clippy**

Run: `cd src-tauri && cargo build && cargo clippy`
Expected: Xatosiz, clippy toza.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands/store.rs src-tauri/src/lib.rs
git commit -m "feat(tauri): Faza 6 — pick_notification_sound command'i"
```

---

## Task 7: Asset scope'ni boshlang'ich bo'sh qilish

**Files:**
- Modify: `src-tauri/tauri.conf.json:27-30`

- [ ] **Step 1: `$HOME/**` ni olib tashlash**

`src-tauri/tauri.conf.json` da `assetProtocol` blokini (27-30 qator) o'zgartiring:

```json
      "assetProtocol": {
        "enable": true,
        "scope": []
      },
```

> Endi scope bo'sh boshlaydi; faqat runtime'da tanlangan/qayta ro'yxatdan o'tgan yo'llar ruxsat etiladi (dinamik tor scope).

- [ ] **Step 2: Build tekshirish**

Run: `cd src-tauri && cargo build`
Expected: Xatosiz (konfiguratsiya yaroqli JSON).

- [ ] **Step 3: Commit**

```bash
git add src-tauri/tauri.conf.json
git commit -m "feat(tauri): Faza 6 — asset scope'ni dinamik tor (bo'sh boshlang'ich)"
```

---

## Task 8: Frontend `music.ts` wrapper

**Files:**
- Create: `src/shared/tauri/music.ts`

- [ ] **Step 1: Wrapper yozish**

Create `src/shared/tauri/music.ts`:

```typescript
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import type { AudioFile } from '@shared/types';

/** list_music_files xom natijasi (Rust AudioFileRaw). */
interface AudioFileRaw {
  name: string;
  path: string;
}

/**
 * Faza 6 musiqa papkasi command'lari.
 * convertFileSrc shu yerda qo'llanadi — renderer xom yo'lni ko'rmaydi.
 */
export const musicApi = {
  pickMusicFolder: () => invoke<string | null>('pick_music_folder'),

  listMusicFiles: async (folderPath: string): Promise<AudioFile[]> => {
    const raw = await invoke<AudioFileRaw[]>('list_music_files', { folderPath });
    return raw.map(f => ({ name: f.name, url: convertFileSrc(f.path) }));
  },
};
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: `music.ts` da xato yo'q (hali ishlatilmagani uchun unused warning bo'lishi mumkin emas — export).

- [ ] **Step 3: Commit**

```bash
git add src/shared/tauri/music.ts
git commit -m "feat(tauri): Faza 6 — frontend music.ts wrapper (convertFileSrc bilan)"
```

---

## Task 9: Frontend `dialog.ts` wrapper

**Files:**
- Create: `src/shared/tauri/dialog.ts`

- [ ] **Step 1: Wrapper yozish**

Create `src/shared/tauri/dialog.ts`:

```typescript
import { invoke } from '@tauri-apps/api/core';
import type { Task } from '@shared/types';

/**
 * Faza 6 dialog command'lari (export/import vazifalar, sound tanlash).
 * pickNotificationSound xom yo'l qaytaradi — ijro paytida convertFileSrc qo'llanadi.
 */
export const dialogApi = {
  exportTasks: () => invoke<boolean>('export_tasks'),
  importTasks: () => invoke<Task[] | null>('import_tasks'),
  pickNotificationSound: () => invoke<string | null>('pick_notification_sound'),
};
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: Xato yo'q.

- [ ] **Step 3: Commit**

```bash
git add src/shared/tauri/dialog.ts
git commit -m "feat(tauri): Faza 6 — frontend dialog.ts wrapper (export/import/sound)"
```

---

## Task 10: Renderer chaqiruvlarini yangi wrapperlarga ko'chirish

**Files:**
- Modify: `src/renderer/hooks/use-music.tsx` (import + 5 chaqiruv)
- Modify: `src/renderer/app/layout/index.tsx:313-315` (convertFileSrc)
- Modify: `src/renderer/components/settings-panel.tsx:132`
- Modify: `src/renderer/components/task-panel.tsx:576,580`

- [ ] **Step 1: use-music.tsx — import qo'shish**

`src/renderer/hooks/use-music.tsx` da `import { api } from '@shared/tauri/api';` (22-qator) dan keyin:

```typescript
import { musicApi } from '@shared/tauri/music';
```

- [ ] **Step 2: use-music.tsx — `listMusicFiles` chaqiruvlari (4 joy)**

Quyidagi 4 ta `window.electronApi?.listMusicFiles(...) ?? []` / `.then(...)` ni almashtiring:

169-qator (useEffect):
```typescript
      musicApi.listMusicFiles(config.folderPath)
        .then(f => {
          setFiles(sortFiles(f, config.sortMode));
          setCurrentFileIndex(0);
        })
        .catch(err => console.error('listMusicFiles failed:', err));
```

297-qator (`refreshFiles`):
```typescript
    const f = await musicApi.listMusicFiles(config.folderPath);
```

306-qator (`pickFolder`):
```typescript
    const f = await musicApi.listMusicFiles(path);
```

395-qator (`addFolder`):
```typescript
    const f = await musicApi.listMusicFiles(path);
```

407-qator (`loadFolder`):
```typescript
    const f = await musicApi.listMusicFiles(folder.path);
```

> Eslatma: `?? []` endi kerak emas — `musicApi.listMusicFiles` doim massiv qaytaradi.

- [ ] **Step 3: use-music.tsx — `pickMusicFolder` chaqiruvlari (2 joy)**

303-qator (`pickFolder`):
```typescript
    const path = await musicApi.pickMusicFolder();
```

389-qator (`addFolder`):
```typescript
    const path = await musicApi.pickMusicFolder();
```

> `loadFolderTrack` (230-237) o'zgarmaydi — `files[index].url` allaqachon `convertFileSrc` natijasi.

- [ ] **Step 4: layout/index.tsx — bildirishnoma ovozi convertFileSrc**

`src/renderer/app/layout/index.tsx` da fayl boshidagi importlarga qo'shing (mavjud `@tauri-apps/api` importi yonida yoki yangi):

```typescript
import { convertFileSrc } from '@tauri-apps/api/core';
```

313-315 qatorlarni almashtiring:
```typescript
      const soundSrc = settings.notificationSoundPath
        ? convertFileSrc(settings.notificationSoundPath)
        : '/bell.mp3';
```

- [ ] **Step 5: settings-panel.tsx — pickNotificationSound**

`src/renderer/components/settings-panel.tsx` da importlarga qo'shing:

```typescript
import { dialogApi } from '@shared/tauri/dialog';
```

132-qatorni almashtiring:
```typescript
                        const p = await dialogApi.pickNotificationSound();
```

- [ ] **Step 6: task-panel.tsx — export/import**

`src/renderer/components/task-panel.tsx` da importlarga qo'shing:

```typescript
import { dialogApi } from '@shared/tauri/dialog';
```

575-582 qatorlardagi handlerlarni almashtiring:
```typescript
  const handleExport = async () => {
    await dialogApi.exportTasks();
  };

  const handleImport = async () => {
    const imported = await dialogApi.importTasks();
    if (imported) replaceTasks(imported);
  };
```

- [ ] **Step 7: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: Xato yo'q. (Agar `window.electronApi` typelari hali ishlatilsa — `yt*` chaqiruvlar Faza 7'da qoladi, bu kutilgan.)

- [ ] **Step 8: Commit**

```bash
git add src/renderer/hooks/use-music.tsx src/renderer/app/layout/index.tsx src/renderer/components/settings-panel.tsx src/renderer/components/task-panel.tsx
git commit -m "feat(tauri): Faza 6 — renderer chaqiruvlarini music.ts/dialog.ts wrapperlariga ko'chirish"
```

---

## Task 11: Yakuniy verifikatsiya (clippy/typecheck/build + runtime acceptance)

**Files:** (kod o'zgarmaydi — tekshiruv; topilgan kamchiliklar tuzatiladi)

- [ ] **Step 1: Statik tekshiruvlar**

Run:
```bash
cd src-tauri && cargo test && cargo clippy && cd .. && npx tsc --noEmit && npm run build
```
Expected: Barcha testlar PASS, clippy toza, typecheck toza, build muvaffaqiyatli.

- [ ] **Step 2: Runtime acceptance — `npm run tauri dev`**

Quyidagilarni tekshiring:
1. **Papka tanlash → ovoz:** Music panel → folder tanlash → fayllar ro'yxati chiqadi → fayl bosilsa **ovoz chiqadi** (asset scope + convertFileSrc + GStreamer).
2. **Restart davomiyligi:** Ilovani yopib qayta oching → saqlangan papka fayllari yana ijro bo'ladi (startup scope re-register ishlaydi).
3. **Bir nechta papka (addFolder):** Ikkinchi papka qo'shilsa, u ham ijro bo'ladi.
4. **Tasks export:** Task panel → Export → JSON fayl saqlanadi (default nom `zenfocus-tasks-<ts>.json`).
5. **Tasks import:** Export qilingan faylni Import qiling → vazifalar tiklanadi. Buzuq/massiv-bo'lmagan JSON rad etiladi (vazifalar o'zgarmaydi).
6. **Custom bildirishnoma ovozi:** Settings → sound tanlash → fokus sessiyasi tugaganda tanlangan ovoz chalinadi. Restart'dan keyin ham chalinadi (re-register).
7. **Ambient + bell:** rain/forest/cafe + bell ishlaydi (public dir).
8. **Scope chegarasi (negative check):** Ro'yxatdan o'tmagan yo'ldagi faylni yuklab ko'ring — devtools konsolda: `new Audio(convertFileSrc('/etc/hostname')).play()` yoki hech qachon tanlanmagan papkadagi audio. **Yuklanmasligi/ovoz chiqmasligi kerak** (konsolda "asset protocol not configured to allow the path" yoki shunga o'xshash). Bu dinamik tor scope haqiqatan cheklayotganini tasdiqlaydi — bu funksiyaning butun maqsadi.

- [ ] **Step 3: Topilgan kamchiliklarni tuzatish**

Agar biror tekshiruv muvaffaqiyatsiz bo'lsa: sababni aniqlang (scope/CSP/codec/arg-nomi), tuzating, tegishli task'ga qayting va qayta tekshiring. Arg nomlari (`folderPath`) backend bilan aynan mos kelishini eslang (typecheck ushlamaydi).

- [ ] **Step 4: Yakuniy commit (agar tuzatishlar bo'lsa)**

```bash
git add -A
git commit -m "fix(tauri): Faza 6 — runtime acceptance tuzatishlari"
```

> Tuzatish bo'lmasa, bu task'da commit yo'q.

---

## Bajarilgandan keyin

- Obsidian `Faza 6 — Dialog, FS, Audio.md` note'idagi checkbox'larni belgilang.
- `tauri-migration` memory faylini yangilang (Faza 6 tugadi, keyingi = Faza 7 yt-dlp sidecar).
- Branch'ga push qiling (`tauri-migration`).
