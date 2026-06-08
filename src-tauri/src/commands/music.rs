use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_shell::ShellExt;

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

/// Bitta sidecar yt-dlp chaqiruvi → trim qilingan stdout.
/// timeout_secs ichida tugamasa yoki status fail → Err.
async fn run_yt_dlp(app: &AppHandle, args: &[&str], timeout_secs: u64) -> Result<String, String> {
  let command = app
    .shell()
    .sidecar("yt-dlp")
    .map_err(|e| format!("sidecar: {e}"))?
    .args(args);
  let output = tokio::time::timeout(
    std::time::Duration::from_secs(timeout_secs),
    command.output(),
  )
  .await
  .map_err(|_| "yt-dlp timeout".to_string())?
  .map_err(|e| format!("yt-dlp exec: {e}"))?;
  if !output.status.success() {
    return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
  }
  Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// yt-dlp sidecar mavjudligini tekshirish (--version).
#[tauri::command]
pub async fn yt_check(app: AppHandle) -> bool {
  run_yt_dlp(&app, &["--version"], 8).await.is_ok()
}

/// Bitta video/jonli oqim uchun stream URL + sarlavha + isLive.
#[tauri::command]
pub async fn yt_get_stream(app: AppHandle, url: String) -> Result<YoutubeStreamInfo, String> {
  let stream_args = ["-g", "-x", "--audio-quality", "0", "--no-playlist", &url];
  let title_args = ["--get-title", "--no-playlist", &url];
  let live_args = ["--print", "%(is_live)s", "--no-playlist", &url];

  let (stream, title, live) = tokio::join!(
    run_yt_dlp(&app, &stream_args, 30),
    run_yt_dlp(&app, &title_args, 30),
    run_yt_dlp(&app, &live_args, 30),
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
    60,
  )
  .await
  .map_err(|e| {
    log::error!("yt-dlp playlist error: {e}");
    "Playlist ma'lumotlarini olishda xatolik.".to_string()
  })?;
  Ok(parse_playlist(&out))
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
