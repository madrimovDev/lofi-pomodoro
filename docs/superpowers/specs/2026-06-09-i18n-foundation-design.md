# SP1 — i18n Poydevori (Design)

**Sana:** 2026-06-09
**Status:** Approved (design)
**Roadmap konteksti:** Bu "barcha feature'larni takomillashtirish" roadmap'ining 1-kichik loyihasi (SP1/7). Keyingilari: SP2 Break & Timer UX, SP3 Tasks polish, SP4 Stats & gamification, SP5 Music depth, SP6 Real media quality, SP7 Performance & infra.

## 1. Muammo va kontekst

ZenFocus'da i18n infratuzilmasi mavjud (`src/shared/i18n/{uz,en,ru}.ts` + `index.ts`), uchala lokal ham 97 ta mos kalitga ega va to'liq tarjima qilingan. Ammo ko'plab foydalanuvchiga ko'rinadigan matnlar komponentlarda **hardcoded** (asosan o'zbekcha), i18n'ni butunlay chetlab o'tadi. Natijada EN/RU lokalida bu matnlar baribir o'zbekcha chiqadi.

Qo'shimcha kamchilik: ba'zi kalitlar i18n'da **bor**, lekin komponentlar ularni baribir hardcode qilgan (ulanmagan).

### Aniqlangan hardcoded manbalar (grep audit, 2026-06-09)

**`src/renderer/components/break-screen.tsx`**
- `STRETCH_TIPS` — 8 ta o'zbekcha string massivi

**`src/renderer/components/task-panel.tsx`**
- Sana yorliqlari: `'Bugun'`, `'Kecha'` (`formatDate`)
- Due yorliqlari: `'⚠ Kechikdi'`, `'🗓 Bugun'`, `'🗓 Ertaga'`
- `placeholder`: `'Tasnif...'`, `"Kichik ish qo'shish..."`, `'Task nomi...'`, `'Tasnif (ixtiyoriy)...'`, `'Ish nomi...'`
- Matn: `'Tugatish'`, `"Qo'shish"`, `'Ishonchingiz komilmi?'` / `"Barchasini o'chirish"`
- Empty steps: `'Quyida ish nomini kiriting'`, `"Ro'yxatdan ishni tanlang"`
- `aria-label`: `'Bekor qilish'`, `'Tanlash'`, `'Tahrirlash'`, `"O'chirish"`, `'Bajarildi'`, `'Qidirish'`, `'Eksport'`, `'Import'`
- **Ulanmagan mavjud kalitlar:** `addSubtask`, `searchPlaceholder`, `dueDateOverdue`, `dueDateToday`, `dueDateTomorrow` i18n'da bor — task-panel ularni hardcode qilgan

**`src/renderer/components/music-side-panel.tsx`**
- `TAB_LABELS` (`'Papka'`, `'YouTube'`, `'Radio'`)
- `"Papka qo'shish"`, `'Stansiya nomi...'`, `'Stream URL...'`, `'YouTube URL yoki playlist...'`
- `aria-label="Ortga"`
- Plural: `` `${playlist.itemCount} ta video` `` / `'1 ta video'`

**`src/renderer/components/music-panel.tsx`**
- `"Papkani o'zgartirish"` / `'Papka tanlash'`
- Tab: `'📁 Papka'` / `'▶ YouTube'`
- `placeholder="YouTube URL yoki playlist..."`
- `aria-label="Yopish"`

**`src/renderer/components/stats-panel.tsx`**
- `DAY_LABELS = ['Ya','Du','Se','Ch','Pa','Ju','Sh']`
- `aria-label="Yopish"`

**`src/renderer/app/layout/index.tsx`**
- Mode yorliqlari: `'short-break': 'Tanaffus'`, `'long-break': 'Uzoq tanaffus'`
- `aria-label="Skip"`, `"Normal rejimga qaytish"`

**`src/renderer/app/layout/main.tsx`**
- `aria-label`: `'Skip'`, `'Ishlar'`, `'Musiqa'`, `'Focus mode'`, `'Sozlamalar'`

**`src/renderer/components/window-control.tsx`**
- `aria-label`: `'Statistika'`, `'Mini mode'`, `'Always on top'`

**`src/renderer/components/settings-panel.tsx`**
- `aria-label="Reset"`

> **Eslatma:** Notification matni (`layout/index.tsx:349`) allaqachon `t('focusDone')` va h.k. ishlatadi — bu yerda muammo yo'q. Inventardagi "notification hardcoded English" gipotezasi noto'g'ri edi.

## 2. Yechim — qamrov (A–E)

### A. Hardcoded matnlarni i18n'ga ko'chirish
Yuqoridagi har bir manbani yangi (yoki mavjud) i18n kalitga bog'lash. `aria-label`'lar ham foydalanuvchiga (accessibility) ko'rinadi — ular ham tarjima qilinadi.

Break tip'lari (`STRETCH_TIPS`) **bor holicha** (8 ta) i18n'ga `stretchTip1`..`stretchTip8` indeksli flat kalitlar sifatida ko'chiriladi (mavjud `Record<string,string>` strukturasiga mos; break-screen indeks bo'yicha tasodifiy tanlaydi). **Variativlik oshirilmaydi** — bu SP2.

### B. Ulanmagan mavjud kalitlarni ulash
`addSubtask`, `searchPlaceholder`, `dueDateOverdue/Today/Tomorrow` — komponentdagi hardcoded qiymatni `t(...)` chaqiruviga almashtirish. Yangi kalit qo'shilmaydi.

### C. Yangi kalitlarni EN/RU ga tarjima
A bosqichida qo'shilgan har bir yangi kalit uchun en.ts va ru.ts ga tarjima yoziladi. Mavjud 97 kalit tegilmaydi.

### D. Interpolatsiya + plural (arxitektura qarori)

Hozirgi `getT` imzosi: `(key: TranslationKey) => string`. Buni kengaytiramiz:

```ts
// Plural selektor — har lokal o'z qoidasiga ega
type PluralCategory = 'one' | 'few' | 'many' | 'other';
function plural(locale: Locale, n: number): PluralCategory;
//   uz: hammasi 'other' (yagona forma)
//   en: n === 1 ? 'one' : 'other'
//   ru: Intl.PluralRules('ru') qoidasi → 'one' | 'few' | 'many'

// Interpolatsiya: {name} kabi placeholder'larni params bilan almashtirish
function t(key, params?: Record<string, string | number>): string;
```

- **In-house minimal** yondashuv (kutubxonasiz, YAGNI). `Intl.PluralRules` brauzerda mavjud — ruscha qoidalar uchun undan foydalanamiz, lekin tarjima string'larini o'zimiz tanlaymiz.
- Plural kerak bo'lgan kalitlar (masalan `videoCount`, `streak`) uchun lokal fayllarda forma variantlari saqlanadi (masalan `videoCount_other`, ru uchun `videoCount_one/_few/_many`). `t('videoCount', {count: n})` mos formani tanlab `{count}` ni almashtiradi.
- Interpolatsiya `{param}` sintaksisi ishlatadi.

> **Diqqat:** `t` imzosi o'zgaradi (`params?` qo'shiladi) — barcha mavjud `t('key')` chaqiruvlari o'zgarmasdan ishlashda davom etadi (params ixtiyoriy).

### E. Lokalga bog'liq sana/vaqt
- `current-time.tsx`, `task-panel.tsx` (formatDate), `stats-panel.tsx` (DAY_LABELS) — `Intl.DateTimeFormat(locale, …)` ga o'tkaziladi.
- **Shart:** `Intl.DateTimeFormat('uz', {weekday:'short'})` va vaqt formati **haqiqiy ilovada (WebKitGTK)** tekshiriladi. Node ICU 'uz' ni qo'llaydi (`Yak Dush Sesh Chor Pay Jum Shan`), lekin WebKitGTK farq qilishi mumkin.
- Agar WebKitGTK 'uz' ni degradatsiya qilsa (masalan inglizchaga fallback) — curated per-locale massivlar (`DAY_LABELS` lokal bo'yicha) fallback sifatida saqlanadi. Bu qaror **verifikatsiyadan keyin** qabul qilinadi, taxmin bilan emas.

## 3. Komponentlar va interfeyslar

### `src/shared/i18n/index.ts` (kengaytiriladi)
- `getT(locale)` → `t(key, params?)` qaytaradi (params ixtiyoriy, orqaga mos)
- `plural(locale, n)` eksport qilinadi (yoki `t` ichida ishlatiladi)
- `LOCALES: Locale[]` eksport (test/parity uchun)

### `src/shared/i18n/{uz,en,ru}.ts`
- Yangi kalitlar qo'shiladi. Plural kalitlar uchun `_one/_few/_many/_other` suffiks konvensiyasi.

### `src/shared/lib/date.ts` (yoki yangi `format.ts`)
- `formatWeekdayShort(locale, date)`, `formatTime(locale, date)`, `formatRelativeDay(locale, date)` — `Intl` o'rovchi yordamchilar (+ verifikatsiyaga qarab fallback massiv).

### Komponentlar
- Hardcoded string'lar `t(...)` ga almashtiriladi. `getT` import qilmagan komponentlar (`music-side-panel`, `music-panel`, `stats-panel`, `break-screen`, `current-time`, `window-control`, `main.tsx`, `settings-panel`, `preset-selector`) `useSettings`/`getT` orqali `t` oladi.

## 4. Data flow
Settings `locale` → `useSettings` → `const t = getT(locale)` → komponentlar `t('key')` / `t('key', {count})`. Lokal o'zgarganda React re-render (mavjud mexanizm).

## 5. Xatoliklarni boshqarish
- Yetishmagan kalit: `t` mavjud fallback zanjirini saqlaydi (`locale[key] ?? uz[key] ?? key`).
- Plural forma topilmasa: `_other` ga fallback.
- `Intl` xatosi (kutilmagan): curated massiv fallback.

## 6. Testlash / verifikatsiya
1. **Kalit-paritet testi (E):** uz/en/ru kalit to'plamlari aynan teng ekanini tekshiruvchi kichik assert/test. CI yoki `typecheck` doirasida ishga tushadigan oddiy script (`comm`-ekvivalenti JS'da). Yetishmagan kalit → fail.
2. **Plural birlik tekshiruvi:** `t('videoCount', {count})` ru uchun 1/2/5/21 → to'g'ri forma (one/few/many) qaytarishi.
3. **Hardcoded leftover sweep:** repo'da `placeholder="`, `aria-label="`, JSX `>matn<` (t() siz) literallar qolmaganini grep bilan tasdiqlash (faqat o'zbekcha emas — har qanday til).
4. **WebKitGTK Intl tekshiruvi (D/E):** ilovada `Intl.DateTimeFormat('uz', …)` natijasini ko'rish; degradatsiya bo'lsa fallback massiv yoqiladi.
5. **Manual:** UI'ni 3 lokalda ko'rib chiqish — barcha matnlar (break ekran, tasks, music panellar, stats, mode yorliqlari, aria-label'lar) tarjima qilinganini tasdiqlash.
6. `npm run typecheck` + `npm run build` o'tishi.

## 7. Qamrovdan tashqari (non-goals)
- Break tip variativligini oshirish → SP2
- Yangi til qo'shish (faqat uz/en/ru)
- RTL qo'llab-quvvatlash
- Tarjima fayllarini tashqi (JSON/cloud) manbaga ko'chirish
