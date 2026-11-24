import { expect, type Page } from '@playwright/test';

export const LANGUAGES = ['en', 'es', 'pt-BR'] as const;
export type Language = (typeof LANGUAGES)[number];
export const PSEUDO = 'en-XA';

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
