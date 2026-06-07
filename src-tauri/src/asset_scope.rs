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
