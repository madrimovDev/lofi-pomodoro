use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
  Dark,
  Light,
}

impl Default for Theme {
  fn default() -> Self {
    Theme::Dark
  }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AmbientSound {
  None,
  Rain,
  Forest,
  Cafe,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MusicSortMode {
  Shuffle,
  Alphabetical,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Locale {
  Uz,
  En,
  Ru,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
  High,
  Medium,
  Low,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TrayMode {
  Focus,
  ShortBreak,
  LongBreak,
}

#[cfg(test)]
mod tests {
  use super::*;
  use serde_json::json;

  #[test]
  fn enum_values_match_ts() {
    assert_eq!(serde_json::to_value(Theme::Dark).unwrap(), json!("dark"));
    assert_eq!(serde_json::to_value(AmbientSound::Cafe).unwrap(), json!("cafe"));
    assert_eq!(serde_json::to_value(MusicSortMode::Shuffle).unwrap(), json!("shuffle"));
    assert_eq!(serde_json::to_value(Locale::Uz).unwrap(), json!("uz"));
    assert_eq!(serde_json::to_value(Priority::High).unwrap(), json!("high"));
    // kebab-case — eng muhim trap
    assert_eq!(serde_json::to_value(TrayMode::ShortBreak).unwrap(), json!("short-break"));
    assert_eq!(serde_json::to_value(TrayMode::LongBreak).unwrap(), json!("long-break"));
  }

  #[test]
  fn enum_deserialize_from_ts() {
    let m: TrayMode = serde_json::from_value(json!("short-break")).unwrap();
    assert_eq!(m, TrayMode::ShortBreak);
    let t: Theme = serde_json::from_value(json!("dark")).unwrap();
    assert_eq!(t, Theme::Dark);
  }
}
