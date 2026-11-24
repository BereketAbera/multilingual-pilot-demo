// Loads every locales/<language>/<screen>.json file. A new language or screen file is
// picked up from its folder; nothing is listed by hand here.

import { NAMESPACES } from './config';

export type NamespaceCatalog = Record<string, string>;
export type Resources = Record<string, Record<string, NamespaceCatalog>>;

const files = import.meta.glob<NamespaceCatalog>('./locales/*/*.json', { eager: true, import: 'default' });

export const resources: Resources = {};
for (const [path, catalog] of Object.entries(files)) {
  const match = /\.\/locales\/([^/]+)\/([^/]+)\.json$/.exec(path);
  if (!match) continue;
  const [, locale, namespace] = match;
  if (!locale || !namespace || !(NAMESPACES as readonly string[]).includes(namespace)) continue;
  (resources[locale] ??= {})[namespace] = catalog;
}

/** True when the language's own file has this message, counting plural forms. */
export function hasOwnMessage(locale: string, namespace: string, key: string, count?: number): boolean {
  const catalog = resources[locale]?.[namespace];
  if (!catalog) return false;
  if (count === undefined) return Object.hasOwn(catalog, key);
  if (count === 0 && Object.hasOwn(catalog, `${key}_zero`)) return true;
  const form = new Intl.PluralRules(locale).select(count);
  return Object.hasOwn(catalog, `${key}_${form}`);
}

/** The names a message needs filled in: "Lot {{lotCode}} is on hold" needs lotCode. */
export function messagePlaceholders(locale: string, namespace: string, key: string): string[] {
  const catalog = resources[locale]?.[namespace];
  const text = catalog && Object.hasOwn(catalog, key) ? (catalog[key] ?? '') : '';
  return [...text.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((match) => match[1] ?? '');
}

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

/** How many English messages a language does not have yet. A set of plural forms counts once. */
export function fallbackCount(locale: string, sourceLocale: string): number {
  if (locale === sourceLocale) return 0;
  let count = 0;
  for (const [namespace, catalog] of Object.entries(resources[sourceLocale] ?? {})) {
    const own = new Set(Object.keys(resources[locale]?.[namespace] ?? {}).map((key) => key.replace(PLURAL_SUFFIX, '')));
    const messages = new Set(Object.keys(catalog).map((key) => key.replace(PLURAL_SUFFIX, '')));
    for (const message of messages) if (!own.has(message)) count += 1;
  }
  return count;
}
