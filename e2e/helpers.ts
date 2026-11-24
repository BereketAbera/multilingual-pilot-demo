import { expect, type Page } from '@playwright/test';
import { LANGUAGES, PSEUDO } from '../tests/locales';

// One list of languages for the screen tests and the browser tests: tests/locales.ts.
export { LANGUAGES, PSEUDO };
export type Language = (typeof LANGUAGES)[number];

export async function chooseLanguage(page: Page, code: string): Promise<void> {
  await page.getByTestId('language').selectOption(code);
  await expect(page.locator('html')).toHaveAttribute('lang', code);
}

/** Opens a page with the language already saved, as a returning user would have it. */
export async function openIn(page: Page, path: string, code: string): Promise<void> {
  await page.addInitScript((locale) => window.localStorage.setItem('pilot.locale', locale), code);
  await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('lang', code);
}

/** The sample plant's calendar date, some days from today, as YYYY-MM-DD. The plant is in Chicago. */
export function plantDate(offsetDays = 0): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  );
  const today = Date.parse(`${parts.year}-${parts.month}-${parts.day}`);
  return new Date(today + offsetDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** A best-before date two months out: inside what the form and the API accept. */
export const BEST_BEFORE = plantDate(60);

/** Picks a date in a field made of three lists. They are found by name, whatever order the language puts them in. */
export async function chooseDate(page: Page, name: string, date: string): Promise<void> {
  const [year = '', month = '', day = ''] = date.split('-');
  await page.locator(`select[name="${name}-year"]`).selectOption(year);
  await page.locator(`select[name="${name}-month"]`).selectOption(month);
  await page.locator(`select[name="${name}-day"]`).selectOption(day);
}

/** Intl puts no-break spaces between a number and its unit. Tests compare with plain ones. */
export const plain = (text: string | null) => (text ?? '').replace(/[\u00A0\u202F]/g, ' ').trim();
