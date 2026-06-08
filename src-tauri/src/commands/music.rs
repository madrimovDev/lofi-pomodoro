use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

use crate::asset_scope;
use crate::models::{AudioFileRaw, YoutubeStreamInfo, YoutubePlaylistItem};

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

/// yt-dlp `--flat-playlist --print %(id)s\t%(title)s` chiqishini parse qiladi.
/// Bo'sh satrlar tashlanadi; birinchi tab id'ni title'dan ajratadi.
/// Keyingi task (sidecar command'lari) tomonidan chaqiriladi.
#[allow(dead_code)]
pub(crate) fn parse_playlist(stdout: &str) -> Vec<YoutubePlaylistItem> {
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
/// Keyingi task (sidecar command'lari) tomonidan chaqiriladi.
#[allow(dead_code)]
pub(crate) fn build_stream_info(stream_out: &str, title_out: &str, live_out: &str) -> YoutubeStreamInfo {
  YoutubeStreamInfo {
    stream_url: stream_out.lines().next().unwrap_or("").to_string(),
    title: title_out.lines().next().unwrap_or("").to_string(),
    is_live: live_out.trim().to_lowercase().starts_with("true"),
  }
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
}
