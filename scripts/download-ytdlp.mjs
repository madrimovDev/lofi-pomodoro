#!/usr/bin/env node
/**
 * Tauri sidecar uchun yt-dlp Linux binary'sini yuklaydi.
 * Tauri sidecar binary'ni target-triple suffiks bilan talab qiladi (dev'da ham).
 * Run: node scripts/download-ytdlp.mjs
 */
import { createWriteStream, mkdirSync, chmodSync } from 'fs';
import { pipeline } from 'stream/promises';

// Faqat Linux (dev + acceptance shu mashinada). Windows/macOS keyingi CI fazasida.
const BINARIES = [
  {
    url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp',
    dest: 'src-tauri/bin/yt-dlp-x86_64-unknown-linux-gnu',
    chmod: true,
  },
];

async function download({ url, dest, chmod }) {
  mkdirSync(dest.split('/').slice(0, -1).join('/'), { recursive: true });
  console.log(`⬇  Downloading ${dest}...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  await pipeline(res.body, createWriteStream(dest));
  if (chmod) chmodSync(dest, 0o755);
  console.log(`✓  ${dest}`);
}

for (const bin of BINARIES) {
  await download(bin);
}
console.log('\n✅ yt-dlp Linux sidecar binary tayyor.');
