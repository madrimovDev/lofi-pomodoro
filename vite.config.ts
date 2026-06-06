import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

// Tauri branch: frontend-only Vite config.
// Electron plugin'lari (vite-plugin-electron) olib tashlandi — backend Rust'da (src-tauri/).
const pathAliases = {
  '@shared': resolve(__dirname, 'src/shared'),
  '@renderer': resolve(__dirname, 'src/renderer'),
  '@': resolve(__dirname, 'src'),
};

export default defineConfig({
  // Background, bell, ambient ovozlar — resources/ dan dist/ root ga ko'chiriladi
  publicDir: resolve(__dirname, 'resources'),

  resolve: { alias: pathAliases },

  plugins: [react(), tailwindcss()],

  // Tauri CLI fixed portni kutadi
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: '127.0.0.1',
  },

  build: {
    copyPublicDir: true,
    target: 'esnext',
  },
});
