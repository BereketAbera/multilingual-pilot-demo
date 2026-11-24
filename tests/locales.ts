// The languages the tests cover. Adding a language to the app means adding it here.
export const LANGUAGES = ['en', 'es', 'pt-BR'] as const;
export const PSEUDO = 'en-XA';
export const ALL_LOCALES = [...LANGUAGES, PSEUDO] as const;

/** Intl uses no-break spaces in places ("74.5 °C", "2:05 p.m."). Tests compare with plain ones. */
export function plain(text: string): string {
  return text.replace(/[\u00A0\u202F]/g, ' ');
}
