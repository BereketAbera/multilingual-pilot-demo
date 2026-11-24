// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleApi } from '../../api/_lib/router';
import { Shell } from '../../src/components/Shell';
import { I18nProvider, setLocale, type LocaleCode } from '../../src/i18n';
import { resources } from '../../src/i18n/resources';
import { PlantProvider } from '../../src/lib/plant';
import { readUnknownCodes } from '../../src/lib/unknownCodes';
import Lot from '../../src/screens/pilot/Lot';
import Orders from '../../src/screens/pilot/Orders';
import RecordOutput from '../../src/screens/pilot/RecordOutput';
import { ALL_LOCALES, LANGUAGES, PSEUDO, plain } from '../locales';

// The screens that have been enabled. A newly enabled screen is added to this list.
const SCREENS: Array<{ name: string; namespace: string; path: string; route: string; element: ReactElement; ready: string }> = [
  { name: 'Production orders', namespace: 'orders', path: '/orders', route: 'orders', element: <Orders />, ready: 'PO-26-1184' },
  { name: 'Lot traceability', namespace: 'lot', path: '/lots/CF-26-0426', route: 'lots/:code', element: <Lot />, ready: 'GH-BA-21010' },
  { name: 'Record output', namespace: 'output', path: '/record-output', route: 'record-output', element: <RecordOutput />, ready: 'PO-26-1185 · Classic basil pesto 190 g' },
];

const RAW_KEY = /\b(common|orders|lot|output|errors):[A-Za-z]/;

let requests: Request[] = [];

function renderScreen(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <I18nProvider>
        <PlantProvider>
          <Routes>
            <Route element={<Shell />}>
              {SCREENS.map((entry) => (
                <Route key={entry.route} path={entry.route} element={entry.element} />
              ))}
            </Route>
          </Routes>
        </PlantProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
}

function text(locale: string, namespace: string, key: string): string {
  const value = resources[locale]?.[namespace]?.[key];
  if (value === undefined) throw new Error(`No ${locale} text for ${namespace}:${key}`);
  return value;
}

beforeEach(() => {
  requests = [];
  window.localStorage.clear();
  window.sessionStorage.clear();
  // The screens talk to the same handler the deployed functions call.
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(new URL(String(input), 'http://localhost'), init);
    requests.push(request.clone());
    return handleApi(request);
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe.each(ALL_LOCALES)('pilot screens in %s', (locale) => {
  it.each(SCREENS)('$name renders with its own title and no raw key', async (entry) => {
    await setLocale(locale as LocaleCode);
    const { container } = renderScreen(entry.path);
    await screen.findAllByText(entry.ready, { exact: false });

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(text(locale, entry.namespace, 'title'));
    const visible = container.textContent ?? '';
    expect(visible).not.toMatch(RAW_KEY);
    expect(visible).not.toContain('{{');
    expect(visible).not.toContain('}}');
    expect(document.documentElement.lang).toBe(locale);
    for (const request of requests) {
      expect(request.headers.get('accept-language')).toBe(locale === PSEUDO ? 'en' : locale);
    }
  });
});

describe('English fallback', () => {
  it('shows English, marked as English, where Portuguese has no translation yet', async () => {
    await setLocale('pt-BR');
    const { container } = renderScreen('/orders');
    await screen.findByText('PO-26-1184');
    const fallback = screen.getByRole('button', { name: 'Clear filters' }).querySelector('[data-fallback]');
    expect(fallback?.getAttribute('data-fallback')).toBe('orders:filter.clear');
    expect(fallback?.getAttribute('lang')).toBe('en');
    expect(fallback?.className).toContain('i18n-fallback');
    expect(container.querySelectorAll('[data-fallback]')).toHaveLength(1);
  });

  it('turns the underline off with the review switch and keeps the English', async () => {
    await setLocale('pt-BR');
    renderScreen('/orders');
    await screen.findByText('PO-26-1184');
    await userEvent.click(screen.getAllByTestId('mark-fallbacks')[0]!);
    const fallback = screen.getByRole('button', { name: 'Clear filters' }).querySelector('[data-fallback]');
    expect(fallback?.className ?? '').not.toContain('i18n-fallback');
    expect(fallback?.getAttribute('lang')).toBe('en');
  });

  it.each(['en', 'es'] as const)('marks nothing in %s, which is complete', async (locale) => {
    await setLocale(locale);
    for (const entry of SCREENS) {
      const { container, unmount } = renderScreen(entry.path);
      await screen.findAllByText(entry.ready, { exact: false });
      expect(container.querySelectorAll('[data-fallback]')).toHaveLength(0);
      unmount();
    }
  });

  it('wraps every translated string in brackets under the pseudo-locale', async () => {
    await setLocale(PSEUDO);
    renderScreen('/orders');
    await screen.findByText('PO-26-1184');
    const table = screen.getByRole('table');
    for (const header of within(table).getAllByRole('columnheader')) {
      expect(header.textContent).toMatch(/^\[.+\]$/);
    }
  });
});

describe('plurals, including zero', () => {
  const expected = {
    en: { all: '10 orders', hold: '1 on hold', none: 'No orders match these filters' },
    es: { all: '10 órdenes', hold: '1 en retención', none: 'Ninguna orden coincide con estos filtros' },
    'pt-BR': { all: '10 ordens', hold: '1 retida', none: 'Nenhuma ordem corresponde a estes filtros' },
  };

  it.each(LANGUAGES)('counts orders in %s', async (locale) => {
    await setLocale(locale);
    renderScreen('/orders');
    await screen.findByText('PO-26-1184');
    const summary = screen.getByTestId('orders-summary');
    expect(summary.textContent).toContain(expected[locale].all);
    expect(summary.textContent).toContain(expected[locale].hold);
    await userEvent.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByTestId('orders-summary').textContent).toContain(expected[locale].none);
  });

  it.each([
    ['en', 'No shipments yet', '1 check failed'],
    ['es', 'Sin envíos todavía', '1 control no cumple'],
    ['pt-BR', 'Nenhuma expedição ainda', '1 verificação não conforme'],
  ] as const)('a lot on hold in %s has no shipments and one failed check', async (locale, shipments, checks) => {
    await setLocale(locale);
    renderScreen('/lots/CF-26-0426');
    expect((await screen.findByTestId('shipment-count')).textContent).toBe(shipments);
    expect(screen.getByTestId('haccp-summary').textContent).toBe(checks);
  });
});

describe('record output', () => {
  const typed = { en: '1,250.5', es: '1,250.5', 'pt-BR': '1.250,5' };
  const temperature = { en: '88.5', es: '88.5', 'pt-BR': '88,5' };
  const echoed = { en: '1,250.5 kg', es: '1,250.5 kg', 'pt-BR': '1.250,5 kg' };
  const held = {
    en: 'Lot CF-26-0426 is on hold. Output cannot be recorded until quality control releases it.',
    es: 'El lote CF-26-0426 está en retención. No se puede registrar producción hasta que control de calidad lo libere.',
    'pt-BR': 'O lote CF-26-0426 está retido. Não é possível registrar produção até que o controle de qualidade o libere.',
  };

  async function fill(locale: (typeof LANGUAGES)[number], orderNo: string) {
    const user = userEvent.setup();
    await setLocale(locale);
    const { container } = renderScreen('/record-output');
    await screen.findAllByText('PO-26-1185', { exact: false });
    const field = (name: string) => container.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
    await user.selectOptions(field('orderNo'), orderNo);
    await user.type(field('quantity'), typed[locale]);
    await user.type(field('temperature'), temperature[locale]);
    await user.type(field('bestBeforeDate'), '2099-01-01');
    return { user, container, submit: () => user.click(container.querySelector<HTMLButtonElement>('button[type="submit"]')!) };
  }

  it.each(LANGUAGES)('reads a number typed the %s way and sends a JSON number', async (locale) => {
    const { submit } = await fill(locale, 'PO-26-1186');
    expect(plain(screen.getByTestId('reads-quantity').textContent ?? '')).toContain(echoed[locale]);
    await submit();
    await screen.findByTestId('success');
    const sent = requests.find((request) => request.method === 'POST');
    const body = (await sent?.json()) as Record<string, unknown>;
    expect(body.quantity).toBe(1250.5);
    expect(body.temperature).toBe(88.5);
    expect(body.bestBeforeDate).toBe('2099-01-01');
    expect(body.productionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(sent?.headers.get('accept-language')).toBe(locale);
    expect(plain(screen.getByTestId('success-body').textContent ?? '')).toContain(echoed[locale]);
  });

  it.each(LANGUAGES)('translates the server-only rule in %s', async (locale) => {
    const { submit } = await fill(locale, 'PO-26-1185');
    await submit();
    expect((await screen.findByTestId('server-text')).textContent).toBe(held[locale]);
    expect(screen.getByTestId('server-exchange').textContent).toContain('"code": "lot.on_hold"');
  });

  it('formats the values of a server message for the language', async () => {
    const { user, container, submit } = await fill('pt-BR', 'PO-26-1184');
    await user.clear(container.querySelector<HTMLInputElement>('[name="quantity"]')!);
    await user.type(container.querySelector<HTMLInputElement>('[name="quantity"]')!, '500');
    await submit();
    const message = plain((await screen.findByTestId('server-text')).textContent ?? '');
    expect(message).toContain('1.750,5 kg');
    expect(message).toContain('10%');
    expect(message).toContain('1.500 kg');
  });

  it('shows the server text for a code it has no translation for, and records the code', async () => {
    const { submit } = await fill('es', 'PO-26-1187');
    await submit();
    const shown = await screen.findByTestId('server-text');
    expect(shown.textContent).toBe('Line 4 is in changeover. Output can be recorded again once the changeover is closed.');
    expect(shown.getAttribute('lang')).toBe('en');
    expect(screen.getByText('Mensaje del servidor, aún sin traducir:')).toBeTruthy();
    expect(readUnknownCodes().map((entry) => entry.code)).toEqual(['line.changeover_in_progress']);
  });

  it('refuses a number typed the wrong way for the language, before anything is sent', async () => {
    const { user, container, submit } = await fill('pt-BR', 'PO-26-1186');
    const quantity = container.querySelector<HTMLInputElement>('[name="quantity"]')!;
    await user.clear(quantity);
    await user.type(quantity, '1,250.5');
    await submit();
    expect(screen.getByTestId('error-quantity').textContent).toBe('Digite um número, por exemplo 1.250,5.');
    expect(screen.getByTestId('validation-summary').textContent).toBe('1 campo precisa de atenção');
    expect(requests.some((request) => request.method === 'POST')).toBe(false);
    expect(document.activeElement).toBe(quantity);
  });

  it('keeps validation messages in step when the language changes', async () => {
    await setLocale('en');
    const { container } = renderScreen('/record-output');
    await screen.findAllByText('PO-26-1185', { exact: false });
    await userEvent.click(container.querySelector<HTMLButtonElement>('button[type="submit"]')!);
    expect(screen.getByTestId('error-orderNo').textContent).toBe('This field is required.');
    expect(screen.getByTestId('validation-summary').textContent).toBe('4 fields need attention');
    await setLocale('es');
    await waitFor(() => expect(screen.getByTestId('error-orderNo').textContent).toBe('Este campo es obligatorio.'));
    expect(screen.getByTestId('validation-summary').textContent).toBe('4 campos necesitan atención');
  });

  it('falls back to English for the one validation message Portuguese does not have', async () => {
    const { user, container, submit } = await fill('pt-BR', 'PO-26-1186');
    const field = container.querySelector<HTMLInputElement>('[name="temperature"]')!;
    await user.clear(field);
    await user.type(field, '900');
    await submit();
    const error = screen.getByTestId('error-temperature');
    expect(plain(error.textContent ?? '')).toBe('Enter a temperature between 0 °C and 150 °C.');
    expect(error.querySelector('[data-fallback]')?.getAttribute('lang')).toBe('en');
  });
});
