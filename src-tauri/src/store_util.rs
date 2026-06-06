use serde::de::DeserializeOwned;
use serde_json::Value;

/// Store'dan o'qilgan qiymatni `T`ga deserialize qiladi. Qiymat yo'q (`None`)
/// yoki buzilgan bo'lsa — `T::default()` qaytaradi (warn log). Bitta yomon
/// yozuv ilovani "bricklab" qo'ymasligi uchun.
pub fn deserialize_or_default<T>(key: &str, value: Option<Value>) -> T
where
  T: DeserializeOwned + Default,
{
  match value {
    Some(v) => serde_json::from_value(v).unwrap_or_else(|e| {
      log::warn!("store kaliti '{key}' deserialize bo'lmadi: {e}; default ishlatilmoqda");
      T::default()
    }),
    None => T::default(),
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::models::{Theme, TimerSettings};
  use serde_json::json;

  #[test]
  fn missing_value_returns_default() {
    let t: Theme = deserialize_or_default("theme", None);
    assert_eq!(t, Theme::Dark);
    let s: TimerSettings = deserialize_or_default("settings", None);
    assert_eq!(s, TimerSettings::default());
  }

  #[test]
  fn valid_value_deserializes() {
    let t: Theme = deserialize_or_default("theme", Some(json!("light")));
    assert_eq!(t, Theme::Light);
  }

  #[test]
  fn corrupt_value_returns_default() {
    // noto'g'ri enum varianti
    let t: Theme = deserialize_or_default("theme", Some(json!("rainbow")));
    assert_eq!(t, Theme::Dark);
    // butunlay noto'g'ri tip
    let s: TimerSettings = deserialize_or_default("settings", Some(json!("oops")));
    assert_eq!(s, TimerSettings::default());
  }
}
