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
pub fn set_active_task_id(app: AppHandle, active_task_id: Option<String>) -> Result<(), String> {
  write_value(&app, "activeTaskId", active_task_id)
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
