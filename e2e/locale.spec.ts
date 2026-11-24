import { expect, test, type Page } from '@playwright/test';
import { LANGUAGES, chooseLanguage, type Language } from './helpers';

interface Expected {
  ordersTitle: string;
  date: RegExp;
  produced: string;
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
    date: /^[A-Z][a-z]{2} \d{1,2}, \d{4}$/,
    produced: '1,250.5 kg',
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
    date: /^\d{1,2} [a-z]{3,4} \d{4}$/,
    produced: '1,250.5 kg',
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
    date: /^\d{1,2} de [a-zç]{3}\. de \d{4}$/,
    produced: '1.250,5 kg',
    typedQuantity: '1.250,5',
    typedTemperature: '88,5',
    wrongQuantity: '1,250.5',
    submit: 'Registrar produção',
    echoedQuantity: '1.250,5 kg',
    held: 'O lote CF-26-0426 está retido. Não é possível registrar produção até que o controle de qualidade o libere.',
    untranslatedLabel: 'Mensagem do servidor, ainda sem tradução:',
  },
};

const plain = (text: string | null) => (text ?? '').replace(/[\u00A0\u202F]/g, ' ').trim();

async function fillForm(page: Page, orderNo: string, expected: Expected) {
  await page.locator('select[name="orderNo"]').selectOption(orderNo);
  await page.locator('input[name="quantity"]').fill(expected.typedQuantity);
  await page.locator('input[name="bestBeforeDate"]').fill('2099-01-01');
  await page.locator('input[name="temperature"]').fill(expected.typedTemperature);
}

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
      expect(plain(await row.getByTestId('produced').textContent())).toBe(expected.produced);
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

      const sent = page.waitForRequest((request) => request.url().endsWith('/api/output') && request.method() === 'POST');
      await page.getByRole('button', { name: expected.submit }).click();
      const request = await sent;
      const body = request.postDataJSON() as Record<string, unknown>;
      expect(body.quantity).toBe(1250.5);
      expect(body.temperature).toBe(88.5);
      expect(body.bestBeforeDate).toBe('2099-01-01');
      expect(String(body.productionDate)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(request.headers()['accept-language']).toBe(code);

      await expect(page.getByTestId('success')).toBeVisible();
      expect(plain(await page.getByTestId('success-body').textContent())).toContain(expected.echoedQuantity);
      await expect(page.getByTestId('server-exchange')).toContainText('"quantity": 1250.5');
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

test('Portuguese shows its five missing strings in English, marked; the switch removes the mark', async ({ page }) => {
  await page.goto('/orders');
  await chooseLanguage(page, 'pt-BR');
  const fallback = page.locator('[data-fallback="orders:filter.clear"]');
  await expect(fallback).toHaveText('Clear filters');
  await expect(fallback).toHaveAttribute('lang', 'en');
  await expect(fallback).toHaveCSS('text-decoration-style', 'dotted');
  await page.locator('header').getByTestId('mark-fallbacks').uncheck();
  await expect(fallback).not.toHaveCSS('text-decoration-style', 'dotted');
  await expect(fallback).toHaveText('Clear filters');
});

test('the status page counts what the files hold', async ({ page }) => {
  await page.goto('/translation-status');
  await expect(page.getByTestId('card-es')).toContainText('Nothing falls back');
  await expect(page.getByTestId('card-pt-BR')).toContainText('5 fall back to English');
  await expect(page.getByTestId('missing-table').locator('tbody tr')).toHaveCount(5);
  await expect(page.getByTestId('unused-keys')).toContainText('orders:col.customer');
  await expect(page.getByTestId('hard-checks').getByText('Failed:')).toHaveCount(0);
});

test('the pseudo-locale turns enabled screens accented and leaves Receiving in plain English', async ({ page }) => {
  await page.goto('/orders');
  await chooseLanguage(page, 'en-XA');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^\[.*\]$/);
  await page.goto('/receiving');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Receiving');
  await expect(page.getByTestId('hand-built-date').first()).toHaveText(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
});
