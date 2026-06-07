use std::time::{SystemTime, UNIX_EPOCH};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_store::StoreExt;

use crate::models::Task;
use crate::store_util::deserialize_or_default;

const STORE_FILE: &str = "config.json";

/// Import qilingan JSON'dan haqiqiy vazifalarni filtrlaydi (Electron'ni mirror):
/// massiv bo'lishi shart; har element obyekt + id:string + name:string bo'lganlari
/// Task'ga deserialize qilinadi. Massiv emas → None.
fn validate_imported_tasks(raw: &str) -> Option<Vec<Task>> {
  let value: serde_json::Value = serde_json::from_str(raw).ok()?;
  let arr = value.as_array()?;
  let tasks = arr
    .iter()
    .filter_map(|item| {
      let has_id = item.get("id").and_then(|v| v.as_str()).is_some();
      let has_name = item.get("name").and_then(|v| v.as_str()).is_some();
      if has_id && has_name {
        serde_json::from_value::<Task>(item.clone()).ok()
      } else {
        None
      }
    })
    .collect();
  Some(tasks)
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
