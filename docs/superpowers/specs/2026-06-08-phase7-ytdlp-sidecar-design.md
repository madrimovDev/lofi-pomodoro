# Faza 7 — yt-dlp sidecar (Dizayn spetsifikatsiyasi)

**Sana:** 2026-06-08
**Branch:** `tauri-migration`
**Status:** Tasdiqlangan (brainstorm) → planning

## Kontekst

ZenFocus Electron→Tauri v2 migratsiyasining 7-fazasi. Faza 1–6 tugagan (store, oyna/tray, dialog/fs/audio — Faza 6 runtime tasdiqlangan). Faza 7 — YouTube musiqa manbasini ta'minlovchi yt-dlp integratsiyasini Electron `child_process.execFile`'dan **Tauri shell sidecar**'ga ko'chiradi.

**Bu migratsiyaning eng yuqori riski (TZ §9.1):** Tauri Linux'da `<audio>` dekodini tizim GStreamer'iga topshiradi. YouTube `-x` oqimlari odatda **Opus yoki AAC/m4a** — toza mashinada (`gstreamer1.0-plugins-bad`/`libav` bo'lmasa) dekod kafolatlanmagan. Eng muhim funksiya jimgina ishlamay qolishi mumkin.

## Qarorlar (brainstorm)

1. **De-risk birinchi** — sidecar qurishdan oldin audio dekod spike'i.
2. **yt-dlp versiyasi: `releases/latest`** (hozirgidek; YouTube o'zgarishlariga chidamliroq, reproducibility'dan voz kechiladi).
3. **Faqat Linux** — dev + runtime acceptance shu mashinada; Windows/macOS keyingi CI fazasida (`release.yml`).

## Doirasidan tashqari (YAGNI)

- Windows/macOS binary'lar va target-triple'lari (CI fazasi).
- yt-dlp versiya pin qilish.
- CSP o'zgartirishlari (allaqachon tayyor — pastga qarang).
- Auto-update artifaktlari.

---

## 1. Spike (de-risk) — birinchi qadam

**Maqsad:** YouTube oqimini WebKitGTK `<audio>`'da dekod qilish strategiyasini *qaror bilan* aniqlash — sidecar qurishdan oldin.

**Usul:** Sidecar'dan ajratilgan. yt-dlp qo'lda terminaldan ishga tushiriladi → stream URL olinadi → ishlab turgan Tauri app webview'ining devtools console'ida `new Audio(url).play()` (yoki `<audio>` element) bilan dekod sinaladi. Bu plumbing'ni decode o'zgaruvchisidan izolyatsiya qiladi.

### Muhim ogohlantirish — false pass

Bu **dev mashinada** `faad`, `fdkaac`, `libav` (`avdec_aac`) **bor** — ya'ni AAC ham, Opus ham bu yerda muammosiz dekod bo'ladi. Shuning uchun "yashil chiroq" toza foydalanuvchi mashinasini ifodalamaydi. Spike'ning asl deliverable'i — **eng kam bog'liqlikli formatni** tanlash va kerakli GStreamer plagin'larini hujjatlash.

### To'rt tekshiruv (bir o'tishda)

1. **Aniq production argumentlar bilan URL olish** — spike yt-dlp chaqiruvi ayni `-g -x --audio-quality 0 --no-playlist <url>` ishlatadi. Default args boshqa format beradi → natija production'ga ko'chmaydi.
2. **Format matritsasi:**
   - (a) default `bestaudio` (production args)
   - (b) majburiy Opus/WebM: `-f 'bestaudio[ext=webm]'`
   - (c) majburiy AAC/m4a: `-f 'bestaudio[ext=m4a]'`
   - Bittasi tushib qolsa — qaysi argumentni ship qilishni aniq bilamiz (ikkinchi spike raunti kerak emas).
3. **Dekod muhitini xarakterlash** — `gst-inspect-1.0 | grep -iE 'opus|aac|faad|libav'` natijasini hujjatlash. Dev mashinada hammasi mavjud → xulosa = toza AppImage uchun kerakli plagin'lar ro'yxati (kelgusi CI faza uchun).
4. **Oddiy video VA jonli oqim (`isLive`)** — jonli oqimlar ko'pincha HLS/m4a (AAC), VOD'dan boshqa format yo'li. Ikkalasi ham sinaladi (kod `isLive` shoxiga ega).

### Spike deliverable

Hujjatlangan qaror:
- Production `yt_get_stream` qaysi format argumentlarini ishlatadi (default `-x --audio-quality 0`, yoki majburiy format flagi).
- AppImage qaysi GStreamer plagin'larini talab qiladi (kelgusi CI/packaging faza uchun eslatma).

---

## 2. Backend (`music.rs` + shell sidecar)

### Shell plagini infratuzilmasi

- `Cargo.toml`: `tauri-plugin-shell = "2"`
- `lib.rs`: `.plugin(tauri_plugin_shell::init())`
- `tauri.conf.json`: `bundle.externalBin: ["bin/yt-dlp"]`
- **`capabilities/default.json`: shell sidecar permission qo'shiladi.** Bu MAJBURIY — Cargo dep + plugin init + externalBin yetarli emas; busiz sidecar runtime'da ishlamaydi. Aniq permission token sintaksisi (`tauri-plugin-shell` v2 da o'zgargan) planning bosqichida **context7**'dan olinadi — xotiradan qayta tiklanmaydi.

### Uchta command (`commands/music.rs`ga qo'shiladi)

| Command | Argumentlar | Qaytaradi (Rust → frontend) | Timeout |
|---|---|---|---|
| `yt_check` | `--version` | `bool` | 8s |
| `yt_get_stream` | `-g -x --audio-quality 0 --no-playlist <url>` (spike natijasiga ko'ra format flagi qo'shilishi mumkin) + `--get-title --no-playlist` + `--print %(is_live)s --no-playlist` | `YoutubeStreamInfo \| {error: string}` | 30s |
| `yt_get_playlist` | `--flat-playlist --print %(id)s\t%(title)s <url>` | `YoutubePlaylistItem[] \| {error: string}` | 60s |

**Implementatsiya detallari (Electron'dan ko'chiriladi — `src/main/ipc/music.ipc.ts`):**
- Sidecar chaqiruvi: `app.shell().sidecar("yt-dlp")?.args([...]).output().await`.
- `yt_check`: `--version` muvaffaqiyatli → `true`, aks holda `false`.
- `yt_get_stream`: uchta chaqiruv parallel (stream `-g`, title `--get-title`, `is_live` `--print`). `is_live` chaqiruvi xato bo'lsa `'False'`'ga fallback. Natija: `streamUrl` (ko'p satr bo'lsa birinchisi), `title` (birinchi satr), `isLive` (`true`bilan boshlansa).
- `yt_get_playlist`: tab-bilan-ajratilgan satrlar parse qilinadi (`id` = tab'dan oldin, `title` = keyin); bo'sh satrlar filtrlanadi.
- **Xato xabarlari aynan o'zbekcha saqlanadi:** `yt-dlp` topilmasa "yt-dlp topilmadi. Iltimos avval o'rnating." / "yt-dlp topilmadi."; umumiy stream xatosi "URL dan stream olishda xatolik yuz berdi."; playlist xatosi "Playlist ma'lumotlarini olishda xatolik."

### Download skripti (`scripts/download-ytdlp.mjs`)

- **Faqat Linux**, `releases/latest`'dan: `https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp`.
- Manzil: `src-tauri/bin/yt-dlp-x86_64-unknown-linux-gnu` (**target-triple suffiks majburiy** — Tauri sidecar buni dev'da ham talab qiladi).
- `chmod 0o755`.

---

## 3. Frontend

### `src/shared/tauri/music.ts` (mavjud `musicApi`ga qo'shiladi)

```ts
ytCheck: () => invoke<boolean>('yt_check'),
ytGetStream: (url: string) => invoke<YoutubeStreamInfo | { error: string }>('yt_get_stream', { url }),
ytGetPlaylist: (url: string) => invoke<YoutubePlaylistItem[] | { error: string }>('yt_get_playlist', { url }),
```

`YoutubeStreamInfo` (`{streamUrl, title, isLive}`) va `YoutubePlaylistItem` (`{id, title}`) — `@shared/types`'dan, o'zgarmaydi.

### `use-music.tsx` (7 ta chaqiruv joyi)

`window.electronApi?.ytCheck/ytGetStream/ytGetPlaylist` → `musicApi.yt*`. Qaytish tiplari **aynan bir xil** (`{error}` union saqlanadi) → hook logikasi o'zgarmaydi. `yt*` plain `invoke` (listener yo'q → `useEffect` cleanup muammosi yo'q).

Chaqiruv joylari: 162 (`ytCheck`), 245/340/487/494 (`ytGetStream`), 327/481 (`ytGetPlaylist`).

### CSP

Allaqachon tayyor (`tauri.conf.json`):
- `media-src 'self' asset: https: blob:` — googlevideo oqimlari va radio.
- `connect-src 'self' asset: https://api.todoist.com ipc: http://ipc.localhost`.

Faza 7'da o'zgartirish shart emas — runtime'da tasdiqlanadi.

---

## 4. Verification

Test framework yo'q → `tsc` + `clippy` + **runtime acceptance**:

1. yt-dlp mavjud → `ytCheck` `true` qaytaradi.
2. Single YouTube video URL → ovoz chiqadi.
3. YouTube playlist URL → treklar ro'yxati to'ldiriladi, navigatsiya ishlaydi.
4. Jonli oqim (`isLive`) → ovoz chiqadi.
5. Radio (SomaFM) hali ishlaydi — regressiya yo'q.
6. yt-dlp yo'q holatda graceful degrade (`ytAvailable=false`, UI buzulmaydi).

---

## Risklar va eslatmalar

- **Audio dekod (eng yuqori risk):** Spike bilan oldindan ushlanadi. Spike yashil bo'lsa ham toza mashina uchun GStreamer plagin'lari hujjatlanadi.
- **Shell capability permission:** planning'da context7'dan aniq sintaksis olinadi.
- **`renderer yt* → musicApi`:** preload `api.d.ts`/`index.ts` Electron tomonida qoladi (`main` branch tegilmaydi); Tauri tomonida faqat `music.ts` + `use-music.tsx` o'zgaradi.
- **AppState/deadlock:** bu fazada AppState lock'iga tegilmaydi (sidecar commandlari store/window holatiga bog'liq emas).
