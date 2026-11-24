import { expect, test } from '@playwright/test';
import { BEST_BEFORE, chooseDate, chooseLanguage } from './helpers';

// Screenshots go to ./screens (git-ignored) unless SCREENS_DIR says otherwise.
const DIR = process.env.SCREENS_DIR ?? './screens';
const shot = (name: string) => `${DIR}/multilingual-pilot-${name}.png`;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
});

test('home', async ({ page }) => {
  await expect(page.getByTestId('format-table')).toBeVisible();
  await page.screenshot({ path: shot('home-desktop') });
});

test('orders in English', async ({ page }) => {
  await page.goto('/orders');
  await expect(page.getByTestId('order-PO-26-1184')).toBeVisible();
  await page.screenshot({ path: shot('orders-en-desktop') });
});

test('orders in Brazilian Portuguese', async ({ page }) => {
  await page.goto('/orders');
  await chooseLanguage(page, 'pt-BR');
  await expect(page.getByTestId('order-PO-26-1184')).toBeVisible();
  await page.screenshot({ path: shot('orders-ptbr-desktop') });
});

test('lot in Spanish', async ({ page }) => {
  await page.goto('/lots/CF-26-0412');
  await chooseLanguage(page, 'es');
  await expect(page.getByTestId('haccp-summary')).toBeVisible();
  await page.screenshot({ path: shot('lot-es-desktop') });
});

test('server message in Brazilian Portuguese', async ({ page }) => {
  await page.goto('/record-output');
  await chooseLanguage(page, 'pt-BR');
  await page.locator('select[name="orderNo"]').selectOption('PO-26-1185');
  await page.locator('input[name="quantity"]').fill('1.250,5');
  await page.locator('input[name="shrink"]').fill('12,5');
  await chooseDate(page, 'bestBeforeDate', BEST_BEFORE);
  await page.locator('input[name="temperature"]').fill('88,5');
  await page.getByRole('button', { name: 'Registrar produção' }).click();
  await expect(page.getByTestId('server-message')).toBeVisible();
  // Bring the translated message and the raw response into the same view.
  await page.getByTestId('server-message').evaluate((message) => {
    window.scrollBy(0, message.getBoundingClientRect().bottom - window.innerHeight + 100);
  });
  await page.screenshot({ path: shot('form-error-ptbr-desktop') });
});

test('translation status', async ({ page }) => {
  await page.goto('/translation-status');
  await expect(page.getByTestId('missing-table')).toBeVisible();
  await page.screenshot({ path: shot('status-desktop') });
});

test('pseudo-locale', async ({ page }) => {
  await page.goto('/orders');
  await chooseLanguage(page, 'en-XA');
  await expect(page.getByTestId('pseudo-banner')).toBeVisible();
  await expect(page.getByTestId('order-PO-26-1184')).toBeVisible();
  await page.screenshot({ path: shot('pseudo-desktop') });
});

test('handoff', async ({ page }) => {
  await page.goto('/handoff');
  await expect(page.getByTestId('glossary')).toBeAttached();
  await page.evaluate(() => {
    const heading = document.getElementById('language');
    if (heading) window.scrollTo(0, heading.getBoundingClientRect().top + window.scrollY - 84);
  });
  await page.screenshot({ path: shot('handoff-desktop') });
});

test('form on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/record-output');
  await chooseLanguage(page, 'es');
  await page.locator('select[name="orderNo"]').selectOption('PO-26-1184');
  await page.locator('input[name="quantity"]').fill('250.5');
  await chooseDate(page, 'bestBeforeDate', BEST_BEFORE);
  await page.locator('input[name="temperature"]').fill('abc');
  await page.getByRole('button', { name: 'Registrar producción' }).click();
  await expect(page.getByTestId('validation-summary')).toBeVisible();
  // Focus moved to the first invalid field; go back to the top so the header sits where it belongs.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: shot('form-phone'), fullPage: true });
});
