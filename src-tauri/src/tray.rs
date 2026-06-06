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
