use tauri::image::Image;

/// Rejim rangini RGB sifatida qaytaradi (Electron qiymatlari).
fn mode_color(mode: &str) -> (u8, u8, u8) {
  match mode {
    "short-break" => (45, 212, 191),
    "long-break" => (167, 139, 250),
    _ => (74, 222, 128), // focus (default)
  }
}

/// 22×22 RGBA tray icon: running=to'la doira, pauza=halqa (36° checker).
/// Electron `createModeIcon` mantiqining ko'chirmasi.
pub fn create_mode_icon(mode: &str, is_running: bool) -> Image<'static> {
  let (r, g, b) = mode_color(mode);
  let size: u32 = 22;
  let cx = size as f64 / 2.0;
  let cy = size as f64 / 2.0;
  let outer_r = cx - 1.0;
  let ring_inner = outer_r - 2.5;
  let mut pixels = vec![0u8; (size * size * 4) as usize];
  for y in 0..size {
    for x in 0..size {
      let dx = x as f64 - cx + 0.5;
      let dy = y as f64 - cy + 0.5;
      let dist = (dx * dx + dy * dy).sqrt();
      let mut alpha = 0u8;
      if is_running {
        if dist <= outer_r {
          alpha = 255;
        }
      } else if dist >= ring_inner && dist <= outer_r {
        let angle = (dy.atan2(dx) * 180.0 / std::f64::consts::PI + 360.0) % 360.0;
        if ((angle / 36.0).floor() as i64) % 2 == 0 {
          alpha = 200;
        }
      }
      let i = ((y * size + x) * 4) as usize;
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = alpha;
    }
  }
  Image::new_owned(pixels, size, size)
}

use crate::app_state::AppState;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};

const MODE_FOCUS: &str = "focus";

fn format_time(secs: i64) -> String {
  let s = secs.max(0);
  format!("{:02}:{:02}", s / 60, s % 60)
}

fn mode_label(mode: &str) -> &'static str {
  match mode {
    "short-break" => "Qisqa tanaffus",
    "long-break" => "Uzoq tanaffus",
    _ => "Fokus",
  }
}

fn build_menu(
  app: &AppHandle,
  time_left: i64,
  mode: &str,
  is_running: bool,
  is_visible: bool,
) -> tauri::Result<Menu<tauri::Wry>> {
  let status = MenuItem::with_id(
    app,
    "status",
    format!("{}  •  {}", format_time(time_left), mode_label(mode)),
    false,
    None::<&str>,
  )?;
  let toggle = MenuItem::with_id(
    app,
    "toggle",
    if is_running {
      "⏸  To'xtatish"
    } else {
      "▶  Boshlash"
    },
    true,
    None::<&str>,
  )?;
  let skip = MenuItem::with_id(app, "skip", "⏭  Keyingisiga o'tish", true, None::<&str>)?;
  let mini = MenuItem::with_id(app, "mini", "📌  Mini rejim", true, None::<&str>)?;
  let toggle_vis = MenuItem::with_id(
    app,
    "toggle_visibility",
    if is_visible {
      "🙈  Yashirish"
    } else {
      "👁  Ko'rsatish"
    },
    true,
    None::<&str>,
  )?;
  let quit = MenuItem::with_id(app, "quit", "Chiqish", true, None::<&str>)?;
  let sep1 = PredefinedMenuItem::separator(app)?;
  let sep2 = PredefinedMenuItem::separator(app)?;
  let sep3 = PredefinedMenuItem::separator(app)?;
  Menu::with_items(
    app,
    &[
      &status,
      &sep1,
      &toggle,
      &skip,
      &sep2,
      &mini,
      &toggle_vis,
      &sep3,
      &quit,
    ],
  )
}

/// Ilk tray'ni yaratadi (setup'da bir marta).
pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
  let menu = build_menu(app, 0, MODE_FOCUS, false, true)?;
  let _tray = TrayIconBuilder::with_id("main-tray")
    .icon(create_mode_icon(MODE_FOCUS, false))
    .icon_as_template(false)
    .tooltip("ZenFocus")
    .menu(&menu)
    .show_menu_on_left_click(false)
    .on_menu_event(|app, event| handle_menu_event(app, event.id().as_ref()))
    .on_tray_icon_event(|tray, event| {
      if let TrayIconEvent::Click {
        button: tauri::tray::MouseButton::Left,
        button_state: tauri::tray::MouseButtonState::Up,
        ..
      } = event
      {
        toggle_window_visibility(tray.app_handle());
      }
    })
    .build(app)?;
  Ok(())
}

fn toggle_window_visibility(app: &AppHandle) {
  if let Some(win) = app.get_webview_window("main") {
    if win.is_visible().unwrap_or(false) {
      let _ = win.hide();
    } else {
      let _ = win.show();
      let _ = win.set_focus();
    }
  }
}

fn handle_menu_event(app: &AppHandle, id: &str) {
  match id {
    "toggle" => {
      let _ = app.emit("tray:toggle-timer", ());
    }
    "skip" => {
      let _ = app.emit("tray:skip", ());
    }
    "mini" => {
      let _ = app.emit("tray:set-mini-mode", true);
    }
    "toggle_visibility" => toggle_window_visibility(app),
    "quit" => {
      let state = app.state::<AppState>();
      state.inner.lock().unwrap().is_quitting = true;
      crate::window_util::restore_normal_before_exit(app);
      app.exit(0);
    }
    _ => {}
  }
}

/// Tray holatini yangilaydi: tooltip har chaqiruvda; icon+menu faqat mode/running o'zgarganda.
pub fn update_tray(app: &AppHandle, time_left: i64, mode: &str, is_running: bool) {
  let Some(tray) = app.tray_by_id("main-tray") else {
    return;
  };

  let _ = tray.set_tooltip(Some(format!(
    "ZenFocus  |  {}  |  {}",
    format_time(time_left),
    mode_label(mode)
  )));
  #[cfg(target_os = "macos")]
  {
    let _ = tray.set_title(Some(format_time(time_left)));
  }

  let changed = {
    let state = app.state::<AppState>();
    let mut inner = state.inner.lock().unwrap();
    let changed =
      inner.prev_mode.as_deref() != Some(mode) || inner.prev_running != Some(is_running);
    inner.prev_mode = Some(mode.to_string());
    inner.prev_running = Some(is_running);
    changed
  };
  let is_visible = app
    .get_webview_window("main")
    .and_then(|w| w.is_visible().ok())
    .unwrap_or(true);

  if changed {
    let _ = tray.set_icon(Some(create_mode_icon(mode, is_running)));
    if let Ok(menu) = build_menu(app, time_left, mode, is_running, is_visible) {
      let _ = tray.set_menu(Some(menu));
    }
  }
}

use crate::models::{TrayMode, TrayTimerState};

#[tauri::command]
pub fn update_tray_state(app: AppHandle, state: TrayTimerState) -> Result<(), String> {
  let mode = match state.mode {
    TrayMode::Focus => "focus",
    TrayMode::ShortBreak => "short-break",
    TrayMode::LongBreak => "long-break",
  };
  update_tray(&app, state.time_left, mode, state.is_running);
  Ok(())
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn mode_colors_match_electron() {
    assert_eq!(mode_color("focus"), (74, 222, 128));
    assert_eq!(mode_color("short-break"), (45, 212, 191));
    assert_eq!(mode_color("long-break"), (167, 139, 250));
    assert_eq!(mode_color("unknown"), (74, 222, 128)); // default = focus
  }

  #[test]
  fn icon_has_correct_dimensions() {
    let img = create_mode_icon("focus", true);
    assert_eq!(img.width(), 22);
    assert_eq!(img.height(), 22);
  }

  #[test]
  fn icon_generation_does_not_panic_for_all_states() {
    for mode in ["focus", "short-break", "long-break", "unknown"] {
      for running in [true, false] {
        let img = create_mode_icon(mode, running);
        assert_eq!(img.width(), 22);
        assert_eq!(img.height(), 22);
      }
    }
  }
}
