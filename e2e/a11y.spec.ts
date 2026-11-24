import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { LANGUAGES, PSEUDO, chooseLanguage, openIn } from './helpers';

const PAGES = ['/', '/orders', '/lots/CF-26-0412', '/lots/CF-26-0426', '/record-output', '/receiving', '/translation-status', '/handoff'];
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function settle(page: Page, path: string) {
  if (path === '/orders') await expect(page.getByTestId('order-PO-26-1184')).toBeVisible();
  if (path.startsWith('/lots/')) await expect(page.getByTestId('haccp-summary')).toBeVisible();
  if (path === '/record-output') await expect(page.locator('select[name="orderNo"]')).toBeVisible();
  if (path === '/') await expect(page.getByTestId('format-table')).toBeVisible();
}

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`)).toEqual([]);
}

for (const code of [...LANGUAGES, PSEUDO]) {
  for (const path of PAGES) {
    test(`accessibility: ${path} in ${code}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await openIn(page, path, code);
      await settle(page, path);
      await expectNoViolations(page);
      expect(errors, 'no errors in the browser console').toEqual([]);
    });
  }
}

test('accessibility: the form with validation errors and a server message, in Portuguese', async ({ page }) => {
  await openIn(page, '/record-output', 'pt-BR');
  await settle(page, '/record-output');
  await page.locator('button[type="submit"]').click();
  await expect(page.getByTestId('validation-summary')).toBeVisible();
  await expectNoViolations(page);

  await page.locator('select[name="orderNo"]').selectOption('PO-26-1185');
  await page.locator('input[name="quantity"]').fill('10');
  await page.locator('input[name="bestBeforeDate"]').fill('2099-01-01');
  await page.locator('input[name="temperature"]').fill('80');
  await page.locator('button[type="submit"]').click();
  await expect(page.getByTestId('server-message')).toBeVisible();
  await expectNoViolations(page);
});

test('the page’s lang attribute follows the selector', async ({ page }) => {
  await page.goto('/orders');
  for (const code of ['es', 'pt-BR', 'en-XA', 'en']) {
    await chooseLanguage(page, code);
    expect(await page.evaluate(() => document.documentElement.lang)).toBe(code);
  }
});

test('the first visit follows the browser’s language when it is one of ours', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'pt-BR' });
  const page = await context.newPage();
  await page.goto('/orders');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ordens de produção');
  await context.close();
});
