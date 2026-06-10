# SP6 — Real Media Quality (Design)

**Sana:** 2026-06-10
**Status:** Approved (design)
**Roadmap:** Sub-project 6/7. SP1–SP5 done. Two areas: a frequency-reactive audio visualizer (Web Audio API) and a light/dark theme crossfade.

## 1. Maqsad va qamrov
- **1. Real visualizer:** replace the fake drift-bars with Web Audio `AnalyserNode` frequency data for local folder audio; keep drift for cross-origin streams (radio/YouTube) which Web Audio cannot analyze without muting.
- **2. Theme crossfade:** smooth light↔dark transition (currently an instant class toggle).

## 2. Mavjud arxitektura (tasdiqlangan 2026-06-10)
- `use-music.tsx`: ONE shared `audioRef` (`HTMLAudioElement`) reused for folder/yt/radio (sets `.src` per track). `getOrCreateAudio()` creates it once + attaches the `'ended'` listener. Consumers of `audioRef`: ONLY internal use-music + `music-mini-widget.tsx` (`useAudioVisualizer(isPlaying ? audioRef.current : null)`). NOT used in tray/title/layout.
- `use-audio-visualizer.ts`: fake — 12 drift bars on a canvas, never touches Web Audio (deliberately, to avoid muting). Returns `canvasRef`.
- `toggle-theme.tsx`: toggles `documentElement.classList`'s `dark` class instantly; persists via `api.setTheme`.
- `index.css`: theme via CSS vars (`--background` oklch etc.) under `:root` / `.dark`; already has `transition: background 0.8s ease` (~line 171, aurora) and `[data-timer-mode="..."].dark` mode-color vars that shift on focus→break. `animationsEnabled` setting toggles a `no-animations` class.
- `convertFileSrc(path)` (tauri) yields an `asset://`/`http://asset.localhost/...` URL for local files. Streams use raw http(s) URLs (cross-origin).

## 3. THE KEY UNKNOWN — capability probe FIRST (gates everything)
Web Audio's `createMediaElementSource(el)` routes the element's output THROUGH the AudioContext. For cross-origin media without CORS headers the node outputs **silence** (taint). The entire visualizer premise is that **local tauri-asset audio is same-origin/CORS-clean** so the analyser yields real data AND audio stays audible. This is **engine-specific (WebKitGTK) and unverified** — if tauri-asset URLs taint, routing folder audio through Web Audio would also MUTE local playback, making the feature infeasible.

**Therefore the implementation is probe-gated:**
- **Probe (manual, in the running app):** load a local folder track; in devtools console run a snippet that creates `new AudioContext()` + `createMediaElementSource(theFolderAudioEl)` + `AnalyserNode` → `destination`, plays, and checks: (a) `getByteFrequencyData` is non-zero during playback, AND (b) audio remains audible. 
- **If the probe PASSES** → proceed with the 2-element refactor (Area 1 full).
- **If the probe FAILS** (zeros or muted) → real visualizer is infeasible on this platform; **ship Area 2 (theme crossfade) only and keep the drift bars.** Do NOT route audio through Web Audio.

This decouples the high-risk playback refactor from the unverified assumption: a failed probe costs a snippet, not a broken playback core.

## 4. Dizayn — Area 1: Real visualizer (2-element, probe-gated)

### use-music: two elements (keep stream element as-is, add folder element)
- Keep the existing single `audioRef` for **stream** sources (yt/radio) UNCHANGED (no behavior change, never routed through Web Audio → never muted). Treat it as `streamAudioRef`.
- Add a NEW `folderAudioRef` (`HTMLAudioElement`) used ONLY for **folder** playback, routed through Web Audio.
- **`activeAudio()` accessor:** returns `source === 'folder' ? folderAudioRef.current : streamAudioRef.current`. Route EVERY current `audioRef.current` read (enumerated: lines ~205/217/223/233/235/243/256/407/415/422/583/596) through `activeAudio()` (or the source-appropriate element). The `'ended'` listener must be attached to BOTH elements.
- **Invariant (regression risk):** switching source **pauses the inactive element** (e.g. starting a folder track pauses `streamAudioRef`; starting radio/yt pauses `folderAudioRef`) — otherwise two tracks play at once.
- **Web Audio graph (folder only, lazy, once):** on the first folder play, create `AudioContext` + `createMediaElementSource(folderAudioRef.current)` + `AnalyserNode` (fftSize 64–128 → ~12–32 bins), connect `source → analyser → ctx.destination`. **`createMediaElementSource` may be called ONCE per element ever** — guard with a `sourceNodeCreatedRef` flag (never re-create on remount/second folder load). Store the `AnalyserNode` in `analyserRef`.
- **AudioContext starts suspended** — call `ctx.resume()` on the PLAY action (user gesture: the play/toggle click or loadFolderTrack triggered by a click), NOT in `onended` auto-advance. The analyser reads flat until the first gesture resume.
- **Expose** `analyserRef: RefObject<AnalyserNode | null>` and `source` on the context (already exposes `source`). The visualizer reads these.

### use-audio-visualizer: real bars + drift fallback (mode chosen by SOURCE, once)
- New signature: `useAudioVisualizer(analyser: AnalyserNode | null, isPlaying: boolean, mode: 'real' | 'drift')` (or pass `source` + analyser and derive mode internally). **Decide mode ONCE when analyser/source changes** — `source === 'folder' && analyser != null` → `'real'`; else `'drift'`. Do NOT switch per-frame on amplitude (a quiet passage is legitimately near-zero → per-frame switching would flicker).
- `'real'`: `analyser.getByteFrequencyData(buf)` each frame → draw bars from the bins (reuse the existing bar styling/colors).
- `'drift'`: the existing random-drift animation (unchanged).
- The all-zero check is used ONLY as the one-time capability probe (§3), never as the per-frame selector.

### music-mini-widget
- Update the `useAudioVisualizer(...)` call to pass `analyserRef.current` + `source`/mode instead of `audioRef.current`. Visualizer still renders the same canvas.

## 5. Dizayn — Area 2: Theme crossfade (CSS transition window)
- `toggle-theme.tsx`: in `handleToggle`, if animations are enabled, add a `theme-transition` class to `documentElement` BEFORE flipping `dark`, then remove it after ~400ms (`setTimeout`, store id to clear if toggled again). Read `animationsEnabled` (via `useSettings`) — skip the transition class if off.
- `index.css`: add a rule that, ONLY while the `theme-transition` class is present, applies an EXPLICIT-property transition (NOT `all`) to all elements:
```css
html.theme-transition * {
  transition: background-color 0.4s ease, color 0.4s ease, border-color 0.4s ease;
}
```
Rationale: explicit longhands (`background-color`/`color`/`border-color`) — NOT `all` (which would animate transforms/layout) and NOT `background` (the aurora uses the `background` shorthand at 0.8s; keeping to `background-color` avoids overriding that). The rule only exists during the ~400ms window (class added then removed), so it never slows normal interaction. Verify in-app that the mini-mode aurora / timer-mode color shift isn't visibly janky during a toggle (it's gated by `animationsEnabled` anyway).

## 6. Components / files
- `src/renderer/hooks/use-music.tsx` — 2-element split, `activeAudio()`, Web Audio graph (folder), `analyserRef`, pause-inactive invariant. (Area 1, probe-gated, HIGH RISK)
- `src/renderer/hooks/use-audio-visualizer.ts` — real-bars + drift-fallback, mode-by-source. (Area 1)
- `src/renderer/components/music-mini-widget.tsx` — pass analyser+source. (Area 1)
- `src/renderer/components/toggle-theme.tsx` — transition window + animationsEnabled gate. (Area 2)
- `src/renderer/index.css` — `html.theme-transition` rule. (Area 2)
- No new settings (no Rust mirror needed); no new i18n.

## 7. Error handling / edge-cases
- Probe fails → no Web Audio routing; drift everywhere (graceful, feature deferred).
- `createMediaElementSource` once-per-element (guard flag) — never throws `InvalidStateError`.
- AudioContext resume on gesture; flat until then (acceptable).
- Switching source pauses the inactive element (no double playback).
- Visualizer: `analyser == null` (stream / probe-failed) → drift; mode fixed per source (no flicker).
- Theme transition only during the 400ms window + only when animationsEnabled.

## 8. Testlash / verifikatsiya
- **Probe (Area 1, manual, FIRST):** in-app snippet confirms non-zero `getByteFrequencyData` + audible local playback. Gate the refactor on it.
- `bash -c 'bun run typecheck'` + `bun run build:vite` green; `bun run check:i18n` parity OK (no new keys, count unchanged).
- **Manual (`bun run dev`):**
  - Visualizer: a folder track shows bars that move WITH the music (not random drift); radio/YT shows drift (and still plays audibly — not muted); switching folder→radio→folder doesn't double-play or mute.
  - Theme: toggling light↔dark crossfades smoothly (~400ms); with animations disabled it's instant; the timer-mode color shift and aurora are unaffected.
- No regressions to playback (next/prev/repeat/auto-advance/volume/saved items).

## 9. Non-goals
- Album art / waveform / spectrogram (frequency bars only).
- Real analysis of cross-origin streams (radio/YT stay drift — fundamental CORS limit).
- View Transitions API (CSS-transition approach chosen; WebKitGTK support uncertain).
- New ambient assets / music features (SP5 scope).
- Configurable visualizer styles/colors.
