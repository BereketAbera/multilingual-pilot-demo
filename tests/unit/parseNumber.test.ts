import { describe, expect, it } from 'vitest';
import { formatNumber } from '../../src/i18n/format';
import { numberSeparators, parseNumber } from '../../src/i18n/parseNumber';

describe('parseNumber in English and US Spanish', () => {
  it.each(['en-US', 'es-US'])('%s reads a comma as grouping and a point as the decimal', (locale) => {
    expect(parseNumber('1,250.5', locale)).toBe(1250.5);
    expect(parseNumber('1250.5', locale)).toBe(1250.5);
    expect(parseNumber('1,250,000', locale)).toBe(1250000);
    expect(parseNumber('0.5', locale)).toBe(0.5);
    expect(parseNumber(' 12 ', locale)).toBe(12);
    expect(parseNumber('-3', locale)).toBe(-3);
  });

  it.each(['en-US', 'es-US'])('%s refuses what it cannot read safely', (locale) => {
    expect(parseNumber('1.250,5', locale)).toBeNull();
    expect(parseNumber('12,50', locale)).toBeNull();
    expect(parseNumber('1 250', locale)).toBeNull();
    expect(parseNumber('abc', locale)).toBeNull();
    expect(parseNumber('12kg', locale)).toBeNull();
    expect(parseNumber('', locale)).toBeNull();
  });
});

describe('parseNumber in Brazilian Portuguese', () => {
  it('reads a point as grouping and a comma as the decimal', () => {
    expect(parseNumber('1.250,5', 'pt-BR')).toBe(1250.5);
    expect(parseNumber('1250,5', 'pt-BR')).toBe(1250.5);
    expect(parseNumber('1.250', 'pt-BR')).toBe(1250);
    expect(parseNumber('1.250.000,75', 'pt-BR')).toBe(1250000.75);
    expect(parseNumber('0,5', 'pt-BR')).toBe(0.5);
  });

  it('refuses the English way of writing the same number', () => {
    expect(parseNumber('1,250.5', 'pt-BR')).toBeNull();
    expect(parseNumber('1250.5', 'pt-BR')).toBeNull();
  });
});

describe('the same typed text is a different number in different locales', () => {
  it('1.250 is one and a quarter in English and 1250 in Portuguese', () => {
    expect(parseNumber('1.250', 'en-US')).toBe(1.25);
    expect(parseNumber('1.250', 'pt-BR')).toBe(1250);
  });
});

describe('other regions work from the same code', () => {
  it('reads Spain and France, where grouping is a point or a space', () => {
    expect(parseNumber('12.345,6', 'es-ES')).toBe(12345.6);
    expect(parseNumber('1234,5', 'es-ES')).toBe(1234.5);
    expect(parseNumber('12 345,6', 'fr-FR')).toBe(12345.6);
    expect(parseNumber('12\u202F345,6', 'fr-FR')).toBe(12345.6);
  });

  it('finds the separators from the runtime, not from a table', () => {
    expect(numberSeparators('en-US')).toEqual({ group: ',', decimal: '.' });
    expect(numberSeparators('pt-BR')).toEqual({ group: '.', decimal: ',' });
  });
});

describe('what the formatter writes, the parser reads back', () => {
  const samples = [0, 0.5, 12, 999.9, 1250.5, 20000, 1234567.8];
  it.each(['en-US', 'es-US', 'pt-BR', 'es-ES', 'fr-FR', 'de-DE'])('%s round trip', (locale) => {
    for (const value of samples) {
      expect(parseNumber(formatNumber(value, locale), locale)).toBe(value);
    }
  });
});
