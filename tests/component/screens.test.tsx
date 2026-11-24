// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addDays, isoDate } from '../../api/_lib/data';
import { handleApi } from '../../api/_lib/router';
import { reportForProject } from '../../scripts/lib/catalog.mjs';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import { Shell } from '../../src/components/Shell';
import { I18nProvider, i18nFor, setLocale, type LocaleCode } from '../../src/i18n';
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
/** Answers that replace the real handler for one test: an API that behaves differently from the stand-in. */
let overrides: Array<(request: Request) => Response | undefined> = [];

const json = (body: unknown, status: number, contentType = 'application/json') =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': contentType } });

const answerOutputWith = (body: unknown, status: number, contentType = 'application/problem+json') => {
  overrides.push((request) => (request.method === 'POST' ? json(body, status, contentType) : undefined));
};

// A best-before date two months out, as plain YYYY-MM-DD, counted from the plant's own today.
const BEST_BEFORE = addDays(isoDate(new Date()), 60);

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
  overrides = [];
  window.localStorage.clear();
  window.sessionStorage.clear();
  // The screens talk to the same handler the deployed functions call.
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(new URL(String(input), 'http://localhost'), init);
    requests.push(request.clone());
    for (const override of overrides) {
      const answer = override(request);
      if (answer) return Promise.resolve(answer);
    }
    return handleApi(request);
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

type Language = (typeof LANGUAGES)[number];

// The same two numbers, typed the way each language writes them.
const TYPED_QUANTITY: Record<Language, string> = { en: '1,250.5', es: '1,250.5', 'pt-BR': '1.250,5' };
const TYPED_TEMPERATURE: Record<Language, string> = { en: '88.5', es: '88.5', 'pt-BR': '88,5' };

/** Opens Record output in a language and fills every required field. */
async function fillForm(locale: Language, orderNo: string, numbers: { quantity?: string; temperature?: string } = {}) {
  const user = userEvent.setup();
  await setLocale(locale);
  const { container } = renderScreen('/record-output');
  await screen.findAllByText('PO-26-1185', { exact: false });
  const field = (name: string) => container.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
  await user.selectOptions(field('orderNo'), orderNo);
  await user.type(field('quantity'), numbers.quantity ?? TYPED_QUANTITY[locale]);
  await user.type(field('temperature'), numbers.temperature ?? TYPED_TEMPERATURE[locale]);
  // The date is three lists, in the language's own order; the test picks by name, whatever the order.
  const [year = '', month = '', day = ''] = BEST_BEFORE.split('-');
  await user.selectOptions(field('bestBeforeDate-year'), year);
  await user.selectOptions(field('bestBeforeDate-month'), month);
  await user.selectOptions(field('bestBeforeDate-day'), day);
  return { user, container, field, submit: () => user.click(container.querySelector<HTMLButtonElement>('button[type="submit"]')!) };
}

/** The body of the one POST the form made, or undefined when it made none. */
const postedBody = async () => (await requests.find((request) => request.method === 'POST')?.json()) as Record<string, unknown> | undefined;

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

  const onHold: Record<Language, { shipments: string; checks: string }> = {
    en: { shipments: 'No shipments yet', checks: '1 check failed' },
    es: { shipments: 'Sin envíos todavía', checks: '1 control no cumple' },
    'pt-BR': { shipments: 'Nenhuma expedição ainda', checks: '1 verificação não conforme' },
  };

  it.each(LANGUAGES)('a lot on hold in %s has no shipments and one failed check', async (locale) => {
    await setLocale(locale);
    renderScreen('/lots/CF-26-0426');
    expect((await screen.findByTestId('shipment-count')).textContent).toBe(onHold[locale].shipments);
    expect(screen.getByTestId('haccp-summary').textContent).toBe(onHold[locale].checks);
  });
});

describe('record output', () => {
  const echoed = { en: '1,250.5 kg', es: '1,250.5 kg', 'pt-BR': '1.250,5 kg' };
  const held = {
    en: 'Lot CF-26-0426 is on hold. Output cannot be recorded until quality control releases it.',
    es: 'El lote CF-26-0426 está en retención. No se puede registrar producción hasta que control de calidad lo libere.',
    'pt-BR': 'O lote CF-26-0426 está retido. Não é possível registrar produção até que o controle de qualidade o libere.',
  };

  const fill = fillForm;

  it.each(LANGUAGES)('reads a number typed the %s way and sends a JSON number', async (locale) => {
    const { submit } = await fill(locale, 'PO-26-1186');
    expect(plain(screen.getByTestId('reads-quantity').textContent ?? '')).toContain(echoed[locale]);
    await submit();
    await screen.findByTestId('success');
    const sent = requests.find((request) => request.method === 'POST');
    const body = (await sent?.json()) as Record<string, unknown>;
    expect(body.quantity).toBe(1250.5);
    expect(body.temperature).toBe(88.5);
    expect(body.bestBeforeDate).toBe(BEST_BEFORE);
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

describe('what the form repeats is what it sends', () => {
  const typedExact = {
    en: { quantity: '12.345', temperature: '88.55', echo: 'Will be recorded as 12.345 kg', heat: '88.55°C', saved: '12.345 kg' },
    es: { quantity: '12.345', temperature: '88.55', echo: 'Se registrará como 12.345 kg', heat: '88.55 °C', saved: '12.345 kg' },
    'pt-BR': { quantity: '12,345', temperature: '88,55', echo: 'Será registrado como 12,345 kg', heat: '88,55 °C', saved: '12,345 kg' },
  };

  const fillWith = (locale: Language, quantity: string, temperature: string, orderNo = 'PO-26-1186') =>
    fillForm(locale, orderNo, { quantity, temperature });
  const sent = postedBody;

  it.each(LANGUAGES)('12.345 kg and 88.55 degrees are echoed, sent and confirmed without rounding in %s', async (locale) => {
    const expected = typedExact[locale];
    const { submit } = await fillWith(locale, expected.quantity, expected.temperature);
    expect(plain(screen.getByTestId('reads-quantity').textContent ?? '')).toBe(expected.echo);
    expect(plain(screen.getByTestId('reads-temperature').textContent ?? '')).toContain(expected.heat);
    await submit();
    await screen.findByTestId('success');
    const body = await sent();
    expect(body?.quantity).toBe(12.345);
    expect(body?.temperature).toBe(88.55);
    expect(plain(screen.getByTestId('success-body').textContent ?? '')).toContain(expected.saved);
    expect(screen.getByTestId('exchange-outcome').textContent).toContain('12.345');
  });

  it('refuses 0,04 kg in Portuguese with the same limits the API has, and never says it will be recorded', async () => {
    const { submit } = await fillWith('pt-BR', '0,04', '88,5');
    // Under the minimum: the field keeps its hint instead of repeating a number the form would refuse.
    expect(screen.queryByTestId('reads-quantity')).toBeNull();
    expect(screen.getByText('Digite o número como você costuma escrever, por exemplo 1.250,5.')).toBeTruthy();
    await submit();
    expect(plain(screen.getByTestId('error-quantity').textContent ?? '')).toBe('Digite uma quantidade entre 0,1 kg e 20.000 kg.');
    expect(screen.queryByTestId('reads-quantity')).toBeNull();
    expect(await sent()).toBeUndefined();
  });

  it.each(LANGUAGES)('repeats a number or a date only when the form would accept it, in %s', async (locale) => {
    const i18n = i18nFor(locale);
    const { user, field } = await fillForm(locale, 'PO-26-1186');
    const type = async (name: string, value: string) => {
      await user.clear(field(name));
      await user.type(field(name), value);
    };
    // Under the minimum, more decimals than the plant records, over the maximum: each typed this language's way.
    for (const [value, decimals] of [[0.05, 2], [12.3456, 4], [20000.1, 1]] as const) {
      await type('quantity', i18n.number(value, decimals));
      expect(screen.queryByTestId('reads-quantity')).toBeNull();
    }
    await type('quantity', i18n.number(0.1, 1));
    expect(plain(screen.getByTestId('reads-quantity').textContent ?? '')).toContain(plain(i18n.quantity(0.1, 'kilogram')));

    expect(screen.getByTestId('reads-temperature')).toBeTruthy();
    await type('temperature', i18n.number(150.5, 1));
    expect(screen.queryByTestId('reads-temperature')).toBeNull();

    // The same for a date: a best-before date on the production date itself is refused on submit, so it is not repeated.
    expect(screen.getByTestId('reads-best-before')).toBeTruthy();
    const [year = '', month = '', day = ''] = isoDate(new Date()).split('-');
    await user.selectOptions(field('bestBeforeDate-year'), year);
    await user.selectOptions(field('bestBeforeDate-month'), month);
    await user.selectOptions(field('bestBeforeDate-day'), day);
    expect(screen.queryByTestId('reads-best-before')).toBeNull();
    expect(screen.getByTestId('reads-production-date')).toBeTruthy();
    expect(await postedBody()).toBeUndefined();
  });

  it('refuses more decimals than the plant records, and a negative shrink, in words that say so', async () => {
    const { user, field, submit } = await fillWith('es', '1.23456', '88.5');
    await user.type(field('shrink'), '-3');
    await submit();
    expect(screen.getByTestId('error-quantity').textContent).toBe('Use 3 decimales o menos.');
    expect(screen.getByTestId('error-shrink').textContent).toBe('La merma no puede ser negativa.');
    expect(await sent()).toBeUndefined();
  });

  it('re-writes a typed number when the language changes, so its value does not', async () => {
    const { field } = await fillWith('pt-BR', '1.250', '88,5');
    expect(plain(screen.getByTestId('reads-quantity').textContent ?? '')).toBe('Será registrado como 1.250 kg');
    await setLocale('en');
    await waitFor(() => expect(field('quantity').value).toBe('1,250'));
    expect(plain(screen.getByTestId('reads-quantity').textContent ?? '')).toBe('Will be recorded as 1,250 kg');
    expect(field('temperature').value).toBe('88.5');
    await setLocale('pt-BR');
    await waitFor(() => expect(field('quantity').value).toBe('1.250'));
  });

  it('shows dates as day, month and year lists in the language’s own order, with the month as a word', async () => {
    const order = (container: HTMLElement) =>
      [...container.querySelectorAll<HTMLSelectElement>('[data-field="bestBeforeDate"] select')].map((select) => select.name.split('-')[1]);
    await setLocale('en');
    const english = renderScreen('/record-output');
    await screen.findAllByText('PO-26-1185', { exact: false });
    expect(order(english.container)).toEqual(['month', 'day', 'year']);
    expect(within(english.container.querySelector<HTMLElement>('[name="bestBeforeDate-month"]')!).getByText('November')).toBeTruthy();
    english.unmount();

    await setLocale('pt-BR');
    const portuguese = renderScreen('/record-output');
    await screen.findAllByText('PO-26-1185', { exact: false });
    expect(order(portuguese.container)).toEqual(['day', 'month', 'year']);
    expect(within(portuguese.container.querySelector<HTMLElement>('[name="bestBeforeDate-month"]')!).getByText('novembro')).toBeTruthy();
  });

  it('after a save offers a fresh form, not a second send of the same record', async () => {
    const { user, container, field } = await fillWith('en', '120.5', '88.5');
    await user.click(container.querySelector<HTMLButtonElement>('button[type="submit"]')!);
    await screen.findByTestId('success');
    expect(container.querySelector('button[type="submit"]')).toBeNull();
    expect(requests.filter((request) => request.method === 'POST')).toHaveLength(1);

    // Changing a value makes it a new record: the old confirmation and the old exchange go.
    await user.type(field('quantity'), '1');
    expect(screen.queryByTestId('success')).toBeNull();
    expect(screen.queryByTestId('exchange-outcome')).toBeNull();
    expect(container.querySelector('button[type="submit"]')).not.toBeNull();
  });

  it('clears a server message as soon as the order changes', async () => {
    const { user, field, submit } = await fillWith('pt-BR', '120,5', '88,5', 'PO-26-1185');
    await submit();
    await screen.findByTestId('server-message');
    await user.selectOptions(field('orderNo'), 'PO-26-1186');
    expect(screen.queryByTestId('server-message')).toBeNull();
  });

  it('a sample shortcut fills the form and gets the server’s refusal, translated', async () => {
    await setLocale('es');
    const { container } = renderScreen('/record-output');
    await screen.findAllByText('PO-26-1185', { exact: false });
    await userEvent.click(screen.getByTestId('try-on_hold'));
    expect((await screen.findByTestId('server-text')).textContent).toContain('El lote CF-26-0426 está en retención.');
    expect(container.querySelector<HTMLSelectElement>('[name="orderNo"]')?.value).toBe('PO-26-1185');
    const body = await sent();
    expect(body).toMatchObject({ orderNo: 'PO-26-1185', quantity: 120.5, temperature: 88.5 });
  });
});

describe('answers the stand-in does not give, but a real API might', () => {
  /** A form that is valid in the browser; what comes back is up to the test. */
  async function submitValid(locale: Language) {
    const form = await fillForm(locale, 'PO-26-1186', { quantity: locale === 'pt-BR' ? '120,5' : '120.5' });
    await form.submit();
    return form;
  }

  it('ASP.NET Core’s default validation answer: no code, a title and an errors dictionary', async () => {
    answerOutputWith(
      {
        type: 'https://tools.ietf.org/html/rfc9110#section-15.5.1',
        title: 'One or more validation errors occurred.',
        status: 400,
        errors: { Quantity: ['The field Quantity must be between 0.1 and 20000.'], '$.temperature': ['The JSON value could not be converted to System.Decimal.'] },
        traceId: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-00',
      },
      400,
    );
    await submitValid('es');
    const shown = await screen.findByTestId('server-text');
    expect(shown.textContent).toBe('One or more validation errors occurred.');
    expect(shown.getAttribute('lang')).toBe('en');
    expect(screen.getByText('Mensaje del servidor, aún sin traducir:')).toBeTruthy();
    // The dictionary's keys are property names in another case; they still land on the right fields.
    const quantity = screen.getByTestId('error-quantity');
    expect(quantity.textContent).toBe('The field Quantity must be between 0.1 and 20000.');
    expect(quantity.querySelector('[lang="en"]')).not.toBeNull();
    expect(screen.getByTestId('error-temperature').textContent).toBe('The JSON value could not be converted to System.Decimal.');
    expect(screen.getByTestId('validation-summary').textContent).toBe('2 campos necesitan atención');
    // Nothing to translate and no code to report.
    expect(readUnknownCodes()).toEqual([]);
    expect(screen.getByTestId('exchange-outcome').textContent).toContain('This response has no code');
  });

  it('a 500 with a title and nothing else shows the title, never an empty line', async () => {
    answerOutputWith({ type: 'about:blank', title: 'An error occurred while processing your request.', status: 500 }, 500);
    await submitValid('pt-BR');
    expect((await screen.findByTestId('server-text')).textContent).toBe('An error occurred while processing your request.');
    expect(readUnknownCodes()).toEqual([]);
  });

  it('a known code without the value its text needs shows the server’s words, not a raw placeholder', async () => {
    answerOutputWith({ title: 'Lot is on hold', status: 409, detail: 'The lot is on hold.', code: 'lot.on_hold' }, 409);
    const { container } = await submitValid('es');
    expect((await screen.findByTestId('server-text')).textContent).toBe('The lot is on hold.');
    expect(container.textContent).not.toContain('{{');
    expect(readUnknownCodes().map((entry) => entry.code)).toEqual(['lot.on_hold']);
  });

  it('null where a value belongs does not take the page down', async () => {
    answerOutputWith(
      {
        title: 'Output exceeds the planned quantity',
        status: 422,
        detail: 'The order would run over its planned quantity.',
        code: 'output.exceeds_planned',
        values: { total: null, planned: { quantity: null }, tolerance: { ratio: 'ten' } },
        fieldErrors: [null, { field: 'quantity' }, { field: 'quantity', code: 'validation.out_of_range', values: null }],
      },
      422,
    );
    await submitValid('en');
    expect((await screen.findByTestId('server-text')).textContent).toBe('The order would run over its planned quantity.');
    // The field's code needs min and max, which were not sent; with no server text for the field, the code itself is shown.
    expect(screen.getByTestId('error-quantity').textContent).toBe('validation.out_of_range');
    expect(screen.queryByTestId('screen-error')).toBeNull();
  });

  it('a success in a shape this screen does not know is not announced as saved', async () => {
    answerOutputWith({ ok: true }, 200, 'application/json');
    await submitValid('pt-BR');
    expect((await screen.findByTestId('unreadable-answer')).textContent).toBe(
      'Não foi possível ler a resposta do servidor. Confira a ordem antes de registrar de novo.',
    );
    expect(screen.queryByTestId('success')).toBeNull();
    expect(screen.queryByTestId('screen-error')).toBeNull();
  });

  it('when the plant’s settings cannot be loaded, says so and retries', async () => {
    let failing = true;
    overrides.push((request) => (failing && new URL(request.url).pathname === '/api/plant' ? json({ title: 'Service Unavailable', status: 503 }, 503) : undefined));
    await setLocale('es');
    const { container } = renderScreen('/record-output');
    const error = await screen.findByTestId('load-error');
    expect(error.textContent).toContain('No se pudieron cargar los datos.');
    expect(container.querySelector('[name="orderNo"]')).toBeNull();
    // The header's plant line does not just vanish: it says, in the user's language, that the settings are missing.
    const plantLine = screen.getAllByTestId('plant-unavailable')[0];
    expect(plantLine?.textContent).toBe('No se pudo cargar la configuración de la planta');
    expect(plantLine?.querySelector('[data-fallback]')).toBeNull();
    failing = false;
    await userEvent.click(within(error).getByRole('button', { name: 'Intentar de nuevo' }));
    await screen.findAllByText('PO-26-1185', { exact: false });
    expect(container.querySelector('[name="orderNo"]')).not.toBeNull();
    expect(screen.queryByTestId('plant-unavailable')).toBeNull();
    expect(container.querySelector('header')?.textContent).toContain('Planta: ');
  });
});

describe('lot screen edge cases', () => {
  it('a lot that does not exist gets a way on, and no retry that cannot help', async () => {
    await setLocale('pt-BR');
    renderScreen('/lots/CF-00-0000');
    const error = await screen.findByTestId('load-error');
    expect(error.textContent).toContain('O lote CF-00-0000 não foi encontrado.');
    expect(error.textContent).toContain('Escolha um lote na lista acima.');
    expect(within(error).getByRole('link').textContent).toBe('Abrir o lote CF-26-0412');
    expect(within(error).queryByRole('button')).toBeNull();
  });

  it('a code typed in lower case ends up on the lot’s own address', async () => {
    await setLocale('en');
    const { container } = renderScreen('/lots/cf-26-0426');
    await screen.findByTestId('haccp-summary');
    await waitFor(() => expect(container.querySelector<HTMLSelectElement>('#lot-picker')?.value).toBe('CF-26-0426'));
    expect(container.querySelectorAll('#lot-picker option')).toHaveLength(7);
  });

  // The zone's short name comes from the browser's own data, so it is not the same in every language.
  const zoneLabel: Record<Language, string> = { en: 'CST', es: 'CST', 'pt-BR': 'GMT-6' };

  it.each(LANGUAGES)('times of day say which time zone they are in, in %s', async (locale) => {
    vi.useFakeTimers({ now: new Date('2026-11-24T20:05:00Z'), toFake: ['Date'] });
    try {
      await setLocale(locale);
      renderScreen('/lots/CF-26-0426');
      await screen.findByTestId('haccp-summary');
      await waitFor(() => expect(screen.getAllByTestId('checked-at')[0]?.textContent).toMatch(new RegExp(`${zoneLabel[locale]}$`)));
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('review switch and safety net', () => {
  it('shows how many messages fall back, and is off where there are none', async () => {
    await setLocale('pt-BR');
    const portuguese = renderScreen('/orders');
    await screen.findByText('PO-26-1184');
    expect(screen.getAllByTestId('fallback-count')[0]?.textContent).toBe('5');
    expect((screen.getAllByTestId('mark-fallbacks')[0] as HTMLInputElement).disabled).toBe(false);
    portuguese.unmount();

    await setLocale('es');
    renderScreen('/orders');
    await screen.findByText('PO-26-1184');
    expect(screen.getAllByTestId('fallback-count')[0]?.textContent).toBe('0');
    expect((screen.getAllByTestId('mark-fallbacks')[0] as HTMLInputElement).disabled).toBe(true);
  });

  it('counts the same fallbacks at run time as the build check does', () => {
    const report = reportForProject(process.cwd());
    for (const entry of report.locales) {
      expect(i18nFor(entry.locale as LocaleCode).fallbackCount).toBe(entry.missing.length);
    }
    expect(i18nFor('en').fallbackCount).toBe(0);
  });

  it('keeps only its own entries when storage holds something else', () => {
    window.sessionStorage.setItem('pilot.unknownCodes', JSON.stringify([null, 7, { code: 'a.b' }, { code: 'line.x', detail: 'Line x.', seenAt: 'now' }]));
    expect(readUnknownCodes()).toEqual([{ code: 'line.x', detail: 'Line x.', seenAt: 'now' }]);
  });

  it('a screen that fails to draw leaves a translated notice, not a blank page', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const Broken = (): ReactElement => {
      throw new Error('boom');
    };
    await setLocale('es');
    render(
      <I18nProvider>
        <ErrorBoundary resetKey="/broken">
          <Broken />
        </ErrorBoundary>
      </I18nProvider>,
    );
    expect(screen.getByTestId('screen-error').textContent).toContain('Esta pantalla tuvo un problema');
    expect(screen.getByRole('button', { name: 'Recargar la página' })).toBeTruthy();
    quiet.mockRestore();
  });
});
