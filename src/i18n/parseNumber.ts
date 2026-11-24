// Intl formats numbers but does not read them. This reads what a user types, by the
// rules of their locale: "1.250,5" in Brazilian Portuguese and "1,250.5" in English
// and US Spanish are the same number. Anything ambiguous is refused rather than guessed.

export interface Separators {
  group: string;
  decimal: string;
}

const separatorCache = new Map<string, Separators>();

export function numberSeparators(locale: string): Separators {
  const known = separatorCache.get(locale);
  if (known) return known;
  const parts = new Intl.NumberFormat(locale, { useGrouping: 'always' }).formatToParts(1234567.8);
  const separators = {
    group: parts.find((part) => part.type === 'group')?.value ?? ',',
    decimal: parts.find((part) => part.type === 'decimal')?.value ?? '.',
  };
  separatorCache.set(locale, separators);
  return separators;
}

function escapeForPattern(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const ANY_SPACE = /[\s\u00A0\u202F]/g;

export function parseNumber(input: string, locale: string): number | null {
  const { group, decimal } = numberSeparators(locale);
  const groupIsSpace = group.replace(ANY_SPACE, '') === '';
  let text = input.trim().replace(/\u2212/g, '-');
  // Locales that group with a space accept any kind of space; the others accept none.
  if (groupIsSpace) text = text.replace(ANY_SPACE, ' ');
  if (text === '') return null;

  const g = escapeForPattern(groupIsSpace ? ' ' : group);
  const d = escapeForPattern(decimal);
  const shape = new RegExp(`^-?(?:\\d{1,3}(?:${g}\\d{3})+|\\d+)(?:${d}\\d+)?$`);
  if (!shape.test(text)) return null;

  const plain = text.split(groupIsSpace ? ' ' : group).join('').replace(decimal, '.');
  const value = Number(plain);
  return Number.isFinite(value) ? value : null;
}
