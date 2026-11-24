import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '../../api/_lib/errorCodes';
import {
  buildPseudoCatalog,
  buildReport,
  exitCode,
  formatReport,
  placeholders,
  pseudoText,
  reportForProject,
  splitPlural,
  type Catalogs,
} from '../../scripts/lib/catalog.mjs';
import { LOCALES, NAMESPACES } from '../../src/i18n/config';

const API_CODES = [{ code: 'lot.on_hold', values: { lotCode: 'string' } }];

function fixture(overrides: Partial<Catalogs> = {}): Catalogs {
  const en = {
    orders: { title: 'Orders', 'count_one': '{{count}} order', 'count_other': '{{count}} orders', updated: 'Updated {{when}}' },
    errors: { 'lot.on_hold': 'Lot {{lotCode}} is on hold.' },
  };
  const es = {
    orders: { title: 'Órdenes', 'count_one': '{{count}} orden', 'count_many': '{{count}} de órdenes', 'count_other': '{{count}} órdenes', updated: 'Actualizado {{when}}' },
    errors: { 'lot.on_hold': 'El lote {{lotCode}} está en retención.' },
  };
  return { en, es, 'en-XA': buildPseudoCatalog(en), ...overrides };
}

const used = (...keys: string[]) => new Map(keys.map((key) => [key, 'screens/Orders.tsx']));
const ALL_USED = used('orders:title', 'orders:count', 'orders:updated');

describe('catalog checks', () => {
  it('passes a complete set of files', () => {
    const report = buildReport({ catalogs: fixture(), usedKeys: ALL_USED, apiCodes: API_CODES });
    expect(report.errors).toEqual([]);
    expect(report.softCount).toBe(0);
    expect(exitCode(report)).toBe(0);
    expect(exitCode(report, { strict: true })).toBe(0);
    expect(report.total).toBe(4);
  });

  it('fails when the code uses a key English does not have', () => {
    const report = buildReport({ catalogs: fixture(), usedKeys: used('orders:title', 'orders:titel'), apiCodes: API_CODES });
    expect(report.unknownKeys).toEqual([{ key: 'orders:titel', file: 'screens/Orders.tsx' }]);
    expect(exitCode(report)).toBe(1);
  });

  it('fails when a translation has a key English does not have', () => {
    const catalogs = fixture();
    catalogs.es!.orders!.subtitle = 'Esta semana';
    const report = buildReport({ catalogs, usedKeys: ALL_USED, apiCodes: API_CODES });
    expect(report.locales.find((entry) => entry.locale === 'es')?.extra).toEqual([{ namespace: 'orders', key: 'subtitle' }]);
    expect(exitCode(report)).toBe(1);
  });

  it('fails when a translation changes a placeholder', () => {
    const catalogs = fixture();
    catalogs.es!.orders!.updated = 'Actualizado {{cuando}}';
    const report = buildReport({ catalogs, usedKeys: ALL_USED, apiCodes: API_CODES });
    expect(report.locales.find((entry) => entry.locale === 'es')?.placeholderMismatches).toEqual([
      { namespace: 'orders', key: 'updated', expected: ['when'], found: ['cuando'] },
    ]);
    expect(exitCode(report)).toBe(1);
  });

  it('reports a string that is not translated yet, and fails it only with --strict', () => {
    const catalogs = fixture();
    delete catalogs.es!.orders!.title;
    const report = buildReport({ catalogs, usedKeys: ALL_USED, apiCodes: API_CODES });
    expect(report.errors).toEqual([]);
    expect(report.locales.find((entry) => entry.locale === 'es')?.missing).toEqual([
      { namespace: 'orders', key: 'title', source: 'Orders', forms: [] },
    ]);
    expect(exitCode(report)).toBe(0);
    expect(exitCode(report, { strict: true })).toBe(1);
    expect(formatReport(report)).toContain('PASSED');
    expect(formatReport(report, { strict: true })).toContain('FAILED (strict)');
  });

  it('reports a plural form the language needs and does not have', () => {
    const catalogs = fixture();
    delete catalogs.es!.orders!.count_many;
    const report = buildReport({ catalogs, usedKeys: ALL_USED, apiCodes: API_CODES });
    expect(report.locales.find((entry) => entry.locale === 'es')?.missing).toEqual([
      { namespace: 'orders', key: 'count', source: '{{count}} orders', forms: ['many'] },
    ]);
  });

  it('lists a key nothing uses, without failing', () => {
    const report = buildReport({ catalogs: fixture(), usedKeys: used('orders:title', 'orders:count'), apiCodes: API_CODES });
    expect(report.unused).toEqual([{ namespace: 'orders', key: 'updated', source: 'Updated {{when}}' }]);
    expect(exitCode(report, { strict: true })).toBe(0);
  });

  it('reports a backend code the client has no text for', () => {
    const apiCodes = [...API_CODES, { code: 'line.changeover_in_progress', values: { line: 'number' } }];
    const report = buildReport({ catalogs: fixture(), usedKeys: ALL_USED, apiCodes });
    expect(report.backend.withoutText).toEqual(['line.changeover_in_progress']);
    expect(exitCode(report)).toBe(0);
    expect(exitCode(report, { strict: true })).toBe(1);
  });

  it('fails when a backend message uses a value the API does not send', () => {
    const report = buildReport({ catalogs: fixture(), usedKeys: ALL_USED, apiCodes: [{ code: 'lot.on_hold', values: {} }] });
    expect(report.errors.join('\n')).toContain('which the API does not send');
  });

  it('fails when the pseudo-locale is out of date', () => {
    const catalogs = fixture();
    catalogs['en-XA']!.orders!.title = '[stale]';
    const report = buildReport({ catalogs, usedKeys: ALL_USED, apiCodes: API_CODES });
    expect(report.pseudoInSync).toBe(false);
    expect(exitCode(report)).toBe(1);
  });
});

describe('helpers', () => {
  it('reads placeholders and plural forms from a key', () => {
    expect(placeholders('{{total}} is over {{ planned }}')).toEqual(['planned', 'total']);
    expect(splitPlural('summary.count_other')).toEqual({ base: 'summary.count', form: 'other' });
    expect(splitPlural('lot.on_hold')).toEqual({ base: 'lot.on_hold', form: null });
  });

  it('builds pseudo text that is bracketed, accented, longer, with placeholders intact', () => {
    const source = 'Lot {{lotCode}} is on hold. Output cannot be recorded.';
    const pseudo = pseudoText(source);
    expect(pseudo.startsWith('[')).toBe(true);
    expect(pseudo.endsWith(']')).toBe(true);
    expect(pseudo).toContain('{{lotCode}}');
    expect(pseudo).not.toContain('hold');
    expect(pseudo.length).toBeGreaterThanOrEqual(Math.floor(source.length * 1.3));
    expect(pseudoText('Save')).toBe('[Šávé ~~]');
  });
});

describe('this project’s own files', () => {
  const report = reportForProject(process.cwd());
  const missingFor = (locale: string) =>
    report.locales.find((entry) => entry.locale === locale)?.missing.map((item) => `${item.namespace}:${item.key}`) ?? [];

  it('has no errors', () => {
    expect(report.errors).toEqual([]);
  });

  it('Spanish is complete; Portuguese has exactly the five strings left out on purpose', () => {
    expect(missingFor('es')).toEqual([]);
    expect(missingFor('pt-BR').sort()).toEqual([
      'lot:events.title',
      'lot:trace.back.hint',
      'orders:filter.clear',
      'output:field.notesHint',
      'output:validation.temperatureRange',
    ]);
  });

  it('has one unused key and one backend code without client text, both left on purpose', () => {
    expect(report.unused.map((item) => `${item.namespace}:${item.key}`)).toEqual(['orders:col.customer']);
    expect(report.backend.withoutText).toEqual(['line.changeover_in_progress']);
  });

  it('has a folder for every language in the config and a file for every screen', () => {
    const folders = readdirSync('src/i18n/locales').sort();
    expect(folders).toEqual(LOCALES.map((locale) => locale.code).sort());
    expect(report.namespaces).toEqual([...NAMESPACES].sort());
  });

  it('the published list of API codes matches what the API can send', () => {
    const published: unknown = JSON.parse(readFileSync('contracts/api-error-codes.json', 'utf8'));
    expect(published).toEqual(ERROR_CODES);
  });
});
