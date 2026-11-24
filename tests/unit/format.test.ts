import { describe, expect, it } from 'vitest';
import { localeConfig, type LocaleCode } from '../../src/i18n/config';
import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatQuantity,
  formatRelativeDays,
  formatRelativeTime,
  pluralForm,
  unitSymbol,
} from '../../src/i18n/format';
import { LANGUAGES, plain } from '../locales';

// One row per language. A new language gets a row here.
const EXPECTED: Record<(typeof LANGUAGES)[number], Record<string, string>> = {
  en: {
    date: 'Nov 24, 2026',
    dateTime: 'Nov 24, 2026, 2:05 PM',
    number: '1,250.5',
    percent: '96.6%',
    wholePercent: '10%',
    quantity: '1,250.5 kg',
    temperature: '74.5°C',
    hoursAgo: '3 hours ago',
    minutesAgo: '35 minutes ago',
    yesterday: 'yesterday',
    inDays: 'in 12 days',
    today: 'today',
  },
  es: {
    date: '24 nov 2026',
    dateTime: '24 nov 2026, 2:05 p.m.',
    number: '1,250.5',
    percent: '96.6%',
    wholePercent: '10%',
    quantity: '1,250.5 kg',
    temperature: '74.5 °C',
    hoursAgo: 'hace 3 horas',
    minutesAgo: 'hace 35 minutos',
    yesterday: 'ayer',
    inDays: 'dentro de 12 días',
    today: 'hoy',
  },
  'pt-BR': {
    date: '24 de nov. de 2026',
    dateTime: '24 de nov. de 2026, 14:05',
    number: '1.250,5',
    percent: '96,6%',
    wholePercent: '10%',
    quantity: '1.250,5 kg',
    temperature: '74,5 °C',
    hoursAgo: 'há 3 horas',
    minutesAgo: 'há 35 minutos',
    yesterday: 'ontem',
    inDays: 'em 12 dias',
    today: 'hoje',
  },
};

const NOW = new Date('2026-11-24T20:05:00Z');
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60 * 1000);

describe.each(LANGUAGES)('format helpers in %s', (code) => {
  const locale = localeConfig(code as LocaleCode).formatLocale;
  const expected = EXPECTED[code];

  it('writes a date with the month as a word', () => {
    expect(plain(formatDate('2026-11-24', locale))).toBe(expected.date);
  });

  it('never shifts a plain date by time zone', () => {
    expect(plain(formatDate('2026-11-01', locale))).toContain('1');
    expect(plain(formatDate('2026-11-01', locale))).not.toContain('31');
  });

  it('writes a moment in the plant time zone', () => {
    expect(plain(formatDateTime(NOW, locale, 'America/Chicago'))).toBe(expected.dateTime);
  });

  it('writes numbers, percentages and quantities', () => {
    expect(plain(formatNumber(1250.5, locale))).toBe(expected.number);
    expect(plain(formatPercent(0.966, locale))).toBe(expected.percent);
    expect(plain(formatPercent(0.1, locale, 0))).toBe(expected.wholePercent);
    expect(plain(formatQuantity(1250.5, 'kilogram', locale))).toBe(expected.quantity);
    expect(plain(formatQuantity(74.5, 'celsius', locale))).toBe(expected.temperature);
  });

  it('keeps the unit when the language changes', () => {
    expect(unitSymbol('kilogram', locale)).toBe('kg');
    expect(unitSymbol('celsius', locale)).toBe('°C');
    expect(plain(formatQuantity(1250.5, 'pound', locale))).toMatch(/ lb$/);
  });

  it('writes relative time', () => {
    expect(plain(formatRelativeTime(ago(180), NOW, locale))).toBe(expected.hoursAgo);
    expect(plain(formatRelativeTime(ago(35), NOW, locale))).toBe(expected.minutesAgo);
    expect(plain(formatRelativeTime(ago(26 * 60), NOW, locale))).toBe(expected.yesterday);
    expect(plain(formatRelativeDays('2026-12-06', '2026-11-24', locale))).toBe(expected.inDays);
    expect(plain(formatRelativeDays('2026-11-24', '2026-11-24', locale))).toBe(expected.today);
  });
});

describe('plural forms', () => {
  it('follows each language: Portuguese treats zero as singular, Spanish does not', () => {
    expect(pluralForm(0, 'en-US')).toBe('other');
    expect(pluralForm(0, 'es-US')).toBe('other');
    expect(pluralForm(0, 'pt-BR')).toBe('one');
    expect(pluralForm(1, 'es-US')).toBe('one');
    expect(pluralForm(1, 'pt-BR')).toBe('one');
    expect(pluralForm(2, 'pt-BR')).toBe('other');
  });

  it('knows the separate form Spanish and Portuguese use for exact millions', () => {
    expect(pluralForm(1_000_000, 'es-US')).toBe('many');
    expect(pluralForm(1_000_000, 'pt-BR')).toBe('many');
    expect(pluralForm(1_000_000, 'en-US')).toBe('other');
  });
});

describe('the region is one config value', () => {
  it('Spain flips the comma and the point where US Spanish does not', () => {
    expect(formatNumber(12345.6, 'es-US')).toBe('12,345.6');
    expect(formatNumber(12345.6, 'es-ES')).toBe('12.345,6');
    expect(formatNumber(12345.6, 'es-MX')).toBe('12,345.6');
  });
});
