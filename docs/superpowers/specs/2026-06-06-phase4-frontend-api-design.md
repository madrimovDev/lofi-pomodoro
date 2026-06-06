# Faza 4 — Frontend API qatlami — Design

> Status: approved (brainstorm) · Sana: 2026-06-06 · Branch: `tauri-migration`
> Manba reja: Obsidian `ZenFocus Tauri Migration/Faza 4 — Frontend API qatlami.md`, repo `docs/TZ-tauri-migratsiya.md` (§6.1)
> Bog'liq: Faza 3 (`docs/superpowers/specs/2026-06-06-phase3-data-model-store-design.md`) — backend tayyor.

## Maqsad

Renderer'ni Tauri backendiga ulash — `window.electronApi` (hozir Tauri'da `undefined`, shuning uchun barcha store chaqiruvlari jim no-op) o'rniga haqiqiy `invoke()`. Natija: sozlama, vazifa, statistika, tema, musiqa-config **haqiqatan saqlanadi va yuklanadi**.

## Qabul qilingan qarorlar (brainstorm)

1. **Wrapper strategiyasi:** Toza `api` modul (`src/shared/tauri/api.ts`), **faqat 12 store metodi**. 5 faylda store chaqiruvlari `api.x()`ga ko'chadi. Non-store metodlar (window, tray, music-folder, yt-dlp, updater, export/import) tegilmaydi — ular Faza 5/6/7.
2. **api.ts xulqi:** Yalang'och, type'langan `invoke` wrapper. Xato/fallback'ni chaqiruvchi boshqaradi — mavjud `.catch(console.error)` + `hydratedRef` pattern saqlanadi. Default'lar faqat bir joyda (Rust backend).
3. **Browser-only vite dev fallback:** Qo'shilmaydi (YAGNI). Asosiy dev `tauri dev`; `dev:vite` (Tauri runtime'siz) da `api` reject bo'ladi — qabul qilinadi.
4. **FOUC:** `toggle-theme`ning mavjud fallback'i saqlanadi, qayta loyihalanmaydi.

## Arxitektura va oqim

```
Komponent/hook  →  api.getSettings()       →  invoke('get_settings')              →  Rust command  →  config.json
                   api.setSettings(s)       →  invoke('set_settings', { settings })
```

`api` — `src/shared/tauri/api.ts`dan import qilinadigan oddiy obyekt. Har metod `@tauri-apps/api/core`ning `invoke`ini type bilan o'raydi. `@tauri-apps/api ^2` allaqachon `package.json`da (prerequisite bor).

## 1. `api.ts` dizayni — eng yuqori xavf: arg-nomlari

`invoke` argument nomlari **typecheck bilan tekshirilMAYDI** — noto'g'ri nom backend'da `None`/default'ni jim yozadi (silent bug, crash emas). `api.ts` shu kontraktning **yagona nuqtasi**; arg nomlari Faza 3 integration notes bilan aniq mos kelishi shart.

```ts
import { invoke } from '@tauri-apps/api/core'
import type { Theme, TimerSettings, Task, MusicConfig, DailyStat } from '@/shared/types'

export const api = {
  getTheme:        () => invoke<Theme>('get_theme'),
  setTheme:        (theme: Theme) => invoke<void>('set_theme', { theme }),
  getSettings:     () => invoke<TimerSettings>('get_settings'),
  setSettings:     (settings: TimerSettings) => invoke<void>('set_settings', { settings }),
  getTasks:        () => invoke<Task[]>('get_tasks'),
  setTasks:        (tasks: Task[]) => invoke<void>('set_tasks', { tasks }),
  getActiveTaskId: () => invoke<string | null>('get_active_task_id'),
  setActiveTaskId: (activeTaskId: string | null) => invoke<void>('set_active_task_id', { activeTaskId }),
  getMusic:        () => invoke<MusicConfig>('get_music'),
  setMusic:        (music: MusicConfig) => invoke<void>('set_music', { music }),
  getStats:        () => invoke<DailyStat[]>('get_stats'),
  setStats:        (stats: DailyStat[]) => invoke<void>('set_stats', { stats }),
}
```

**Kritik arg-nomlari** (xato qilish oson, jim null yozadi):
- `set_music` → `{ music }` (NE `config`)
- `set_active_task_id` → `{ activeTaskId }` (NE `id`)
- qolganlar bir so'zli: `{ theme }`, `{ settings }`, `{ tasks }`, `{ stats }`

Import yo'li (`@/shared/types` yoki nisbiy) mavjud loyiha konventsiyasiga moslanadi.

## 2. Chaqiruv joylari migratsiyasi (5 fayl)

| Fayl | O'zgarish |
|---|---|
| `src/renderer/hooks/use-settings.tsx` | `getSettings`/`setSettings` → `api`. To'liq store. |
| `src/renderer/hooks/use-tasks.tsx` | `getTasks`/`getActiveTaskId`/`setTasks`/`setActiveTaskId` → `api`. To'liq store. |
| `src/renderer/hooks/use-stats.tsx` | `getStats`/`setStats` → `api`. To'liq store. |
| `src/renderer/components/toggle-theme.tsx` | `getTheme`/`setTheme` → `api`. DOM fallback saqlanadi. |
| `src/renderer/hooks/use-music.tsx` | **Ataylab aralash**: `getMusic`/`setMusic` → `api`; non-store (`pickMusicFolder`, `listMusicFiles`, `ytCheck`, `ytGetStream`, `ytGetPlaylist`) → `window.electronApi?.` da qoladi (Faza 6/7). |

**Saqlanadigan pattern'lar:**
- `hydratedRef` deferral (tasks, stats) — o'zgarishsiz.
- Mount'da `get` + `.catch(console.error)`.
- Optional chaining (`?.`) `api` chaqiruvlarida olib tashlanadi (`api` har doim mavjud).
- **Har `set` chaqiruvi `.catch(console.error)` oladi** — yalang'och wrapper'da disk xatosi unhandled promise rejection bo'lmasligi uchun. (Eski kodda ba'zi set'lar fire-and-forget edi; migratsiyada hammasiga `.catch` qo'shiladi.)

## 3. Tegilmaydigan narsalar (doira chegarasi)

Faza 4 dan keyin **ma'lumot saqlanadi, lekin native xulq hali o'lik** — window-control, tray, music folder/yt-dlp, updater, export/import ishlamaydi (`window.electronApi` `undefined` → no-op). Bu kutilgan.

Tegilmaydigan fayllar: `use-tray-sync.ts`, `use-updater.ts`, `window-control.tsx`, `settings-panel.tsx` (sound/todoist/alwaysOnTop/miniMode), `task-panel.tsx` (export/import), `app/layout/main.tsx` + `app/layout/index.tsx` (window/mini).

`window.electronApi` global tipi (`src/preload/api.d.ts`) **saqlanadi** — non-store chaqiruvlar shu tipdan foydalanadi (Faza 5–8 gacha).

**Tashqarida qolgan qarorlar (Faza 4 emas):**
- FOUC'ni butunlay yo'q qilish (theme'ni localStorage'ga) — kelajak mumkin.
- Browser-only vite dev fallback — qo'shilmaydi (YAGNI).

## 4. Verifikatsiya — runtime acceptance gate

Typecheck arg-kontraktni tekshirMAYDI — **faqat runtime tekshiradi** (Faza 3'dagi saboq, bu yerda o'tkirroq: xato jim, crash emas):

- [ ] Vazifa qo'shish → **to'liq chiqib** (tray emas, oynani yopib) → qayta ochish → vazifa saqlanadi
- [ ] Sozlama o'zgartirish (masalan focus 25→30) → qayta ochishda saqlanadi
- [ ] Fokus seansini tugatish → statistika +1, streak to'g'ri
- [ ] Tema dark/light → saqlanadi
- [ ] Musiqa config (volume, sortMode, savedPlaylists) → saqlanadi
- [ ] `~/.local/share/com.madrimov.zenfocus/config.json`da to'g'ri kalitlar (`music`, `activeTaskId` jim `null` emas)
- [ ] `bun run typecheck` toza

## Tegiladigan fayllar

- `src/shared/tauri/api.ts` (yangi)
- `src/renderer/hooks/use-settings.tsx`, `use-tasks.tsx`, `use-stats.tsx`, `use-music.tsx` (store qismi)
- `src/renderer/components/toggle-theme.tsx`
