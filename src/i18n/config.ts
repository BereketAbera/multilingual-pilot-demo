// The one place a language is switched on. Adding a language starts here.

export const NAMESPACES = ['common', 'orders', 'lot', 'output', 'errors'] as const;
export type Namespace = (typeof NAMESPACES)[number];

export interface LocaleConfig {
  /** Folder name under locales/, and the value of the page's lang attribute. */
  code: string;
  /** The language's name, written in that language. */
  label: string;
  /** Region used for dates and numbers. Changing es-US to es-MX is this one value. */
  formatLocale: string;
  /** What the API is told in Accept-Language. */
  acceptLanguage: string;
  /** Developer locales sit under their own divider in the selector. */
  developer: boolean;
}

export const LOCALES = [
  { code: 'en', label: 'English', formatLocale: 'en-US', acceptLanguage: 'en', developer: false },
  { code: 'es', label: 'Español', formatLocale: 'es-US', acceptLanguage: 'es', developer: false },
  { code: 'pt-BR', label: 'Português (Brasil)', formatLocale: 'pt-BR', acceptLanguage: 'pt-BR', developer: false },
  { code: 'en-XA', label: 'Pseudo-locale', formatLocale: 'en-US', acceptLanguage: 'en', developer: true },
] as const satisfies readonly LocaleConfig[];

export type LocaleCode = (typeof LOCALES)[number]['code'];

export const SOURCE_LOCALE: LocaleCode = 'en';
export const PSEUDO_LOCALE: LocaleCode = 'en-XA';
export const STORAGE_KEY = 'pilot.locale';

export function isLocaleCode(value: unknown): value is LocaleCode {
  return LOCALES.some((locale) => locale.code === value);
}

export function localeConfig(code: LocaleCode): LocaleConfig {
  return LOCALES.find((locale) => locale.code === code) ?? LOCALES[0];
}
