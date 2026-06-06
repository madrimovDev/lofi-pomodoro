use crate::app_state::AppState;
use tauri::{AppHandle, Emitter, Manager, State};

/// Always-on-top'ni o'rnatadi. Linux'da blur'da qayta qo'llash uchun flag saqlanadi.
#[tauri::command]
pub fn set_always_on_top(
  app: AppHandle,
  state: State<'_, AppState>,
  enabled: bool,
) -> Result<(), String> {
  let win = app.get_webview_window("main").ok_or("oyna topilmadi")?;
  win.set_always_on_top(enabled).map_err(|e| e.to_string())?;
  #[cfg(target_os = "macos")]
  {
    let _ = win.set_visible_on_all_workspaces(enabled);
  }
  state.inner.lock().unwrap().always_on_top = enabled;
  Ok(())
}

/// Mini-rejimni yoqadi/o'chiradi. Aniq qiymatlar TZ §5.2.
#[tauri::command]
pub fn set_mini_mode(
  app: AppHandle,
  state: State<'_, AppState>,
  enabled: bool,
) -> Result<(), String> {
  use tauri::{LogicalSize, Size};
  let win = app.get_webview_window("main").ok_or("oyna topilmadi")?;

  if enabled {
    let scale = win.scale_factor().unwrap_or(1.0);
    let size = win.inner_size().map_err(|e| e.to_string())?.to_logical::<f64>(scale);
    {
      let mut inner = state.inner.lock().unwrap();
      inner.normal_size = Some((size.width, size.height));
      inner.normal_min_size = Some((600.0, 400.0));
      inner.mini_was_always_on_top = inner.always_on_top;
      inner.always_on_top = true;
      inner.mini_mode = true;
    }
    win.set_min_size(Some(Size::Logical(LogicalSize::new(200.0, 54.0)))).map_err(|e| e.to_string())?;
    win.set_max_size(Some(Size::Logical(LogicalSize::new(800.0, 200.0)))).map_err(|e| e.to_string())?;
    win.set_size(Size::Logical(LogicalSize::new(320.0, 72.0))).map_err(|e| e.to_string())?;
    win.set_always_on_top(true).map_err(|e| e.to_string())?;
  } else {
    win.set_min_size(Some(Size::Logical(LogicalSize::new(0.0, 0.0)))).map_err(|e| e.to_string())?;
    win.set_max_size(Some(Size::Logical(LogicalSize::new(9999.0, 9999.0)))).map_err(|e| e.to_string())?;
    let (normal_size, normal_min, was_aot) = {
      let inner = state.inner.lock().unwrap();
      (inner.normal_size, inner.normal_min_size, inner.mini_was_always_on_top)
    };
    if let Some((mw, mh)) = normal_min {
      win.set_min_size(Some(Size::Logical(LogicalSize::new(mw, mh)))).map_err(|e| e.to_string())?;
    }
    if let Some((w, h)) = normal_size {
      win.set_size(Size::Logical(LogicalSize::new(w, h))).map_err(|e| e.to_string())?;
    }
    win.set_always_on_top(was_aot).map_err(|e| e.to_string())?;
    {
      let mut inner = state.inner.lock().unwrap();
      inner.mini_mode = false;
      inner.always_on_top = was_aot;
    }
  }
  win.emit("window:mini-mode-changed", enabled).map_err(|e| e.to_string())?;
  Ok(())
}
