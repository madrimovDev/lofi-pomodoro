// Bu modeldagi ba'zi tuzilmalar (TimerPreset, YoutubeStreamInfo, YoutubePlaylistItem,
// AudioFile, TrayTimerState, TrayMode, Subtask, RadioStation, SavedMusicFolder,
// SavedYtPlaylist) hozircha faqat to'liq ma'lumotlar kontrakt sifatida mavjud —
// ular Faza 5/6/7 commandlari tomonidan ishlatiladi. dead_code ogohlantirishini
// modulning o'zida o'chiramiz (alohida struct'larga tegmaymiz).
#![allow(dead_code)]

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
  #[default]
  Dark,
  Light,
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

/// list_music_files xom natijasi — frontend convertFileSrc bilan AudioFile{name,url} hosil qiladi.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioFileRaw {
  pub name: String,
  pub path: String,
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
    assert!(s.show_break_screen);
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
}
