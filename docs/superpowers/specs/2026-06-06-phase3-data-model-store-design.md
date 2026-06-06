# Phase 3 — Data model va Store — Design

> Status: approved (brainstorm) · Sana: 2026-06-06 · Branch: `tauri-migration`
> Manba reja: Obsidian `ZenFocus Tauri Migration/Faza 3 — Data model va Store.md`, repo `docs/TZ-tauri-migratsiya.md` (§4, §5.6, §7)

## Maqsad

Rust `serde` modellari + `tauri-plugin-store` orqali doimiy saqlash. Bu — migratsiyaning poydevori; busiz UI faqat default ma'lumot bilan ishlaydi. Phase 3 oxirida store'dan o'qish/yozishning 6 jufti backend'da tayyor bo'ladi (frontend ulanishi Faza 4 da).

## Qabul qilingan qarorlar (brainstorm)

1. **Store arxitekturasi:** Rust command orqali (TZ bo'yicha). Frontend `invoke('get_settings')` → Rust store'ni o'qiydi/yozadi. IPC kontrakti Electron bilan bir xil qoladi → Faza 4 wrapper'i oson.
2. **Electron→Tauri data migration:** YO'Q — toza boshlash. Tauri yangi bo'sh store bilan default qiymatlardan boshlaydi. Eski Electron config'idan import qilinmaydi.
3. **Saqlash semantikasi:** har `set_*` command oxirida explicit `store.save()`. Yozishlar tez-tez emas, shuning uchun debounce shart emas.
4. **Deserialize xatosi:** buzilgan/eski enum varianti bo'lsa → default'ga qaytish (warn log), error tarqatmaslik. Bitta yomon yozuv ilovani bricklamasin.

## Arxitektura va oqim

```
Frontend (invoke)  →  commands/store.rs  →  StoreExt: app.store("config.json")
                          ↕ serde                ↕ serde_json::Value
                       models.rs              ~/.local/share/com.madrimov.zenfocus/config.json
```

## 1. Modellar (`src-tauri/src/models.rs`) — eng nozik qism

Modellar TS type'lari (`src/shared/types.ts`) bilan **aniq round-trip mos** bo'lishi shart, chunki bir xil JSON typed frontend'ga oqadi.

### Struct'lar
`#[serde(rename_all = "camelCase")]` bilan: `TimerSettings`, `TimerPreset`, `MusicConfig`, `SavedYtPlaylist`, `SavedMusicFolder`, `RadioStation`, `YoutubeStreamInfo`, `YoutubePlaylistItem`, `AudioFile`, `Subtask`, `Task`, `DailyStat`, `TrayTimerState`.

### Enum qiymatlari — MAJBURIY

`rename_all="camelCase"` faqat **field nomlarini** o'zgartiradi. Enum **qiymatlari** alohida rename talab qiladi (aks holda Rust `ShortBreak` deb serialize qiladi → frontend buziladi):

| Rust enum | TS qiymatlar | Atribut |
|---|---|---|
| `Theme` | `dark`/`light` | `rename_all = "lowercase"` |
| `AmbientSound` | `none`/`rain`/`forest`/`cafe` | `lowercase` |
| `MusicSortMode` | `shuffle`/`alphabetical` | `lowercase` |
| `Locale` | `uz`/`en`/`ru` | `lowercase` |
| `Priority` | `high`/`medium`/`low` | `lowercase` |
| `TrayMode` (`TrayTimerState.mode`) | `focus`/`short-break`/`long-break` | **`kebab-case`** |

### Optional maydonlar
TS'da `?` yoki `| null` bo'lganlar → `Option<T>`:
- `Task.completedAt?` → `Option<i64>`, `#[serde(skip_serializing_if = "Option::is_none")]` (TS'da `?` = yo'q bo'lishi mumkin)
- `DailyStat.skippedSessions?` → `Option<u32>`, `skip_serializing_if`
- `Task.priority: 'high'|'medium'|'low'|null` → `Option<Priority>` (null sifatida serialize bo'ladi, `skip_serializing_if` YO'Q)
- `Task.dueDate: number|null`, `notificationSoundPath`, `activePreset`, `todoistToken`, `MusicConfig.folderPath`/`youtubeUrl` → `Option<...>` null bilan

Har maydon TS'dagi ko'rinishiga qarab `skip_serializing_if` qo'llaniladi yoki qo'llanilmaydi.

### Default'lar va forward migration
- `TimerSettings`, `MusicConfig` uchun `Default` impl (TZ §7.1, §7.2 qiymatlari — `src/shared/types.ts` `DEFAULT_*` bilan bir xil).
- Har strukturaga `#[serde(default)]` — eski store'da yetishmayotgan kalitlar default bilan to'ladi (Electron `applyMigrations` ekvivalenti: `autoStartBreaks`, `autoStartFocus`, `alwaysOnTop`, `activePreset`, `dailyGoal`, `showBreakScreen`, `todoistToken`).

## 2. Store sozlash

- `Cargo.toml`: `tauri-plugin-store = "2"`
- `package.json`: `bun add @tauri-apps/plugin-store`
- `lib.rs`: `.plugin(tauri_plugin_store::Builder::default().build())`
- Store fayli: `config.json` (Electron `config` ekvivalenti) → `~/.local/share/com.madrimov.zenfocus/config.json`
- Kirish: `StoreExt` trait — `app.store("config.json")?`, qiymatlar `serde_json::Value` orqali

## 3. Command'lar (`src-tauri/src/commands/store.rs`)

6 juft get/set:

| Command | Argument | Qaytaradi |
|---|---|---|
| `get_theme` / `set_theme` | `theme` | `Theme` / `void` |
| `get_settings` / `set_settings` | `settings` | `TimerSettings` / `void` |
| `get_tasks` / `set_tasks` | `tasks` | `Vec<Task>` / `void` |
| `get_active_task_id` / `set_active_task_id` | `id` | `Option<String>` / `void` |
| `get_music` / `set_music` | `config` | `MusicConfig` (default bilan merge) / `void` |
| `get_stats` / `set_stats` | `stats` | `Vec<DailyStat>` / `void` |

Umumiy xulq:
- **get:** store'dan kalitni o'qiydi → `serde_json::from_value` bilan deserialize. Kalit yo'q yoki deserialize fail bo'lsa → **default qaytaradi** (`warn!` log), error emas.
- **set:** `serde_json::to_value` → `store.set(key, value)` → **`store.save()`** (explicit).
- `lib.rs` `invoke_handler![...]` ga barchasini ro'yxatdan o'tkazish.
- `capabilities/default.json`: `store:default` permission.

Kalitlar: `theme`, `settings`, `tasks`, `activeTaskId`, `music`, `stats`.

## Tegiladigan fayllar

- `src-tauri/src/models.rs` (yangi)
- `src-tauri/src/commands/store.rs` (yangi) + `src-tauri/src/commands/mod.rs`
- `src-tauri/src/lib.rs`, `Cargo.toml`, `capabilities/default.json`, `package.json`

## Verifikatsiya

- [ ] DevTools: `await window.__TAURI__.core.invoke('get_settings')` → default'lar qaytaradi
- [ ] `set_settings` chaqirilganda `config.json` diskka yoziladi (`~/.local/share/com.madrimov.zenfocus/config.json`)
- [ ] Eski (yetishmaydigan kalitli) JSON yuklanganda default bilan to'ldiriladi
- [ ] **Enum round-trip:** `set` → `get` qilinganda `short-break`, `high`, `dark`, `shuffle` qiymatlari aynan saqlanadi (PascalCase emas)
- [ ] Buzilgan qiymat (qo'lda noto'g'ri JSON yozilsa) → default qaytaradi, ilova crash bo'lmaydi
- [ ] `cargo clippy` toza
- [ ] `bun run typecheck` toza
- [ ] `bun run dev` — regress yo'q
- [ ] `tauri-migration` branchga commit + push
