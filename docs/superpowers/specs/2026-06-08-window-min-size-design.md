# Oyna minimal o'lchami (timer card) — Dizayn spetsifikatsiyasi

**Sana:** 2026-06-08
**Branch:** `tauri-migration`
**Status:** Tasdiqlangan (brainstorm) → planning

## Kontekst

Yangi resize qo'llari (#5) oynani erkin kichraytirishga imkon berdi, lekin hozirgi `minWidth: 600 / minHeight: 400` markazdagi timer card'ni to'liq ko'rsatmaydi (ayniqsa balandlik — card ~700px, lekin minHeight 400 uni qirqadi). Foydalanuvchi: oyna timer card to'liq ko'rinadigan darajadan kichraymasligi kerak.

## Qaror (brainstorm)

**Yondashuv A — statik min o'lcham.** Card'ning eng katta holatiga moslangan qat'iy `minWidth`/`minHeight`. Mini-rejim logikasi bilan konflikt yo'q. (Runtime-o'lchovli B varianti rad etildi — mini-rejim `normal_min_size` saqlash/tiklash mexanizmi bilan ziddiyat + ortiqcha kod.)

## O'lcham hisobi

- **TimerRing** = `(RADIUS 110 + STROKE 5) × 2` = **230px**.
- **Card** (`main.tsx`): `glass px-16 py-12 gap-6 w-[340px]`, ~8 bola (PresetSelector, mode label, TimerRing, TaskDisplay, tugmalar qatori `size-12`, SessionDots, dailyGoal qatori, MusicMiniWidget).
- Card balandligi ≈ `py-12 (96)` + bolalar (~208) + TimerRing (230) + 7 gap (168) ≈ **~702px**.
- **Titlebar** (`window-control`): `h-10` = 40px; `main` `pt-10` (40px) offset.
- To'liq ko'rinish uchun oyna ichki balandligi ≈ 40 + 702 ≈ **742px**.

## Tanlangan qiymatlar

- **`minWidth: 440`** (card 340 + chet) — card gorizontal qirqilmaydi.
- **`minHeight: 780`** (≈742 + saxiy chet) — card barcha qatorlari bilan to'liq ko'rinadi. Biroz saxiy: talab "card'dan kichik bo'lmasin" → min ≥ card kafolatlangan; ortiqcha bo'lmasligi runtime'da tasdiqlanadi/sozlanadi.

## Tegiladigan joylar (IKKALA — sinxron bo'lishi SHART)

1. **`src-tauri/tauri.conf.json`** `app.windows[0]`: `minWidth: 440`, `minHeight: 780` (hozir 600/400).
2. **`src-tauri/src/commands/window.rs`** `set_mini_mode` (~24): `inner.normal_min_size = Some((440.0, 780.0))` (hozir `(600.0, 400.0)`). Bu mini-rejimga kirishda saqlanib, chiqishda tiklanadigan qiymat — conf bilan mos bo'lishi shart, aks holda mini'dan chiqgach min noto'g'ri bo'ladi.

## Verifikatsiya

- `cargo check` (conf schema) + `cargo clippy`/`cargo test` toza.
- **Runtime (foydalanuvchi):** resize qo'llari bilan oynani min'gacha kichraytirib — timer card to'liq ko'rinishini (gorizontal/vertikal qirqilmasligini) tasdiqlash. Mini-rejimga kirib-chiqib, normal min tiklanishini tekshirish. Agar saxiylik (bo'sh joy) ko'p/kam bo'lsa, qiymatlar sozlanadi.

## Doirasidan tashqari (YAGNI)
- Runtime-o'lchovli min (B).
- maxWidth/maxHeight o'zgartirish.
- Card layout'ini ixchamlashtirish.

## Eslatma
- Card balandligi holatga (dailyGoal>0, music widget, preset soni) qarab biroz o'zgaradi; `minHeight: 780` eng katta holatga moslangan (saxiy), shuning uchun barcha holatlarda card sig'adi.
