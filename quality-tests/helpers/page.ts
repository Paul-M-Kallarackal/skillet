import type { Page } from '@playwright/test';

export async function openPage(page: Page, path: string) {
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
}
