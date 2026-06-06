# Dizayn: Aniqlangan bug'larni tuzatish

**Sana:** 2026-06-06
**Faza:** Sifat poydevori — 1-bosqich (faqat bug-fix, testsiz)

## Maqsad

ZenFocus kodida aniqlangan ikkita bug'ni tuzatish va eskirgan README'ni
yangilash. Test framework va testlar ushbu fazaga **kirmaydi** (foydalanuvchi
qarori). Ochiq bug-hunt ham kirmaydi — faqat quyida nomma-nom sanab o'tilgan
elementlar.

## Qamrov

| # | Element | Tur |
|---|---------|-----|
| 1 | Timezone kalit nomuvofiqligi (`use-stats.tsx`) | 🐛 Tasdiqlangan bug |
| 2 | Stale-closure mo'rt pati (`use-stats.tsx`, `use-tasks.tsx`) | 🛡 Hardening |
| 3 | README yangilash (20 feature) | 📄 Hujjat |

---

## 1. Timezone kalit nomuvofiqligi

### Muammo

`use-stats.tsx` da statistika yozuvlari **lokal** sana kaliti bilan saqlanadi:

```ts
// todayKey() — yozuvchi (line 6)
`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
```

Ammo `calculateStreak` (line 13) o'quvchi sifatida **UTC** kalit ishlatadi:

```ts
const key = d.toISOString().slice(0, 10);  // UTC!
```

Yozuvchi va o'quvchi turli kalendarlarda ishlaydi. UTC+5 (Toshkent) da lokal
00:00–05:00 oralig'ida `toISOString()` bir kun orqadagi sanani qaytaradi, UTC−
mintaqalarda esa kechqurun bir kun oldinga ketadi. Natijada streak noto'g'ri
hisoblanadi yoki jimgina 0 ga tushadi.

### Yechim

Bitta umumiy helper yaratiladi va **barcha** kalit hosil qilish joylarida
ishlatiladi:

```ts
// src/shared/lib/date.ts
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
```

`dateKey` lokal kalendarni ishlatadi — shu sababli yozuvchi bilan izchil bo'ladi.

**O'zgartiriladigan joylar** (lokal kalit takrorlanishi ham yo'qoladi):

- `use-stats.tsx:6` — `todayKey()` → `dateKey(new Date())`
- `use-stats.tsx:13` — `calculateStreak` ichidagi `toISOString` → `dateKey(d)` (**bug tuzatish**)
- `stats-panel.tsx:21` — chart kunlari → `dateKey(d)`
- `stats-panel.tsx:38` — `todayStr` → `dateKey(td)`

## 2. Stale-closure mo'rt pati

### Muammo

`use-stats.tsx` va `use-tasks.tsx` da persist-funksiyalar closure'dagi state'ni
to'g'ridan-to'g'ri o'qiydi:

```ts
function saveStats(next: DailyStat[]) {
  setStatsState(next);
  window.electronApi?.setStats(next);
}
// upsertToday: stats.find(...) + saveStats([...stats.filter(...), updated])
```

Hozirgi chaqiruv yo'llarida bir tickda bir xil state'ga ikkita yozuv yo'q
(masalan `handleSessionComplete` `addFocusSession` (stats) va `incrementPomodoro`
(tasks) ni chaqiradi — bular **turli** state). Shuning uchun bu **tasdiqlangan
data-loss bug emas, balki mo'rt pat**. Kelajakda bir state'ga ketma-ket ikkita
yozuv qo'shilsa, ikkinchisi birinchisini o'chiradi.

### Yechim

`use-timer.ts` dagi mavjud pattern (functional `setState` + alohida persistence
`useEffect`) ikkala hookga ham qo'llaniladi:

- Mutatsiya helperlari `setState(prev => ...)` funksional shaklga o'tkaziladi —
  closure state'ga tayanmaydi.
- Persistlash alohida `useEffect`da state o'zgarganda bajariladi.
- **Hydration guard** (`useRef`) qo'shiladi — store'dan dastlabki yuklash
  paytida qayta yozib yuborilmasligi uchun. Bu StrictMode double-mount'ga ham
  bardoshli.

Tashqi xulq-atvor (interfeys) o'zgarmaydi — faqat ichki implementatsiya.

## 3. README yangilash

Joriy `README.md` faqat boshlang'ich skeletni tasvirlaydi. Implement qilingan
20 ta feature'ni (Timer, Tasks, Stats, Music, Break screen) aks ettiradigan
qilib yangilanadi. Loyiha strukturasi joriy fayl daraxtiga moslashtiriladi.

---

## Arxitektura ta'siri

- Yangi fayl: `src/shared/lib/date.ts` (`dateKey` helper)
- O'zgartiriladigan: `use-stats.tsx`, `use-tasks.tsx`, `stats-panel.tsx`, `README.md`
- Tashqi interfeyslar (hook qaytaruvchi qiymatlari, IPC) o'zgarmaydi
- Yangi bog'liqlik yo'q

## Tekshirish (testsiz)

- `bun run typecheck` — nol xato
- `bun run build` — muvaffaqiyatli
- Qo'lda: streak hisobining timezone chegarasida to'g'riligini ko'rib chiqish
