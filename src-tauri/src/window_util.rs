use crate::app_state::AppState;
use tauri::{AppHandle, Manager};

/// Chiqishdan oldin mini-rejimda bo'lsa normal o'lchamga qaytaradi —
/// window-state plugin transient (320×72) o'lchamni saqlamasligi uchun.
pub fn restore_normal_before_exit(app: &AppHandle) {
  use tauri::{LogicalSize, Size};
  let state = app.state::<AppState>();
  let (mini, normal_size) = {
    let inner = state.inner.lock().unwrap();
    (inner.mini_mode, inner.normal_size)
  };
  if mini {
    if let Some(win) = app.get_webview_window("main") {
      let _ = win.set_min_size(Some(Size::Logical(LogicalSize::new(0.0, 0.0))));
      let _ = win.set_max_size(Some(Size::Logical(LogicalSize::new(9999.0, 9999.0))));
      if let Some((w, h)) = normal_size {
        let _ = win.set_size(Size::Logical(LogicalSize::new(w, h)));
      }
    }
  }
}
