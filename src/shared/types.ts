// === IPC Channels ===
export const IPC_CHANNELS = {
  // App
  APP_GET_VERSION: 'app:get-version',
  APP_IS_ELECTRON: 'app:is-electron',
  // Window
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',

} as const;
