mod app_state;
mod asset_scope;
mod commands;
mod models;
mod store_util;
mod tray;
mod window_util;

/// Tizimda faol NVIDIA GPU borligini aniqlaydi (PCI vendor 0x10de).
#[cfg(target_os = "linux")]
fn has_nvidia_gpu() -> bool {
  use std::fs;
  let Ok(entries) = fs::read_dir("/sys/class/drm") else {
    return false;
  };
  for entry in entries.flatten() {
    let vendor_path = entry.path().join("device/vendor");
    if let Ok(vendor) = fs::read_to_string(&vendor_path) {
      if vendor.trim().eq_ignore_ascii_case("0x10de") {
        return true;
      }
    }
  }
  false
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // NVIDIA aniqlash — DMABUF disable va frontend glass fallback signali uchun.
  #[cfg(target_os = "linux")]
  let is_nvidia = has_nvidia_gpu();

  // WebKitGTK + NVIDIA (ayniqsa Wayland'da) DMABUF renderer bilan
  // "Error 71 (Protocol error)" yoki "Failed to create GBM buffer" berib
  // yiqiladi yoki bo'sh oyna ochadi. NVIDIA aniqlansa DMABUF'ni o'chiramiz —
  // bu barqaror software render beradi (backdrop-filter blur ishlamaydi,
  // buning uchun CSS fallback bor). Intel/AMD mashinalar tegilmaydi —
  // ular native Wayland + GPU compositing + blur'ni saqlaydi.
  #[cfg(target_os = "linux")]
  if is_nvidia && std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
    std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
  }

  tauri::Builder::default()
    .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
      use tauri::Manager;
      if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
      }
    }))
    .plugin(tauri_plugin_store::Builder::default().build())
    .plugin(tauri_plugin_window_state::Builder::default().build())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_shell::init())
    .manage(app_state::AppState::default())
    .on_window_event(|window, event| {
      if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        use tauri::Manager;
        let state = window.state::<app_state::AppState>();
        let is_quitting = state.inner.lock().unwrap().is_quitting;
        if !is_quitting {
          api.prevent_close();
          let _ = window.hide();
        }
      }
      #[cfg(target_os = "linux")]
      if let tauri::WindowEvent::Focused(false) = event {
        use tauri::Manager;
        let state = window.state::<app_state::AppState>();
        let aot = state.inner.lock().unwrap().always_on_top;
        if aot {
          let _ = window.set_always_on_top(true);
        }
      }
    })
    .setup(move |app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      // NVIDIA software render'da backdrop-filter (blur) ishlamaydi — frontendga
      // signal beramiz: <html>ga `no-backdrop-blur` class qo'shiladi va CSS
      // opaque glass fallback'ga o'tadi. Capable mashinalar (Intel/AMD) tegilmaydi.
      #[cfg(target_os = "linux")]
      if is_nvidia {
        use tauri::Manager;
        if let Some(win) = app.get_webview_window("main") {
          let _ = win.eval("document.documentElement.classList.add('no-backdrop-blur')");
        }
      }
      asset_scope::reregister_from_store(app.handle());
      tray::setup_tray(app.handle())?;
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      commands::store::get_theme,
      commands::store::set_theme,
      commands::store::get_settings,
      commands::store::set_settings,
      commands::store::get_tasks,
      commands::store::set_tasks,
      commands::store::get_active_task_id,
      commands::store::set_active_task_id,
      commands::store::get_music,
      commands::store::set_music,
      commands::store::get_stats,
      commands::store::set_stats,
      commands::music::pick_music_folder,
      commands::music::list_music_files,
      commands::tasks::export_tasks,
      commands::tasks::import_tasks,
      commands::store::pick_notification_sound,
      commands::window::set_always_on_top,
      commands::window::set_mini_mode,
      tray::update_tray_state
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
