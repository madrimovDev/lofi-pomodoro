use std::sync::Mutex;

/// Oyna/ilova bo'ylab umumiy holat. `tauri::State` orqali kiriladi.
#[derive(Default)]
pub struct AppState {
  pub inner: Mutex<AppStateInner>,
}

#[derive(Default)]
pub struct AppStateInner {
  /// Haqiqiy chiqish jarayonidami (tray "Chiqish") — close-to-tray'ni o'tkazib yuborish uchun.
  pub is_quitting: bool,
  /// Always-on-top yoqilganmi (Linux blur reapply uchun).
  pub always_on_top: bool,
  /// Mini-rejimdami.
  pub mini_mode: bool,
  /// Mini-rejimdan oldingi normal o'lcham (width, height) — qaytarish uchun.
  pub normal_size: Option<(f64, f64)>,
  /// Mini-rejimdan oldingi normal min-o'lcham (width, height).
  pub normal_min_size: Option<(f64, f64)>,
  /// Mini-rejimga kirishdan oldingi always-on-top holati.
  pub mini_was_always_on_top: bool,
  /// Tray icon/menu'ni faqat o'zgarganda qayta qurish uchun oldingi holat.
  pub prev_mode: Option<String>,
  pub prev_running: Option<bool>,
  /// Tanaffus overlay'idan oldingi holat: (was_hidden, was_mini, was_aot). None = overlay faol emas.
  pub pre_break: Option<(bool, bool, bool)>,
}
