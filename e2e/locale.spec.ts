import { expect, test, type Page } from '@playwright/test';
import { BEST_BEFORE, LANGUAGES, chooseDate, chooseLanguage, plain, type Language } from './helpers';

// One row per language. A new language gets a row here; the type check fails until it has one.
interface Expected {
  ordersTitle: string;
  /** A date in the orders list: the month as a word, the year only when it is not this year's. */
  date: RegExp;
  /** The same date in full, as the lot screen and the cell's tooltip show it. */
  fullDate: RegExp;
  produced: string;
  exactTyped: string;
  exactEcho: string;
  tooSmallTyped: string;
  tooSmallEcho: string;
  overPlanned: string[];
  typedQuantity: string;
  typedTemperature: string;
  wrongQuantity: string;
  submit: string;
  echoedQuantity: string;
  held: string;
  untranslatedLabel: string;
}

const EXPECTED: Record<Language, Expected> = {
  en: {
    ordersTitle: 'Production orders',
    date: /^[A-Z][a-z]{2} \d{1,2}(, \d{4})?$/,
    fullDate: /^[A-Z][a-z]{2} \d{1,2}, \d{4}$/,
    produced: '1,250.5 kg',
    exactTyped: '1.25',
    exactEcho: 'Will be recorded as 1.25 kg',
    tooSmallTyped: '0.05',
    tooSmallEcho: 'Will be recorded as 0.05 kg',
    overPlanned: ['1,750.5 kg', '10%', '1,500 kg'],
    typedQuantity: '1,250.5',
    typedTemperature: '88.5',
    wrongQuantity: '1.250,5',
    submit: 'Record output',
    echoedQuantity: '1,250.5 kg',
    held: 'Lot CF-26-0426 is on hold. Output cannot be recorded until quality control releases it.',
    untranslatedLabel: 'Message from the server, not translated yet:',
  },
  es: {
    ordersTitle: 'Órdenes de producción',
    date: /^\d{1,2} [a-z]{3,4}( \d{4})?$/,
    fullDate: /^\d{1,2} [a-z]{3,4} \d{4}$/,
    produced: '1,250.5 kg',
    exactTyped: '1.25',
    exactEcho: 'Se registrará como 1.25 kg',
    tooSmallTyped: '0.05',
    tooSmallEcho: 'Se registrará como 0.05 kg',
    overPlanned: ['1,750.5 kg', '10%', '1,500 kg'],
    typedQuantity: '1,250.5',
    typedTemperature: '88.5',
    wrongQuantity: '1.250,5',
    submit: 'Registrar producción',
    echoedQuantity: '1,250.5 kg',
    held: 'El lote CF-26-0426 está en retención. No se puede registrar producción hasta que control de calidad lo libere.',
    untranslatedLabel: 'Mensaje del servidor, aún sin traducir:',
  },
  'pt-BR': {
    ordersTitle: 'Ordens de produção',
    date: /^\d{1,2} de [a-zç]{3}\.( de \d{4})?$/,
    fullDate: /^\d{1,2} de [a-zç]{3}\. de \d{4}$/,
    produced: '1.250,5 kg',
    exactTyped: '1,25',
    exactEcho: 'Será registrado como 1,25 kg',
    tooSmallTyped: '0,05',
    tooSmallEcho: 'Será registrado como 0,05 kg',
    overPlanned: ['1.750,5 kg', '10%', '1.500 kg'],
    typedQuantity: '1.250,5',
    typedTemperature: '88,5',
    wrongQuantity: '1,250.5',
    submit: 'Registrar produção',
    echoedQuantity: '1.250,5 kg',
    held: 'O lote CF-26-0426 está retido. Não é possível registrar produção até que o controle de qualidade o libere.',
    untranslatedLabel: 'Mensagem do servidor, ainda sem tradução:',
  },
};

async function fillForm(page: Page, orderNo: string, expected: Expected) {
  await page.locator('select[name="orderNo"]').selectOption(orderNo);
  await page.locator('input[name="quantity"]').fill(expected.typedQuantity);
  await chooseDate(page, 'bestBeforeDate', BEST_BEFORE);
  await page.locator('input[name="temperature"]').fill(expected.typedTemperature);
}

const isOutputPost = (request: { url(): string; method(): string }) => request.url().endsWith('/api/output') && request.method() === 'POST';

for (const code of LANGUAGES) {
  const expected = EXPECTED[code];

  test.describe(`in ${code}`, () => {
    test('switch language, and the choice survives a reload and a new page', async ({ page }) => {
      await page.goto('/orders');
      await chooseLanguage(page, code);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(expected.ordersTitle);
      await expect(page).toHaveTitle(new RegExp(expected.ordersTitle));

      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('lang', code);
      await expect(page.getByTestId('language')).toHaveValue(code);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(expected.ordersTitle);

      await page.goto('/record-output');
      await expect(page.locator('html')).toHaveAttribute('lang', code);
      await expect(page.getByRole('button', { name: expected.submit })).toBeVisible();
    });

    test('read a date and a number', async ({ page }) => {
      await page.goto('/orders');
      await chooseLanguage(page, code);
      const row = page.getByTestId('order-PO-26-1184');
      expect(plain(await row.getByTestId('start').textContent())).toMatch(expected.date);
      expect(plain(await row.getByTestId('start').getAttribute('title'))).toMatch(expected.fullDate);
      expect(plain(await row.getByTestId('produced').textContent())).toBe(expected.produced);

      await page.goto('/lots/CF-26-0425');
      expect(plain(await page.getByTestId('lot-produced').textContent())).toMatch(expected.fullDate);
    });

    test('every API call carries the language', async ({ page }) => {
      await page.goto('/');
      await chooseLanguage(page, code);
      const request = page.waitForRequest('**/api/orders');
      await page.goto('/orders');
      expect((await request).headers()['accept-language']).toBe(code);
    });

    test('submit the form with a number typed this language’s way', async ({ page }) => {
      await page.goto('/record-output');
      await chooseLanguage(page, code);
      await fillForm(page, 'PO-26-1186', expected);
      expect(plain(await page.getByTestId('reads-quantity').textContent())).toContain(expected.echoedQuantity);

      const sent = page.waitForRequest(isOutputPost);
      await page.getByRole('button', { name: expected.submit }).click();
      const request = await sent;
      const body = request.postDataJSON() as Record<string, unknown>;
      expect(body.quantity).toBe(1250.5);
      expect(body.temperature).toBe(88.5);
      expect(body.bestBeforeDate).toBe(BEST_BEFORE);
      expect(String(body.productionDate)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(request.headers()['accept-language']).toBe(code);

      await expect(page.getByTestId('success')).toBeVisible();
      expect(plain(await page.getByTestId('success-body').textContent())).toContain(expected.echoedQuantity);
      await expect(page.getByTestId('server-exchange')).toContainText('"quantity": 1250.5');

      // The record is in: the next step is a fresh form, not a second send of the same values.
      await expect(page.locator('button[type="submit"]')).toHaveCount(0);
    });

    test('the form repeats a typed number to the last decimal, and that is the number it sends', async ({ page }) => {
      await page.goto('/record-output');
      await chooseLanguage(page, code);
      await fillForm(page, 'PO-26-1186', expected);
      await page.locator('input[name="quantity"]').fill(expected.exactTyped);
      expect(plain(await page.getByTestId('reads-quantity').textContent())).toBe(expected.exactEcho);

      const sent = page.waitForRequest(isOutputPost);
      await page.getByRole('button', { name: expected.submit }).click();
      expect(((await sent).postDataJSON() as Record<string, unknown>).quantity).toBe(1.25);
      await expect(page.getByTestId('success')).toBeVisible();
      expect(plain(await page.getByTestId('success-body').textContent())).toContain(expected.exactEcho.split(' ').slice(-2).join(' '));
      await expect(page.getByTestId('server-exchange')).toContainText('"quantity": 1.25');
    });

    test('a quantity under the API’s minimum is refused in the browser, and no longer repeated', async ({ page }) => {
      await page.goto('/record-output');
      await chooseLanguage(page, code);
      await fillForm(page, 'PO-26-1186', expected);
      await page.locator('input[name="quantity"]').fill(expected.tooSmallTyped);
      expect(plain(await page.getByTestId('reads-quantity').textContent())).toBe(expected.tooSmallEcho);
      let posted = false;
      page.on('request', (request) => {
        if (request.method() === 'POST') posted = true;
      });
      await page.getByRole('button', { name: expected.submit }).click();
      await expect(page.getByTestId('error-quantity')).toBeVisible();
      await expect(page.getByTestId('reads-quantity')).toHaveCount(0);
      expect(posted).toBe(false);
    });

    test('a shortcut trips a server rule whose values are formatted for the language', async ({ page }) => {
      await page.goto('/record-output');
      await chooseLanguage(page, code);
      await page.getByTestId('try-over_planned').click();
      const message = plain(await page.getByTestId('server-text').textContent());
      for (const value of expected.overPlanned) expect(message).toContain(value);
      await expect(page.getByTestId('server-exchange')).toContainText('"code": "output.exceeds_planned"');
    });

    test('a number typed another language’s way is refused before it is sent', async ({ page }) => {
      await page.goto('/record-output');
      await chooseLanguage(page, code);
      await fillForm(page, 'PO-26-1186', expected);
      await page.locator('input[name="quantity"]').fill(expected.wrongQuantity);
      let posted = false;
      page.on('request', (request) => {
        if (request.method() === 'POST') posted = true;
      });
      await page.getByRole('button', { name: expected.submit }).click();
      await expect(page.getByTestId('error-quantity')).toContainText(expected.typedQuantity);
      await expect(page.locator('input[name="quantity"]')).toBeFocused();
      expect(posted).toBe(false);
    });

    test('trigger the server-only rule and read the translated message', async ({ page }) => {
      await page.goto('/record-output');
      await chooseLanguage(page, code);
      await fillForm(page, 'PO-26-1185', expected);
      await page.getByRole('button', { name: expected.submit }).click();
      await expect(page.getByTestId('server-text')).toHaveText(expected.held);
      const raw = page.getByTestId('server-exchange');
      await expect(raw).toContainText('HTTP 409');
      await expect(raw).toContainText('"code": "lot.on_hold"');
      await expect(raw).toContainText(`x-request-culture: ${code}`);
    });

    test('a code with no translation shows the server text and lands on the status page', async ({ page }) => {
      await page.goto('/record-output');
      await chooseLanguage(page, code);
      await fillForm(page, 'PO-26-1187', expected);
      await page.getByRole('button', { name: expected.submit }).click();
      const shown = page.getByTestId('server-text');
      await expect(shown).toHaveText('Line 4 is in changeover. Output can be recorded again once the changeover is closed.');
      await expect(shown).toHaveAttribute('lang', 'en');
      if (code !== 'en') await expect(page.getByText(expected.untranslatedLabel)).toBeVisible();

      await page.getByRole('link', { name: 'Translation status' }).click();
      await expect(page.getByTestId('seen-codes')).toContainText('line.changeover_in_progress');
    });
  });
}

test('a number typed in Portuguese keeps its value when the language is switched to English', async ({ page }) => {
  await page.goto('/record-output');
  await chooseLanguage(page, 'pt-BR');
  await page.locator('input[name="quantity"]').fill('1.250');
  expect(plain(await page.getByTestId('reads-quantity').textContent())).toBe('Será registrado como 1.250 kg');
  await chooseLanguage(page, 'en');
  await expect(page.locator('input[name="quantity"]')).toHaveValue('1,250');
  expect(plain(await page.getByTestId('reads-quantity').textContent())).toBe('Will be recorded as 1,250 kg');
});

test('the date fields follow the app’s language, not the browser’s', async ({ page }) => {
  const order = () =>
    page.locator('[data-field="bestBeforeDate"] select').evaluateAll((selects) => selects.map((select) => (select as HTMLSelectElement).name.split('-')[1]));
  await page.goto('/record-output');
  await chooseLanguage(page, 'en');
  expect(await order()).toEqual(['month', 'day', 'year']);
  await chooseLanguage(page, 'pt-BR');
  expect(await order()).toEqual(['day', 'month', 'year']);
  await expect(page.locator('select[name="bestBeforeDate-month"] option').nth(11)).toHaveText('novembro');
  await chooseDate(page, 'bestBeforeDate', BEST_BEFORE);
  await expect(page.getByTestId('reads-best-before')).toContainText(/\d{1,2} de [a-zç]{3}\. de \d{4}/);
});

test('times of day are shown in plant time and say so', async ({ browser }) => {
  // A reader in the Eastern zone: the time shown is the plant's, an hour earlier, and labelled.
  const context = await browser.newContext({ locale: 'en-US', timezoneId: 'America/Detroit' });
  const page = await context.newPage();
  await page.goto('/lots/CF-26-0426');
  await expect(page.getByTestId('checked-at').first()).toHaveText(/ C[SD]T$/);
  await page.goto('/record-output');
  await page.getByTestId('try-on_hold').click();
  await expect(page.getByTestId('server-message')).toBeVisible();
  await context.close();
});

test('Portuguese shows its five missing strings in English, marked; the switch removes the mark', async ({ page }) => {
  await page.goto('/orders');
  await chooseLanguage(page, 'pt-BR');
  await expect(page.locator('header').getByTestId('fallback-count')).toHaveText('5');
  const fallback = page.locator('[data-fallback="orders:filter.clear"]');
  await expect(fallback).toHaveText('Clear filters');
  await expect(fallback).toHaveAttribute('lang', 'en');
  await expect(fallback).toHaveCSS('text-decoration-style', 'dotted');
  await page.locator('header').getByTestId('mark-fallbacks').uncheck();
  await expect(fallback).not.toHaveCSS('text-decoration-style', 'dotted');
  await expect(fallback).toHaveText('Clear filters');

  // English has nothing to mark, so the switch is off there and says why.
  await chooseLanguage(page, 'en');
  await expect(page.locator('header').getByTestId('mark-fallbacks')).toBeDisabled();
  await expect(page.locator('header').getByTestId('fallback-count')).toHaveText('0');
});

test('the status page counts what the files hold', async ({ page }) => {
  await page.goto('/translation-status');
  await expect(page.getByTestId('card-es')).toContainText('Nothing falls back');
  await expect(page.getByTestId('card-pt-BR')).toContainText('5 strings fall back to English');
  await expect(page.getByTestId('missing-table').locator('tbody tr')).toHaveCount(5);
  await expect(page.getByTestId('unused-keys')).toContainText('orders:col.customer');
  await expect(page.getByTestId('hard-checks').getByText('Failed:')).toHaveCount(0);

  // The two runs of the command end differently, and the difference is in view without scrolling inside a box.
  await expect(page.getByTestId('run-passed')).toContainText('Passed, exit code 0. no errors. 5 strings and 1 backend code will fall back');
  await expect(page.getByTestId('run-failed')).toContainText('Failed, exit code 1. 5 strings and 1 backend code would fall back.');
  for (const run of ['run-passed', 'run-failed']) {
    const fits = await page.getByTestId(run).locator('pre').evaluate((pre) => pre.scrollHeight <= pre.clientHeight);
    expect(fits, `${run} shows all of its output`).toBe(true);
  }
});

test('the pseudo-locale turns enabled screens accented and leaves Receiving in plain English', async ({ page }) => {
  await page.goto('/orders');
  await chooseLanguage(page, 'en-XA');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^\[.*\]$/);
  await page.goto('/receiving');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Receiving');
  await expect(page.getByTestId('hand-built-date').first()).toHaveText(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
});
