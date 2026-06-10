# Music Depth (SP5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add track metadata (artist/album/title via lofty), repeat modes + in-folder search, radio/YouTube URL validation + retry + configurable yt-dlp timeout, and ambient crossfade + volume-slider UI.

**Architecture:** Backend gains a `lofty` dependency for tag reading (async, non-fatal per file) and a timeout param on the yt-dlp commands; `MusicConfig` gains two mirrored fields (`repeatMode`, `ytTimeoutSecs`). Frontend reworks `use-music` advance logic via a ref (no stale closure) and rewrites `use-ambient` for crossfade with decomposed effects. Highest-risk tasks (lofty/metadata, crossfade) are isolated.

**Tech Stack:** TypeScript, React 19, Vite, Tauri v2, Rust (`lofty`). **BUN**: `bash -c 'bun run typecheck'`, `bash -c 'bun run check:i18n'`, `bash -c 'bun run build:vite'`; Rust: `bash -c 'cd src-tauri && cargo test'` / `cargo build`. (`bash -c` avoids a zsh quirk.)

**Reference spec:** `docs/superpowers/specs/2026-06-10-music-depth-design.md`

## Conventions (verified)
- Translator: `useSettings().t`; in `music-side-panel.tsx` it's `t`, in `music-panel.tsx` it's `tFn` (local `t` tab-id clash). New i18n keys → all 3 `src/shared/i18n/{uz,en,ru}.ts`; `bun run check:i18n` enforces parity.
- Aliases `@shared/*`/`@renderer/*` (no `@/*`).
- **Rust persistence lesson (SP3):** new TS `MusicConfig` fields MUST be added to Rust `models::MusicConfig` struct + `Default` or `set_music` drops them.
- **lofty API (context7-verified):** `lofty::read_from_path(path) -> Result<TaggedFile>`; `tf.primary_tag().or_else(|| tf.first_tag()) -> Option<&Tag>`; `use lofty::prelude::*;` brings the `Accessor` trait → `tag.title()/.artist()/.album() -> Option<Cow<str>>`.
- `use-music.tsx`: single `audioRef`; `onended` listener set once at Audio creation; `advanceFolderTrack`/`advanceYtTrack` are useCallbacks doing `(prev+1)%length`. `config` from `MusicConfig`.
- `music.rs`: `list_music_files` is `pub fn` (sync); `yt_get_stream` has THREE hardcoded `30`s (`tokio::join!` of stream/title/live); `yt_get_playlist` uses `60`. `run_yt_dlp(app, args, timeout_secs)`.
- `music.ts`: `ytGetStream(url)`/`ytGetPlaylist(url)` wrappers; `listMusicFiles` maps `AudioFileRaw{name,path}` → `AudioFile{name,url}` via `convertFileSrc`.

## File Structure
- `src-tauri/Cargo.toml` — `lofty` dep (T2).
- `src-tauri/src/models.rs` — `RepeatMode` enum, MusicConfig 2 fields + Default + roundtrip test (T1); AudioFileRaw metadata fields (T2).
- `src-tauri/src/commands/music.rs` — list_music_files async + tags (T2); yt timeout param (T5).
- `src-tauri/src/lib.rs` — (no new commands; signatures unchanged names).
- `src/shared/types.ts` — RepeatMode, MusicConfig fields+DEFAULT (T1); AudioFile metadata (T2).
- `src/shared/tauri/music.ts` — timeout params (T5); AudioFileRaw+mapping metadata (T2).
- `src/renderer/hooks/use-music.tsx` — repeat ref + advance semantics (T4); timeout pass + retry (T5).
- `src/renderer/hooks/use-ambient.ts` — crossfade rewrite (T6).
- `src/renderer/components/music-side-panel.tsx` (+ `music-mini-widget.tsx`, `music-panel.tsx`) — metadata display (T3), repeat button + folder search (T4), URL validation + retry + timeout input (T5).
- `src/renderer/components/settings-panel.tsx` — ambient selector + volume slider (T6).
- `src/shared/i18n/{uz,en,ru}.ts` — new keys per task.

---

## Task 1: MusicConfig settings (repeatMode + ytTimeoutSecs) — TS + Rust mirror

**Files:** modify `src/shared/types.ts`, `src-tauri/src/models.rs`

- [ ] **Step 1: TS — RepeatMode + MusicConfig fields**

In `src/shared/types.ts`:
- Add near `MusicSortMode`: `export type RepeatMode = 'off' | 'all' | 'one';`
- `interface MusicConfig`: add `repeatMode: RepeatMode;` and `ytTimeoutSecs: number;`
- `DEFAULT_MUSIC_CONFIG`: add `repeatMode: 'all',` and `ytTimeoutSecs: 30,`

- [ ] **Step 2: Rust — RepeatMode enum + MusicConfig mirror**

In `src-tauri/src/models.rs`:
- Add a `RepeatMode` enum (near `MusicSortMode`):
```rust
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum RepeatMode {
  Off,
  #[default]
  All,
  One,
}
```
- `MusicConfig` struct: add `pub repeat_mode: RepeatMode,` and `pub yt_timeout_secs: u64,`
- `Default for MusicConfig`: add `repeat_mode: RepeatMode::All,` and `yt_timeout_secs: 30,`

- [ ] **Step 3: Rust roundtrip test for MusicConfig**

Add to a `#[cfg(test)] mod tests` in `models.rs` (the file already has a tests module — add this test there; it uses `serde_json::json`):
```rust
  #[test]
  fn music_config_roundtrip_preserves_new_fields() {
    let json = serde_json::json!({
      "folderPath": null, "sortMode": "shuffle", "youtubeUrl": null, "volume": 0.5,
      "savedPlaylists": [], "savedFolders": [], "savedRadioStations": [],
      "repeatMode": "one", "ytTimeoutSecs": 45
    });
    let c: MusicConfig = serde_json::from_value(json).unwrap();
    assert_eq!(c.repeat_mode, RepeatMode::One);
    assert_eq!(c.yt_timeout_secs, 45);
    let back = serde_json::to_value(&c).unwrap();
    assert_eq!(back["repeatMode"], "one");
    assert_eq!(back["ytTimeoutSecs"], 45);
  }
```

- [ ] **Step 4: Verify**

`bash -c 'bun run typecheck'` → PASS. `bash -c 'cd src-tauri && cargo test'` → all pass incl. `music_config_roundtrip_preserves_new_fields`.

- [ ] **Step 5: Commit**

```bash
git add src/shared/types.ts src-tauri/src/models.rs
git commit -m "feat(music): repeatMode + ytTimeoutSecs in MusicConfig (TS + Rust persist)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Track metadata backend (lofty) — HIGHEST RISK, isolated

**Files:** modify `src-tauri/Cargo.toml`, `src-tauri/src/models.rs`, `src-tauri/src/commands/music.rs`, `src/shared/types.ts`, `src/shared/tauri/music.ts`

- [ ] **Step 1: Add lofty dependency**

```bash
bash -c 'cd src-tauri && cargo add lofty'
```
(Use `cargo add` so it pins a current resolving version; do NOT hand-write a version guess.)

- [ ] **Step 2: AudioFileRaw metadata fields (Rust)**

In `src-tauri/src/models.rs`, `AudioFileRaw` struct — add after `path`:
```rust
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub artist: Option<String>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub album: Option<String>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub title: Option<String>,
```

- [ ] **Step 3: list_music_files — async + lofty tags (non-fatal per file)**

In `src-tauri/src/commands/music.rs`:
- Add a helper (above `list_music_files`):
```rust
/// Reads (title, artist, album) tags; any failure → all None (never aborts the listing).
fn read_meta(path: &str) -> (Option<String>, Option<String>, Option<String>) {
  use lofty::prelude::*;
  match lofty::read_from_path(path) {
    Ok(tf) => match tf.primary_tag().or_else(|| tf.first_tag()) {
      Some(t) => (
        t.title().map(|c| c.to_string()),
        t.artist().map(|c| c.to_string()),
        t.album().map(|c| c.to_string()),
      ),
      None => (None, None, None),
    },
    Err(_) => (None, None, None),
  }
}
```
- Convert `list_music_files` to async + offload the scan/tag loop to a blocking thread (avoids freezing the UI on large folders):
```rust
#[tauri::command]
pub async fn list_music_files(app: AppHandle, folder_path: String) -> Vec<AudioFileRaw> {
  asset_scope::allow_path(&app, &folder_path);
  tauri::async_runtime::spawn_blocking(move || {
    let Ok(entries) = std::fs::read_dir(&folder_path) else { return Vec::new(); };
    entries
      .flatten()
      .filter(|e| e.file_type().map(|t| t.is_file()).unwrap_or(false))
      .filter_map(|e| {
        let name = e.file_name().to_string_lossy().to_string();
        if !is_audio_file(&name) { return None; }
        let path = e.path().to_string_lossy().to_string();
        let (title, artist, album) = read_meta(&path);
        Some(AudioFileRaw { name, path, artist, album, title })
      })
      .collect()
  })
  .await
  .unwrap_or_default()
}
```
> `asset_scope::allow_path` stays on the command thread (needs `&app`); the blocking closure only does fs + lofty (no `app`). `spawn_blocking` returns a `JoinHandle`; `.await.unwrap_or_default()` yields `Vec::new()` if the task panics.

- [ ] **Step 4: TS types + mapping**

In `src/shared/types.ts`, `interface AudioFile`: add `artist?: string; album?: string; title?: string;`
In `src/shared/tauri/music.ts`:
- Extend the local `AudioFileRaw` interface: `interface AudioFileRaw { name: string; path: string; artist?: string; album?: string; title?: string; }`
- Update the map in `listMusicFiles`:
```ts
    return raw.map(f => ({ name: f.name, url: convertFileSrc(f.path), artist: f.artist, album: f.album, title: f.title }));
```

- [ ] **Step 5: Verify**

`bash -c 'cd src-tauri && cargo build'` → compiles (lofty resolves). `bash -c 'cd src-tauri && cargo test'` → pass. `bash -c 'bun run typecheck'` → PASS.
> If `cargo build` fails on the lofty API (version skew), check the installed version's docs for `read_from_path`/`primary_tag`/`Accessor` and adjust; the verified API is `read_from_path` + `primary_tag().or_else(first_tag())` + `Accessor` getters returning `Option<Cow<str>>`.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/models.rs src-tauri/src/commands/music.rs src/shared/types.ts src/shared/tauri/music.ts
git commit -m "feat(music): read track metadata (artist/album/title) via lofty, async listing

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Metadata display (now-playing)

**Files:** modify `src/renderer/components/music-mini-widget.tsx`, `src/renderer/components/music-side-panel.tsx`

- [ ] **Step 1: Compute a display label helper**

Where the current folder track name is shown (mini-widget and side-panel now-playing bar), the track is `files[currentFileIndex]` (an `AudioFile` with optional `title`/`artist`). Render:
- Primary line: `track.title ?? track.name`
- Secondary line (only if `track.artist`): `track.artist`

In `music-mini-widget.tsx`: find where the track name string is derived (the marquee text). Change it to `track.title ?? track.name`. If artist is present, append ` — ${track.artist}` to the marquee text OR show a small secondary line (whichever fits the existing single-line marquee — simplest: `track.artist ? `${track.title ?? track.name} — ${track.artist}` : (track.title ?? track.name)`). NEVER produce "undefined" — guard each field.

In `music-side-panel.tsx` now-playing area: same — primary `title ?? name`, optional artist secondary line.
> Only folder tracks have metadata; YouTube/radio keep their existing title/name. Apply the metadata display only on the folder `source` path (or guard: the fields are simply absent for yt/radio, so `title ?? name` still works).

- [ ] **Step 2: Verify**

`bash -c 'bun run typecheck'` → PASS. Read diff: no `undefined` can render (each field guarded).

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/music-mini-widget.tsx src/renderer/components/music-side-panel.tsx
git commit -m "feat(music): show track title/artist metadata in now-playing

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Repeat modes (ref-based) + in-folder search

**Files:** modify `src/renderer/hooks/use-music.tsx`, `src/renderer/components/music-side-panel.tsx`, `src/shared/i18n/{uz,en,ru}.ts`

- [ ] **Step 1: i18n (all 3 locales)**

uz.ts: `repeatOff: 'Takror: o\'chiq',` `repeatAll: 'Takror: hammasi',` `repeatOne: 'Takror: bitta',` `searchTracks: 'Trek qidirish...',`
en.ts: `repeatOff: 'Repeat: off',` `repeatAll: 'Repeat: all',` `repeatOne: 'Repeat: one',` `searchTracks: 'Search tracks...',`
ru.ts: `repeatOff: 'Повтор: выкл',` `repeatAll: 'Повтор: все',` `repeatOne: 'Повтор: один',` `searchTracks: 'Поиск треков...',`

- [ ] **Step 2: use-music — repeatMode ref + advance semantics**

In `use-music.tsx`:
- Add a ref kept current (stale-closure fix): near the other refs, `const repeatModeRef = useRef(config.repeatMode); repeatModeRef.current = config.repeatMode;`
- In the Audio `onended` handler (created once when the Audio element is made), read `repeatModeRef.current`:
  - `'one'` → `const a = audioRef.current; if (a) { a.currentTime = 0; a.play().catch(() => {}); } return;` (do NOT advance)
  - else call the existing advance (folder or yt) which must honor `'off'` vs `'all'` (Step 3).
- Add a `setRepeatMode(mode: RepeatMode)` to the context that does `updateConfig({ repeatMode: mode })` (mirror how other config setters persist). Add `repeatMode: config.repeatMode` and `setRepeatMode` to the context value + interface + default.

- [ ] **Step 3: advance honors off/all (both folder + YT)**

Rewrite `advanceFolderTrack` and `advanceYtTrack` to read `repeatModeRef.current` and stop at the end for `'off'`:
```ts
  const advanceFolderTrack = useCallback(() => {
    setCurrentFileIndex(prev => {
      const last = files.length - 1;
      if (prev >= last) {
        if (repeatModeRef.current === 'off') { audioRef.current?.pause(); return prev; } // stop at end
        loadFolderTrack(0); return 0; // 'all' wrap
      }
      const next = prev + 1; loadFolderTrack(next); return next;
    });
  }, [files.length]);
```
Apply the SAME shape to `advanceYtTrack` (using `ytPlaylist.length`, `loadYtTrack`/its loader, `setYtCurrentIndex`). The `next`/`prev` BUTTON handlers keep wrapping unconditionally (explicit user action) — do NOT gate them on repeatMode.
> `'one'` is handled in `onended` (Step 2), so advance only sees `'off'`/`'all'`.

- [ ] **Step 4: Repeat button UI + folder search**

In `music-side-panel.tsx`:
- Import `Repeat`, `Repeat1` from `lucide-react`. Add a repeat toggle button in the now-playing controls: cycles `off → all → one → off`; icon = `Repeat` (dimmed for off, normal for all) / `Repeat1` (for one); `aria-label`/`title` = `t(repeatMode==='off'?'repeatOff':repeatMode==='all'?'repeatAll':'repeatOne')`. onClick: `setRepeatMode(next)`.
- Folder tab: add a search input (above the track list) with `placeholder={t('searchTracks')}`; filter the displayed folder tracks by `name`/`title`/`artist` (case-insensitive). The filter is display-only — clicking a result must call the existing play handler with the track's REAL index in `files` (find by url/identity), not the filtered index.

- [ ] **Step 5: Verify**

`bash -c 'bun run check:i18n'` → parity OK. `bash -c 'bun run typecheck'` → PASS. Read diff: `onended` reads `repeatModeRef.current`; `off` stops at last; `all` wraps; `one` replays; next/prev unconditional.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/hooks/use-music.tsx src/renderer/components/music-side-panel.tsx src/shared/i18n/
git commit -m "feat(music): repeat modes (off/all/one) via ref + in-folder search

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: yt-dlp timeout + URL validation + retry

**Files:** modify `src-tauri/src/commands/music.rs`, `src/shared/tauri/music.ts`, `src/renderer/hooks/use-music.tsx`, `src/renderer/components/music-side-panel.tsx`, `src/shared/i18n/{uz,en,ru}.ts`

- [ ] **Step 1: Rust — timeout param (replace ALL hardcoded values)**

In `src-tauri/src/commands/music.rs`:
- `yt_get_stream`: add `timeout_secs: u64` param; replace ALL THREE `run_yt_dlp(&app, &..., 30)` calls in the `tokio::join!` with `timeout_secs`:
```rust
pub async fn yt_get_stream(app: AppHandle, url: String, timeout_secs: u64) -> Result<YoutubeStreamInfo, String> {
  // ...args unchanged...
  let (stream, title, live) = tokio::join!(
    run_yt_dlp(&app, &stream_args, timeout_secs),
    run_yt_dlp(&app, &title_args, timeout_secs),
    run_yt_dlp(&app, &live_args, timeout_secs),
  );
  // ...rest unchanged...
}
```
- `yt_get_playlist`: add `timeout_secs: u64` param; replace the `60` with `timeout_secs`.
(Commands stay registered under the same names; only signatures change. The Tauri arg name for `timeout_secs` is `timeoutSecs` on the JS side via camelCase.)

- [ ] **Step 2: music.ts — pass timeout**

In `src/shared/tauri/music.ts`:
```ts
  ytGetStream: (url: string, timeoutSecs: number): Promise<YoutubeStreamInfo | { error: string }> =>
    invoke<YoutubeStreamInfo>('yt_get_stream', { url, timeoutSecs })
      .catch((e: unknown) => ({ error: typeof e === 'string' ? e : 'Xatolik yuz berdi' })),
  ytGetPlaylist: (url: string, timeoutSecs: number): Promise<YoutubePlaylistItem[] | { error: string }> =>
    invoke<YoutubePlaylistItem[]>('yt_get_playlist', { url, timeoutSecs })
      .catch((e: unknown) => ({ error: typeof e === 'string' ? e : 'Xatolik yuz berdi' })),
```

- [ ] **Step 3: use-music — pass config.ytTimeoutSecs + validation + retry**

In `use-music.tsx`:
- Every `musicApi.ytGetStream(url)` / `musicApi.ytGetPlaylist(url)` call → pass `config.ytTimeoutSecs ?? 30` as the 2nd arg.
- `loadYoutube(url)`: at the top, validate `if (!/^https?:\/\//i.test(url.trim())) { setYtError(t? or a code); return; }` — set the existing yt-error state to an "invalid URL" indicator (use a sentinel the UI maps to `t('invalidUrl')`). Keep `lastYtUrl` (already in state as the input/url) available so retry can re-invoke `loadYoutube(lastUrl)`.
> The hook does not have `t`; set a structured error (e.g. `ytError = 'invalid'` vs a message). The COMPONENT renders the localized text. If the hook currently stores an error string, store a code (`'invalid'`) and let the component translate; keep existing error strings working.

- [ ] **Step 4: music-side-panel — validation message + retry button + timeout input**

In `music-side-panel.tsx` (uses `t`):
- Radio "Add URL" submit: validate `^https?://` (trim) before `addRadioStation`; on fail show inline `t('invalidUrl')`, don't add.
- YouTube tab: when there's a yt error, show a "Qayta urinish" button (`t('retry')` — existing key) that calls `loadYoutube(currentYtUrl)`; if the error is the invalid-URL code, show `t('invalidUrl')` instead of a generic message.
- Add a small NumberInput-like control for the yt timeout in the YouTube tab bound to `config.ytTimeoutSecs` (min 5, max 120) → `updateConfig({ ytTimeoutSecs: v })`. Label `t('ytTimeout')`.

i18n (all 3 locales): uz `invalidUrl: 'Yaroqsiz URL',` `ytTimeout: 'Timeout (s)',` ; en `invalidUrl: 'Invalid URL',` `ytTimeout: 'Timeout (s)',` ; ru `invalidUrl: 'Неверный URL',` `ytTimeout: 'Таймаут (с)',`
(Reuse existing `retry`='Qayta urinish' for the retry button.)

- [ ] **Step 5: Verify**

`bash -c 'cd src-tauri && cargo build'` + `cargo test` → pass. `bash -c 'bun run check:i18n'` → parity OK. `bash -c 'bun run typecheck'` → PASS. Confirm NO hardcoded `30`/`60` timeout remains in `yt_get_stream`/`yt_get_playlist` (`bash -c "grep -nE 'run_yt_dlp.*(30|60)' src-tauri/src/commands/music.rs || echo CLEAN"`).

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/commands/music.rs src/shared/tauri/music.ts src/renderer/hooks/use-music.tsx src/renderer/components/music-side-panel.tsx src/shared/i18n/
git commit -m "feat(music): configurable yt-dlp timeout + URL validation + retry

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Ambient crossfade + volume slider UI — HIGHEST RISK, isolated

**Files:** modify `src/renderer/hooks/use-ambient.ts`, `src/renderer/components/settings-panel.tsx`, `src/shared/i18n/{uz,en,ru}.ts`

- [ ] **Step 1: Rewrite use-ambient with decomposed effects + crossfade**

Replace `src/renderer/hooks/use-ambient.ts` with a version that separates the three triggers (a volume tick must NOT crossfade; rapid sound flips must not run concurrent fades):
```ts
import { useEffect, useRef } from 'react';
import { type AmbientSound } from '@shared/types';

const FADE_MS = 800;
const FADE_STEPS = 16;

export function useAmbient(sound: AmbientSound | undefined, volume: number | undefined, isPlaying: boolean) {
  const currentRef = useRef<HTMLAudioElement | null>(null);
  const soundRef = useRef<AmbientSound>('none');
  const fadeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const safeVolume = typeof volume === 'number' && isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0.4;
  const safeSound = sound ?? 'none';

  const cancelFade = () => { if (fadeRef.current) { clearInterval(fadeRef.current); fadeRef.current = null; } };

  // sound-change → crossfade
  useEffect(() => {
    if (soundRef.current === safeSound) return;
    cancelFade();
    const old = currentRef.current;
    const target = safeVolume;

    if (safeSound === 'none') {
      // fade out + stop
      let v = old?.volume ?? 0;
      fadeRef.current = setInterval(() => {
        v -= target / FADE_STEPS;
        if (old) old.volume = Math.max(0, v);
        if (v <= 0) { cancelFade(); old?.pause(); currentRef.current = null; }
      }, FADE_MS / FADE_STEPS);
      soundRef.current = 'none';
      return;
    }

    const next = new Audio(`/${safeSound}.mp3`);
    next.loop = true;
    next.volume = 0;
    currentRef.current = next;
    soundRef.current = safeSound;
    if (isPlaying) next.play().catch(() => {});

    let step = 0;
    fadeRef.current = setInterval(() => {
      step++;
      const f = step / FADE_STEPS;
      next.volume = Math.min(target, target * f);
      if (old) old.volume = Math.max(0, target * (1 - f));
      if (step >= FADE_STEPS) { cancelFade(); old?.pause(); next.volume = target; }
    }, FADE_MS / FADE_STEPS);
  }, [safeSound]);

  // volume-change → set directly, NO fade
  useEffect(() => {
    if (currentRef.current && !fadeRef.current) currentRef.current.volume = safeVolume;
  }, [safeVolume]);

  // isPlaying-change → play/pause
  useEffect(() => {
    const a = currentRef.current;
    if (!a) return;
    if (isPlaying) a.play().catch(() => {}); else a.pause();
  }, [isPlaying]);

  // unmount cleanup
  useEffect(() => () => { cancelFade(); currentRef.current?.pause(); currentRef.current = null; }, []);
}
```
> Notes: `[safeSound]` is the only crossfade trigger; volume sets gain directly (guarded `!fadeRef.current` so it doesn't fight an in-flight fade); fade interval stored in `fadeRef` and cancelled on every new transition + unmount. `none` fades out. This is a deliberate behavior-preserving rewrite — do NOT reintroduce the `[sound,volume,isPlaying]` combined effect.

- [ ] **Step 2: Ambient UI in settings**

In `settings-panel.tsx`, add an "Ambient" section (with a divider) — a sound selector (segmented buttons like the `language` section) + a volume slider:
```tsx
            <div className="h-px bg-border/50" />
            <div className="flex flex-col gap-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground/60">{t('ambient')}</p>
              <div className="flex gap-1">
                {(['none','rain','forest','cafe'] as const).map(s => (
                  <button key={s} onClick={() => updateSettings({ ambientSound: s })}
                    className={`px-2 py-0.5 rounded-md text-[10px] transition-colors duration-150 border ${
                      (settings.ambientSound ?? 'none') === s
                        ? 'bg-primary/20 border-primary/40 text-foreground'
                        : 'border-border/50 text-muted-foreground/60 hover:border-border hover:text-muted-foreground'
                    }`}>
                    {t(s === 'none' ? 'ambientNone' : s === 'rain' ? 'ambientRain' : s === 'forest' ? 'ambientForest' : 'ambientCafe')}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm text-foreground/80 select-none">{t('ambientVolume')}</label>
                <input type="range" min={0} max={1} step={0.05} value={settings.ambientVolume ?? 0.4}
                  onChange={e => updateSettings({ ambientVolume: parseFloat(e.target.value) })}
                  className="w-28 accent-primary" />
              </div>
            </div>
```
i18n (all 3 locales): uz `ambient: 'Ambient ovoz',` `ambientNone: 'Yo\'q',` `ambientRain: 'Yomg\'ir',` `ambientForest: 'O\'rmon',` `ambientCafe: 'Kafe',` `ambientVolume: 'Ambient ovoz balandligi',` ; en `ambient: 'Ambient sound',` `ambientNone: 'None',` `ambientRain: 'Rain',` `ambientForest: 'Forest',` `ambientCafe: 'Cafe',` `ambientVolume: 'Ambient volume',` ; ru `ambient: 'Эмбиент',` `ambientNone: 'Нет',` `ambientRain: 'Дождь',` `ambientForest: 'Лес',` `ambientCafe: 'Кафе',` `ambientVolume: 'Громкость эмбиента',`

- [ ] **Step 3: Verify**

`bash -c 'bun run check:i18n'` → parity OK. `bash -c 'bun run typecheck'` → PASS.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/hooks/use-ambient.ts src/renderer/components/settings-panel.tsx src/shared/i18n/
git commit -m "feat(music): ambient crossfade + sound selector & volume slider UI

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Green gates**

```bash
cd /home/madrimov/Projects/lofi-pomodoro
bash -c 'bun run check:i18n' && bash -c 'bun run typecheck' && bash -c 'bun run build:vite'
bash -c 'cd src-tauri && cargo test' && bash -c 'cd src-tauri && cargo build'
```
Expected: parity OK, typecheck PASS, build succeeds, cargo tests pass (incl. `music_config_roundtrip_preserves_new_fields`), cargo build clean.

- [ ] **Step 2: i18n leftover sweep (literal + expr)**

```bash
grep -rnE 'placeholder="|aria-label="|title="' src/renderer/components src/renderer/app || echo "NONE-literal"
grep -rnE "aria-label=\{[^}]*'[^']+'|title=\{[^}]*'[^']+'" src/renderer/components src/renderer/app | grep -vE "t\(|tFn\(|tr\(|\?:|formatDateShort|formatMonthShort|\\\$\{" || echo "NONE-expr"
```
Expected: NONE-literal, NONE-expr.

- [ ] **Step 3: Manual GUI pass (`bash -c 'bun run dev'`)**
- **Metadata:** pick a folder with tagged MP3s → now-playing shows Title — Artist; a tagless file shows the filename (no "undefined"); a large folder loads without freezing the UI.
- **Repeat:** `one` replays the current track on end; `off` stops after the last track; `all` loops; next/prev always move; the mode persists after restart.
- **Folder search:** filtering narrows the list; clicking a filtered track plays the correct one.
- **Robustness:** non-http radio/YT URL → inline "Invalid URL"; lowering yt timeout to 5 makes slow URLs fail faster; the retry button re-runs the failed YT load.
- **Ambient:** switching sound crossfades smoothly (no hard cut); dragging the volume slider changes gain WITHOUT a fade; selector + volume persist after restart.

- [ ] **Step 4: Final commit (if sweep fixes needed)**

```bash
git add -A && git commit -m "music: SP5 final verification fixes

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review notes (author)
- **Spec coverage:** §3 metadata = T2(backend)+T3(display); §4 repeat+search = T4; §5 timeout/validation/retry = T5; §6 crossfade+ambient UI = T6; MusicConfig mirror+roundtrip = T1.
- **Advisor points pinned:** lofty API context7-verified + `cargo add` (T2); list_music_files async+spawn_blocking + per-file non-fatal (T2); repeatMode via `repeatModeRef` (no stale closure) + off/all/one semantics for BOTH folder & YT + next/prev unconditional (T4); crossfade decomposed into 3 effects, fade in `fadeRef` cancelled on transition/unmount, volume sets gain directly (T6); ALL hardcoded yt timeouts replaced (T5); retry re-runs specific op; permissive URL validation; metadata display `title ?? name` (T3).
- **Rust mirror lesson:** repeatMode/ytTimeoutSecs in models::MusicConfig + Default + roundtrip test (T1).
- **No placeholders; exact paths; BUN + cargo commands.**
