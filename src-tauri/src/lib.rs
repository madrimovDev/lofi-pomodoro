mod models;
mod store_util;

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
    .plugin(tauri_plugin_store::Builder::default().build())
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
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
