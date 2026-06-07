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
