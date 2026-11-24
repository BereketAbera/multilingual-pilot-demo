// Every date, number, quantity, percent and relative time on screen goes through this file.
// It uses the browser's Intl API; the region comes from the language's formatLocale.

export type Unit = 'kilogram' | 'pound' | 'celsius' | 'fahrenheit';

const cache = new Map<string, unknown>();

function cached<T>(key: string, create: () => T): T {
  if (!cache.has(key)) cache.set(key, create());
  return cache.get(key) as T;
}

function numberFormat(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  return cached(`n|${locale}|${JSON.stringify(options)}`, () => new Intl.NumberFormat(locale, options));
}

function dateFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return cached(`d|${locale}|${JSON.stringify(options)}`, () => new Intl.DateTimeFormat(locale, options));
}

function toDate(value: string | Date): Date {
  return typeof value === 'string' ? new Date(value) : value;
}

/**
 * A plain calendar date ("2026-11-24"), with the month as a word.
 * 11/24/2026 and 24/11/2026 are the same day in two of our languages; on a best-before
 * date that is a food-safety risk, so the short numeric form is never used.
 */
export function formatDate(isoDate: string | Date, locale: string): string {
  return dateFormat(locale, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(toDate(isoDate));
}

/** A moment in time, shown in the plant's time zone. */
export function formatDateTime(instant: string | Date, locale: string, timeZone?: string): string {
  return dateFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  }).format(toDate(instant));
}

export function formatNumber(value: number, locale: string, maximumFractionDigits = 1): string {
  return numberFormat(locale, { maximumFractionDigits }).format(value);
}

/** A ratio as a percentage: 0.966 becomes "96.6%". One decimal by default, so a column lines up. */
export function formatPercent(ratio: number, locale: string, minimumFractionDigits = 1): string {
  return numberFormat(locale, { style: 'percent', minimumFractionDigits, maximumFractionDigits: 1 }).format(ratio);
}

/** A number with its unit. The unit comes from the data (a plant setting), never from the language. */
export function formatQuantity(value: number, unit: Unit, locale: string, maximumFractionDigits = 1): string {
  return numberFormat(locale, { style: 'unit', unit, unitDisplay: 'short', maximumFractionDigits }).format(value);
}

/** The unit's symbol on its own, for a field suffix: "kg", "°C". */
export function unitSymbol(unit: Unit, locale: string): string {
  const parts = numberFormat(locale, { style: 'unit', unit, unitDisplay: 'short' }).formatToParts(1);
  return parts.find((part) => part.type === 'unit')?.value ?? unit;
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "3 hours ago", "yesterday", "in 12 days". */
export function formatRelativeTime(target: string | Date, now: Date, locale: string): string {
  const format = cached(`r|${locale}`, () => new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }));
  const seconds = Math.round((toDate(target).getTime() - now.getTime()) / 1000);
  const size = Math.abs(seconds);
  if (size < MINUTE) return format.format(0, 'minute');
  if (size < HOUR) return format.format(Math.trunc(seconds / MINUTE), 'minute');
  if (size < DAY) return format.format(Math.trunc(seconds / HOUR), 'hour');
  return format.format(Math.trunc(seconds / DAY), 'day');
}

/** Whole days between two plain dates: "today", "in 45 days", "3 days ago". */
export function formatRelativeDays(isoDate: string, todayIso: string, locale: string): string {
  const format = cached(`r|${locale}`, () => new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }));
  const days = Math.round((Date.parse(isoDate) - Date.parse(todayIso)) / (DAY * 1000));
  return format.format(days, 'day');
}

/** The plural form a count takes in a language: "one", "other", and so on. */
export function pluralForm(count: number, locale: string): Intl.LDMLPluralRule {
  return cached(`p|${locale}`, () => new Intl.PluralRules(locale)).select(count);
}
