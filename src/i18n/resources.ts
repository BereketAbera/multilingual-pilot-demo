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
  if (count === undefined) return key in catalog;
  if (count === 0 && `${key}_zero` in catalog) return true;
  const form = new Intl.PluralRules(locale).select(count);
  return `${key}_${form}` in catalog;
}
