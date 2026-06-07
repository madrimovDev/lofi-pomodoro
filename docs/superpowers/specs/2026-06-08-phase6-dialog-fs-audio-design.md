# Faza 6 — Dialog, FS, Audio (dizayn spec)

**Sana:** 2026-06-08
**Branch:** `tauri-migration`
**Oldingi faza:** Faza 5 (Oyna va Tray) — tugagan
**Keyingi faza:** Faza 7 (yt-dlp sidecar)

## Maqsad

Lokal musiqa papkalari, fayl dialoglari va asset-protokol orqali audio ijro. IPC kontrakti metodlari: 14 (`pick_music_folder`), 15 (`list_music_files`), 19 (`export_tasks`), 20 (`import_tasks`), 21 (`pick_notification_sound`).

`yt-dlp` (16–18) va Todoist (22) — bu fazaga KIRMAYDI (Faza 7/8).

## Qarorlar (brainstorm)

1. **Rust command + frontend wrapper pattern** (to'g'ridan-to'g'ri JS plugin emas) — 30-metodli IPC kontrakti va Faza 3/4 (`api.ts`)/Faza 5 (`window.ts`) izchilligi uchun.
2. **Asset scope: dinamik tor** (foydalanuvchi qarori) — `$HOME/**` keng scope o'rniga faqat tanlangan yo'llar runtime'da qo'shiladi.
3. **FS plugin yo'q** — barcha fayl operatsiyalari Rust command ichida `std::fs` orqali (frontend to'g'ridan-to'g'ri fs chaqirmaydi). TZ "tauri-plugin-fs / std::fs" degandi; `std::fs` sodda va yetarli.
4. **Dialog Rust API** (`app.dialog()`) — Rust'dan chaqiriladi → JS dialog capability shart emas (capability'lar faqat JS→command ko'prigini cheklaydi).
5. **Scope re-register manbasi = bizning store** (persisted-scope plugin emas) — store allaqachon yo'llarni saqlaydi, qo'shimcha plugin/fayl shart emas, yagona manba.

## Mavjud holat (tasdiqlangan)

`src-tauri/tauri.conf.json` allaqachon sozlangan:
- `assetProtocol.enable = true`, `scope = ["$HOME/**"]` → bu faza'da `$HOME/**` **olib tashlanadi**.
- CSP: `media-src 'self' asset: https: blob:` ✅ va `connect-src ... asset: https://api.todoist.com` ✅ — lokal `asset:` ijro uchun CSP TAYYOR, bu faza'da CSP o'zgarmaydi.

## Task 0 — Audio dekod spike (BIRINCHI)

TZ §9.1: lokal audio dekodi migratsiyaning eng katta riski va WebKitGTK + NVIDIA (RTX 3050, Wayland) mashinada birinchi marta ishlaydi. Plumbing'dan oldin:

- Ma'lum bir lokal MP3 → `convertFileSrc(path)` → `<audio>` → **ovoz chiqishini** tasdiqlash (GStreamer kodek).
- Yashil chiroq olinmasa (ovoz yo'q), plumbing'ni qurishdan oldin to'xtab kodek strategiyasini hal qilish (`gstreamer1.0-plugins-good` o'rnatilganmi; AAC/m4a uchun `plugins-bad`/`libav`).
- Bu silent-failure'ni uchta sababdan (scope / CSP / kodek) bittaga qisqartiradi — scope va CSP bu faza ishidan, kodek tizimdan.

## Komponentlar

### Rust: asset scope util

**`src-tauri/src/asset_scope.rs`** (yangi):
- `allow_path(app, path: &str)` — yo'l papka bo'lsa `app.asset_protocol_scope().allow_directory(path, true)`, fayl bo'lsa `allow_file(path)`. Xatoni log qiladi, panic qilmaydi.
- `reregister_from_store(app)` — store'dan o'qiydi: joriy `music.folderPath`, `music.savedFolders[].path`, `settings.notificationSound` (custom yo'l) — har birini `allow_path` orqali scope'ga qo'shadi. `lib.rs` setup'da chaqiriladi.

### Rust: command'lar

**`src-tauri/src/commands/music.rs`** (yangi — Faza 7'da yt-dlp shu yerga qo'shiladi):
- `pick_music_folder(app) -> Option<String>` — `app.dialog().file().blocking_pick_folder()` (bloklovchi, alohida thread'da/`spawn_blocking`). Bekor → `None`. Tanlangan papka → `allow_path`.
- `list_music_files(app, folder_path: String) -> Vec<AudioFileRaw>` — `std::fs::read_dir` + audio kengaytma filtri (`mp3 wav ogg flac m4a aac opus weba webm`, kichik harfga keltirib solishtirish). `{name, path}` (xom absolut yo'l) qaytaradi. Papka → `allow_path` (himoyaviy). O'qish xatosida bo'sh `Vec` (Electron xulqini mirror).

`AudioFileRaw` — `models.rs`'ga: `{ name: String, path: String }` (`serde` camelCase). Frontend `convertFileSrc` qo'llab `AudioFile {name, url}` hosil qiladi.

**`src-tauri/src/commands/tasks.rs`** (yangi):
- `export_tasks(app) -> bool` — store'dan `tasks` o'qiydi; `app.dialog().file().blocking_save_file()` (default nom `zenfocus-tasks-<ts>.json`, `ts` = `SystemTime` epoch millis; JSON filtri). Yo'l yo'q → `false`. `serde_json::to_string_pretty` → `std::fs::write`. Xato → `false` (log).
- `import_tasks(app) -> Option<Vec<Task>>` — `blocking_pick_file()` (JSON filtri). Yo'q → `None`. `std::fs::read_to_string` → `serde_json::from_str::<serde_json::Value>`. **Minimal validatsiya** (Electron'ni aynan mirror): massiv bo'lishi shart; har element obyekt + `id: string` + `name: string` bo'lganlari filtrlanadi va `Task` ga deserialize qilinadi. Xato/massiv emas → `None`.

**`src-tauri/src/commands/store.rs`** (mavjudga qo'shiladi):
- `pick_notification_sound(app) -> Option<String>` — `blocking_pick_file()` (audio filtri: `mp3 wav ogg flac m4a`). Tanlangan **xom yo'l** qaytaradi va faylni `allow_path` orqali scope'ga qo'shadi. Bekor → `None`.

Barcha yangi command'lar `lib.rs` `invoke_handler`'ga registratsiya qilinadi.

### Plugin + Cargo

- `src-tauri/Cargo.toml`: `tauri-plugin-dialog = "2"` (faqat shu — fs plugin yo'q).
- `src-tauri/src/lib.rs`: `.plugin(tauri_plugin_dialog::init())` + setup'da `asset_scope::reregister_from_store(app)`.
- `tauri.conf.json`: `assetProtocol.scope` dan `$HOME/**` olib tashlanadi (bo'sh `[]` yoki object form `{"allow": []}`).
- Capabilities: **o'zgartirish shart emas**.

### Frontend wrapperlar

**`src/shared/tauri/music.ts`** (yangi):
- `pickMusicFolder(): Promise<string | null>` — `invoke('pick_music_folder')`.
- `listMusicFiles(path: string): Promise<AudioFile[]>` — `invoke('list_music_files', {folderPath})` → `{name, path}[]` ni `{name, url: convertFileSrc(path)}[]` ga map qiladi.

**`src/shared/tauri/dialog.ts`** (yangi):
- `exportTasks(): Promise<boolean>` — `invoke('export_tasks')`.
- `importTasks(): Promise<Task[] | null>` — `invoke('import_tasks')`.
- `pickNotificationSound(): Promise<string | null>` — `invoke('pick_notification_sound')` (xom yo'l qaytaradi).

### Renderer o'zgarishlari (`window.electronApi?.X` → yangi wrapper)

- `src/renderer/hooks/use-music.tsx` — `pickMusicFolder`/`listMusicFiles` chaqiruvlari (~169, 297, 303, 389, 407). `convertFileSrc` endi `listMusicFiles` wrapper ichida → `loadFolderTrack` (~232) xom `url`ni to'g'ridan beradi. `yt*` chaqiruvlar TEGILMAYDI (Faza 7).
- `src/renderer/app/layout/index.tsx` (~313) — custom bildirishnoma ovozi yo'liga `convertFileSrc` qo'llash (settings'dagi xom yo'l ijro paytida o'raladi).
- `src/renderer/components/settings-panel.tsx` (132) — `pickNotificationSound`.
- `src/renderer/components/task-panel.tsx` (576, 580) — `exportTasks`/`importTasks`.

## Ma'lumot modellari

- `AudioFileRaw` — `{name, path}` (Rust → frontend xom).
- `AudioFile` — `{name, url}` (frontend, `convertFileSrc` natijasi) — TZ §6.1, `types.ts`'da mavjud.
- `Task` — mavjud (`models.rs`).

## Xatolarni boshqarish

- `pick_*` bekor qilinsa → `None`/`null` (Electron xulqi).
- `list_music_files` o'qish xatosi → bo'sh `Vec` (jim, Electron'dek).
- `export_tasks` xatosi → `false` (log). `import_tasks` parse/validatsiya xatosi → `None` (log).
- `allow_path` xatosi → log, panic yo'q (ijro davom etadi, faqat o'sha yo'l ishlamasligi mumkin).

## Verifikatsiya (test framework yo'q → clippy/typecheck + runtime acceptance)

1. `cargo clippy` toza, `tsc`/typecheck toza, `npm run build` o'tadi.
2. **Task 0 spike:** lokal MP3 `convertFileSrc` orqali ovoz chiqaradi.
3. Papka tanlash → fayllar ro'yxati → ijro (ovoz chiqadi, asset scope + GStreamer).
4. **Restart** → saqlangan papka qayta ijro bo'ladi (startup scope re-register ishlaydi).
5. Tasks export → JSON fayl yoziladi; import → vazifalar tiklanadi (validatsiya buzuq faylni rad etadi).
6. Custom bildirishnoma ovozi tanlanadi va chalinadi.
7. Ambient ovozlar (rain/forest/cafe) + bell ishlaydi (public dir, allaqachon).

## Ko'lamdan tashqari (Faza 7/8)

- `yt_check`, `yt_get_stream`, `yt_get_playlist` (yt-dlp sidecar) — Faza 7.
- YouTube/radio CSP polish — Faza 7.
- `todoist_import` — Faza 8.
