# SP5 — Music Depth (Design)

**Sana:** 2026-06-10
**Status:** Approved (design)
**Roadmap:** Sub-project 5/7. SP1–SP4 done. Applies the Rust-settings/MusicConfig persistence lesson (SP3), the ref-for-stale-closure pattern (SP2 keybindings / use-timer callbacks), and the verify-API-via-context7 discipline (SP3 drag-drop). The largest sub-project.

## 1. Maqsad va qamrov
- **1. Track metadata** (artist/album/title) via Rust `lofty` crate.
- **2. Repeat modes** (off/all/one) + **in-folder search**.
- **3. Radio/YouTube robustness:** URL validation + retry + configurable yt-dlp timeout.
- **4. Ambient:** crossfade between sounds + separate volume slider UI.

## 2. Mavjud arxitektura (tasdiqlangan 2026-06-10)
- `use-music.tsx` (`MusicProvider`): `audioRef` (single `Audio`), `source` ('folder'|'youtube'|'radio'|null), `files: AudioFile[]`, `currentFileIndex`, `ytPlaylist`, `ytCurrentIndex`, `currentRadio`; `onended` listener (set once when the Audio is created) auto-advances via `advanceFolderTrack`/`advanceYtTrack` (both `useCallback`, currently `(prev+1)%length` = always-loop); `loadFolder/loadYoutube/playRadio/setVolume/next/prev`; `config: MusicConfig` persisted via `get_music`/`set_music`.
- `AudioFile = { name, url }` (TS) ← built from Rust `AudioFileRaw { name, path }` (frontend `convertFileSrc(path)` → url). `list_music_files(folder_path) -> Vec<AudioFileRaw>` (SYNC command).
- `MusicConfig` (TS + Rust `models::MusicConfig`, `#[serde(rename_all="camelCase", default)]` + explicit `Default` impl): folderPath, sortMode, youtubeUrl, volume, savedPlaylists, savedFolders, savedRadioStations.
- yt-dlp: `yt_get_stream(url) -> Result<YoutubeStreamInfo>` runs `run_yt_dlp(args, timeout_secs)` with **hardcoded `30`** for both the stream-args and title-args in a `tokio::join!`; `yt_get_playlist(url)`; `yt_check()`.
- `use-ambient.ts`: single `Audio`, effect keyed `[safeSound, safeVolume, isPlaying]`; switching sound = abrupt pause/new Audio/play. `settings.ambientSound`/`settings.ambientVolume` exist in TimerSettings; **no ambient UI in settings-panel**.
- **Rust MusicConfig persistence lesson (SP3):** any new TS `MusicConfig` field MUST be added to Rust `models::MusicConfig` struct + `Default` or `set_music` drops it.
- **lofty API (verified via context7, 2026-06-10):** `use lofty::prelude::*; use lofty::read_from_path;` → `read_from_path(path) -> Result<TaggedFile>`; `tagged_file.primary_tag().or_else(|| tagged_file.first_tag()) -> Option<&Tag>`; `Accessor` getters `tag.title()/.artist()/.album() -> Option<Cow<str>>`. `.ok()` makes a read failure non-fatal.

## 3. Dizayn — Area 1: Track metadata (lofty)

### Backend
- `Cargo.toml`: add `lofty` (recent version, e.g. `0.22`; implementer confirms a resolving version via `cargo build`).
- `AudioFileRaw` gains `#[serde(skip_serializing_if="Option::is_none")] artist/album/title: Option<String>`.
- `list_music_files` reads tags per file, **non-fatal per file**:
```rust
fn read_meta(path: &str) -> (Option<String>, Option<String>, Option<String>) {
  match lofty::read_from_path(path) {
    Ok(tf) => {
      let tag = tf.primary_tag().or_else(|| tf.first_tag());
      match tag {
        Some(t) => (t.title().map(|c| c.to_string()), t.artist().map(|c| c.to_string()), t.album().map(|c| c.to_string())),
        None => (None, None, None),
      }
    }
    Err(_) => (None, None, None), // unreadable/tagless → no metadata, never abort
  }
}
```
- **Performance (blocking-class):** tag-reading a large folder is CPU/IO heavy. Make `list_music_files` **async** and run the directory scan + tag loop inside `tauri::async_runtime::spawn_blocking` (or `tokio::task::spawn_blocking`) so it never freezes the UI/IPC thread. Frontend already `await`s it. (If spawn_blocking complicates path handling, the fallback is to keep it sync but the async+spawn_blocking form is the spec'd target.)

### Frontend
- `AudioFile` gains `artist?: string; album?: string; title?: string;`. Build them from the raw in the folder-load mapping.
- Display: now-playing (mini-widget + side-panel now-playing bar) shows `title ?? name` as the primary line and `artist` as a secondary line when present. **Never render "undefined — undefined"** — guard each field.

## 4. Dizayn — Area 2: Repeat modes + folder search

### Repeat modes
- `MusicConfig.repeatMode: 'off' | 'all' | 'one'` (default `'all'` — current behavior). **Rust `models::MusicConfig` struct + Default** gets `repeat_mode: ...` (mirror; a String or an enum `RepeatMode`). Use a Rust enum `RepeatMode { Off, All, One }` with `#[serde(rename_all="lowercase")]`, default `All`.
- **Stale-closure fix (blocking-class):** the `onended` handler is created once; `repeatMode` MUST be read through a ref kept current (the `use-timer` `onSessionCompleteRef` pattern): `const repeatModeRef = useRef(config.repeatMode); repeatModeRef.current = config.repeatMode;`. The `onended` handler and advance functions read `repeatModeRef.current` (NOT a captured value).
- **Semantics (pin precisely; apply to BOTH folder and YT advance):**
  - `one` → in `onended`: `audio.currentTime = 0; audio.play()`, do NOT change index.
  - `off` → advance to next; if currently at the LAST track, STOP (pause, do not wrap).
  - `all` → advance to next; wrap to 0 after the last.
  - `next`/`prev` buttons always advance/wrap regardless of repeatMode (explicit user action).
- UI: a repeat toggle button (cycles off→all→one) in the now-playing bar with a distinct icon/label per mode (lucide `Repeat` / `Repeat1`; dimmed for off).

### In-folder search
- Folder tab: a search input filtering the displayed track list by `name` + `title`/`artist` (when present), case-insensitive. Pure display filter (does not change `files`/playback indices — clicking a filtered result still plays the correct track by its real index/url).

## 5. Dizayn — Area 3: Radio/YouTube robustness

### URL validation (permissive)
- Radio "Add URL": require `^https?://` (trim); reject otherwise with inline error. (Stream content not validated client-side — playback error surfaces via the audio `error` event.)
- YouTube: before invoking yt-dlp, require the input to start with `http://`/`https://` (permissive — let yt-dlp be the real validator; do NOT over-reject `music.youtube.com`/`youtu.be`/playlist URLs).

### Configurable timeout
- `MusicConfig.ytTimeoutSecs: number` (default `30`). **Rust `models::MusicConfig` + Default** mirror (`yt_timeout_secs: u64`, default 30).
- `yt_get_stream(url, timeout_secs)` and `yt_get_playlist(url, timeout_secs)` gain a `timeout_secs: u64` param. **Replace ALL hardcoded `30`s** (the stream-args AND title-args inside the `tokio::join!`) with `timeout_secs`. Frontend passes `config.ytTimeoutSecs`.
- A NumberInput for `ytTimeoutSecs` (min 5, max 120) in the music side-panel YouTube tab (or settings — keep it in the YouTube tab, music-domain).

### Retry (specific op, not generic)
- On YT load failure (`ytError` state) or radio playback failure, show a "Qayta urinish" button that re-runs the SPECIFIC failed op: `loadYoutube(lastUrl)` / `playRadio(lastStation)`. Store just enough to re-invoke (the url/station already in state). No generic "last action" abstraction (YAGNI).
- Folder track audio `error` event: surface a small error + the existing skip/next still works.

## 6. Dizayn — Area 4: Ambient crossfade + volume slider

### Crossfade (decompose the three triggers — blocking-class)
Rewrite `use-ambient.ts`. Do NOT keep one effect keyed on `[sound, volume, isPlaying]` (that crossfades on a volume tick and runs concurrent fades on rapid flips). Instead:
- **Two Audio refs:** `currentRef` (active) + `prevRef` (fading out). A `fadeRef` holds the in-flight interval/raf id.
- **sound-change** → crossfade: move `currentRef` → `prevRef` (fade its volume → 0 then pause/null), create the new Audio in `currentRef` (volume 0 → target), run ONE fade interval (~800ms, ~16 steps). **Cancel any in-flight `fadeRef` before starting a new one** (clear interval) and on unmount.
- **volume-change** → set `currentRef.current.volume` directly to the target gain (NO fade).
- **isPlaying-change** → `play()`/`pause()` the current element (no fade).
Implement as separate effects (one per dependency concern) so a volume tick never triggers a crossfade. Guard against `sound==='none'` (fade out + stop). Clamp volume 0..1 (existing `safeVolume`).

### Volume slider + sound selector UI
- Settings panel: an "Ambient" section with a sound selector (none/rain/forest/cafe — segmented buttons like `language`) bound to `settings.ambientSound`, and a volume slider (range input 0..1, step 0.05) bound to `settings.ambientVolume`. (Both fields already exist in TimerSettings; this is UI only — no new settings.)

## 7. Settings / Rust mirroring (SP3 LESSON — mandatory)
Two new **MusicConfig** fields (NOT TimerSettings): `repeatMode`, `ytTimeoutSecs`.
- TS: `src/shared/types.ts` `MusicConfig` interface + `DEFAULT_MUSIC_CONFIG` + `export type RepeatMode = 'off'|'all'|'one'`.
- **Rust `src-tauri/src/models.rs` `MusicConfig` struct + Default**: `repeat_mode: RepeatMode` (new Rust enum, default `All`), `yt_timeout_secs: u64` (default 30).
- No `settings_roundtrip` test for MusicConfig exists; add a small Rust round-trip test for `MusicConfig` asserting `repeatMode`/`ytTimeoutSecs` survive (mirror the TimerSettings test).

## 8. Components / files
- `src-tauri/Cargo.toml` — add `lofty`.
- `src-tauri/src/models.rs` — AudioFileRaw metadata fields; MusicConfig `repeat_mode`+`yt_timeout_secs`+Default; `RepeatMode` enum; MusicConfig roundtrip test.
- `src-tauri/src/commands/music.rs` — `list_music_files` async + lofty tag read (non-fatal); `yt_get_stream`/`yt_get_playlist` timeout param (replace all 30s).
- `src/shared/types.ts` — `RepeatMode`, MusicConfig fields + DEFAULT, AudioFile metadata fields.
- `src/shared/tauri/music.ts` — `ytGetStream(url, timeoutSecs)`/`ytGetPlaylist(url, timeoutSecs)` signatures; `listMusicFiles` stays (returns metadata now).
- `src/renderer/hooks/use-music.tsx` — repeatModeRef + onended/advance semantics; build AudioFile metadata; retry state; pass timeout.
- `src/renderer/hooks/use-ambient.ts` — crossfade rewrite (decomposed effects + fadeRef).
- `src/renderer/components/music-side-panel.tsx` (+ `music-mini-widget.tsx`, `music-panel.tsx`) — metadata display, repeat button, folder search, URL validation, retry button, timeout input.
- `src/renderer/components/settings-panel.tsx` — ambient sound selector + volume slider.
- `src/shared/i18n/{uz,en,ru}.ts` — new keys (repeat modes, search, invalid URL, retry, timeout, ambient labels).

## 9. Error handling / edge-cases
- Metadata: per-file read failure → None (listing continues); display falls back to filename.
- Large folder: async + spawn_blocking avoids UI freeze.
- repeatMode read via ref (no stale closure); `off` stops at last track only.
- Crossfade: in-flight fade cancelled on new transition/unmount; volume changes don't fade.
- Invalid URL → inline error, no backend call. yt-dlp timeout/failure → ytError + retry button.
- Old persisted MusicConfig without new fields → Rust `default` fills them.

## 10. Testlash / verifikatsiya
- `bash -c 'bun run typecheck'` + `bun run build:vite` green; `bun run check:i18n` parity OK; `bash -c 'cd src-tauri && cargo test'` (incl. new MusicConfig roundtrip) + `cargo build` (lofty resolves/compiles).
- i18n leftover sweep (literal + expr).
- **Manual (`bun run dev`):**
  - Metadata: a tagged folder shows Title — Artist; a tagless/odd file shows filename (no "undefined"); large folder loads without freezing.
  - Repeat: `one` replays the track; `off` stops after the last track; `all` loops; next/prev always move; mode persists across restart.
  - Folder search filters the list; clicking a result plays the right track.
  - URL validation rejects non-http; yt-dlp timeout setting takes effect; retry re-runs the failed load.
  - Ambient: switching sound crossfades (no abrupt cut); volume slider changes gain without a fade; selector + slider persist.

## 11. Non-goals
- New ambient sound ASSETS (.mp3 files) — only existing 3; adding types deferred (assets must be supplied separately).
- Album art / waveform / true frequency visualizer (SP6).
- Editing/writing tags (read-only metadata).
- Gapless playback / true crossfade between MUSIC tracks (ambient crossfade only).
- yt-dlp auto-install.
