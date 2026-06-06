# ZenFocus — Lofi Pomodoro

Glassmorphism dizaynli, lofi muhitida ishlovchi Pomodoro timer uchun Electron desktop ilovasi. Fokus seanslari, vazifa boshqaruvi, statistika va musiqa — barchasi bitta tinch interfeysda.

## Stack

| | |
|---|---|
| Runtime | Electron 41 |
| UI | React 19 + Tailwind 4 + shadcn |
| Build | Vite 8 + vite-plugin-electron |
| Til | TypeScript 6 |
| Paket menejeri | Bun |
| Font | Geist Variable |

## Imkoniyatlar

### ⏱ Timer
- Drift-siz `Date.now()` asosidagi sanoq — uzoq seanslarda ham aniq
- Maxsus presetlar (Deep Work, Classic, Quick) va o'z presetlaringiz
- Auto-start tanaffus / fokus
- Always-on-top va mini-mode (ixcham oyna)
- Oyna sarlavhasida jonli timer
- Holatni localStorage'ga saqlash (qayta ochilganda tiklash)

### ✅ Vazifalar (Tasks)
- Qidiruv va filtrlash
- Prioritet (high / medium / low)
- Subtasklar
- Muddat (due date) belgisi
- Drag-and-drop tartiblash (@dnd-kit)
- Todoist'dan import
- JSON eksport / import

### 📊 Statistika
- Kunlik fokus seanslari va daqiqalar
- Streak tracker (ketma-ket kunlar)
- Kunlik maqsad (daily goal) va progress
- So'nggi 7 kun grafigi

### 🎵 Musiqa
- Lokal papkalar (bir nechta papka saqlash)
- YouTube video / playlist / stream (yt-dlp orqali)
- Radio stansiyalar (SomaFM, Chillhop va o'z stansiyalaringiz)
- Ambient ovozlar (yomg'ir, o'rmon, kafe)
- Audio visualizer va ovoz fade
- Mini-widget va yon panel

### 🌬 Tanaffus ekrani (Break screen)
- Nafas olish (breathing circle)
- Cho'zilish (stretch)
- Suv ichish eslatmasi
- Ko'z dam olishi

### 🌐 Boshqa
- 3 til: o'zbek / ingliz / rus
- Dark / light tema
- Auto-updater (electron-updater)
- Tray menyu (timer boshqaruvi)
- Focus mode (bildirishnomalarni o'chirish)

## Loyiha strukturasi

```
src/
├── main/                  # Electron main process
│   ├── index.ts           # Entry: app lifecycle, protocol, single-instance
│   ├── window.ts          # BrowserWindow (frame-less)
│   ├── tray.ts            # Tray menyu va timer holati
│   ├── store.ts           # electron-store (typed)
│   ├── logger.ts          # electron-log
│   ├── services/
│   │   └── updater.ts     # Auto-updater
│   └── ipc/
│       ├── index.ts       # IPC handlerlarni ro'yxatga olish
│       ├── music.ipc.ts   # Folder + YouTube (yt-dlp)
│       ├── store.ipc.ts   # Settings/tasks/stats saqlash
│       └── window-control.ts
├── preload/
│   ├── index.ts           # contextBridge: window.electronApi
│   └── api.d.ts           # Window type deklaratsiyalari
├── renderer/
│   ├── main.tsx           # React entry
│   ├── index.css          # Tailwind + glassmorphism tokenlar
│   ├── app/               # Layout, provider, main/mini sahifa
│   ├── components/        # Timer, tasks, music, stats, break screen ...
│   ├── contexts/          # timer-context
│   └── hooks/             # use-timer, use-stats, use-tasks, use-music ...
└── shared/
    ├── types.ts           # IPC kanallari, model tiplar, default'lar
    ├── i18n/              # uz / en / ru
    └── lib/               # date.ts (dateKey), utils.ts
resources/
├── bg.jpg                 # Fon rasm
├── bell.mp3               # Bildirishnoma ovozi
└── rain/forest/cafe.mp3   # Ambient ovozlar
```

## O'rnatish

```bash
git clone <repo-url> zenfocus-pomodoro
cd zenfocus-pomodoro
cp .env.example .env
bun install
bun run download-ytdlp   # YouTube uchun yt-dlp binarini yuklash
```

## Konfiguratsiya (.env)

```env
NODE_ENV=development   # "development" | "production"
```

## Ishga tushirish

```bash
bun run dev          # Vite dev server + Electron
bun run build        # Production build
bun run preview      # Build + Electron oynasi
bun run typecheck    # TypeScript tekshiruvi
bun run lint         # ESLint
bun run format       # Prettier
```

## Paketlash (build artifact)

```bash
bun run package:linux   # Linux build (electron-builder)
bun run package:win     # Windows build
bun run publish:linux   # Build + release publish
bun run publish:win
```

Build natijasi `dist/` ichida: `index.html`, `assets/`, `main/index.js`, `preload/index.js`.

## Litsenziya

MIT
