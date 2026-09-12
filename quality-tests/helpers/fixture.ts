import { expect as playwrightExpect, test as base } from '@playwright/test';

type BrowserFixtures = {
  consoleErrors: string[];
};

export const test = base.extend<BrowserFixtures>({
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];

    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await use(errors);
  }
});

export const expect = playwrightExpect;
