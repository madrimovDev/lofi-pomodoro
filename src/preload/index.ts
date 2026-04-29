import { contextBridge, ipcRenderer } from 'electron';
import {
  exposePosPrinterAPI,
  createReceipt,
  type PaperWidth,
  type PrintContent,
  type PrinterConfig,
  type ReceiptData,
  type TextStyle,
  type TableColumn,
  type BarcodeOptions,
  type QRCodeOptions,
  type ImageOptions,
  type CurrencyOptions,
  type PrintResult,
  IPC_CHANNELS as PRINTER_IPC,
} from '@madrimov/electron-pos-printer';
import { IPC_CHANNELS } from '../shared/types';

// Expose low-level POS printer API as window.posPrinter
exposePosPrinterAPI();

// === Receipt Builder Proxy ===
const builders = new Map<number, ReturnType<typeof createReceipt>>();
let nextBuilderId = 0;

contextBridge.exposeInMainWorld('receiptBuilder', {
  create: (paperWidth: PaperWidth = 80): number => {
    const id = nextBuilderId++;
    builders.set(id, createReceipt(paperWidth));
    return id;
  },
  destroy: (id: number): void => {
    builders.delete(id);
  },

  // Currency
  setCurrency: (id: number, options: CurrencyOptions): void => {
    builders.get(id)?.setCurrency(options);
  },

  // Text
  text: (id: number, value: string, style?: TextStyle): void => {
    builders.get(id)?.text(value, style);
  },
  textCenter: (id: number, value: string, style?: Omit<TextStyle, 'align'>): void => {
    builders.get(id)?.textCenter(value, style);
  },
  textRight: (id: number, value: string, style?: Omit<TextStyle, 'align'>): void => {
    builders.get(id)?.textRight(value, style);
  },
  textBold: (id: number, value: string, style?: Omit<TextStyle, 'bold'>): void => {
    builders.get(id)?.textBold(value, style);
  },
  title: (id: number, value: string): void => {
    builders.get(id)?.title(value);
  },
  subtitle: (id: number, value: string): void => {
    builders.get(id)?.subtitle(value);
  },

  // Separators
  line: (id: number, character?: string): void => {
    builders.get(id)?.line(character);
  },
  dashedLine: (id: number): void => {
    builders.get(id)?.dashedLine();
  },
  doubleLine: (id: number): void => {
    builders.get(id)?.doubleLine();
  },
  feed: (id: number, lines?: number): void => {
    builders.get(id)?.feed(lines);
  },
  cut: (id: number, partial?: boolean): void => {
    builders.get(id)?.cut(partial);
  },

  // Table & rows
  tableRow: (id: number, columns: (string | TableColumn)[]): void => {
    builders.get(id)?.tableRow(columns);
  },
  row: (id: number, label: string, value: string, labelBold?: boolean): void => {
    builders.get(id)?.row(label, value, labelBold);
  },
  itemRow: (id: number, name: string, qty: number, price: number): void => {
    builders.get(id)?.itemRow(name, qty, price);
  },
  totalRow: (id: number, label: string, amount: number): void => {
    builders.get(id)?.totalRow(label, amount);
  },

  // Media
  barcode: (id: number, value: string, options?: Partial<BarcodeOptions>): void => {
    builders.get(id)?.barcode(value, options);
  },
  qrcode: (id: number, value: string, options?: Partial<QRCodeOptions>): void => {
    builders.get(id)?.qrcode(value, options);
  },
  image: (id: number, source: string, options?: ImageOptions): void => {
    builders.get(id)?.image(source, options);
  },

  // Raw & data
  raw: (id: number, content: PrintContent): void => {
    builders.get(id)?.raw(content);
  },
  fromData: (id: number, data: ReceiptData): void => {
    builders.get(id)?.fromData(data);
  },

  // Get & clear
  getContents: (id: number): PrintContent[] => {
    return builders.get(id)?.getContents() ?? [];
  },
  clear: (id: number): void => {
    builders.get(id)?.clear();
  },

  // Print
  print: (id: number, config: PrinterConfig): Promise<PrintResult> => {
    const builder = builders.get(id);
    if (!builder) {
      return Promise.resolve({ success: false, jobId: '', error: 'Builder not found' });
    }
    const contents = builder.getContents();
    return ipcRenderer.invoke(PRINTER_IPC.PRINT, { contents, config });
  },
  printFromData: (data: ReceiptData, config: PrinterConfig, paperWidth: PaperWidth = 80): Promise<PrintResult> => {
    const builder = createReceipt(paperWidth);
    builder.fromData(data);
    const contents = builder.getContents();
    return ipcRenderer.invoke(PRINTER_IPC.PRINT, { contents, config });
  },
});

// === Fiskal (Soliq) API ===
contextBridge.exposeInMainWorld('electronApi', {
  isElectron: true as const,

  getVersion: (): Promise<string> =>
    ipcRenderer.invoke(IPC_CHANNELS.APP_GET_VERSION),
  minimizeWindow: () =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),
  closeWindow: () =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),
  maximizeWindow: () =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MAXIMIZE),
});
