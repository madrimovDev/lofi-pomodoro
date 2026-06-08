# ZenFocus — Lofi Pomodoro

Glassmorphism dizaynli, lofi muhitida ishlovchi Pomodoro timer uchun Tauri v2 desktop ilovasi. Fokus seanslari, vazifa boshqaruvi, statistika va musiqa — barchasi bitta tinch interfeysda.

## Stack

| | |
|---|---|
| Runtime | Tauri v2 (Rust + WebKitGTK) |
| UI | React 19 + Tailwind 4 + shadcn |
| Build | Vite 8 + @tauri-apps/cli |
| Til | TypeScript 6 |
| Paket menejeri | Bun |
| Font | Geist Variable |

## Imkoniyatlar

### Timer
- Drift-siz `Date.now()` asosidagi sanoq — uzoq seanslarda ham aniq
- Maxsus presetlar (Deep Work, Classic, Quick) va o'z presetlaringiz
- Auto-start tanaffus / fokus
- Always-on-top va mini-mode (ixcham oyna)
- Oyna sarlavhasida jonli timer
- Holatni saqlash (qayta ochilganda tiklash)

### Vazifalar (Tasks)
- Qidiruv va filtrlash
- Prioritet (high / medium / low)
- Subtasklar
- Muddat (due date) belgisi
- Drag-and-drop tartiblash (@dnd-kit)
- JSON eksport / import

### Statistika
- Kunlik fokus seanslari va daqiqalar
- Streak tracker (ketma-ket kunlar)
- Kunlik maqsad (daily goal) va progress
- So'nggi 7 kun grafigi

### Musiqa
- Lokal papkalar (bir nechta papka saqlash)
- YouTube video / playlist / stream (yt-dlp orqali)
- Radio stansiyalar (SomaFM, Chillhop va o'z stansiyalaringiz)
- Ambient ovozlar (yomg'ir, o'rmon, kafe)
- Audio visualizer va ovoz fade
- Mini-widget va yon panel

### Tanaffus ekrani (Break screen)
- Nafas olish (breathing circle)
- Cho'zilish (stretch)
- Suv ichish eslatmasi
- Ko'z dam olishi

### Boshqa
- 3 til: o'zbek / ingliz / rus
- Dark / light tema
- Focus mode (bildirishnomalarni o'chirish)

## Loyiha strukturasi

```
src/
├── renderer/
│   ├── main.tsx           # React entry
│   ├── index.css          # Tailwind + glassmorphism tokenlar
│   ├── app/               # Layout, provider, main/mini sahifa
│   ├── components/        # Timer, tasks, music, stats, break screen ...
│   ├── contexts/          # timer-context
│   └── hooks/             # use-timer, use-stats, use-tasks, use-music ...
└── shared/
    ├── types.ts           # Model tiplar, default'lar
    ├── i18n/              # uz / en / ru
    └── lib/               # date.ts (dateKey), utils.ts
src-tauri/
├── src/
│   ├── main.rs            # Tauri entry
│   └── lib.rs             # Commands: music, store, dialog, window
├── Cargo.toml
└── tauri.conf.json
resources/
├── bg.jpg                 # Fon rasm
├── bell.mp3               # Bildirishnoma ovozi
└── rain/forest/cafe.mp3   # Ambient ovozlar
```

## O'rnatish

```bash
git clone <repo-url> zenfocus-pomodoro
cd zenfocus-pomodoro
bun install
bun run download-ytdlp   # YouTube uchun yt-dlp sidecar binarini yuklash
```

## Ishga tushirish

```bash
bun run dev          # Tauri dev (vite dev server + Tauri oynasi)
bun run build        # Tauri production build
bun run typecheck    # TypeScript tekshiruvi
bun run lint         # ESLint
bun run format       # Prettier
```

## Paketlash (build artifact)

```bash
bun run build        # tauri build — AppImage/deb (Linux), exe (Windows)
```

Build natijasi `src-tauri/target/release/bundle/` ichida.

### Linux runtime eslatmasi

**AppImage** GStreamer plaginlarini o'z ichiga oladi — qo'shimcha o'rnatish shart emas.

Manbadan build (AppImage emas) qilayotgan bo'lsangiz, quyidagi paketlar kerak:

```bash
# Debian/Ubuntu
sudo apt install gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-libav

# Fedora/RHEL
sudo dnf install gstreamer1-plugins-good gstreamer1-plugins-bad-free gstreamer1-libav
```

NVIDIA tizimlarida WebKitGTK hardware acceleration muammo bo'lsa, ishga tushirishdan oldin:

```bash
export WEBKIT_DISABLE_COMPOSITING_MODE=1
```

## Litsenziya

MIT
