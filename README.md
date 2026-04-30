# ZenFocus — Lofi Pomodoro

Glassmorphism dizaynli, lofi muhitida ishlovchi Pomodoro timer uchun Electron desktop ilovasi.

## Stack

| | |
|---|---|
| Runtime | Electron 41 |
| UI | React 19 + Tailwind 4 + shadcn |
| Build | Vite 8 + vite-plugin-electron |
| Til | TypeScript 6 |
| Font | Geist Variable |

## Loyiha strukturasi

```
src/
├── main/              # Electron main process
│   ├── index.ts       # Entry: .env yuklash, app lifecycle
│   ├── window.ts      # BrowserWindow (frame-less)
│   └── ipc/
│       ├── index.ts   # IPC handlerlarni ro'yxatga olish
│       └── window-control.ts  # Minimize / maximize / close
├── preload/
│   ├── index.ts       # contextBridge: window.electronApi
│   └── api.d.ts       # Window type deklaratsiyalari
├── renderer/
│   ├── main.tsx       # React entry
│   ├── index.css      # Tailwind + glassmorphism tokenlar
│   ├── app/
│   │   ├── layout/    # Asosiy layout va main sahifa
│   │   └── provider/  # App wrapper
│   └── components/
│       ├── current-time.tsx   # 1s tick soat
│       ├── toggle-theme.tsx   # Dark / light toggle
│       └── window-control.tsx # Custom title bar
└── shared/
    ├── types.ts        # IPC channel konstantlari
    └── components/ui/  # shadcn komponentlar
resources/
└── bg.jpg             # Fon rasm
```

## O'rnatish

```bash
git clone <repo-url> zenfocus-pomodoro
cd zenfocus-pomodoro
cp .env.example .env
bun install
```

## Konfiguratsiya (.env)

```env
NODE_ENV=development   # "development" | "production"
```

## Ishga tushirish

```bash
bun run dev        # Vite dev server + Electron
bun run build      # Production build
bun run preview    # Build + Electron oynasi
bun run typecheck  # TypeScript tekshiruvi
```

## Build natijasi

```
dist/
├── index.html          # Renderer
├── assets/             # JS, CSS, fontlar
├── main/index.js       # Main process (CJS)
└── preload/index.js    # Preload script (CJS)
```

## Litsenziya

MIT
