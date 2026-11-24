#!/usr/bin/env node
// pnpm i18n:pseudo   writes the pseudo-locale (en-XA) from the English files.
// It is an ordinary locale folder, added by the same steps as any other language.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PSEUDO_LOCALE, SOURCE_LOCALE, buildPseudoCatalog, loadCatalogs } from './lib/catalog.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const localesDir = join(root, 'src/i18n/locales');
const pseudo = buildPseudoCatalog(loadCatalogs(localesDir)[SOURCE_LOCALE]);

mkdirSync(join(localesDir, PSEUDO_LOCALE), { recursive: true });
let count = 0;
for (const [namespace, entries] of Object.entries(pseudo)) {
  writeFileSync(join(localesDir, PSEUDO_LOCALE, `${namespace}.json`), `${JSON.stringify(entries, null, 2)}\n`);
  count += Object.keys(entries).length;
}
console.log(`Wrote ${count} strings to src/i18n/locales/${PSEUDO_LOCALE}`);
