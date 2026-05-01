import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron/simple';
import react from '@vitejs/plugin-react';
import renderer from 'vite-plugin-electron-renderer';
import { resolve } from 'path';
import tailwindcss from "@tailwindcss/vite";

const pathAliases = {
  '@shared': resolve(__dirname, 'src/shared'),
  '@renderer': resolve(__dirname, 'src/renderer'),
  '@': resolve(__dirname, 'src'),
};

export default defineConfig({
  // 🎯 Public directory ni resources ga yo'naltiramiz
  publicDir: resolve(__dirname, 'resources'),

  resolve: { alias: pathAliases },

  plugins: [
    react(),
    tailwindcss(),
    electron({
      main: {
        entry: 'src/main/index.ts',
        vite: {
          build: {
            outDir: 'dist/main',
            rollupOptions: {
              external: ['electron', 'electron-updater', 'electron-log'],
              output: { format: 'cjs' },
            },
          },
          resolve: { alias: pathAliases },
        },
      },
      preload: {
        input: 'src/preload/index.ts',
        vite: {
          build: {
            outDir: 'dist/preload',
            rollupOptions: {
              external: ['electron'],
              output: { format: 'cjs' },
            },
          },
        },
      },
    }),
    renderer(),
  ],

  build: {
    // Public fayllarni copy qilishni ta'minlash
    copyPublicDir: true,
  },
});
