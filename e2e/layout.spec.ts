import { expect, test, type Page } from '@playwright/test';
import { LANGUAGES, PSEUDO, openIn } from './helpers';

const PAGES = ['/', '/orders', '/lots/CF-26-0412', '/lots/CF-26-0426', '/record-output', '/receiving', '/translation-status', '/handoff'];

async function expectNoSidewaysScroll(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `page is ${scrollWidth}px wide in a ${clientWidth}px window`).toBeLessThanOrEqual(clientWidth);
}

async function settle(page: Page, path: string) {
  if (path === '/orders') await expect(page.getByTestId('order-PO-26-1184')).toBeVisible();
  if (path.startsWith('/lots/')) await expect(page.getByTestId('haccp-summary')).toBeVisible();
  if (path === '/record-output') await expect(page.locator('select[name="orderNo"]')).toBeVisible();
}

// Labels a third longer: the pseudo-locale is about 40% longer than English.
for (const width of [1280, 768]) {
  test.describe(`pseudo-locale at ${width} wide`, () => {
    test.use({ viewport: { width, height: 900 } });

    for (const path of PAGES) {
      test(`${path} does not scroll sideways`, async ({ page }) => {
        await openIn(page, path, PSEUDO);
        await settle(page, path);
        await expectNoSidewaysScroll(page);
      });
    }

    test('the form with every error showing does not scroll sideways', async ({ page }) => {
      await openIn(page, '/record-output', PSEUDO);
      await settle(page, '/record-output');
      await page.locator('button[type="submit"]').click();
      await expect(page.getByTestId('validation-summary')).toBeVisible();
      await expectNoSidewaysScroll(page);

      await page.locator('select[name="orderNo"]').selectOption('PO-26-1185');
      await page.locator('input[name="quantity"]').fill('10');
      await page.locator('input[name="bestBeforeDate"]').fill('2099-01-01');
      await page.locator('input[name="temperature"]').fill('80');
      await page.locator('button[type="submit"]').click();
      await expect(page.getByTestId('server-message')).toBeVisible();
      await expectNoSidewaysScroll(page);
    });
  });
}

test.describe('on a phone, 390 wide', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const code of [...LANGUAGES, PSEUDO]) {
    for (const path of ['/orders', '/lots/CF-26-0426', '/record-output']) {
      test(`${path} in ${code} does not scroll sideways`, async ({ page }) => {
        await openIn(page, path, code);
        await settle(page, path);
        await expectNoSidewaysScroll(page);
      });
    }
  }

  test('the menu opens, navigates and closes', async ({ page }) => {
    await openIn(page, '/orders', 'es');
    const menu = page.getByRole('button', { name: 'Menú' });
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await menu.click();
    await page.getByRole('link', { name: 'Registrar producción' }).click();
    await expect(page).toHaveURL(/\/record-output$/);
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Registrar producción');
  });
});
