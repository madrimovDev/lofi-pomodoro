# Faza 4 — Frontend API qatlami Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Renderer'ni Faza 3 Tauri store backendiga ulash — `window.electronApi?.x()` (Tauri'da `undefined` → jim no-op) o'rniga type'langan `invoke()` wrapper orqali ma'lumotni haqiqatan saqlash/yuklash.

**Architecture:** Yangi `src/shared/tauri/api.ts` — yalang'och, type'langan `invoke` wrapper, faqat 12 store metodi. 5 renderer faylida store chaqiruvlari `api.x()`ga ko'chadi. Non-store chaqiruvlar (window/tray/music-folder/yt/updater/export) tegilmaydi — `window.electronApi?.`da qoladi (Faza 5/6/7). Mavjud `hydratedRef` + `.catch` pattern saqlanadi.

**Tech Stack:** React 19 + TypeScript, `@tauri-apps/api ^2` (`invoke`, allaqachon o'rnatilgan), Vite/`@shared/*` alias, Bun. **Test framework yo'q** → har task `bun run typecheck` bilan, yakuniy task runtime acceptance bilan tasdiqlanadi.

**Manba spec:** `docs/superpowers/specs/2026-06-06-phase4-frontend-api-design.md`

---

## ⚠️ Eng yuqori xavf (butun reja davomida eslab turing)

`invoke` argument nomlari **typecheck bilan tekshirilMAYDI**. Noto'g'ri nom backend'da `None`/default'ni **jim** yozadi (crash emas). `api.ts` shu kontraktning yagona nuqtasi. Kritik:
- `set_music` → `{ music }` (NE `config`)
- `set_active_task_id` → `{ activeTaskId }` (NE `id`)

Bu faqat Task 6 runtime verifikatsiyasida tutiladi.

---

## Fayl strukturasi

| Fayl | Mas'uliyat | Holat |
|---|---|---|
| `src/shared/tauri/api.ts` | 12 store metodi, type'langan `invoke` wrapper | Yangi |
| `src/renderer/hooks/use-settings.tsx` | `getSettings`/`setSettings` → `api` | O'zgartirish |
| `src/renderer/components/toggle-theme.tsx` | `getTheme`/`setTheme` → `api` (DOM fallback saqlanadi) | O'zgartirish |
| `src/renderer/hooks/use-stats.tsx` | `getStats`/`setStats` → `api` | O'zgartirish |
| `src/renderer/hooks/use-tasks.tsx` | `getTasks`/`getActiveTaskId`/`setTasks`/`setActiveTaskId` → `api` | O'zgartirish |
| `src/renderer/hooks/use-music.tsx` | `getMusic`/`setMusic` → `api` (non-store tegilmaydi) | O'zgartirish (qisman) |

---

### Task 1: `api.ts` store wrapper yaratish

**Files:**
- Create: `src/shared/tauri/api.ts`

- [ ] **Step 1: api.ts yaratish**

`src/shared/tauri/api.ts` yarat:

```ts
import { invoke } from '@tauri-apps/api/core';
import type { Theme, TimerSettings, Task, MusicConfig, DailyStat } from '@shared/types';

/**
 * Faza 3 store backendiga type'langan invoke wrapper (12 metod).
 * DIQQAT: arg nomlari (`music`, `activeTaskId`, ...) backend kontrakti bilan
 * aynan mos kelishi shart — typecheck buni tekshirmaydi, faqat runtime tekshiradi.
 */
export const api = {
  getTheme: () => invoke<Theme>('get_theme'),
  setTheme: (theme: Theme) => invoke<void>('set_theme', { theme }),

  getSettings: () => invoke<TimerSettings>('get_settings'),
  setSettings: (settings: TimerSettings) => invoke<void>('set_settings', { settings }),

  getTasks: () => invoke<Task[]>('get_tasks'),
  setTasks: (tasks: Task[]) => invoke<void>('set_tasks', { tasks }),

  getActiveTaskId: () => invoke<string | null>('get_active_task_id'),
  setActiveTaskId: (activeTaskId: string | null) =>
    invoke<void>('set_active_task_id', { activeTaskId }),

  getMusic: () => invoke<MusicConfig>('get_music'),
  setMusic: (music: MusicConfig) => invoke<void>('set_music', { music }),

  getStats: () => invoke<DailyStat[]>('get_stats'),
  setStats: (stats: DailyStat[]) => invoke<void>('set_stats', { stats }),
};
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: PASS — `@tauri-apps/api/core` va `@shared/types` import'lari yechiladi, xato yo'q. (`api` hali ishlatilmaydi, lekin TS unused-export'dan shikoyat qilmaydi.)

- [ ] **Step 3: Commit**

```bash
git add src/shared/tauri/api.ts
git commit -m "feat(tauri): Faza 4 — store invoke wrapper (api.ts)"
```

---

### Task 2: `use-settings.tsx` va `toggle-theme.tsx` migratsiyasi

To'liq store fayllar, oddiy almashtirish.

**Files:**
- Modify: `src/renderer/hooks/use-settings.tsx`
- Modify: `src/renderer/components/toggle-theme.tsx`

- [ ] **Step 1: use-settings.tsx — import qo'shish**

`src/renderer/hooks/use-settings.tsx` 2-3 qatorlar orasiga `api` import qo'sh. Hozir:
```ts
import { DEFAULT_TIMER_SETTINGS, type TimerSettings } from '@shared/types';
import { getT, type TranslationKey } from '@shared/i18n';
```
Bo'lsin:
```ts
import { DEFAULT_TIMER_SETTINGS, type TimerSettings } from '@shared/types';
import { getT, type TranslationKey } from '@shared/i18n';
import { api } from '@shared/tauri/api';
```

- [ ] **Step 2: use-settings.tsx — getSettings almashtirish**

Hozir (20-24 qatorlar):
```ts
  useEffect(() => {
    window.electronApi?.getSettings()
      .then(s => { if (s) setSettings({ ...DEFAULT_TIMER_SETTINGS, ...s }); })
      .catch(err => console.error('getSettings failed:', err));
  }, []);
```
Bo'lsin:
```ts
  useEffect(() => {
    api.getSettings()
      .then(s => { if (s) setSettings({ ...DEFAULT_TIMER_SETTINGS, ...s }); })
      .catch(err => console.error('getSettings failed:', err));
  }, []);
```

- [ ] **Step 3: use-settings.tsx — setSettings almashtirish**

Hozir (26-30 qatorlar):
```ts
  const updateSettings = (patch: Partial<TimerSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    window.electronApi?.setSettings(next);
  };
```
Bo'lsin (set'ga `.catch` qo'shiladi — yalang'och wrapper'da unhandled rejection bo'lmasligi uchun):
```ts
  const updateSettings = (patch: Partial<TimerSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    api.setSettings(next).catch(err => console.error('setSettings failed:', err));
  };
```

- [ ] **Step 4: toggle-theme.tsx — import qo'shish**

`src/renderer/components/toggle-theme.tsx` 4-qatordan keyin qo'sh. Hozir:
```ts
import type { Theme } from '@shared/types';
```
Bo'lsin:
```ts
import type { Theme } from '@shared/types';
import { api } from '@shared/tauri/api';
```

- [ ] **Step 5: toggle-theme.tsx — getTheme almashtirish (DOM fallback saqlanadi)**

Hozir (9-15 qatorlar):
```ts
  useEffect(() => {
    if (window.electronApi) {
      window.electronApi.getTheme().then(setTheme).catch(err => console.error('getTheme failed:', err));
    } else {
      setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    }
  }, []);
```
Bo'lsin (invoke har doim mavjud; xato bo'lsa DOM'dan fallback — FOUC oldini olish saqlanadi):
```ts
  useEffect(() => {
    api.getTheme()
      .then(setTheme)
      .catch(err => {
        console.error('getTheme failed:', err);
        setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
      });
  }, []);
```

- [ ] **Step 6: toggle-theme.tsx — setTheme almashtirish**

Hozir (22-26 qatorlar):
```ts
  const handleToggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    window.electronApi?.setTheme(next);
  };
```
Bo'lsin:
```ts
  const handleToggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    api.setTheme(next).catch(err => console.error('setTheme failed:', err));
  };
```

- [ ] **Step 7: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/hooks/use-settings.tsx src/renderer/components/toggle-theme.tsx
git commit -m "feat(tauri): Faza 4 — use-settings va toggle-theme api'ga ko'chirish"
```

---

### Task 3: `use-stats.tsx` va `use-tasks.tsx` migratsiyasi

`hydratedRef` deferral pattern'li fayllar — pattern o'zgarmaydi, faqat chaqiruvlar `api`ga.

**Files:**
- Modify: `src/renderer/hooks/use-stats.tsx`
- Modify: `src/renderer/hooks/use-tasks.tsx`

- [ ] **Step 1: use-stats.tsx — import qo'shish**

`src/renderer/hooks/use-stats.tsx` 3-qatordan keyin qo'sh. Hozir:
```ts
import { type DailyStat } from '@shared/types';
import { dateKey } from '@shared/lib/date';
```
Bo'lsin:
```ts
import { type DailyStat } from '@shared/types';
import { dateKey } from '@shared/lib/date';
import { api } from '@shared/tauri/api';
```

- [ ] **Step 2: use-stats.tsx — getStats almashtirish**

Hozir (48-53 qatorlar):
```ts
  useEffect(() => {
    window.electronApi?.getStats()
      .then((s) => { if (s) setStatsState(s); })
      .catch(err => console.error('getStats failed:', err))
      .finally(() => { hydratedRef.current = true; });
  }, []);
```
Bo'lsin:
```ts
  useEffect(() => {
    api.getStats()
      .then((s) => { if (s) setStatsState(s); })
      .catch(err => console.error('getStats failed:', err))
      .finally(() => { hydratedRef.current = true; });
  }, []);
```

- [ ] **Step 3: use-stats.tsx — setStats almashtirish**

Hozir (56-59 qatorlar):
```ts
  useEffect(() => {
    if (!hydratedRef.current) return;
    window.electronApi?.setStats(stats);
  }, [stats]);
```
Bo'lsin:
```ts
  useEffect(() => {
    if (!hydratedRef.current) return;
    api.setStats(stats).catch(err => console.error('setStats failed:', err));
  }, [stats]);
```

- [ ] **Step 4: use-tasks.tsx — import qo'shish**

`src/renderer/hooks/use-tasks.tsx` 2-qatordan keyin qo'sh. Hozir:
```ts
import { type Subtask, type Task } from '@shared/types';
```
Bo'lsin:
```ts
import { type Subtask, type Task } from '@shared/types';
import { api } from '@shared/tauri/api';
```

- [ ] **Step 5: use-tasks.tsx — init (getTasks + getActiveTaskId) almashtirish**

Hozir (49-60 qatorlar):
```ts
  useEffect(() => {
    Promise.all([
      window.electronApi?.getTasks(),
      window.electronApi?.getActiveTaskId(),
    ])
      .then(([t, id]) => {
        if (t) setTasksState(t);
        if (id !== undefined) setActiveTaskIdState(id ?? null);
      })
      .catch(err => console.error('tasks init failed:', err))
      .finally(() => { hydratedRef.current = true; });
  }, []);
```
Bo'lsin:
```ts
  useEffect(() => {
    Promise.all([
      api.getTasks(),
      api.getActiveTaskId(),
    ])
      .then(([t, id]) => {
        if (t) setTasksState(t);
        if (id !== undefined) setActiveTaskIdState(id ?? null);
      })
      .catch(err => console.error('tasks init failed:', err))
      .finally(() => { hydratedRef.current = true; });
  }, []);
```

- [ ] **Step 6: use-tasks.tsx — setTasks va setActiveTaskId almashtirish**

Hozir (63-71 qatorlar):
```ts
  useEffect(() => {
    if (!hydratedRef.current) return;
    window.electronApi?.setTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    window.electronApi?.setActiveTaskId(activeTaskId);
  }, [activeTaskId]);
```
Bo'lsin:
```ts
  useEffect(() => {
    if (!hydratedRef.current) return;
    api.setTasks(tasks).catch(err => console.error('setTasks failed:', err));
  }, [tasks]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    api.setActiveTaskId(activeTaskId).catch(err => console.error('setActiveTaskId failed:', err));
  }, [activeTaskId]);
```

- [ ] **Step 7: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/hooks/use-stats.tsx src/renderer/hooks/use-tasks.tsx
git commit -m "feat(tauri): Faza 4 — use-stats va use-tasks api'ga ko'chirish"
```

---

### Task 4: `use-music.tsx` store qismi migratsiyasi (aralash fayl)

**Faqat** `getMusic` (1 joy) va `setMusic` (3 joy) `api`ga. Non-store chaqiruvlar (`ytCheck`, `listMusicFiles`, `pickMusicFolder`, `ytGetStream`, `ytGetPlaylist`) **tegilmaydi** — `window.electronApi?.`da qoladi.

**Files:**
- Modify: `src/renderer/hooks/use-music.tsx`

- [ ] **Step 1: import qo'shish**

`src/renderer/hooks/use-music.tsx` boshidagi import bloklaridan keyin (`@shared/types`dan `DEFAULT_MUSIC_CONFIG`, `MusicConfig` import qilingan blok ostiga) `api` import qo'sh:
```ts
import { api } from '@shared/tauri/api';
```
(Mavjud `@shared/...` import'lari yonida joylashtir; aniq qatorni mavjud import bloki oxiriga qo'y.)

- [ ] **Step 2: getMusic almashtirish (ytCheck tegilmaydi)**

Hozir (156-163 qatorlar):
```ts
  useEffect(() => {
    window.electronApi?.getMusic()
      .then(c => { if (c) setConfig({ ...DEFAULT_MUSIC_CONFIG, ...c }); })
      .catch(err => console.error('getMusic failed:', err));
    window.electronApi?.ytCheck()
      .then(ok => setYtAvailable(ok))
      .catch(() => setYtAvailable(false));
  }, []);
```
Bo'lsin (faqat `getMusic` → `api`; `ytCheck` o'zgarmaydi — Faza 7):
```ts
  useEffect(() => {
    api.getMusic()
      .then(c => { if (c) setConfig({ ...DEFAULT_MUSIC_CONFIG, ...c }); })
      .catch(err => console.error('getMusic failed:', err));
    window.electronApi?.ytCheck()
      .then(ok => setYtAvailable(ok))
      .catch(() => setYtAvailable(false));
  }, []);
```

- [ ] **Step 3: setMusic — updateConfig (291-qator) almashtirish**

Hozir (289-292 qatorlar):
```ts
  const updateConfig = (patch: Partial<MusicConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    window.electronApi?.setMusic(next);
  };
```
Bo'lsin:
```ts
  const updateConfig = (patch: Partial<MusicConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    api.setMusic(next).catch(err => console.error('setMusic failed:', err));
  };
```

- [ ] **Step 4: setMusic — qolgan 2 joyni almashtirish (516, 525-qatorlar)**

`src/renderer/hooks/use-music.tsx`da qolgan **ikkita** `window.electronApi?.setMusic(next);` chaqiruvini (taxminan 516 va 525-qatorlar) quyidagiga almashtir:
```ts
    api.setMusic(next).catch(err => console.error('setMusic failed:', err));
```
Almashtirishdan oldin tasdiqla: `grep -n "setMusic" src/renderer/hooks/use-music.tsx` endi **faqat `api.setMusic`** ko'rsatishi kerak (`window.electronApi?.setMusic` qolmasligi kerak). Har ikki joyning `next` o'zgaruvchisi mahalliy doirada aniqlangan — kontekstni buzma, faqat chaqiruv qatorini almashtir.

- [ ] **Step 5: Tekshiruv — getMusic/setMusic to'liq ko'chganini tasdiqlash**

Run: `grep -n "electronApi?.getMusic\|electronApi?.setMusic" src/renderer/hooks/use-music.tsx`
Expected: **bo'sh natija** (hech qaysi store chaqiruvi qolmagan). Non-store (`electronApi?.ytCheck`, `electronApi?.listMusicFiles`, va h.k.) hali qolishi KERAK — ularni o'zgartirma.

- [ ] **Step 6: Typecheck**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/hooks/use-music.tsx
git commit -m "feat(tauri): Faza 4 — use-music store qismini api'ga ko'chirish"
```

---

### Task 5: Yakuniy tekshiruv — barcha store chaqiruvlari ko'chganini tasdiqlash

Kod o'zgarishi yo'q — to'liqlikni tasdiqlash.

**Files:** (tekshiruv)

- [ ] **Step 1: Hech qaysi STORE chaqiruvi electronApi'da qolmaganini tasdiqlash**

Run: `grep -rn "electronApi?\.\(getTheme\|setTheme\|getSettings\|setSettings\|getTasks\|setTasks\|getActiveTaskId\|setActiveTaskId\|getMusic\|setMusic\|getStats\|setStats\)" src/renderer`
Expected: **bo'sh natija** — barcha 12 store metodi `api`ga ko'chgan.

- [ ] **Step 2: Non-store chaqiruvlari hali joyida ekanini tasdiqlash (regress yo'q)**

Run: `grep -rn "electronApi?\." src/renderer | grep -vE "getTheme|setTheme|getSettings|setSettings|getTasks|setTasks|getActiveTaskId|setActiveTaskId|getMusic|setMusic|getStats|setStats"`
Expected: window-control, use-tray-sync, use-updater, settings-panel, task-panel, use-music (yt/folder) chaqiruvlari ko'rinadi — bular Faza 5/6/7, ataylab qoldirilgan.

- [ ] **Step 3: Typecheck (yakuniy)**

Run: `bun run typecheck`
Expected: PASS.

---

### Task 6: Runtime acceptance verifikatsiyasi (ASOSIY DARVOZA)

Typecheck arg-kontraktni tekshirMAYDI — bu yagona haqiqiy darvoza. **Inson tomonidan** qo'lda bajariladi (Tauri oyna + DevTools/disk).

**Files:** (verifikatsiya — kod yo'q)

- [ ] **Step 1: Ilovani ishga tushirish**

Run: `bun run dev`
Expected: Tauri oynasi ochiladi, UI default ma'lumot bilan ko'rinadi, console'da xato yo'q.

- [ ] **Step 2: Vazifa persistligi (eng muhim)**

UI'da yangi vazifa qo'sh → oynani **to'liq yop** (tray emas) → `bun run dev` qayta ishga tushir.
Expected: vazifa saqlanib qolgan.

- [ ] **Step 3: Boshqa store slot'lari**

- Sozlama: focus 25→30 o'zgartir → qayta ochishda 30 qoladi.
- Tema: dark↔light → qayta ochishda saqlanadi.
- Statistika: fokus seansini tugat → bugungi statistika +1.
- Musiqa: volume/sortMode o'zgartir → qayta ochishda saqlanadi.

- [ ] **Step 4: Disk faylida arg-kontrakt to'g'riligini tasdiqlash**

Run: `cat ~/.local/share/com.madrimov.zenfocus/config.json`
Expected: `music` va `activeTaskId` kalitlari **to'g'ri qiymat** bilan (jim `null` emas). Masalan vazifa faol qilingach `"activeTaskId":"<uuid>"`, musiqa o'zgargach `"music":{...}` to'liq obyekt.

- [ ] **Step 5: Push**

```bash
git push origin tauri-migration
```

- [ ] **Step 6: Obsidian holatini yangilash (qo'lda, ixtiyoriy)**

`ZenFocus Tauri Migration — Index.md`: Faza 4 → ✅ Tugadi, Faza 5 → ⬜ Keyingi.

---

## Self-Review natijalari

**Spec coverage:**
- Toza `api.ts`, 12 store metodi → Task 1 ✅
- Arg nomlari (`music`, `activeTaskId`) → Task 1 api.ts ✅, Task 6 runtime tasdiq ✅
- 5 fayl migratsiyasi → Task 2 (use-settings, toggle-theme), Task 3 (use-stats, use-tasks), Task 4 (use-music) ✅
- use-music ataylab aralash → Task 4 (faqat get/setMusic, non-store qoldiriladi) ✅
- hydratedRef pattern saqlanadi → Task 3 (o'zgartirilmaydi) ✅
- har set'ga `.catch` → Task 2-4 har set chaqiruvида ✅
- FOUC fallback saqlanadi → Task 2 Step 5 (toggle-theme DOM fallback) ✅
- Non-store tegilmaydi → Task 5 Step 2 tasdiqlaydi ✅
- Runtime acceptance gate → Task 6 ✅

**Type consistency:** `api` obyekt nomi va 12 metod imzosi Task 1'da aniqlangan, Task 2-4'da aynan shu nomlar bilan ishlatilgan ✅. Import yo'li `@shared/tauri/api` hamma joyda izchil ✅.

**Placeholder scan:** TODO/TBD yo'q; har kod qadami aniq old→new bilan ✅.

**No test framework:** Loyihada unit-test infra yo'q; reja typecheck + runtime acceptance ishlatadi (spec qarori). Test framework qo'shish ataylab scope'dan tashqarida (YAGNI).
