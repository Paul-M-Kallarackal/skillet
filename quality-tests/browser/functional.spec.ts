import { expectNoSeriousAccessibilityViolations } from '../helpers/accessibility';
import { test, expect } from '../helpers/fixture';
import { measureHorizontalLayout } from '../helpers/layout';
import { openPage } from '../helpers/page';

test('loads the inventory and primary pages', async ({ page, consoleErrors }) => {
  await openPage(page, '/skills');
  await expect(page.getByRole('heading', { name: 'All skills' })).toBeVisible();
  await page.emulateMedia({ colorScheme: 'dark' });
  const bodyFont = await page.locator('body').evaluate((element) => getComputedStyle(element).fontFamily);
  expect(bodyFont).toContain('system-ui');
  expect(bodyFont).not.toContain('Strawn');
  expect(await page.locator('html').evaluate((element) => getComputedStyle(element).colorScheme)).toBe('light');
  await expect(page.getByPlaceholder('Search name or description')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rescan' })).toBeVisible();

  const menu = page.getByRole('button', { name: 'Toggle navigation' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('link', { name: /All agents/ }).click();
  await expect(page.getByRole('heading', { name: 'Agents', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save and rescan' })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test('filters by purpose and opens the actual skill directly', async ({ page }) => {
  await page.route('**/api/index', (route) => route.fulfill({ json: {
    scannedAt: '', scanMs: 1, stalePluginVersions: 0, repos: [], agents: [],
    skills: ['accessibility', 'impeccable'].map((name) => ({
      id: name, name, scope: 'global', canonicalId: name, description: 'Original technical description',
      errors: [], diverged: false, shadowed: false, repoName: '', repoId: '', pluginName: '',
      instances: [{ id: name, kind: 'canonical', absPath: `/fixture/skills/${name}`, isHub: false }]
    })), cells: {}
  } }));
  await openPage(page, '/skills');
  await page.getByRole('textbox', { name: 'Search skills', exact: true }).fill('accessibility');
  const card = page.getByRole('article', { name: 'accessibility', exact: true });
  await expect(page.getByRole('article', { name: 'impeccable', exact: true })).toHaveCount(0);
  await expect(card.getByRole('link', { name: 'Open Check accessibility', exact: true })).toHaveAttribute('href', '/skills/accessibility');
  await expect(page.getByRole('button', { name: 'New Folder', exact: true })).toHaveCount(0);
});

test('supports filtering and the command palette', async ({ page, consoleErrors }) => {
  await openPage(page, '/skills');
  await page.getByPlaceholder('Search name or description').fill('no-such-skillet-skill');
  await expect(page.getByText('No skills match this view.')).toBeVisible();
  await page.keyboard.press('Control+K');
  await expect(page.getByPlaceholder('Jump to a skill')).toBeVisible();
  const dialog = page.getByRole('dialog', { name: 'Find a skill', exact: true });
  await expectNoSeriousAccessibilityViolations(page);
  for (let count = 0; count < 16; count++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test('meets the accessibility and responsive-layout baseline', async ({ page }) => {
  await openPage(page, '/skills');
  await expect(page.getByRole('heading', { name: 'All skills' })).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
  for (const width of [375, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.locator('main').evaluate((element) => element.clientWidth)).toBeGreaterThan(0);
    const menu = page.getByRole('button', { name: 'Toggle navigation' });
    if (width >= 768) await expect(menu).not.toBeVisible();
    else {
      await expect(menu).toBeVisible();
      await expect(page.getByLabel('Needs attention')).toHaveCount(0);
    }
    const layout = await measureHorizontalLayout(page);
    expect(layout.hasOverflow, `viewport width: ${layout.viewportWidth}`).toBe(false);
    const main = await page.locator('main').evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth
    }));
    expect(main.scrollWidth, `main client width: ${main.clientWidth}`).toBeLessThanOrEqual(main.clientWidth + 1);
  }
});
