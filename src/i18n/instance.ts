// The only file that configures the i18n library (i18next). Screens never import it.

import i18next from 'i18next';
import { LOCALES, NAMESPACES, SOURCE_LOCALE, STORAGE_KEY, isLocaleCode, type LocaleCode } from './config';
import { resources } from './resources';

export function detectLocale(): LocaleCode {
  try {
    const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (isLocaleCode(saved)) return saved;
  } catch {
    // Storage can be blocked; fall through to the browser's languages.
  }
  const wanted = typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]);
  for (const tag of wanted) {
    const lower = tag.toLowerCase();
    const match = LOCALES.find(
      (locale) => !locale.developer && (locale.code.toLowerCase() === lower || locale.code.toLowerCase().split('-')[0] === lower.split('-')[0]),
    );
    if (match) return match.code;
  }
  return SOURCE_LOCALE;
}

export const i18n = i18next.createInstance();

void i18n.init({
  resources,
  lng: detectLocale(),
  // English fallback: without this line i18next has no fallback language at all.
  fallbackLng: SOURCE_LOCALE,
  supportedLngs: LOCALES.map((locale) => locale.code),
  load: 'currentOnly',
  ns: [...NAMESPACES],
  defaultNS: 'common',
  nsSeparator: ':',
  keySeparator: false,
  interpolation: { escapeValue: false },
  returnNull: false,
  initAsync: false,
});
