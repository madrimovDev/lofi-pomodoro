use std::time::{SystemTime, UNIX_EPOCH};
use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_store::StoreExt;

use crate::models::Task;
use crate::store_util::deserialize_or_default;

const STORE_FILE: &str = "config.json";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
  pub status: String, // "ok" | "invalid" | "cancelled"
  pub tasks: Vec<Task>,
  pub total: usize,
}

/// Returns (valid_tasks, original_array_len), or None if not a JSON array.
fn parse_imported_tasks(raw: &str) -> Option<(Vec<Task>, usize)> {
  let value: serde_json::Value = serde_json::from_str(raw).ok()?;
  let arr = value.as_array()?;
  let total = arr.len();
  let tasks = arr
    .iter()
    .filter_map(|item| {
      let has_id = item.get("id").and_then(|v| v.as_str()).is_some();
      let has_name = item.get("name").and_then(|v| v.as_str()).is_some();
      if has_id && has_name { serde_json::from_value::<Task>(item.clone()).ok() } else { None }
    })
    .collect();
  Some((tasks, total))
}

fn import_result_from_raw(raw: &str) -> ImportResult {
  match parse_imported_tasks(raw) {
    Some((tasks, total)) => ImportResult { status: "ok".into(), tasks, total },
    None => ImportResult { status: "invalid".into(), tasks: vec![], total: 0 },
  }
}

/// Vazifalarni JSON faylga eksport qilish. Bekor/xato → false.
#[tauri::command]
pub async fn export_tasks(app: AppHandle) -> bool {
  let Ok(store) = app.store(STORE_FILE) else {
    log::error!("export_tasks: store ochilmadi");
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

/// JSON fayldan vazifalarni import qilish. Tipli natija: cancelled/invalid/ok.
#[tauri::command]
pub async fn import_tasks(app: AppHandle) -> ImportResult {
  let file = app
    .dialog()
    .file()
    .add_filter("JSON", &["json"])
    .blocking_pick_file();
  let Some(path) = file.and_then(|f| f.into_path().ok()) else {
    return ImportResult { status: "cancelled".into(), tasks: vec![], total: 0 };
  };
  match std::fs::read_to_string(&path) {
    Ok(raw) => import_result_from_raw(&raw),
    Err(e) => {
      log::error!("import_tasks read failed: {e}");
      ImportResult { status: "invalid".into(), tasks: vec![], total: 0 }
    }
  }
}

/// Berilgan yo'ldan import (drag-drop uchun). Tipli natija: invalid/ok.
#[tauri::command]
pub async fn import_tasks_from_path(path: String) -> ImportResult {
  match std::fs::read_to_string(&path) {
    Ok(raw) => import_result_from_raw(&raw),
    Err(e) => {
      log::error!("import_tasks_from_path read failed: {e}");
      ImportResult { status: "invalid".into(), tasks: vec![], total: 0 }
    }
  }
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
    let (tasks, total) = parse_imported_tasks(raw).unwrap();
    assert_eq!(tasks.len(), 2);
    assert_eq!(total, 2);
    assert_eq!(tasks[0].name, "A");
  }

  #[test]
  fn non_array_returns_none() {
    assert!(parse_imported_tasks(r#"{"id":"1"}"#).is_none());
    assert!(parse_imported_tasks("not json").is_none());
  }

  #[test]
  fn invalid_items_filtered_with_total() {
    let raw = r#"[
      {"id":"1","name":"Keeps","description":"","estimatedPomodoros":1,"completedPomodoros":0,"createdAt":0,"priority":null,"dueDate":null},
      {"id":"2"},
      {"name":"NoId"}
    ]"#;
    let (tasks, total) = parse_imported_tasks(raw).unwrap();
    assert_eq!(tasks.len(), 1);
    assert_eq!(total, 3);
    assert_eq!(tasks[0].id, "1");
  }

  #[test]
  fn status_mapping() {
    assert_eq!(import_result_from_raw("not json").status, "invalid");
    let ok = import_result_from_raw(r#"[{"id":"1","name":"A","description":"","estimatedPomodoros":1,"completedPomodoros":0,"createdAt":0,"priority":null,"dueDate":null}]"#);
    assert_eq!(ok.status, "ok");
    assert_eq!(ok.total, 1);
  }
}
