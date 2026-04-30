#!/usr/bin/env node
/**
 * Downloads the latest yt-dlp binaries for Linux and Windows.
 * Run: node scripts/download-ytdlp.mjs
 */
import { createWriteStream, mkdirSync, chmodSync } from 'fs';
import { pipeline } from 'stream/promises';

const BINARIES = [
  {
    url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp',
    dest: 'bin/linux/yt-dlp',
    chmod: true,
  },
  {
    url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
    dest: 'bin/win/yt-dlp.exe',
    chmod: false,
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
console.log('\n✅ yt-dlp binaries ready.');
