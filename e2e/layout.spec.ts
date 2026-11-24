import { expect, test, type Page } from '@playwright/test';
import { BEST_BEFORE, LANGUAGES, PSEUDO, chooseDate, openIn } from './helpers';

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
      await chooseDate(page, 'bestBeforeDate', BEST_BEFORE);
      await page.locator('input[name="temperature"]').fill('80');
      await page.locator('button[type="submit"]').click();
      await expect(page.getByTestId('server-message')).toBeVisible();
      await expectNoSidewaysScroll(page);
    });
  });
}

// The pseudo-locale pads every string alike; a real language does not. Portuguese squeezed the
// product column to five lines at laptop width while the pseudo-locale run stayed green, so the
// real languages are measured too: no table row may be taller than two lines of text.
const TWO_LINES = 72;

test.describe('real languages at 1280 wide', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  for (const code of LANGUAGES) {
    test(`orders in ${code}: every column in view, no row taller than two lines`, async ({ page }) => {
      await openIn(page, '/orders', code);
      await settle(page, '/orders');
      await page.evaluate(() => document.fonts.ready);
      const heights = await page.locator('[data-testid="orders-table"] tbody tr').evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().height));
      expect(heights.length).toBe(10);
      expect(Math.max(...heights), `row heights ${heights.join(', ')}`).toBeLessThanOrEqual(TWO_LINES);
      const region = page.getByRole('group').filter({ has: page.getByTestId('orders-table') });
      const hidden = await region.evaluate((element) => element.scrollWidth - element.clientWidth);
      expect(hidden, 'the orders table needs no sideways scroll').toBeLessThanOrEqual(1);
      await expectNoSidewaysScroll(page);
    });
  }
});

for (const width of [1280, 1024]) {
  test.describe(`real languages at ${width} wide`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const code of LANGUAGES) {
      test(`orders in ${code}: the filters show their whole text and the status is in view`, async ({ page }) => {
        await openIn(page, '/orders', code);
        await settle(page, '/orders');
        await page.evaluate(() => document.fonts.ready);
        for (const id of ['#orders-status', '#orders-line']) {
          const clipped = await page.locator(id).evaluate((select) => select.scrollWidth > select.clientWidth);
          expect(clipped, `${id} is wide enough for its text`).toBe(false);
        }
        // Where the table would not fit beside the menu, the orders are cards and nothing is off to the side.
        const held = page.getByTestId('order-PO-26-1185');
        for (const part of [held.locator('.rounded-full'), held.getByTestId('start'), held.getByRole('link')]) {
          const box = await part.boundingBox();
          expect(box && box.x + box.width, 'inside the window').toBeLessThanOrEqual(width);
        }
        await expectNoSidewaysScroll(page);
      });

      test(`lot in ${code}: the tables fit and no row is taller than two lines`, async ({ page }) => {
        await openIn(page, '/lots/CF-26-0412', code);
        await settle(page, '/lots/CF-26-0412');
        await page.evaluate(() => document.fonts.ready);
        // Below 1200 wide the HACCP checks are blocks, not a table: the result sits beside each check's name.
        if (width < 1200) await expect(page.getByTestId('haccp-cards').locator('.rounded-full')).toHaveCount(3);
        for (const panel of width < 1200 ? ['trace-back', 'trace-forward'] : ['trace-back', 'trace-forward', 'haccp']) {
          const region = page.locator(`[aria-labelledby="${panel}"][role="group"]`);
          const heights = await region.locator('tbody tr').evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().height));
          expect(Math.max(...heights), `${panel} row heights ${heights.join(', ')}`).toBeLessThanOrEqual(TWO_LINES);
          const hidden = await region.evaluate((element) => element.scrollWidth - element.clientWidth);
          expect(hidden, `${panel} needs no sideways scroll`).toBeLessThanOrEqual(1);
        }
        await expectNoSidewaysScroll(page);
      });
    }
  });
}

test.describe('at 320 wide, the narrowest phone', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  for (const path of PAGES) {
    test(`${path} does not scroll sideways`, async ({ page }) => {
      await openIn(page, path, 'en');
      await settle(page, path);
      await expectNoSidewaysScroll(page);
    });
  }
});

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

  for (const code of LANGUAGES) {
    test(`the columns that carry the point are in view in ${code}`, async ({ page }) => {
      const inView = async (locator: ReturnType<Page['locator']>) => {
        const box = await locator.boundingBox();
        expect(box, 'element is rendered').not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(390);
      };
      // Orders: status, start date and the link to the lot, for the order that is on hold.
      await openIn(page, '/orders', code);
      await settle(page, '/orders');
      const held = page.getByTestId('order-PO-26-1185');
      await inView(held.locator('.rounded-full'));
      await inView(held.getByTestId('start'));
      await inView(held.getByRole('link'));
      // Lot on hold: the failed check's result.
      await page.goto('/lots/CF-26-0426');
      await settle(page, '/lots/CF-26-0426');
      const results = page.getByTestId('haccp-cards').locator('.rounded-full');
      await expect(results).toHaveCount(3);
      await inView(results.nth(2));
      // A table that is still wider than the phone says so.
      await expect(page.getByTestId('scroll-hint').first()).toBeVisible();
      await expect(page.getByTestId('scroll-fade').first()).toBeVisible();
    });
  }

  test('a wide table loses its fade once it is scrolled to the end', async ({ page }) => {
    await openIn(page, '/lots/CF-26-0412', 'pt-BR');
    await settle(page, '/lots/CF-26-0412');
    const region = page.locator('[aria-labelledby="trace-back"][role="group"]');
    const panel = page.locator('section[aria-labelledby="trace-back"]');
    await expect(panel.getByTestId('scroll-fade')).toBeVisible();
    await region.evaluate((element) => element.scrollTo({ left: element.scrollWidth }));
    await expect(panel.getByTestId('scroll-fade')).toHaveCount(0);
    await expect(panel.getByTestId('scroll-hint')).toBeVisible();
  });

  test('the menu closes on Escape', async ({ page }) => {
    await openIn(page, '/orders', 'en');
    const menu = page.getByRole('button', { name: 'Menu' });
    await menu.click();
    await expect(page.locator('#app-nav')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#app-nav')).toBeHidden();
  });

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

test('the first Tab shows the skip link on top of the header, and the Handoff contents land with their heading in view', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/handoff');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  const onTop = await skip.evaluate((link) => {
    const box = link.getBoundingClientRect();
    return document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) === link;
  });
  expect(onTop, 'the focused skip link is not behind the header').toBe(true);

  for (const name of ['Glossary', 'Add a language', 'Checking it in staging']) {
    await page.getByRole('navigation', { name: 'On this page' }).getByRole('link', { name }).click();
    const heading = page.getByRole('heading', { level: 2, name });
    const [top, headerBottom] = await Promise.all([
      heading.evaluate((element) => element.getBoundingClientRect().top),
      page.locator('header').evaluate((element) => element.getBoundingClientRect().bottom),
    ]);
    expect(top, `"${name}" is below the sticky header`).toBeGreaterThanOrEqual(headerBottom);
    await page.evaluate(() => window.scrollTo(0, 0));
  }
});

test('the Handoff figure shows one drawing at a time, with a name and a description for a screen reader', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/handoff');
  const drawing = page.getByTestId('backend-paths').getByRole('img');
  // Wide enough for the four columns at full size.
  await expect(drawing).toHaveCount(1);
  await expect(drawing).toHaveAccessibleName(/^Where a backend message goes/);
  await expect(drawing).toHaveAccessibleDescription(/Path 1, the normal case.*Path 2, a fallback.*Path 3, a fallback/);
  await expect(drawing.getByText('What the user sees', { exact: true })).toHaveCount(1);

  // A laptop window: each path is its own drawing, top to bottom, and the three fill the panel side by side.
  await page.setViewportSize({ width: 1100, height: 800 });
  await expect(drawing).toHaveCount(1);
  await expect(drawing).toHaveAccessibleName(/^Where a backend message goes/);
  await expect(drawing.getByText('What the user sees', { exact: true })).toHaveCount(3);
  const [panel, laptop] = await Promise.all([page.getByTestId('backend-paths').boundingBox(), drawing.boundingBox()]);
  expect(laptop && panel && laptop.width / panel.width, 'fills the panel').toBeGreaterThan(0.95);
  const tops = await drawing.locator('svg').evaluateAll((drawings) => drawings.map((each) => Math.round(each.getBoundingClientRect().top)));
  expect(new Set(tops).size, `the three start level: ${tops.join(', ')}`).toBe(1);

  // On a phone the same three, one under the other, inside the window.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(drawing).toHaveCount(1);
  await expect(drawing.getByText('What the user sees', { exact: true })).toHaveCount(3);
  await expect(drawing).toHaveAccessibleDescription(/Path 1, the normal case/);
  const box = await drawing.boundingBox();
  expect(box && box.x + box.width, 'inside the window').toBeLessThanOrEqual(390);
  await expectNoSidewaysScroll(page);
});

test('the icons a browser or a phone asks for by name are images, not the page', async ({ request }) => {
  for (const [path, type] of [
    ['/favicon.ico', 'image/'],
    ['/favicon.svg', 'image/svg+xml'],
    ['/apple-touch-icon.png', 'image/png'],
    ['/og.png', 'image/png'],
    ['/robots.txt', 'text/plain'],
  ] as const) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()['content-type'], path).toContain(type);
  }
});
