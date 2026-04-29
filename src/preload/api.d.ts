import type {
  PaperWidth,
  PrintContent,
  PrinterConfig,
  PrintResult,
  ReceiptData,
  TextStyle,
  TableColumn,
  BarcodeOptions,
  QRCodeOptions,
  ImageOptions,
  CurrencyOptions,
  PrinterInfo,
} from '@madrimov/electron-pos-printer';

export interface ReceiptBuilderAPI {
  create(paperWidth?: PaperWidth): number;
  destroy(id: number): void;

  setCurrency(id: number, options: CurrencyOptions): void;

  text(id: number, value: string, style?: TextStyle): void;
  textCenter(id: number, value: string, style?: Omit<TextStyle, 'align'>): void;
  textRight(id: number, value: string, style?: Omit<TextStyle, 'align'>): void;
  textBold(id: number, value: string, style?: Omit<TextStyle, 'bold'>): void;
  title(id: number, value: string): void;
  subtitle(id: number, value: string): void;

  line(id: number, character?: string): void;
  dashedLine(id: number): void;
  doubleLine(id: number): void;
  feed(id: number, lines?: number): void;
  cut(id: number, partial?: boolean): void;

  tableRow(id: number, columns: (string | TableColumn)[]): void;
  row(id: number, label: string, value: string, labelBold?: boolean): void;
  itemRow(id: number, name: string, qty: number, price: number): void;
  totalRow(id: number, label: string, amount: number): void;

  barcode(id: number, value: string, options?: Partial<BarcodeOptions>): void;
  qrcode(id: number, value: string, options?: Partial<QRCodeOptions>): void;
  image(id: number, source: string, options?: ImageOptions): void;

  raw(id: number, content: PrintContent): void;
  fromData(id: number, data: ReceiptData): void;

  getContents(id: number): PrintContent[];
  clear(id: number): void;

  print(id: number, config: PrinterConfig): Promise<PrintResult>;
  printFromData(data: ReceiptData, config: PrinterConfig, paperWidth?: PaperWidth): Promise<PrintResult>;
}

export interface PosPrinterAPI {
  getPrinters(): Promise<PrinterInfo[]>;
  print(contents: PrintContent[], config: PrinterConfig): Promise<PrintResult>;
}

export interface ElectronAPI {
  isElectron: true;
  minimizeWindow(): void;
  closeWindow(): void;
  maximizeWindow(): void;
}

declare global {
  interface Window {
    electronApi?: ElectronAPI;
    posPrinter?: PosPrinterAPI;
    receiptBuilder?: ReceiptBuilderAPI;
  }
}
