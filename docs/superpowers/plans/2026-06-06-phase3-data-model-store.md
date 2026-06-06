# Faza 3 — Data model va Store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rust `serde` modellari + `tauri-plugin-store` orqali ZenFocus ma'lumotlarini (theme, settings, tasks, stats, music, activeTaskId) doimiy saqlash; 6 juft get/set command backend'da tayyor bo'ladi.

**Architecture:** Frontend `invoke('get_settings')` chaqiradi → Rust command `commands/store.rs` → `tauri-plugin-store` (`config.json`) o'qiydi/yozadi. Modellar (`models.rs`) TS type'lari bilan aniq round-trip mos. Deserialize xatosida default'ga qaytiladi; har `set`'da explicit `save()`. Electron'dan import yo'q — toza boshlash.

**Tech Stack:** Rust 2021, Tauri 2.11, `tauri-plugin-store` v2, `serde`/`serde_json`, Bun (frontend paket), `cargo test` (TDD).

**Manba spec:** `docs/superpowers/specs/2026-06-06-phase3-data-model-store-design.md`

---

## Fayl strukturasi

| Fayl | Mas'uliyat | Holat |
|---|---|---|
| `src-tauri/src/models.rs` | Barcha serde struct/enum + `Default` impl'lar + round-trip unit testlar | Yangi |
| `src-tauri/src/store_util.rs` | `deserialize_or_default` pure helper + unit testlar | Yangi |
| `src-tauri/src/commands/mod.rs` | `commands` moduli barrel | Yangi |
| `src-tauri/src/commands/store.rs` | 6 juft get/set command (`#[tauri::command]`) | Yangi |
| `src-tauri/src/lib.rs` | `mod` deklaratsiyalar, store plugin, `invoke_handler!` | O'zgartirish |
| `src-tauri/Cargo.toml` | `tauri-plugin-store` dependency | O'zgartirish |
| `src-tauri/capabilities/default.json` | `store:default` permission | O'zgartirish |
| `package.json` | `@tauri-apps/plugin-store` (Faza 4 uchun) | O'zgartirish |

**Dizayn izohi:** Store o'qish logikasi `deserialize_or_default` pure funksiyasiga ajratilgan (kirish: `Option<serde_json::Value>` → chiqish: `T`). Bu `AppHandle` mock'siz to'liq unit-test qilinadi — default-fallback va buzilgan-JSON xatti-harakatlari shu yerda tekshiriladi. Command'lar shu funksiyani `store.get()` natijasi bilan chaqiradi.

---

### Task 1: Bog'liqliklar va store plugin ulanishi

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs:36` (Builder zanjiri)
- Modify: `src-tauri/capabilities/default.json`
- Modify: `package.json`

- [ ] **Step 1: Cargo.toml'ga store dependency qo'shish**

`src-tauri/Cargo.toml` `[dependencies]` bo'limining oxiriga (`tauri-plugin-log = "2"` ostiga) qo'sh:

```toml
tauri-plugin-store = "2"
```

- [ ] **Step 2: lib.rs'da store plugin'ni ulash**

`src-tauri/src/lib.rs` ichida `tauri::Builder::default()` qatoridan keyin `.setup(...)`dan **oldin** plugin qo'sh. `lib.rs:36-37`ni quyidagicha o'zgartir:

```rust
  tauri::Builder::default()
    .plugin(tauri_plugin_store::Builder::default().build())
    .setup(move |app| {
```

- [ ] **Step 3: capabilities'ga store permission qo'shish**

`src-tauri/capabilities/default.json` `permissions` massiviga `"store:default"` qo'sh:

```json
  "permissions": [
    "core:default",
    "core:window:allow-start-dragging",
    "core:window:allow-internal-toggle-maximize",
    "store:default"
  ]
```

- [ ] **Step 4: Frontend store paketini qo'shish (Faza 4 uchun)**

Run: `bun add @tauri-apps/plugin-store`
Expected: `package.json` `dependencies`ga `@tauri-apps/plugin-store` qo'shiladi, xatosiz tugaydi.

- [ ] **Step 5: Build tekshiruvi**

Run: `cd src-tauri && cargo build`
Expected: PASS — `tauri-plugin-store` yuklab olinadi va kompilyatsiya qilinadi (ogohlantirishlar bo'lishi mumkin, xato yo'q).

- [ ] **Step 6: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/lib.rs src-tauri/capabilities/default.json package.json bun.lock
git commit -m "feat(tauri): Faza 3 — tauri-plugin-store ulash"
```

---

### Task 2: Enum modellar + round-trip testlar (TDD)

Bu — eng nozik qism. Enum **qiymatlari** TS bilan mos kelishi shart (default Rust `ShortBreak` qiladi → frontend buziladi).

**Files:**
- Create: `src-tauri/src/models.rs`
- Modify: `src-tauri/src/lib.rs` (`mod models;` qo'shish)

- [ ] **Step 1: lib.rs'ga modul deklaratsiyasi qo'shish**

`src-tauri/src/lib.rs` faylining eng boshiga (1-qatordan oldin) qo'sh:

```rust
mod models;
```

- [ ] **Step 2: Enum'larni va failing testni yozish**

`src-tauri/src/models.rs` yarat:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
  Dark,
  Light,
}

impl Default for Theme {
  fn default() -> Self {
    Theme::Dark
  }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AmbientSound {
  None,
  Rain,
  Forest,
  Cafe,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MusicSortMode {
  Shuffle,
  Alphabetical,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Locale {
  Uz,
  En,
  Ru,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
  High,
  Medium,
  Low,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TrayMode {
  Focus,
  ShortBreak,
  LongBreak,
}

#[cfg(test)]
mod tests {
  use super::*;
  use serde_json::json;

  #[test]
  fn enum_values_match_ts() {
    assert_eq!(serde_json::to_value(Theme::Dark).unwrap(), json!("dark"));
    assert_eq!(serde_json::to_value(AmbientSound::Cafe).unwrap(), json!("cafe"));
    assert_eq!(serde_json::to_value(MusicSortMode::Shuffle).unwrap(), json!("shuffle"));
    assert_eq!(serde_json::to_value(Locale::Uz).unwrap(), json!("uz"));
    assert_eq!(serde_json::to_value(Priority::High).unwrap(), json!("high"));
    // kebab-case — eng muhim trap
    assert_eq!(serde_json::to_value(TrayMode::ShortBreak).unwrap(), json!("short-break"));
    assert_eq!(serde_json::to_value(TrayMode::LongBreak).unwrap(), json!("long-break"));
  }

  #[test]
  fn enum_deserialize_from_ts() {
    let m: TrayMode = serde_json::from_value(json!("short-break")).unwrap();
    assert_eq!(m, TrayMode::ShortBreak);
    let t: Theme = serde_json::from_value(json!("dark")).unwrap();
    assert_eq!(t, Theme::Dark);
  }
}
```

- [ ] **Step 3: Testlar muvaffaqiyatsiz/o'tishini tekshirish**

Run: `cd src-tauri && cargo test --lib models::tests::enum_values_match_ts models::tests::enum_deserialize_from_ts`
Expected: PASS (enum'lar to'g'ri yozilgan bo'lsa). Agar biror enum'da rename unutilsa, `enum_values_match_ts` FAIL bo'ladi va aniq qaysi qiymat mos emasligini ko'rsatadi.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/models.rs src-tauri/src/lib.rs
git commit -m "feat(tauri): Faza 3 — enum modellar (TS-mos serde qiymatlar)"
```

---

### Task 3: Struct modellar + default'lar + round-trip testlar (TDD)

**Files:**
- Modify: `src-tauri/src/models.rs`

- [ ] **Step 1: Struct'larni Task 2'dagi enum'lardan keyin qo'shish**

`src-tauri/src/models.rs` ichida `#[cfg(test)]` blokidan **oldin** qo'sh:

```rust
// Container-darajadagi #[serde(default)] — yetishmayotgan har qanday kalit
// `Default` impl'dan to'ladi (forward migration: eski config yangi maydonlarni
// avtomatik oladi).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct TimerSettings {
  pub focus_duration: u32,
  pub short_break_duration: u32,
  pub long_break_duration: u32,
  pub sessions_before_long_break: u32,
  pub sound_enabled: bool,
  pub notifications_enabled: bool,
  pub ambient_sound: AmbientSound,
  pub ambient_volume: f64,
  pub focus_mode: bool,
  pub notification_sound_path: Option<String>,
  pub locale: Locale,
  pub auto_start_breaks: bool,
  pub auto_start_focus: bool,
  pub always_on_top: bool,
  pub active_preset: Option<String>,
  pub daily_goal: u32,
  pub show_break_screen: bool,
  pub todoist_token: Option<String>,
}

impl Default for TimerSettings {
  fn default() -> Self {
    Self {
      focus_duration: 25,
      short_break_duration: 5,
      long_break_duration: 15,
      sessions_before_long_break: 4,
      sound_enabled: true,
      notifications_enabled: true,
      ambient_sound: AmbientSound::None,
      ambient_volume: 0.4,
      focus_mode: false,
      notification_sound_path: None,
      locale: Locale::Uz,
      auto_start_breaks: false,
      auto_start_focus: false,
      always_on_top: false,
      active_preset: None,
      daily_goal: 0,
      show_break_screen: true,
      todoist_token: None,
    }
  }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimerPreset {
  pub id: String,
  pub name: String,
  pub focus_duration: u32,
  pub short_break_duration: u32,
  pub long_break_duration: u32,
  pub sessions_before_long_break: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedYtPlaylist {
  pub id: String,
  pub name: String,
  pub url: String,
  pub thumbnail_url: Option<String>,
  pub item_count: u32,
  pub added_at: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedMusicFolder {
  pub id: String,
  pub path: String,
  pub name: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RadioStation {
  pub id: String,
  pub name: String,
  pub url: String,
  pub genre: String,
  pub is_built_in: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct MusicConfig {
  pub folder_path: Option<String>,
  pub sort_mode: MusicSortMode,
  pub youtube_url: Option<String>,
  pub volume: f64,
  pub saved_playlists: Vec<SavedYtPlaylist>,
  pub saved_folders: Vec<SavedMusicFolder>,
  pub saved_radio_stations: Vec<RadioStation>,
}

impl Default for MusicConfig {
  fn default() -> Self {
    Self {
      folder_path: None,
      sort_mode: MusicSortMode::Shuffle,
      youtube_url: None,
      volume: 0.5,
      saved_playlists: Vec::new(),
      saved_folders: Vec::new(),
      saved_radio_stations: Vec::new(),
    }
  }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct YoutubeStreamInfo {
  pub stream_url: String,
  pub title: String,
  pub is_live: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct YoutubePlaylistItem {
  pub id: String,
  pub title: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioFile {
  pub name: String,
  pub url: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Subtask {
  pub id: String,
  pub text: String,
  pub done: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
  pub id: String,
  pub name: String,
  pub description: String,
  pub estimated_pomodoros: u32,
  pub completed_pomodoros: u32,
  pub created_at: i64,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub completed_at: Option<i64>,
  pub priority: Option<Priority>,
  pub due_date: Option<i64>,
  #[serde(default)]
  pub subtasks: Vec<Subtask>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyStat {
  pub date: String,
  pub focus_sessions: u32,
  pub focus_minutes: u32,
  pub tasks_completed: u32,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub skipped_sessions: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayTimerState {
  pub time_left: i64,
  pub mode: TrayMode,
  pub is_running: bool,
}
```

- [ ] **Step 2: Struct testlarini `#[cfg(test)] mod tests` ichiga qo'shish**

`src-tauri/src/models.rs` ichidagi `mod tests` blokига Task 2'dagi testlardan keyin qo'sh:

```rust
  #[test]
  fn timer_settings_default_matches_ts() {
    let s = TimerSettings::default();
    let v = serde_json::to_value(&s).unwrap();
    assert_eq!(v["focusDuration"], json!(25));
    assert_eq!(v["ambientVolume"], json!(0.4));
    assert_eq!(v["locale"], json!("uz"));
    assert_eq!(v["dailyGoal"], json!(0));
    assert_eq!(v["showBreakScreen"], json!(true));
    assert_eq!(v["todoistToken"], json!(null));
  }

  #[test]
  fn timer_settings_forward_migration() {
    // Eski Electron config: faqat bir nechta kalit bor, yangilari yo'q.
    // Container-darajadagi #[serde(default)] tufayli yetishmayotgan kalitlar
    // (dailyGoal, todoistToken, showBreakScreen, ...) default'dan to'ladi.
    let partial = json!({
      "focusDuration": 30,
      "ambientSound": "rain",
      "locale": "en"
    });
    let s: TimerSettings = serde_json::from_value(partial).unwrap();
    // Berilgan kalitlar saqlanadi
    assert_eq!(s.focus_duration, 30);
    assert_eq!(s.ambient_sound, AmbientSound::Rain);
    assert_eq!(s.locale, Locale::En);
    // Yetishmayotgan kalitlar default'dan to'ladi
    assert_eq!(s.short_break_duration, 5);
    assert_eq!(s.daily_goal, 0);
    assert_eq!(s.show_break_screen, true);
    assert_eq!(s.todoist_token, None);
  }

  #[test]
  fn task_priority_null_serializes() {
    let t = Task {
      id: "1".into(),
      name: "Test".into(),
      description: String::new(),
      estimated_pomodoros: 1,
      completed_pomodoros: 0,
      created_at: 0,
      completed_at: None,
      priority: None,
      due_date: None,
      subtasks: Vec::new(),
    };
    let v = serde_json::to_value(&t).unwrap();
    // priority null sifatida chiqadi (TS: priority|null)
    assert_eq!(v["priority"], json!(null));
    assert_eq!(v["dueDate"], json!(null));
    // completedAt skip_serializing_if bilan yo'q bo'ladi (TS: completedAt?)
    assert!(v.get("completedAt").is_none());
    // round-trip
    let back: Task = serde_json::from_value(v).unwrap();
    assert_eq!(back, t);
  }

  #[test]
  fn music_config_partial_merges_defaults() {
    // saved_* kalitlari yo'q — #[serde(default)] bo'sh vec beradi
    let partial = json!({
      "folderPath": null,
      "sortMode": "alphabetical",
      "youtubeUrl": null,
      "volume": 0.7
    });
    let c: MusicConfig = serde_json::from_value(partial).unwrap();
    assert_eq!(c.sort_mode, MusicSortMode::Alphabetical);
    assert_eq!(c.volume, 0.7);
    assert!(c.saved_playlists.is_empty());
    assert!(c.saved_radio_stations.is_empty());
  }
```

- [ ] **Step 3: Barcha model testlarini ishlatish**

Run: `cd src-tauri && cargo test --lib models::`
Expected: PASS — barcha testlar (enum + struct). Agar field nomi mos kelmasa (masalan `focus_duration` → `focusDuration` rename ishlamasa) `timer_settings_default_matches_ts` FAIL bo'ladi.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/models.rs
git commit -m "feat(tauri): Faza 3 — struct modellar + default + round-trip testlar"
```

---

### Task 4: Store helper (`deserialize_or_default`) + testlar (TDD)

Bu pure funksiya store o'qish logikasini AppHandle'dan ajratadi — buzilgan/yo'q qiymat → default xulqi shu yerda test qilinadi.

**Files:**
- Create: `src-tauri/src/store_util.rs`
- Modify: `src-tauri/src/lib.rs` (`mod store_util;`)

- [ ] **Step 1: lib.rs'ga modul qo'shish**

`src-tauri/src/lib.rs` boshida `mod models;` ostiga qo'sh:

```rust
mod store_util;
```

- [ ] **Step 2: Helper + failing test yozish**

`src-tauri/src/store_util.rs` yarat:

```rust
use serde::de::DeserializeOwned;
use serde_json::Value;

/// Store'dan o'qilgan qiymatni `T`ga deserialize qiladi. Qiymat yo'q (`None`)
/// yoki buzilgan bo'lsa — `T::default()` qaytaradi (warn log). Bitta yomon
/// yozuv ilovani "bricklab" qo'ymasligi uchun.
pub fn deserialize_or_default<T>(key: &str, value: Option<Value>) -> T
where
  T: DeserializeOwned + Default,
{
  match value {
    Some(v) => serde_json::from_value(v).unwrap_or_else(|e| {
      log::warn!("store kaliti '{key}' deserialize bo'lmadi: {e}; default ishlatilmoqda");
      T::default()
    }),
    None => T::default(),
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::models::{Theme, TimerSettings};
  use serde_json::json;

  #[test]
  fn missing_value_returns_default() {
    let t: Theme = deserialize_or_default("theme", None);
    assert_eq!(t, Theme::Dark);
    let s: TimerSettings = deserialize_or_default("settings", None);
    assert_eq!(s, TimerSettings::default());
  }

  #[test]
  fn valid_value_deserializes() {
    let t: Theme = deserialize_or_default("theme", Some(json!("light")));
    assert_eq!(t, Theme::Light);
  }

  #[test]
  fn corrupt_value_returns_default() {
    // noto'g'ri enum varianti
    let t: Theme = deserialize_or_default("theme", Some(json!("rainbow")));
    assert_eq!(t, Theme::Dark);
    // butunlay noto'g'ri tip
    let s: TimerSettings = deserialize_or_default("settings", Some(json!("oops")));
    assert_eq!(s, TimerSettings::default());
  }
}
```

- [ ] **Step 3: Testlarni ishlatish**

Run: `cd src-tauri && cargo test --lib store_util::`
Expected: PASS — uchala test (missing/valid/corrupt).

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/store_util.rs src-tauri/src/lib.rs
git commit -m "feat(tauri): Faza 3 — deserialize_or_default helper + testlar"
```

---

### Task 5: Store command'lari + ro'yxatga olish

**Files:**
- Create: `src-tauri/src/commands/mod.rs`
- Create: `src-tauri/src/commands/store.rs`
- Modify: `src-tauri/src/lib.rs` (`mod commands;` + `invoke_handler!`)

- [ ] **Step 1: commands/mod.rs yaratish**

`src-tauri/src/commands/mod.rs` yarat:

```rust
pub mod store;
```

- [ ] **Step 2: commands/store.rs yaratish**

`src-tauri/src/commands/store.rs` yarat:

```rust
use crate::models::{DailyStat, MusicConfig, Task, Theme, TimerSettings};
use crate::store_util::deserialize_or_default;
use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "config.json";

/// Berilgan kalitni store'ga yozadi va darhol diskka saqlaydi.
fn write_value<T: Serialize>(app: &AppHandle, key: &str, value: T) -> Result<(), String> {
  let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
  let json = serde_json::to_value(value).map_err(|e| e.to_string())?;
  store.set(key, json);
  store.save().map_err(|e| e.to_string())?;
  Ok(())
}

/// Berilgan kalitni store'dan o'qiydi (yo'q/buzilgan bo'lsa default).
fn read_value<T>(app: &AppHandle, key: &str) -> Result<T, String>
where
  T: serde::de::DeserializeOwned + Default,
{
  let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
  Ok(deserialize_or_default(key, store.get(key)))
}

#[tauri::command]
pub fn get_theme(app: AppHandle) -> Result<Theme, String> {
  read_value(&app, "theme")
}

#[tauri::command]
pub fn set_theme(app: AppHandle, theme: Theme) -> Result<(), String> {
  write_value(&app, "theme", theme)
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Result<TimerSettings, String> {
  read_value(&app, "settings")
}

#[tauri::command]
pub fn set_settings(app: AppHandle, settings: TimerSettings) -> Result<(), String> {
  write_value(&app, "settings", settings)
}

#[tauri::command]
pub fn get_tasks(app: AppHandle) -> Result<Vec<Task>, String> {
  read_value(&app, "tasks")
}

#[tauri::command]
pub fn set_tasks(app: AppHandle, tasks: Vec<Task>) -> Result<(), String> {
  write_value(&app, "tasks", tasks)
}

#[tauri::command]
pub fn get_active_task_id(app: AppHandle) -> Result<Option<String>, String> {
  read_value(&app, "activeTaskId")
}

#[tauri::command]
pub fn set_active_task_id(app: AppHandle, id: Option<String>) -> Result<(), String> {
  write_value(&app, "activeTaskId", id)
}

#[tauri::command]
pub fn get_music(app: AppHandle) -> Result<MusicConfig, String> {
  read_value(&app, "music")
}

#[tauri::command]
pub fn set_music(app: AppHandle, config: MusicConfig) -> Result<(), String> {
  write_value(&app, "music", config)
}

#[tauri::command]
pub fn get_stats(app: AppHandle) -> Result<Vec<DailyStat>, String> {
  read_value(&app, "stats")
}

#[tauri::command]
pub fn set_stats(app: AppHandle, stats: Vec<DailyStat>) -> Result<(), String> {
  write_value(&app, "stats", stats)
}
```

- [ ] **Step 3: lib.rs'ga modul va invoke_handler qo'shish**

`src-tauri/src/lib.rs` boshida modul deklaratsiyalariga qo'sh:

```rust
mod commands;
```

So'ng `.run(tauri::generate_context!())` qatoridan **oldin** (`.setup(...)` blokidan keyin) `invoke_handler` qo'sh:

```rust
    .invoke_handler(tauri::generate_handler![
      commands::store::get_theme,
      commands::store::set_theme,
      commands::store::get_settings,
      commands::store::set_settings,
      commands::store::get_tasks,
      commands::store::set_tasks,
      commands::store::get_active_task_id,
      commands::store::set_active_task_id,
      commands::store::get_music,
      commands::store::set_music,
      commands::store::get_stats,
      commands::store::set_stats
    ])
    .run(tauri::generate_context!())
```

- [ ] **Step 4: Build va clippy tekshiruvi**

Run: `cd src-tauri && cargo clippy --all-targets -- -D warnings && cargo test --lib`
Expected: PASS — clippy toza (xato yo'q), barcha unit testlar o'tadi.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/ src-tauri/src/lib.rs
git commit -m "feat(tauri): Faza 3 — store get/set command'lari (12 ta)"
```

---

### Task 6: Qo'lda verifikatsiya (DevTools) va yakun

Command'lar Tauri runtime kontekstida ishlaganligi sababli ular jonli ilovada tekshiriladi (unit test AppHandle mock'idan ko'ra ishonchli).

**Files:** (kod o'zgarishi yo'q — tekshiruv)

- [ ] **Step 1: Ilovani ishga tushirish**

Run: `bun run dev`
Expected: Tauri oynasi ochiladi, regress yo'q (timer/UI default ma'lumot bilan ishlaydi).

- [ ] **Step 2: DevTools'da default o'qishni tekshirish**

DevTools console'da (oynada o'ng tugma → Inspect yoki `Ctrl+Shift+I`):

```js
await window.__TAURI__.core.invoke('get_settings')
```
Expected: `TimerSettings` default obyekti — `{focusDuration: 25, ambientVolume: 0.4, locale: "uz", ...}` (camelCase kalitlar).

- [ ] **Step 3: Yozish va disk fayl tekshiruvi**

DevTools console'da:

```js
await window.__TAURI__.core.invoke('set_theme', { theme: 'light' })
await window.__TAURI__.core.invoke('get_theme')   // → "light"
```

So'ng terminalда:
Run: `cat ~/.local/share/com.madrimov.zenfocus/config.json`
Expected: `{"theme":"light"}` (yoki shu kalitni o'z ichiga olgan JSON) — disk'ga yozilgan.

- [ ] **Step 4: Enum round-trip tekshiruvi (tray mode)**

DevTools console'da:

```js
await window.__TAURI__.core.invoke('set_stats', { stats: [{date:"2026-06-06", focusSessions:1, focusMinutes:25, tasksCompleted:0}] })
await window.__TAURI__.core.invoke('get_stats')
```
Expected: aynan qaytadi (skippedSessions yo'q — skip qilinган). camelCase saqlanadi.

- [ ] **Step 5: Buzilgan qiymat fallback tekshiruvi**

Terminal'da config.json'ga noto'g'ri theme yozib ko'r:
Run: `cd src-tauri && cargo test --lib` (avval to'liq test paketi yana o'tishini tasdiqla)
Expected: PASS. (Buzilgan-qiymat xulqi Task 4'da unit-test qilingan; bu yerda regressiya yo'qligini tasdiqlash.)

- [ ] **Step 6: Yakuniy tekshiruv va push**

Run: `cd src-tauri && cargo clippy --all-targets -- -D warnings` va loyiha ildizida `bun run typecheck`
Expected: ikkalasi ham toza.

```bash
git push origin tauri-migration
```

- [ ] **Step 7: Obsidian Faza 3 holatini yangilash (ixtiyoriy, qo'lda)**

`ZenFocus Tauri Migration — Index.md`'da Faza 3 holatini `⬜ Keyingi` → `✅ Tugadi`, Faza 4'ni `⬜ Keyingi` qil.

---

## Self-Review natijalari

**Spec coverage:**
- Arxitektura (Rust command) → Task 5 ✅
- Toza boshlash (import yo'q) → dizayn bo'yicha hech qaerda import yo'q ✅
- Modellar + camelCase → Task 3 ✅
- Enum rename (lowercase/kebab-case) → Task 2 ✅
- Optional + skip_serializing_if → Task 3 (Task struct, DailyStat) ✅
- Forward migration `#[serde(default)]` → Task 3 testlari ✅
- 6 juft command → Task 5 ✅
- Explicit `save()` har set'da → Task 5 `write_value` ✅
- Deserialize xatosida default → Task 4 `deserialize_or_default` ✅
- capabilities `store:default` → Task 1 ✅
- Verifikatsiya (DevTools, enum round-trip, clippy) → Task 6 ✅

**Type consistency:** `deserialize_or_default(key, value)` imzosi Task 4'da aniqlanган, Task 5'da `read_value` ichida shu imzo bilan ishlatilган ✅. `write_value`/`read_value` helper nomlari Task 5'da izchil ✅.

**Placeholder scan:** TODO/TBD yo'q; har kod qadami to'liq kod bilan ✅.
