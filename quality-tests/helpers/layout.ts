import type { Page } from '@playwright/test';

export async function measureHorizontalLayout(page: Page) {
  return page.evaluate(() => ({
    hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    viewportWidth: document.documentElement.clientWidth
  }));
}
