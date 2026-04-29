# Electron Soliq

POS printer va Unikassa fiskal modul integratsiyasi uchun Electron ilovasi. Asosiy frontend remote URL dan yuklanadi — bu loyihada faqat Electron shell va native integratsiyalar mavjud.

## Arxitektura

```
┌──────────────────────────────────────────────────┐
│          RENDERER (Remote Web Frontend)          │
│     SOLIQ_REMOTE_URL dan yuklanadi (prod)        │
│     test.html yuklanadi (dev)                    │
└───────────────────┬──────────────────────────────┘
                    │ contextBridge (IPC)
┌───────────────────┴──────────────────────────────┐
│              PRELOAD SCRIPT                      │
│  window.electronSoliq  — fiskal API              │
│  window.posPrinter     — printer API             │
│  window.receiptBuilder — chek qurish API         │
└───────────────────┬──────────────────────────────┘
                    │
┌───────────────────┴──────────────────────────────┐
│              MAIN PROCESS                        │
│  SoliqService → FiskalAPI → Unikassa API         │
│  @madrimov/electron-pos-printer → POS printer    │
└──────────────────────────────────────────────────┘
```

## Talablar (Requirements)

| Dastur | Versiya | Izoh |
|--------|---------|------|
| Node.js | 20+ | Electron 35 talab qiladi |
| Bun (tavsiya) | 1.0+ | npm o'rniga tezroq ishlaydi |
| npm (alternativ) | 9+ | Bun o'rnatilmagan bo'lsa |
| Git | 2.0+ | Versiya nazorati |
| Windows | 10+ | Build uchun (NSIS installer) |

## O'rnatish

### Bun bilan (tavsiya etiladi)

```bash
git clone <repo-url> electron-soliq
cd electron-soliq
cp .env.example .env
bun install
```

### npm bilan (Bun o'rnatilmagan bo'lsa)

```bash
git clone <repo-url> electron-soliq
cd electron-soliq
cp .env.example .env
npm install
```

> **Eslatma:** `bun.lock` mavjud. npm ishlatganda `package-lock.json` ham yaratiladi. Ikkalasi parallel yashay oladi, lekin jamoada bitta package manager tanlash tavsiya etiladi.

## Konfiguratsiya (.env)

`.env.example` dan `.env` fayl yarating va to'ldiring:

```env
# ============ APP ============
# "development" — test.html ochiladi, DevTools yonadi
# "production"  — SOLIQ_REMOTE_URL dan frontend yuklanadi
NODE_ENV=development

# Remote frontend URL (production uchun o'zgartiriladi)
SOLIQ_REMOTE_URL=https://example.com

# ============ FISKAL MODUL ============
# FM identifikatori (Unikassa bergan kod)
# Bo'sh qoldirilsa — fiskal sozlanmaydi, frontend dan configure() chaqirish mumkin
FISCAL_ID=

# "test"  — https://api.unikassa.uz (test server)
# "local" — http://localhost:8181 (lokal fiskal modul)
FISCAL_ENV=test

# Standart URL o'rniga boshqa URL (ixtiyoriy)
# FISCAL_BASE_URL=http://192.168.1.100:8181/api/v1

# So'rov timeout millisekundda (default: 30000)
# FISCAL_TIMEOUT=30000
```

### Rejimlar

| Sozlama | Dev rejim | Prod rejim |
|---------|-----------|------------|
| `NODE_ENV` | `development` | `production` |
| `SOLIQ_REMOTE_URL` | o'zgartirish shart emas | `https://your-app.uz` |
| `FISCAL_ID` | test FM ID yoki bo'sh | real FM ID |
| `FISCAL_ENV` | `test` | `local` |
| Electron oyna | `test.html` + DevTools | Remote URL |
| Web Security | o'chirilgan | yoniq |

## Ishga tushirish

### Development

```bash
# Bun bilan
bun run dev          # Vite dev server (hot reload)
bun run preview      # Build + Electron oynasi ochiladi

# npm bilan
npm run dev
npm run preview
```

`NODE_ENV=development` bo'lsa test panel ochiladi — barcha API larni tugmalar orqali sinab ko'rish mumkin.

### TypeScript tekshiruvi

```bash
bun run typecheck    # yoki: npm run typecheck
```

### Production Build

```bash
# Faqat build (dist/ papkaga)
bun run build        # yoki: npm run build

# Windows installer yaratish (release/ papkaga)
bun run package:win  # yoki: npm run package:win
```

Build natijalari:
- `dist/main/index.js` — main process (CJS)
- `dist/preload/index.js` — preload script (CJS)
- `release/` — Windows NSIS installer (package:win dan keyin)

### Packaged app da .env

`electron-builder` avtomatik `.env` faylni `resources/` papkasiga ko'chiradi. Foydalanuvchi `.env` ni ilovaning `resources/` papkasida tahrirlashi mumkin.

## Loyiha strukturasi

```
electron-soliq/
├── src/
│   ├── main/                        # Electron main process
│   │   ├── index.ts                 # Entry: .env yuklash, app lifecycle
│   │   ├── window.ts                # BrowserWindow yaratish
│   │   ├── ipc/
│   │   │   ├── index.ts             # Barcha IPC handlerlarni ro'yxatga olish
│   │   │   └── soliq.ipc.ts         # Fiskal IPC handlerlari
│   │   ├── services/
│   │   │   └── soliq.service.ts     # SoliqService (FiskalAPI wrapper)
│   │   └── lib/
│   │       ├── constants.ts         # REMOTE_URL
│   │       ├── http-logger.ts       # Axios request/response logger
│   │       └── fiskal-unikassa/     # Unikassa fiskal modul kutubxonasi
│   │           ├── FiskalAPI.ts     # HTTP klient (axios)
│   │           ├── types.ts         # Barcha tiplar va error kodlari
│   │           └── errors.ts        # FiskalAPIError, FiskalValidationError
│   ├── preload/
│   │   ├── index.ts                 # contextBridge: API larni expose qilish
│   │   └── api.d.ts                 # Frontend uchun TypeScript tiplar
│   └── shared/
│       └── types.ts                 # IPC channel nomlari va re-export tiplar
├── test.html                        # Dev rejim test paneli
├── .env.example                     # Konfiguratsiya namunasi
├── .env                             # Konfiguratsiya (gitignore da)
├── package.json
├── tsconfig.json
├── vite.config.ts
└── electron-builder.yml             # Windows installer konfiguratsiyasi
```

---

## Frontend API Qo'llanmasi

Electron ichida yuklangan har qanday web sahifa quyidagi global API larga ega bo'ladi.
Agar sahifa oddiy browserda ochilsa — bu ob'ektlar `undefined` bo'ladi.

### Electron da ishlayotganini aniqlash

```typescript
if (window.electronSoliq) {
  // Electron ichida — native funksiyalar mavjud
} else {
  // Oddiy browser — fallback logika
}
```

---

### 1. Printer API (`window.posPrinter`)

#### Printerlar ro'yxatini olish

```typescript
const printers = await window.posPrinter.getPrinters();
// [{name: "POS-80", displayName: "POS-80", isDefault: true, status: 0, ...}]
```

#### PrintContent[] bilan chop etish

```typescript
await window.posPrinter.print(
  [
    { type: 'text', value: 'Salom!', style: { bold: true, align: 'center' } },
    { type: 'line' },
    { type: 'text', value: 'Test chop etish' },
    { type: 'cut' },
  ],
  { printerName: 'POS-80', paperWidth: 80, silent: true }
);
```

---

### 2. Receipt Builder API (`window.receiptBuilder`)

Chek qurish uchun step-by-step builder. Barcha operatsiyalar preload kontekstida bajariladi.

#### Step-by-step builder

```typescript
const rb = window.receiptBuilder;

// 1. Builder yaratish (80mm yoki 58mm)
const id = rb.create(80);

// 2. Valyuta formati sozlash
rb.setCurrency(id, { symbol: "so'm", decimals: 0, symbolPosition: 'after' });

// 3. Chek kontentini qurish
rb.title(id, "DO'KON NOMI");
rb.subtitle(id, 'Toshkent sh., Chilonzor t.');
rb.line(id);
rb.row(id, 'Sana', new Date().toLocaleString());
rb.row(id, 'Kassir', 'Alisher');
rb.dashedLine(id);

// Tovarlar
rb.itemRow(id, 'Non',    2, 5000);
rb.itemRow(id, 'Sut 1L', 1, 12000);
rb.itemRow(id, 'Choy',   3, 8000);

// Jami
rb.doubleLine(id);
rb.totalRow(id, 'Jami', 46000);
rb.line(id);

// QR kod va footer
rb.textCenter(id, 'Rahmat xaridingiz uchun!');
rb.qrcode(id, 'https://soliq.uz/receipt/12345');
rb.feed(id, 2);
rb.cut(id);

// 4. Chop etish
const result = await rb.print(id, {
  printerName: 'POS-80',
  paperWidth: 80,
  silent: true
});

// 5. Xotirani tozalash
rb.destroy(id);
```

#### ReceiptData dan bir chaqiruvda

```typescript
const result = await window.receiptBuilder.printFromData(
  {
    header: {
      title: "DO'KON NOMI",
      subtitle: 'Filial #3',
      address: ['Toshkent sh.', 'Chilonzor t.'],
      phone: '+998 90 123 45 67',
    },
    items: [
      { name: 'Non',    quantity: 2, price: 5000 },
      { name: 'Sut 1L', quantity: 1, price: 12000 },
    ],
    totals: { subtotal: 22000, tax: 2640, total: 24640 },
    payment: { method: 'Naqd', amount: 25000, change: 360 },
    footer: ['Rahmat!', 'www.dokon.uz'],
    meta: {
      orderNumber: '00142',
      date: new Date(),
      cashier: 'Alisher',
    },
  },
  { printerName: 'POS-80', paperWidth: 80, silent: true },
  80 // paperWidth
);
```

#### Mavjud builder metodlari

| Metod | Parametrlar | Izoh |
|-------|-------------|------|
| `create(paperWidth?)` | `80 \| 58` | Builder yaratish, ID qaytaradi |
| `destroy(id)` | | Xotirani tozalash |
| `setCurrency(id, opts)` | `{symbol, decimals, ...}` | Valyuta formati |
| `text(id, value, style?)` | | Matn qo'shish |
| `textCenter(id, value)` | | Markazlashgan matn |
| `textRight(id, value)` | | O'ngga tekislangan matn |
| `textBold(id, value)` | | Qalin matn |
| `title(id, value)` | | Sarlavha (markazda, qalin, katta) |
| `subtitle(id, value)` | | Kichik sarlavha |
| `line(id, char?)` | default: `-` | Chiziq ajratgich |
| `dashedLine(id)` | | `---` chiziq |
| `doubleLine(id)` | | `===` chiziq |
| `feed(id, lines?)` | default: 3 | Bo'sh qator |
| `cut(id, partial?)` | | Qog'ozni kesish |
| `tableRow(id, columns)` | | Jadval qator |
| `row(id, label, value)` | | 2 ustunli qator |
| `itemRow(id, name, qty, price)` | | Tovar qatori (nom, soni, narx) |
| `totalRow(id, label, amount)` | | Jami qator (qalin) |
| `barcode(id, value, opts?)` | | Shtrix kod |
| `qrcode(id, value, opts?)` | | QR kod |
| `image(id, source, opts?)` | | Rasm (base64 yoki path) |
| `raw(id, content)` | `PrintContent` | To'g'ridan-to'g'ri kontent |
| `fromData(id, data)` | `ReceiptData` | Strukturali ma'lumotdan qurish |
| `getContents(id)` | | `PrintContent[]` olish |
| `clear(id)` | | Builder tarkibini tozalash |
| `print(id, config)` | `PrinterConfig` | Chop etish |
| `printFromData(data, config, pw?)` | | Bir chaqiruvda qurish va chop etish |

---

### 3. Fiskal API (`window.electronSoliq.fiskal`)

Unikassa fiskal modul bilan ishlash uchun to'liq API.

#### Konfiguratsiya

Agar `.env` da `FISCAL_ID` berilgan bo'lsa — avtomatik sozlanadi.
Aks holda frontend dan configure chaqirish kerak:

```typescript
await window.electronSoliq.fiskal.configure({
  fiscalId: 'FM_IDENTIFIKATOR',
  environment: 'test',  // 'test' | 'local'
  // baseUrl: 'http://custom:8181/api/v1',  // ixtiyoriy
  // timeout: 30000,  // ixtiyoriy
});
```

#### FM ulanishini tekshirish

```typescript
const isConnected = await window.electronSoliq.fiskal.healthCheck();
// true | false
```

#### FM ma'lumotlarini olish

```typescript
const info = await window.electronSoliq.fiskal.getInfo();
// { AppletVersion, TerminalID, Locked, MemoryInfo }

const zStats = await window.electronSoliq.fiskal.getZStats();
// { UnClosedCount, UnsentToOFDCount }

const zInfo = await window.electronSoliq.fiskal.getZInfo(0); // 0=joriy, 1=oldingi
// { TerminalID, OpenTime, TotalSaleCount, TotalCash, ... }

const memory = await window.electronSoliq.fiskal.getFiscalMemory();
// { TotalBalance, OpenZReportsCount }

const receipt = await window.electronSoliq.fiskal.getReceiptInfo(0);
// { ReceiptSeq, FiscalSign, TerminalID, DateTime, TotalAmount, Type }
```

#### Smena (Z-Hisobot) boshqaruvi

```typescript
// Smenani ochish
await window.electronSoliq.fiskal.openZReport();
// { status: 'OK', ZReportNumber }

// Smenani yopish
await window.electronSoliq.fiskal.closeZReport();
// { status: 'OK', ZReportNumber, CloseTime }

// Smena ochiq ekanligini kafolatlash (agar yopiq bo'lsa — ochadi)
await window.electronSoliq.fiskal.ensureZReportOpen();

// OFD bilan sinxronizatsiya
await window.electronSoliq.fiskal.sync();
```

#### Sotuv cheki yuborish

```typescript
const result = await window.electronSoliq.fiskal.sendSale({
  PayType: 'cash',  // 'cash' | 'card' | 'mixed'
  Receipt: {
    Items: [
      {
        Name: 'Non',
        Price: 500000,      // narx tiyinda (5000 so'm = 500000 tiyin)
        Amount: 2000,       // miqdor (2.000 = 2 dona)
        VAT: 60000,         // QQS summasi tiyinda
        VATPercent: 12,     // QQS foizi
        // Ixtiyoriy:
        // Barcode: '4780001234567',
        // SPIC: '00302001001000000',
        // Units: 1,
        // Discount: 0,
      },
    ],
    Location: {
      Latitude: 41.311081,
      Longitude: 69.240562,
    },
    ReceivedCash: 1000000,  // naqd qabul qilingan (tiyinda)
    ReceivedCard: 0,        // karta orqali
    Time: new Date().toISOString(),
    // ExtraInfo: { TIN: '123456789' },  // xaridor INN (ixtiyoriy)
  },
});

// Natija:
// {
//   TerminalID: 'UZ...',
//   ReceiptSeq: 42,
//   FiscalSign: 'ABC123...',
//   QRCodeURL: 'https://ofd.soliq.uz/check?...',
//   DateTime: '2026-03-31T12:00:00'
// }
```

> **Muhim:** `Price`, `VAT`, `ReceivedCash`, `ReceivedCard` — barchasi **tiyinda** (1 so'm = 100 tiyin).
> `Amount` — **3 kasr raqamli** (1000 = 1 dona, 2500 = 2.5 dona).

#### Qaytarish cheki

```typescript
const result = await window.electronSoliq.fiskal.sendRefund({
  PayType: 'cash',
  Receipt: {
    Items: [
      { Name: 'Non', Price: 500000, Amount: 2000, VAT: 60000, VATPercent: 12 },
    ],
    Location: { Latitude: 41.31, Longitude: 69.24 },
    ReceivedCash: 1000000,
    Time: new Date().toISOString(),
    // RefundInfo MAJBURIY — asl chek ma'lumotlari
    RefundInfo: {
      DateTime: '2026-03-31T10:00:00',  // asl chek vaqti
      FiscalSign: 'ABC123...',           // asl chek FiscalSign
      ReceiptSeq: 42,                     // asl chek raqami
      TerminalID: 'UZ...',               // asl terminal ID
    },
  },
});
```

#### Avans va kredit cheklari

```typescript
// Avans cheki
await window.electronSoliq.fiskal.sendAdvance({ PayType, Receipt });

// Kredit cheki
await window.electronSoliq.fiskal.sendCredit({ PayType, Receipt });
```

#### Xatoliklar bilan ishlash

Fiskal operatsiyalar xato bo'lganda `Error` tashlanadi. Asosiy xato kodlari:

| Kod | Nomi | Izoh | Yechim |
|-----|------|------|--------|
| `9020` | NOT_FOUND | Ma'lumot topilmadi | Indeksni tekshiring |
| `9021` | ZREPORT_IS_NOT_OPENED | Smena ochilmagan | `openZReport()` chaqiring |
| `9023` | ZREPORT_IS_ALREADY_CLOSED | Smena yopilgan | `openZReport()` chaqiring |
| `9030` | DATETIME_IS_IN_THE_PAST | Vaqt xatosi | 1s kutib qayta urining |
| `9031` | SEND_ALL_RECEIPTS_FIRST | Sync kerak | `sync()` chaqiring |
| `9040-9043` | OVERFLOW | Smena limiti to'ldi | Smenani yopib qayta oching |
| `9090` | LOCKED | FM bloklangan | `sync()` chaqiring |
| `9092` | ALREADY_POS_LOCKED | Boshqa POS ga ulangan | FM ni tekshiring |

> **Eslatma:** `sendSale`, `sendRefund`, `sendAdvance`, `sendCredit` operatsiyalari avtomatik retry bilan ishlaydi (max 3 marta). 9030, 9031, 9090, 9091 xatolarida avtomatik qayta urinadi. 9040-9043 da smenani yopib/ochib qayta urinadi.

```typescript
try {
  await window.electronSoliq.fiskal.sendSale({ ... });
} catch (error) {
  // error.message — xatolik matni
  // Masalan: "Fiskal modul sozlanmagan. Avval configure() chaqiring."
  console.error('Fiskal xato:', error.message);
}
```

---

## Tiplar (Type Definitions)

Frontend loyihangizda `src/preload/api.d.ts` faylini ko'chiring yoki quyidagi tiplarni ishlatib global `Window` interfeysini kengaytiring:

```typescript
// frontend loyihada: electron.d.ts
interface Window {
  electronSoliq?: import('./path/to/api').ElectronSoliqAPI;
  posPrinter?: import('./path/to/api').PosPrinterAPI;
  receiptBuilder?: import('./path/to/api').ReceiptBuilderAPI;
}
```

Yoki to'g'ridan-to'g'ri `src/preload/api.d.ts` ni frontend loyihaga ko'chiring — barcha tiplar u yerda to'liq aniqlangan.

---

## Windows da Build qilish

### Tayyorgarlik

1. [Node.js 20+](https://nodejs.org/) o'rnatilgan bo'lishi kerak
2. [Git](https://git-scm.com/) o'rnatilgan bo'lishi kerak
3. `resources/icon.png` fayl mavjud bo'lishi kerak (256x256 px tavsiya etiladi)

### Build jarayoni

```bash
# 1. Dependencylarni o'rnatish
bun install          # yoki: npm install

# 2. .env ni production uchun sozlash
# .env faylda:
#   NODE_ENV=production
#   SOLIQ_REMOTE_URL=https://your-app.uz
#   FISCAL_ID=real_fm_id
#   FISCAL_ENV=local

# 3. Windows installer yaratish
bun run package:win  # yoki: npm run package:win

# 4. Installer release/ papkada tayyor:
#    release/Soliq Setup 1.0.0.exe
```

### Build konfiguratsiyasi (electron-builder.yml)

| Parametr | Qiymati | Izoh |
|----------|---------|------|
| `appId` | `com.soliq.electron` | Ilova identifikatori |
| `productName` | `Soliq` | Ilova nomi |
| `win.target` | `nsis` (x64) | Windows NSIS installer |
| `nsis.oneClick` | `false` | O'rnatish yo'lini tanlash imkoni |
| `nsis.perMachine` | `true` | Barcha foydalanuvchilar uchun |
| `extraResources` | `.env → .env` | `.env` resources ga ko'chiriladi |
| `publish.provider` | `generic` | Auto-update server URL |

### Packaged app da .env joylashuvi

```
Soliq/
├── Soliq.exe
└── resources/
    ├── .env              ← shu faylni tahrirlang
    ├── app.asar
    └── ...
```

---

## Xavfsizlik

| Sozlama | Qiymati | Izoh |
|---------|---------|------|
| `contextIsolation` | `true` | Preload konteksti ajratilgan |
| `nodeIntegration` | `false` | Renderer da Node.js yo'q |
| `sandbox` | `false` | Printer package talab qiladi |
| `webSecurity` | `true` (prod) | Same-origin policy |

Remote frontend `window.electronSoliq`, `window.posPrinter`, `window.receiptBuilder` orqali faqat belgilangan funksiyalarga ega. `ipcRenderer` yoki Node.js API larga to'g'ridan-to'g'ri kirish yo'q.

---

## Muammolarni hal qilish

| Muammo | Sabab | Yechim |
|--------|-------|--------|
| `window.electronSoliq` undefined | Preload ishlamayapti | `sandbox: false` ekanligini tekshiring |
| `__dirname is not defined` | ESM format | `package.json` da `"type": "module"` bo'lmasligi kerak |
| `Fiskal modul sozlanmagan` | `FISCAL_ID` bo'sh | `.env` da `FISCAL_ID` yozing yoki `configure()` chaqiring |
| Printer topilmadi | Printer ulanmagan | `getPrinters()` bilan tekshiring |
| `ECONNREFUSED localhost:8181` | Lokal FM ishlamayapti | `FISCAL_ENV=test` qo'ying (online test server) |
| Build xatosi (Windows) | `icon.png` yo'q | `resources/icon.png` qo'shing |
