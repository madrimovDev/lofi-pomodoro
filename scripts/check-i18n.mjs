// Verifies uz/en/ru have identical key sets, by parsing the source files.
// No TS compilation needed — keys are matched by regex on `^\s*ident:` lines.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const i18nDir = join(here, '..', 'src', 'shared', 'i18n');
const locales = ['uz', 'en', 'ru'];

function extractKeys(locale) {
  const src = readFileSync(join(i18nDir, `${locale}.ts`), 'utf8');
  const keys = new Set();
  for (const m of src.matchAll(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*:/gm)) {
    keys.add(m[1]);
  }
  return keys;
}

const sets = Object.fromEntries(locales.map((l) => [l, extractKeys(l)]));
const base = sets.uz;
let failed = false;

for (const l of ['en', 'ru']) {
  const missing = [...base].filter((k) => !sets[l].has(k));
  const extra = [...sets[l]].filter((k) => !base.has(k));
  if (missing.length) {
    failed = true;
    console.error(`[${l}] MISSING ${missing.length} keys:`, missing.join(', '));
  }
  if (extra.length) {
    failed = true;
    console.error(`[${l}] EXTRA ${extra.length} keys:`, extra.join(', '));
  }
}

if (failed) {
  console.error('\ni18n parity check FAILED');
  process.exit(1);
}
console.log(`i18n parity OK — ${base.size} keys × ${locales.length} locales`);
