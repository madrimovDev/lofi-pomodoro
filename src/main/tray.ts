import { BrowserWindow, Menu, Tray, nativeImage, app, ipcMain } from 'electron';
import { join } from 'path';
import { deflateSync } from 'zlib';
import { IPC_CHANNELS, type TrayTimerState } from '../shared/types';

let tray: Tray | null = null;
let _win: BrowserWindow | null = null;
let _state: TrayTimerState = { timeLeft: 0, mode: 'focus', isRunning: false };

function formatTime(s: number): string {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

const MODE_LABELS: Record<string, string> = {
  'focus': 'Fokus',
  'short-break': 'Tanaffus',
  'long-break': 'Uzoq tanaffus',
};

// Build a minimal valid PNG from raw RGBA pixel rows.
// nativeImage.createFromDataURL with SVG data URLs is unreliable on Linux —
// the tray icon silently disappears when updated. PNG works everywhere.
function buildPng(size: number, pixels: Buffer): Buffer {
  // CRC32 table (PNG chunk integrity)
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c;
  }
  const crc32 = (buf: Buffer): number => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer): Buffer => {
    const t = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.concat([t, data]);
    const out = Buffer.alloc(4 + 4 + data.length + 4);
    out.writeUInt32BE(data.length, 0);
    t.copy(out, 4);
    data.copy(out, 8);
    out.writeUInt32BE(crc32(crcBuf), 8 + data.length);
    return out;
  };

  // Prepend filter byte 0 (None) to each row, then zlib-compress
  const rows = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    rows[y * (1 + size * 4)] = 0;
    pixels.copy(rows, y * (1 + size * 4) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = deflateSync(rows, { level: 1 });

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit depth, RGBA

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function createModeIcon(mode: string, isRunning: boolean): Electron.NativeImage {
  const COLORS: Record<string, [number, number, number]> = {
    'focus':       [74,  222, 128], // #4ade80
    'short-break': [45,  212, 191], // #2dd4bf
    'long-break':  [167, 139, 250], // #a78bfa
  };
  const [r, g, b] = COLORS[mode] ?? COLORS['focus'];
  const size = 22;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = cx - 1;
  const ringInner = outerR - 2.5;

  const pixels = Buffer.alloc(size * size * 4, 0);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let alpha = 0;
      if (isRunning) {
        if (dist <= outerR) alpha = 255;
      } else {
        if (dist >= ringInner && dist <= outerR) {
          const angle = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
          if (Math.floor(angle / 36) % 2 === 0) alpha = 200;
        }
      }
      const i = (y * size + x) * 4;
      pixels[i] = r; pixels[i + 1] = g; pixels[i + 2] = b; pixels[i + 3] = alpha;
    }
  }

  return nativeImage.createFromBuffer(buildPng(size, pixels), { scaleFactor: 1 });
}

function rebuildMenu(): void {
  if (!tray || !_win) return;

  const isVisible = _win.isVisible();
  const label = `${formatTime(_state.timeLeft)}  •  ${MODE_LABELS[_state.mode] ?? _state.mode}`;

  const menu = Menu.buildFromTemplate([
    { label, enabled: false },
    { type: 'separator' },
    {
      label: _state.isRunning ? "⏸  To'xtatish" : '▶  Boshlash',
      click: () => { _win?.webContents.send(IPC_CHANNELS.TRAY_TOGGLE_TIMER); },
    },
    {
      label: "⏭  Keyingisiga o'tish",
      click: () => { _win?.webContents.send(IPC_CHANNELS.TRAY_SKIP); },
    },
    { type: 'separator' },
    {
      label: '📌  Mini rejim',
      click: () => { _win?.webContents.send(IPC_CHANNELS.TRAY_SET_MINI_MODE, true); },
    },
    {
      label: isVisible ? "🙈  Yashirish" : "👁  Ko'rsatish",
      click: () => {
        if (_win?.isVisible()) {
          _win.hide();
        } else {
          _win?.show();
          _win?.focus();
        }
      },
    },
    { type: 'separator' },
    { label: 'Chiqish', click: () => { app.quit(); } },
  ]);

  tray.setContextMenu(menu);
}

function updateTray(state: TrayTimerState): void {
  if (!tray) return;

  const prevMode = _state.mode;
  const prevRunning = _state.isRunning;
  _state = state;

  const tooltipText = `ZenFocus  |  ${formatTime(state.timeLeft)}  |  ${MODE_LABELS[state.mode] ?? state.mode}`;
  tray.setToolTip(tooltipText);
  if (process.platform === 'darwin') {
    tray.setTitle(formatTime(state.timeLeft));
  }

  if (state.mode !== prevMode || state.isRunning !== prevRunning) {
    tray.setImage(createModeIcon(state.mode, state.isRunning));
    rebuildMenu();
  }
}

export function setupTray(win: BrowserWindow): void {
  _win = win;

  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'tray-icon.png')
    : join(__dirname, '../../resources/tray-icon.png');

  tray = new Tray(iconPath);
  tray.setToolTip('ZenFocus');

  tray.on('click', () => {
    if (win.isVisible()) {
      win.hide();
    } else {
      win.show();
      win.focus();
    }
  });

  win.webContents.on('did-finish-load', () => {
    rebuildMenu();
  });
  rebuildMenu();

  ipcMain.handle(IPC_CHANNELS.TRAY_UPDATE_STATE, (_e, state: TrayTimerState) => {
    updateTray(state);
  });
}
