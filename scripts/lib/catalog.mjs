// Checks over the translation files themselves: one JSON file per screen per language in,
// a report out. The i18n library is not loaded, but its file format is assumed: i18next's
// {{name}} placeholders and plural keys ending in _one, _other and so on. With FormatJS or
// Lingui these checks come from the library's own commands; the Handoff page lists them.
//
// Hard failures (always fail the build):
//   - a key used in the code that English does not have
//   - a key in another language that English does not have
//   - a translation whose placeholders differ from the English ones
//   - a backend message that uses a value the API does not send
//   - a pseudo-locale that is out of date
// Soft findings (reported; fail only with --strict):
//   - a string not translated yet (it falls back to English at run time)
//   - a backend code the client has no text for (the server's own text is shown)
// Unused keys are listed and never fail.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export const SOURCE_LOCALE = 'en';
export const PSEUDO_LOCALE = 'en-XA';
export const BACKEND_NAMESPACE = 'errors';
export const PLURAL_FORMS = ['zero', 'one', 'two', 'few', 'many', 'other'];

const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g;

/** Reads <dir>/<locale>/<namespace>.json into { locale: { namespace: { key: text } } }. */
export function loadCatalogs(localesDir) {
  const catalogs = {};
  for (const locale of readdirSync(localesDir).sort()) {
    const folder = join(localesDir, locale);
    if (!statSync(folder).isDirectory()) continue;
    catalogs[locale] = {};
    for (const file of readdirSync(folder).sort()) {
      if (!file.endsWith('.json')) continue;
      catalogs[locale][file.slice(0, -5)] = JSON.parse(readFileSync(join(folder, file), 'utf8'));
    }
  }
  return catalogs;
}

export function placeholders(text) {
  const names = new Set();
  for (const match of text.matchAll(PLACEHOLDER)) names.add(match[1]);
  return [...names].sort();
}

/** "summary.count_other" -> { base: "summary.count", form: "other" }. */
export function splitPlural(key) {
  const index = key.lastIndexOf('_');
  if (index > 0) {
    const form = key.slice(index + 1);
    if (PLURAL_FORMS.includes(form)) return { base: key.slice(0, index), form };
  }
  return { base: key, form: null };
}

/** The plural forms a language needs, from the runtime's own CLDR data. */
export function requiredPluralForms(locale) {
  return new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
}

/** Groups one namespace into messages: a plural set counts as one message. */
export function toMessages(namespaceCatalog) {
  const messages = new Map();
  for (const [key, text] of Object.entries(namespaceCatalog)) {
    const { base, form } = splitPlural(key);
    const entry = messages.get(base) ?? { plural: false, forms: {}, text: '' };
    if (form) {
      entry.plural = true;
      entry.forms[form] = text;
      if (form === 'other' || !entry.text) entry.text = text;
    } else {
      entry.text = text;
    }
    messages.set(base, entry);
  }
  return messages;
}

const ACCENTS = {
  a: 'á', c: 'ç', d: 'đ', e: 'é', g: 'ğ', h: 'ĥ', i: 'í', j: 'ĵ', k: 'ķ', l: 'ļ', n: 'ñ', o: 'ö',
  r: 'ŕ', s: 'š', t: 'ţ', u: 'ü', w: 'ŵ', y: 'ý', z: 'ž',
  A: 'Á', C: 'Ç', D: 'Đ', E: 'É', G: 'Ğ', H: 'Ĥ', I: 'Í', J: 'Ĵ', K: 'Ķ', L: 'Ļ', N: 'Ñ', O: 'Ö',
  R: 'Ŕ', S: 'Š', T: 'Ţ', U: 'Ü', W: 'Ŵ', Y: 'Ý', Z: 'Ž',
};

/** "Save" -> "[Šávé ~~]": accented, about 40% longer, in brackets. Placeholders are left alone. */
export function pseudoText(text) {
  const parts = text.split(/(\{\{[^}]*\}\})/);
  let visibleLength = 0;
  const accented = parts
    .map((part) => {
      if (part.startsWith('{{')) return part;
      visibleLength += part.length;
      return [...part].map((char) => ACCENTS[char] ?? char).join('');
    })
    .join('');
  // Padding in groups of five, so a long string can still wrap where a real translation would.
  const padLength = Math.max(2, Math.ceil(visibleLength * 0.4));
  const padding = Array.from({ length: padLength }, (_, index) => (index % 6 === 5 ? ' ' : '~')).join('').trim();
  return `[${accented} ${padding}]`;
}

export function buildPseudoCatalog(sourceCatalog) {
  const pseudo = {};
  for (const [namespace, entries] of Object.entries(sourceCatalog)) {
    pseudo[namespace] = {};
    for (const [key, text] of Object.entries(entries)) pseudo[namespace][key] = pseudoText(text);
  }
  return pseudo;
}

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'locales' || name === 'node_modules') continue;
      walk(full, files);
    } else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) {
      files.push(full);
    }
  }
  return files;
}

/** Finds every 'namespace:key' string literal in the source folder. */
export function scanKeyUsage(srcDir, namespaces) {
  const pattern = new RegExp(`['"\`]((?:${namespaces.join('|')}):[A-Za-z0-9_.-]+)['"\`]`, 'g');
  const used = new Map();
  for (const file of walk(srcDir)) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(pattern)) {
      const key = match[1];
      if (!used.has(key)) used.set(key, relative(srcDir, file).split(sep).join('/'));
    }
  }
  return used;
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * @param {object} input
 * @param {Record<string, Record<string, Record<string, string>>>} input.catalogs
 * @param {Map<string, string>} input.usedKeys  'namespace:key' -> first file that uses it
 * @param {Array<{code: string, values: Record<string, string>}>} input.apiCodes
 */
export function buildReport({ catalogs, usedKeys, apiCodes }) {
  const source = catalogs[SOURCE_LOCALE];
  if (!source) throw new Error(`No ${SOURCE_LOCALE} folder found: English is the source language.`);
  const namespaces = Object.keys(source).sort();
  const errors = [];

  const sourceMessages = {};
  let total = 0;
  for (const namespace of namespaces) {
    sourceMessages[namespace] = toMessages(source[namespace]);
    total += sourceMessages[namespace].size;
  }

  // Keys the code uses that English does not have.
  const unknownKeys = [];
  for (const [ref, file] of usedKeys) {
    const [namespace, key] = [ref.slice(0, ref.indexOf(':')), ref.slice(ref.indexOf(':') + 1)];
    if (!sourceMessages[namespace]?.has(key)) {
      unknownKeys.push({ key: ref, file });
      errors.push(`${ref} is used in ${file} but is missing from ${SOURCE_LOCALE}/${namespace}.json`);
    }
  }

  // Keys English has that the code never names. The backend namespace is matched against the API instead.
  const unused = [];
  for (const namespace of namespaces) {
    if (namespace === BACKEND_NAMESPACE) continue;
    for (const [key, message] of sourceMessages[namespace]) {
      if (!usedKeys.has(`${namespace}:${key}`)) unused.push({ namespace, key, source: message.text });
    }
  }

  const locales = [];
  for (const locale of Object.keys(catalogs).sort()) {
    if (locale === SOURCE_LOCALE) continue;
    const catalog = catalogs[locale];
    const pseudo = locale === PSEUDO_LOCALE;
    const missing = [];
    const extra = [];
    const placeholderMismatches = [];
    let translated = 0;
    const needed = requiredPluralForms(locale);

    for (const namespace of namespaces) {
      const own = catalog[namespace] ?? {};
      const ownMessages = toMessages(own);
      for (const [key, message] of sourceMessages[namespace]) {
        const candidate = ownMessages.get(key);
        if (!candidate) {
          missing.push({ namespace, key, source: message.text, forms: [] });
          continue;
        }
        if (message.plural) {
          const wanted = [...needed, ...(message.forms.zero !== undefined ? ['zero'] : [])];
          const absent = wanted.filter((form) => candidate.forms[form] === undefined);
          if (absent.length > 0) {
            missing.push({ namespace, key, source: message.text, forms: absent });
            continue;
          }
        }
        translated += 1;
      }
      for (const key of Object.keys(own)) {
        const { base, form } = splitPlural(key);
        const sourceMessage = sourceMessages[namespace].get(base);
        if (!sourceMessage) {
          extra.push({ namespace, key });
          errors.push(`${locale}/${namespace}.json has "${key}", which ${SOURCE_LOCALE} does not have`);
          continue;
        }
        const sourceText = source[namespace][key] ?? (form ? sourceMessage.forms.other : undefined) ?? sourceMessage.text;
        const ignore = form ? ['count'] : [];
        const expected = placeholders(sourceText).filter((name) => !ignore.includes(name));
        const found = placeholders(own[key]).filter((name) => !ignore.includes(name));
        if (!sameJson(expected, found)) {
          placeholderMismatches.push({ namespace, key, expected, found });
          errors.push(
            `${locale}/${namespace}.json "${key}": placeholders {${found.join(', ')}} do not match English {${expected.join(', ')}}`,
          );
        }
      }
    }
    for (const namespace of Object.keys(catalog)) {
      if (!namespaces.includes(namespace)) errors.push(`${locale}/${namespace}.json has no ${SOURCE_LOCALE} file`);
    }
    locales.push({ locale, pseudo, total, translated, missing, extra, placeholderMismatches });
  }

  // Backend codes against the client's texts.
  const backendTexts = source[BACKEND_NAMESPACE] ?? {};
  const backend = {
    codes: apiCodes.map((spec) => ({
      code: spec.code,
      values: Object.keys(spec.values),
      texts: Object.fromEntries(
        Object.keys(catalogs)
          .filter((locale) => locale !== PSEUDO_LOCALE)
          .map((locale) => [locale, catalogs[locale]?.[BACKEND_NAMESPACE]?.[spec.code] !== undefined]),
      ),
    })),
    withoutText: apiCodes.filter((spec) => backendTexts[spec.code] === undefined).map((spec) => spec.code),
    textsWithoutCode: Object.keys(backendTexts).filter((key) => !apiCodes.some((spec) => spec.code === key)),
  };
  for (const spec of apiCodes) {
    const text = backendTexts[spec.code];
    if (text === undefined) continue;
    const unknown = placeholders(text).filter((name) => !(name in spec.values));
    if (unknown.length > 0) {
      errors.push(`${SOURCE_LOCALE}/${BACKEND_NAMESPACE}.json "${spec.code}" uses {${unknown.join(', ')}}, which the API does not send`);
    }
  }
  for (const key of backend.textsWithoutCode) {
    errors.push(`${SOURCE_LOCALE}/${BACKEND_NAMESPACE}.json has "${key}", which is not a code the API can send`);
  }

  // The pseudo-locale is written by a script, so it must match what the script would write today.
  const pseudoInSync = catalogs[PSEUDO_LOCALE] !== undefined && sameJson(catalogs[PSEUDO_LOCALE], buildPseudoCatalog(source));
  if (!pseudoInSync) errors.push(`${PSEUDO_LOCALE} is out of date: run "pnpm i18n:pseudo"`);

  const untranslated = locales.filter((entry) => !entry.pseudo).reduce((sum, entry) => sum + entry.missing.length, 0);

  return {
    sourceLocale: SOURCE_LOCALE,
    pseudoLocale: PSEUDO_LOCALE,
    namespaces,
    total,
    locales,
    unused,
    unknownKeys,
    backend,
    pseudoInSync,
    errors,
    untranslated,
    softCount: untranslated + backend.withoutText.length,
  };
}

export function exitCode(report, { strict = false } = {}) {
  if (report.errors.length > 0) return 1;
  if (strict && report.softCount > 0) return 1;
  return 0;
}

/** The text the command prints. The Translation status page shows the same text. */
export function formatReport(report, { strict = false } = {}) {
  const lines = [];
  lines.push(`Translation check${strict ? ' (strict)' : ''}`);
  lines.push(`Source: ${report.sourceLocale}, ${report.total} messages in ${report.namespaces.length} files`);
  lines.push('');
  for (const entry of report.locales) {
    const label = entry.pseudo ? `${entry.locale} (built by pnpm i18n:pseudo)` : entry.locale;
    lines.push(`${label}: ${entry.translated} of ${entry.total} translated`);
    for (const item of entry.missing) {
      const forms = item.forms.length > 0 ? ` (plural forms missing: ${item.forms.join(', ')})` : '';
      lines.push(`  not translated  ${item.namespace}:${item.key}${forms}`);
    }
  }
  lines.push('');
  if (report.backend.withoutText.length > 0) {
    lines.push('Backend codes with no client text (the server text is shown):');
    for (const code of report.backend.withoutText) lines.push(`  ${code}`);
    lines.push('');
  }
  if (report.unused.length > 0) {
    lines.push('Unused keys (in English, not named in the code):');
    for (const item of report.unused) lines.push(`  ${item.namespace}:${item.key}`);
    lines.push('');
  }
  if (report.errors.length > 0) {
    lines.push('Errors:');
    for (const error of report.errors) lines.push(`  ${error}`);
    lines.push('');
  }
  lines.push(verdict(report, { strict }));
  return lines.join('\n');
}

const counted = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** What falls back, in words: "5 strings and 1 backend code". The two are counted apart because they are fixed in different places. */
export function fallbackSummary(report) {
  const parts = [];
  if (report.untranslated > 0) parts.push(counted(report.untranslated, 'string'));
  if (report.backend.withoutText.length > 0) parts.push(counted(report.backend.withoutText.length, 'backend code'));
  return parts.join(' and ');
}

/** The last line the command prints. */
export function verdict(report, { strict = false } = {}) {
  if (report.errors.length > 0) return `FAILED: ${counted(report.errors.length, 'error')}.`;
  if (report.softCount === 0) return 'PASSED: no errors, nothing falls back.';
  if (strict) return `FAILED (strict): ${fallbackSummary(report)} would fall back.`;
  return `PASSED: no errors. ${fallbackSummary(report)} will fall back; --strict makes that a failure.`;
}

/** Loads everything from a project folder and builds the report. */
export function reportForProject(root) {
  const catalogs = loadCatalogs(join(root, 'src/i18n/locales'));
  const namespaces = Object.keys(catalogs[SOURCE_LOCALE] ?? {});
  const usedKeys = scanKeyUsage(join(root, 'src'), namespaces);
  const apiCodes = JSON.parse(readFileSync(join(root, 'contracts/api-error-codes.json'), 'utf8'));
  return buildReport({ catalogs, usedKeys, apiCodes });
}
