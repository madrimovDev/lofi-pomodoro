# Texnik Topshiriq (TZ): ZenFocus — Electron → Tauri v2 Migratsiyasi

> **Maqsad:** Ushbu hujjat Rust/Tauri dasturchisiga ZenFocus Pomodoro ilovasini **aynan** qayta qurish uchun yetarli barcha texnik tafsilotni beradi. Frontend (React UI) saqlanadi — uning ko'rinishi va xulqi o'zgarmasligi kerak. O'zgaradigan narsa — Electron main process Rust/Tauri backendiga ko'chiriladi va renderer'ning native chaqiruvlari idiomatik Tauri `invoke()`/`listen()`ga o'tkaziladi.

---

## 1. KONTEKST

ZenFocus — glassmorphism dizaynli lofi Pomodoro desktop ilovasi. Hozir **Electron 41 + React 19 + Tailwind 4 + Vite 8 + TypeScript 6** asosida. Ilova yetuk: timer, vazifalar, statistika, musiqa (lokal papka / YouTube / radio / ambient), tray, mini-rejim, 3 til (uz/en/ru), auto-update.

**Nega ko'chirilyapti:** Tauri'da ilova ~10x kichik binary, ancha kam RAM ishlatadi. Frontend a'lo darajada — uni o'zgartirmasdan Tauri'da ishga tushirish maqsad.

**Natija:** Linux (AppImage), Windows (NSIS), macOS uchun ishlovchi, hozirgi ilovaning aynan funksional ekvivalenti bo'lgan Tauri v2 ilovasi.

### Qabul qilingan qarorlar
| Qaror | Tanlov |
|---|---|
| TZ tili | O'zbek (kod va texnik atamalar inglizcha) |
| Renderer strategiyasi | **Idiomatik Tauri `invoke()`/`listen()`** — `window.electronApi` butunlay olib tashlanadi, chaqiruvlar `@tauri-apps/api`ga ko'chiriladi |
| Platformalar | Linux + Windows + **macOS** (yangi) |
| Auto-update | **Faza 1'ga KIRMAYDI** — keyinroq alohida qo'shiladi (8-bo'limga qarang) |

---

## 2. MAQSADLI STACK

| Qatlam | Hozir (Electron) | Maqsad (Tauri v2) |
|---|---|---|
| Backend | Electron main (TypeScript, CJS) | **Rust** (`src-tauri/`) |
| IPC | `contextBridge` + `ipcRenderer` | `#[tauri::command]` + `invoke()` / event `emit`+`listen` |
| Frontend | React 19 (o'zgarishsiz) | React 19 (chaqiruv qatlami o'zgaradi, UI o'zgarmaydi) |
| Bundler | Vite + vite-plugin-electron | **Vite** (electron pluginlari olib tashlanadi) |
| Saqlash | `@madrimov/electron-store-typed` | `tauri-plugin-store` |
| Oyna holati | `@madrimov/electron-window-state` | `tauri-plugin-window-state` |
| Log | `electron-log` | `tauri-plugin-log` |
| Dialog | Electron `dialog` | `tauri-plugin-dialog` |
| Fayl tizimi | Node `fs` | `tauri-plugin-fs` / Rust `std::fs` |
| HTTP (Todoist) | Electron `net.fetch` (main) | `tauri-plugin-http` yoki Rust `reqwest` |
| Tashqi binary (yt-dlp) | `child_process.execFile` | **Tauri sidecar** (`tauri-plugin-shell`) |
| Yagona instans | `requestSingleInstanceLock` | `tauri-plugin-single-instance` |
| Tashqi havolalar | `shell.openExternal` | `tauri-plugin-opener` |
| Lokal audio | `localfile://` custom protokol | `convertFileSrc()` (asset protokol) |

---

## 3. MAQSADLI LOYIHA STRUKTURASI

```
zenfocus-tauri/
├── src/                      # Frontend — MAVJUDIDAN KO'CHIRILADI
│   ├── renderer/             # React (UI o'zgarmaydi, chaqiruv qatlami o'zgaradi)
│   ├── shared/               # types.ts, i18n/, lib/ — saqlanadi
│   │   └── tauri/            # YANGI: invoke wrapper'lar (api.ts) — quyida 6-bo'lim
│   └── (main/ va preload/ O'CHIRILADI — Rust'ga ko'chadi)
├── src-tauri/                # YANGI Rust backend
│   ├── src/
│   │   ├── main.rs           # Entry, builder, plugin'lar, single-instance
│   │   ├── commands/         # #[tauri::command] funksiyalar (IPC ekvivalenti)
│   │   │   ├── store.rs      # settings/tasks/stats/theme/music get-set
│   │   │   ├── music.rs      # folder pick/list, yt-dlp sidecar
│   │   │   ├── window.rs     # mini-mode, always-on-top, music-panel toggle
│   │   │   ├── tasks.rs      # export/import, todoist
│   │   │   └── tray.rs       # tray state update + menu
│   │   ├── models.rs         # serde struct'lar (TimerSettings, MusicConfig, Task, DailyStat ...)
│   │   └── tray.rs           # dinamik tray icon generatsiya
│   ├── bin/                  # yt-dlp sidecar binary'lar (target-triple nomli)
│   ├── icons/                # app ikonkalari (.png/.ico/.icns) — YANGI YARATILADI
│   ├── capabilities/         # Tauri v2 permission'lar
│   ├── tauri.conf.json
│   └── Cargo.toml
├── index.html                # title "Electron" → "ZenFocus" ga o'zgartiriladi
├── vite.config.ts            # electron plugin'lar olib tashlanadi
└── package.json              # script'lar tauri'ga o'tadi
```

---

## 4. BACKEND: TAURI COMMAND KONTRAKTI (ENG MUHIM QISM)

Hozirgi preload **aniq 30 ta metod** ochadi (`src/preload/index.ts`). Har biri bitta Tauri command yoki event'ga ko'chiriladi. Quyidagi jadval — to'liq kontrakt. Command nomlari Rust'da `snake_case`, frontend `invoke('snake_case_name', {...})` bilan chaqiradi.

### 4.1 Invoke command'lar (renderer → backend, javob kutadi)

| # | Frontend (eski) | Tauri command | Argument | Qaytaradi | Backend imkoniyat |
|---|---|---|---|---|---|
| 1 | `getVersion()` | `@tauri-apps/api/app` `getVersion()` | — | `string` | App metadata (command kerakmas) |
| 2 | `getTheme()` | `get_theme` | — | `'dark'\|'light'` | store read |
| 3 | `setTheme(t)` | `set_theme` | `theme` | `void` | store write |
| 4 | `getSettings()` | `get_settings` | — | `TimerSettings` | store read |
| 5 | `setSettings(s)` | `set_settings` | `settings` | `void` | store write |
| 6 | `getTasks()` | `get_tasks` | — | `Task[]` | store read |
| 7 | `setTasks(t)` | `set_tasks` | `tasks` | `void` | store write |
| 8 | `getActiveTaskId()` | `get_active_task_id` | — | `string\|null` | store read |
| 9 | `setActiveTaskId(id)` | `set_active_task_id` | `id` | `void` | store write |
| 10 | `getMusic()` | `get_music` | — | `MusicConfig` (default bilan merge) | store read |
| 11 | `setMusic(c)` | `set_music` | `config` | `void` | store write |
| 12 | `getStats()` | `get_stats` | — | `DailyStat[]` | store read |
| 13 | `setStats(s)` | `set_stats` | `stats` | `void` | store write |
| 14 | `pickMusicFolder()` | `pick_music_folder` | — | `string\|null` | dialog (open directory) |
| 15 | `listMusicFiles(p)` | `list_music_files` | `folderPath` | `AudioFile[]` | fs readdir + filter + asset URL |
| 16 | `ytCheck()` | `yt_check` | — | `boolean` | sidecar `yt-dlp --version` |
| 17 | `ytGetStream(url)` | `yt_get_stream` | `url` | `YoutubeStreamInfo \| {error}` | sidecar yt-dlp |
| 18 | `ytGetPlaylist(url)` | `yt_get_playlist` | `url` | `YoutubePlaylistItem[] \| {error}` | sidecar yt-dlp |
| 19 | `exportTasks()` | `export_tasks` | — | `boolean` | dialog save + fs write JSON |
| 20 | `importTasks()` | `import_tasks` | — | `Task[]\|null` | dialog open + fs read JSON |
| 21 | `pickNotificationSound()` | `pick_notification_sound` | — | `string\|null` | dialog (audio filter) |
| 22 | `todoistImport()` | `todoist_import` | — | `Task[] \| {error}` | HTTP GET (Bearer token) |
| 23 | `minimizeWindow()` | `@tauri-apps/api/window` `getCurrentWindow().minimize()` | — | `void` | window API |
| 24 | `maximizeWindow()` | window `toggleMaximize()` | — | `void` | window API |
| 25 | `closeWindow()` | window `close()` | — | `void` | window API |
| 26 | `toggleMusicPanel()` | `toggle_music_panel` | — | `boolean` (expanded) | window resize (+360px) |
| 27 | `setAlwaysOnTop(b)` | `set_always_on_top` | `enabled` | `void` | window API + platforma logikasi |
| 28 | `setMiniMode(b)` | `set_mini_mode` | `enabled` | `void` | window resize/constraint (aniq qiymatlar 5.2) |
| 29 | `updateTrayState(s)` | `update_tray_state` | `state` | `void` | tray icon + menu yangilash |
| 30 | `checkForUpdates()` / `installUpdate()` | — | — | — | **Faza 2 (auto-update)** — hozir stub/no-op |

### 4.2 Event'lar (backend → renderer, `emit` → `listen`)

| Eski (preload listener) | Tauri event nomi | Payload | Kim chiqaradi |
|---|---|---|---|
| `onMiniModeChanged(cb)` | `window:mini-mode-changed` | `boolean` | `set_mini_mode` oxirida |
| `onTrayToggle(cb)` | `tray:toggle-timer` | — | Tray menu "Play/Pause" |
| `onTraySkip(cb)` | `tray:skip` | — | Tray menu "Skip" |
| `onTraySetMiniMode(cb)` | `tray:set-mini-mode` | `boolean` | Tray menu "Mini rejim" |
| `onUpdateStatus(cb)` | `updater:status` | `UpdaterStatus` | **Faza 2** |

---

## 5. NATIVE IMKONIYATLAR — ANIQ XULQ

### 5.1 Asosiy oyna (`src/main/window.ts` → `tauri.conf.json` + Rust)
- O'lcham: **default 1280×800**, **min 600×400**
- **`decorations: false`** (frame'siz — UI'da custom titlebar bor)
- `resizable: true`, opaque (transparent EMAS)
- Oyna holati (width/height/x/y) saqlanadi → `tauri-plugin-window-state`
- **DIQQAT — transient o'lchamlar:** `tauri-plugin-window-state` yopishda joriy o'lchamni saqlaydi. Agar foydalanuvchi **mini-rejimda (320×72)** yoki **musiqa paneli ochiq (+360px)** holatda chiqsa, ilova shu vaqtinchalik o'lchamda qayta ochiladi. Mini-rejim va musiqa-panel o'lchamlari **vaqtinchalik** deb belgilanishi va saqlanadigan holatdan chiqarilishi (yoki saqlashdan oldin normal o'lchamga qaytarilishi) kerak.
- **Wayland (Linux):** global x/y berilmaydi (kompozitorlar e'tiborsiz qoldiradi). `WAYLAND_DISPLAY` yoki `XDG_SESSION_TYPE=wayland` bo'lsa pozitsiyani o'tkazib yuborish.
- Dev'da Vite dev-server URL, prod'da bundled `index.html` yuklanadi (Tauri buni avtomatik qiladi).
- Tashqi havolalar tashqi brauzerda ochiladi → `tauri-plugin-opener` (hozir `shell.openExternal` + `setWindowOpenHandler`).
- **Yopish tugmasi ilovani trayga yashiradi** (chiqarmaydi). Faqat tray menyu "Chiqish" yoki `app.quit()` haqiqatan chiqaradi. Tauri'da window `close-requested` hodisasini ushlab, `prevent_close()` + `hide()` qilinadi; `is_quitting` bayroq holatida o'tkaziladi.

### 5.2 Mini rejim (`src/main/ipc/window-control.ts:87-113`) — ANIQ QIYMATLAR
Yoqilganda:
- Joriy o'lcham va min-o'lcham saqlanadi (qaytarish uchun)
- `setMinimumSize(200, 54)`, `setMaximumSize(800, 200)`, `setSize(320, 72)`
- Always-on-top **majburan yoqiladi**
O'chirilganda:
- Avval `setMinimumSize(0,0)` → `setMaximumSize(9999, 9999)` (Linux/KDE Wayland'da `setMaximumSize(0,0)` WM'ni buzadi — ishlatmang) → saqlangan min/o'lcham qaytariladi
- Oldingi always-on-top holati qaytariladi
- Oxirida `window:mini-mode-changed` event emit qilinadi

### 5.3 Always-on-top (`window-control.ts:34-70`)
- `setAlwaysOnTop(true)` (Win/Linux); macOS'da `'screen-saver'` darajasi + `setVisibleOnAllWorkspaces(true, {visibleOnFullScreen:true})`
- **Linux:** kompozitor blur'da stacking'ni reset qiladi → flag yoqiq bo'lsa har `blur` hodisasida qayta qo'llash
- Startup'da `settings.alwaysOnTop` bo'lsa qayta tiklanadi

### 5.4 Musiqa paneli kengaytmasi (`window-control.ts:18-32`)
- `toggle_music_panel`: oyna kengligiga **+360px** (`MUSIC_PANEL_WIDTH`) qo'shadi/oladi; `true`=kengaytirilgan qaytaradi. Balandlik o'zgarmaydi.

### 5.5 Tray (`src/main/tray.ts`)
- **Dinamik icon:** rejimga qarab rangli doira generatsiya qilinadi (22×22 RGBA PNG): yashil=focus, teal=short-break, binafsha=long-break. To'la doira=ishlayapti, uzuq doira=pauza. Rust'da ekvivalent generatsiya yoki oldindan tayyor PNG to'plami.
- **macOS DIQQAT:** menu bar tray ikonkasi odatda **monoxrom template image**ga majburlanadi — rangli rejim-indikatori macOS'da rang ko'rsatmasligi mumkin. Darwin'da `set_icon_as_template(false)` yoki rangli ko'rinish uchun alohida ishlov kerak.
- **Tooltip:** `ZenFocus | MM:SS | <rejim>`. macOS'da menu bar'da `MM:SS` ko'rsatiladi.
- **Menu:** [holat satri (disabled)] · ⏯ Boshlash/To'xtatish · ⏭ Keyingisiga · 📌 Mini rejim · 🙈/👁 Yashirish/Ko'rsatish · Chiqish
- **Tray click:** oyna ko'rinsa yashiradi, aks holda ko'rsatadi+focus
- Menu element'lari renderer'ga event yuboradi (4.2). Renderer holatni `update_tray_state` orqali yuboradi (`{timeLeft, mode, isRunning}`).

### 5.6 Saqlash (`src/main/store.ts`) → `tauri-plugin-store`
- Store nomi: `config` (JSON). Kalitlar va default'lar:

| Kalit | Tip | Default |
|---|---|---|
| `theme` | `'dark'\|'light'` | `'dark'` |
| `settings` | `TimerSettings` | quyida 7.1 |
| `tasks` | `Task[]` | `[]` |
| `activeTaskId` | `string\|null` | `null` |
| `music` | `MusicConfig` | quyida 7.2 |
| `stats` | `DailyStat[]` | `[]` |

- **Forward migration:** yuklashda `settings`da yetishmayotgan kalitlar default bilan to'ldiriladi (`autoStartBreaks`, `autoStartFocus`, `alwaysOnTop`, `activePreset`, `dailyGoal`, `showBreakScreen`, `todoistToken`). Rust'da serde `#[serde(default)]` bu ishni tabiiy bajaradi.

### 5.7 Lokal audio: `localfile://` → asset protokol
- Hozir: custom `localfile://` protokol → ichkarida `file://`ga aylanadi (`src/main/index.ts:23-46`). Yo'l: `pathToFileURL(path).replace('file://','localfile://')` (`music.ipc.ts:35-39`).
- **Tauri:** `convertFileSrc(path)` (`@tauri-apps/api/core`) ishlatib `asset://` URL hosil qilinadi. `tauri.conf.json`'da `app.security.assetProtocol.enable = true` va `scope` foydalanuvchi musiqa papkalarini qamrashi kerak (papkalar ixtiyoriy bo'lgani uchun keng scope yoki dinamik kengaytirish — `$HOME/**` yoki tanlangan papkalarni runtime'da scope'ga qo'shish).
- **Renderer o'zgarishi:** `list_music_files` endi xom yo'l qaytaradi; renderer `audio.src` ga berishdan oldin `convertFileSrc()` qo'llaydi (joylar 6.2).

### 5.8 yt-dlp sidecar (`src/main/ipc/music.ipc.ts`) — ENG YUQORI RISK
- **Hozir:** `bin/<platform>/yt-dlp` (dev) / `process.resourcesPath/bin/yt-dlp` (prod), `execFile` bilan chaqiriladi.
- **3 ta chaqiruv:**
  - `yt_check`: `yt-dlp --version` (8s timeout)
  - `yt_get_stream`: `-g -x --audio-quality 0 --no-playlist <url>` + `--get-title --no-playlist` + `--print %(is_live)s` (30s). `{streamUrl, title, isLive}` qaytaradi.
  - `yt_get_playlist`: `--flat-playlist --print '%(id)s\t%(title)s' <url>` (60s). `{id, title}[]` qaytaradi (tab bilan ajratilgan satrlar parse qilinadi).
- **Tauri sidecar:**
  - `tauri.conf.json` → `bundle.externalBin: ["bin/yt-dlp"]`
  - Binary'lar **target-triple nomli** bo'lishi SHART: `yt-dlp-x86_64-unknown-linux-gnu`, `yt-dlp-x86_64-pc-windows-msvc.exe`, `yt-dlp-aarch64-apple-darwin` + `yt-dlp-x86_64-apple-darwin` (macOS uchun ikkala arch).
  - Rust: `tauri_plugin_shell::ShellExt` → `app.shell().sidecar("yt-dlp")?.args([...]).output().await`
  - `download-ytdlp.mjs` yangilanadi: macOS binary'larini ham yuklab, `src-tauri/bin/`ga target-triple nomi bilan joylashtiradi. **Eslatma:** hozir `releases/latest` (pin qilinmagan) — reproducibility uchun aniq versiyaga pin qilish tavsiya etiladi.

### 5.9 Todoist import (`src/main/ipc/store.ipc.ts:91-128`)
- `https://api.todoist.com/rest/v2/tasks`ga `Authorization: Bearer <token>` bilan GET. Token `settings.todoistToken`dan. Todoist priority/due date → ilova `Task` sxemasiga map qilinadi.
- **Tauri:** Rust `reqwest` yoki `tauri-plugin-http` bilan backend command (token backend'da qoladi, CORS muammosi yo'q).

### 5.10 Qolgan native
- **App version:** `@tauri-apps/api/app` `getVersion()` (Cargo.toml versiyasidan).
- **Single instance:** `tauri-plugin-single-instance` — ikkinchi instans oynani restore+focus qiladi.
- **Logging:** `tauri-plugin-log` (fayl: info, konsol: debug). Uncaught panic'lar log'ga.

---

## 6. FRONTEND O'ZGARISHLARI (idiomatik invoke)

UI komponentlari, CSS, animatsiyalar **o'zgarmaydi**. Faqat native chaqiruv qatlami o'zgaradi.

### 6.1 `window.electronApi` → Tauri wrapper
`src/shared/tauri/api.ts` yangi modul yaratiladi — hozirgi `electronApi` interfeysiga mos funksiyalarni `invoke`/`listen` ustida beradi. Bu eski `window.electronApi?.x()` chaqiruvlarini `api.x()`ga almashtirib, butun renderer bo'ylab izchillikni saqlaydi (30+ chaqiruv joyi). Misol:
```ts
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
export const api = {
  getSettings: () => invoke<TimerSettings>('get_settings'),
  setSettings: (settings: TimerSettings) => invoke<void>('set_settings', { settings }),
  ytGetStream: (url: string) => invoke<YoutubeStreamInfo | {error: string}>('yt_get_stream', { url }),
  onTrayToggle: (cb: () => void) => listen('tray:toggle-timer', () => cb()), // unlisten promise qaytaradi
  // ... 30 metod
};
```
**Chaqiruv joylari** (almashtiriladi): `toggle-theme.tsx`, `settings-panel.tsx`, `window-control.tsx`, `use-settings.tsx`, `use-tasks.tsx`, `use-stats.tsx`, `use-music.tsx`, `use-tray-sync.ts`, `use-updater.ts`, `app/layout/index.tsx`, `app/layout/main.tsx`. **Diqqat:** Electron listener'lari sinxron `() => void` unsubscribe qaytaradi; Tauri `listen()` **Promise<UnlistenFn>** qaytaradi — `useEffect` cleanup'lari shunga moslanadi.

### 6.2 Audio src — `convertFileSrc`
`src/renderer/hooks/use-music.tsx` da lokal fayl manbalari `convertFileSrc()` bilan o'raladi:
- `loadFolderTrack` (~232-qator): `audio.src = convertFileSrc(localPath)`
- Bildirishnoma ovozi `app/layout/index.tsx` (~313): custom sound yo'li ham `convertFileSrc`
- YouTube stream URL va radio URL (https) — o'zgarmaydi, lekin **CSP** kerak (6.3)

### 6.3 CSP (media oqimlari uchun)
`tauri.conf.json` → `app.security.csp`: YouTube stream (`*.googlevideo.com`) va radio (`https:`) `<audio>`da ishlashi uchun `media-src https: asset: 'self'` ruxsat berilishi kerak; `connect-src` Todoist uchun `https://api.todoist.com`.

### 6.4 Sof web — o'zgarmaydi
`document.title` (oyna sarlavhasida timer), `Notification` API, `localStorage` (timer holati), `setInterval`/`Date.now()` (drift-siz sanoq), Web Audio yo'q (visualizer faqat canvas 2D + `requestAnimationFrame`), `-webkit-app-region: drag` (mini-rejim drag) — barchasi ikkala webview'da ishlaydi.

---

## 7. DATA MODEL (Rust serde struct'lari)

`src/shared/types.ts`dagi tiplar Rust'da takrorlanadi (camelCase'ni saqlash uchun `#[serde(rename_all = "camelCase")]`).

### 7.1 TimerSettings (default)
`focusDuration:25, shortBreakDuration:5, longBreakDuration:15, sessionsBeforeLongBreak:4, soundEnabled:true, notificationsEnabled:true, ambientSound:'none', ambientVolume:0.4, focusMode:false, notificationSoundPath:null, locale:'uz', autoStartBreaks:false, autoStartFocus:false, alwaysOnTop:false, activePreset:null, dailyGoal:0, showBreakScreen:true, todoistToken:null`

### 7.2 MusicConfig (default)
`folderPath:null, sortMode:'shuffle', youtubeUrl:null, volume:0.5, savedPlaylists:[], savedFolders:[], savedRadioStations:[]`

### 7.3 Boshqalar
- `Task`: `id, name, description, estimatedPomodoros, completedPomodoros, createdAt, completedAt?, priority:'high'|'medium'|'low'|null, dueDate:number|null, subtasks: {id,text,done}[]`
- `DailyStat`: `date:'YYYY-MM-DD', focusSessions, focusMinutes, tasksCompleted, skippedSessions?`
- `AudioFile`: `{name, url}` (url endi asset protokol uchun convertFileSrc bilan hosil qilinadi)
- `TimerPreset`, `SavedYtPlaylist`, `SavedMusicFolder`, `RadioStation`, `YoutubeStreamInfo`, `YoutubePlaylistItem` — `types.ts`dan aynan.
- `BUILT_IN_STATIONS` (4 ta: SomaFM Drone/Groove/DeepSpace, Chillhop) va `DEFAULT_PRESETS` (Deep Work/Classic/Quick) — frontend konstantalari, o'zgarmaydi.

---

## 8. BUILD, PACKAGING, CI

### 8.1 `tauri.conf.json` asosiy
- `productName: "ZenFocus"`, `identifier: "com.madrimov.zenfocus"`, `version` (Cargo.toml bilan sinxron)
- `app.windows[0]`: `width:1280, height:800, minWidth:600, minHeight:400, decorations:false, resizable:true, title:"ZenFocus"`
- `build.frontendDist: "../dist"`, `build.devUrl: "http://localhost:5173"`
- `bundle.targets`: `["appimage", "nsis", "dmg"]` (yoki `"app"` macOS uchun)
- `bundle.externalBin: ["bin/yt-dlp"]`
- `app.security.assetProtocol.enable: true` + scope
- `app.security.csp`: 6.3'dagi qiymat

### 8.2 Ikonkalar — YANGI YARATILADI
Hozirgi Electron build'da **app ikonka yo'q** (default Electron ikonka). Tauri majburiy ikonka talab qiladi: `src-tauri/icons/` — `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns` (macOS), `icon.ico` (Windows). `tauri icon <source.png>` CLI bilan generatsiya qilinadi. Tray ikonka alohida (`tray-icon.png` mavjud).

### 8.3 macOS qo'shimcha (YANGI platforma)
- `.icns` ikonka, `dmg` target
- Imzo/notarization ixtiyoriy (rasmiy tarqatish uchun Apple Developer hisobi kerak; lokal build'da o'tkazib yuborilishi mumkin)
- Kodda mavjud darwin xulqlari (tray menu bar timer, `setVisibleOnAllWorkspaces`) Tauri ekvivalentlari bilan saqlanadi

### 8.4 Script'lar (`package.json`)
- `dev` → `tauri dev`; `build` → `tauri build`; `typecheck`/`lint`/`format` o'zgarmaydi
- `download-ytdlp` → 5.8'ga ko'ra yangilanadi (3 platforma, target-triple nomlash)

### 8.5 Vite config
- `vite-plugin-electron` va `vite-plugin-electron-renderer` **olib tashlanadi**
- React, Tailwind, path alias (`@renderer`, `@shared`, `@`) saqlanadi
- `publicDir: resources` saqlanadi → `bg.jpg`, `bell.mp3`, `rain/forest/cafe.mp3` `/`-relativ qoladi (o'zgarmaydi)

### 8.6 CI/CD (`.github/workflows`)
- **ci.yml:** Bun + `typecheck` (saqlanadi); ixtiyoriy `cargo fmt --check`, `cargo clippy`
- **release.yml:** `v*.*.*` teg bo'yicha. Har platforma uchun matrix (ubuntu/windows/macos), `download-ytdlp` → `tauri build`. macOS runner qo'shiladi. Auto-update artifaktlari Faza 1'da YO'Q.
- Linux **build** bog'liqliklari: `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev` (tray) va boshqalar.
- Linux **runtime kodek** bog'liqliklari (audio dekod uchun — 9.1'ga qarang): `gstreamer1.0-plugins-good` (MP3), AAC/m4a uchun `gstreamer1.0-plugins-bad` + `gstreamer1.0-libav`. AppImage tarqatishda bu plagin'lar hujjatlashtirilishi yoki bundllanishi kerak, aks holda toza tizimda audio buzuq chiqadi.

---

## 9. WEBVIEW RISKLARI VA FALLBACK (UI'ni saqlash uchun KRITIK)

Tauri bundle qilingan Chromium o'rniga **tizim webview** ishlatadi (Linux=WebKitGTK, Windows=WebView2, macOS=WKWebView). Sizning "ajoyib ko'rinish"ingizga tegadigan xavflar:

| Xususiyat | WebKitGTK (Linux) | WebView2 (Win10) | WKWebView (macOS) | Fallback kerakmi |
|---|---|---|---|---|
| OKLCH ranglar (~40+ joyda) | ✅ | ⚠️ eski versiyalarda | ✅ | **Ha** — `@supports`+sRGB fallback |
| `color-mix(in oklch)` (aurora text) | ✅ | ⚠️ Chromium <111 | ✅ | **Ha** — statik rang fallback |
| `backdrop-filter` (glass) | ✅ (`-webkit-` bor) | ✅ | ✅ | Yo'q |
| CSS animatsiyalar (aurora, breathe, marquee) | ✅ | ✅ | ✅ | Yo'q |
| `-webkit-app-region: drag` | ✅ | ✅ | ✅ | Yo'q (mini-rejim drag'ni test qilish) |
| Notification / localStorage / canvas | ✅ | ✅ | ✅ | Yo'q |

**Majburiy birinchi qadam — "spike":** to'liq migratsiyadan oldin bo'sh Tauri oynasiga hozirgi `index.css` (glass, OKLCH, aurora gradient) joylanib, **Linux WebKitGTK** va **Windows WebView2**'da render tekshiriladi. Glass effekti yoki ranglar buzilsa, fallback'lar (`@supports (color: oklch(...))` bloklari, statik rang) qo'shiladi.

### 9.1 AUDIO DEKOD RISKI (UI render'dan ham muhimroq — bu musiqa ilovasi)
Electron Chromium'ning o'z kodeklarini bundllaydi. **Tauri Linux'da `<audio>` dekodini tizim GStreamer'iga topshiradi** — baytlarni element'ga yetkazish (asset protokol + CSP) dekodlanishini KAFOLATLAMAYDI:
- Lokal fayl + SomaFM radio = MP3 (`gstreamer1.0-plugins-good` — odatda bor).
- **YouTube `-x --audio-quality 0` oqimlari odatda Opus yoki AAC/m4a** — AAC `plugins-bad`/`libav` talab qiladi, toza mashinada **kafolatlanmagan**. Natijada eng muhim funksiya jimgina ishlamay qolishi mumkin.

**Spike audio testini ham o'z ichiga olishi SHART** (render bilan birga): WebKitGTK'da (a) lokal MP3, (b) radio oqimi, (c) haqiqiy YouTube oqimi ijro etib ko'riladi. AAC ishlamasa — yt-dlp argument'larini Opus/MP3 formatga majburlash yoki AppImage'ga GStreamer plagin'larini bundllash hal qilinadi. Bu migratsiyaning asosiy riski (`color-mix` degradatsiyasidan muhimroq).

---

## 10. QAMROVDAN TASHQARI (Faza 2 — keyinroq)

- **Auto-update:** `tauri-plugin-updater`. Tauri'da update artifaktlari **majburiy imzolanadi** (keypair generatsiya: `tauri signer generate`), public key `tauri.conf.json`'ga, private key CI secret'ga. GitHub Releases endpoint. Hozirgi `UPDATER_*` IPC va `use-updater.ts` Faza 1'da stub/no-op qoldiriladi (UI buzilmasligi uchun).

---

## 11. VERIFIKATSIYA (qabul mezonlari)

Dasturchi quyidagilarni **ishlab turgan ilovada** tekshirishi shart:

1. **Timer:** boshlash/pauza/skip, fokus tugaganda bell + bildirishnoma, oyna sarlavhasida `MM:SS`, sessiyalar sikli, preset almashtirish, holat qayta ochishda tiklanadi.
2. **Saqlash:** vazifa/statistika/sozlama qo'shib, **to'liq chiqib** qayta ochilganda saqlanib qolishi (tray'ga yashirish emas — haqiqiy quit).
3. **Mini-rejim:** tray yoki tugma orqali kirish → oyna 320×72, always-on-top, drag ishlaydi; chiqishda avvalgi o'lcham tiklanadi.
4. **Musiqa:**
   - Lokal papka tanlash → fayllar ro'yxati → ijro (asset protokol orqali ovoz chiqishi)
   - YouTube playlist URL → treklar, navigatsiya; single video; radio stansiya — barchasi ovoz chiqarishi (CSP to'g'ri)
   - Volume slider, ambient ovozlar, visualizer
5. **Always-on-top:** Linux'da boshqa oynaga o'tib qaytganda ham ustda turishi (blur reapply).
6. **Tray:** dinamik rangli ikonka rejimga qarab o'zgarishi, menyu amallari (play/pause/skip/mini/show-hide/quit).
7. **Dialog:** papka tanlash, sound tanlash, tasks export/import.
8. **Todoist:** token bilan import.
9. **Til:** uz/en/ru almashishi; **tema:** dark/light.
10. **Ko'rinish:** glass blur, OKLCH ranglar, aurora animatsiyalari **uchala platformada** Electron versiyasiga vizual mos (9-bo'lim spike natijasi).
11. `cargo clippy` toza, `bun run typecheck` toza, uchala platformada build muvaffaqiyatli.

---

## 12. TAVSIYA ETILGAN BOSQICHLAR

1. **Spike (1-kun):** bo'sh Tauri v2 + hozirgi `index.css` → 3 webview'da (a) glass/OKLCH **render** va (b) **audio dekod** (lokal MP3 + radio + YouTube oqimi, ayniqsa WebKitGTK'da — 9.1) tekshiruvi. Yashil chiroq olinmasa (render yoki audio), davom etishdan oldin fallback strategiyasi.
2. **Skelet:** Tauri scaffold, Vite electron-plugin'larsiz, frontend yuklanadi (native funksiyalarsiz).
3. **Store + types:** serde model'lar, `tauri-plugin-store`, get/set command'lar, migration.
4. **Oyna + tray:** window config, mini-rejim, always-on-top, music-panel toggle, tray + event'lar, close-to-tray, single-instance.
5. **Dialog + fs + audio:** folder pick/list, asset protokol + `convertFileSrc`, export/import, sound pick.
6. **yt-dlp sidecar:** download script (3 platforma), 3 command, parse logikasi.
7. **Todoist + qolganlar:** HTTP command, app version, logging.
8. **Frontend refactor:** `src/shared/tauri/api.ts`, 30+ chaqiruv joyi, listen cleanup'lari, CSP.
9. **CSS fallback'lar:** OKLCH/color-mix `@supports`.
10. **Build/CI:** ikonkalar, 3 platforma tauri.conf, release matrix.
11. **Faza 2:** auto-update.
