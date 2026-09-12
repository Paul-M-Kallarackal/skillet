import { test, expect } from '../helpers/fixture';
import { expectNoSeriousAccessibilityViolations } from '../helpers/accessibility';

const skill = { source: 'vercel-labs/agent-skills', slug: 'vercel-react-best-practices', name: 'vercel-react-best-practices' };
const preview = { ...skill, token: 'reviewed-snapshot', description: 'React and Next.js performance guidelines from Vercel Engineering.', instructions: '# React Best Practices\n\nA guide to improving React and Next.js performance.\n\nIncludes references and supporting files.', files: ['SKILL.md', 'references/guide.md'], destination: '/fixture/hub/vercel-react-best-practices', commit: 'a'.repeat(40), existing: false };
test.beforeEach(async ({ page }) => {
  await page.route('**/api/index', (route) => route.fulfill({ json: { scannedAt: '', scanMs: 1, stalePluginVersions: 0, repos: [], agents: [], skills: [], cells: {}, hubPath: '/fixture/hub' } }));
  await page.route('**/api/catalog/search?*', (route) => route.fulfill({ json: { skills: [skill] } }));
  await page.route('**/api/catalog/preview', (route) => route.fulfill({ json: preview }));
});

test('searches, reviews, cancels, and imports only the reviewed snapshot', async ({ page }, testInfo) => {
  let installs = 0;
  await page.route('**/api/catalog/install', (route) => {
    installs++; expect(route.request().postDataJSON()).toEqual({ token: preview.token });
    return route.fulfill({ json: { name: skill.name, skillId: 'imported', destination: preview.destination } });
  });
  await page.goto('/discover');
  await page.getByLabel('Search skills or paste a skills.sh link').fill('react');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const review = page.getByRole('button', { name: `Review ${skill.name} from ${skill.source}` });
  await expect(review).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
  await page.screenshot({ path: `.impeccable/review/catalog-${testInfo.project.name}.png`, fullPage: true });
  await review.click();
  const dialog = page.getByRole('dialog', { name: 'Review skill', exact: true });
  await expect(dialog.getByText(preview.description)).toBeVisible();
  expect(installs).toBe(0);
  await expectNoSeriousAccessibilityViolations(page);
  await page.screenshot({ path: `.impeccable/review/catalog-review-${testInfo.project.name}.png`, fullPage: true });
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(review).toBeFocused();
  expect(installs).toBe(0);
  await review.click();
  await dialog.getByRole('button', { name: 'Add to library' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'added to your library' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open skill' })).toHaveAttribute('href', '/skills/imported');
  expect(installs).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('handles empty results, network errors, duplicates, and an expired preview', async ({ page }) => {
  await page.route('**/api/catalog/search?*', (route) => route.fulfill({ json: { skills: [] } }));
  await page.goto('/discover');
  await page.getByLabel('Search skills or paste a skills.sh link').fill('unknown');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByText('No skills found.', { exact: false })).toBeVisible();
  await page.route('**/api/catalog/search?*', (route) => route.fulfill({ status: 502, json: { message: 'Could not reach the skill source. Check your connection and try again.' } }));
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Check your connection');
  await page.route('**/api/catalog/search?*', (route) => route.fulfill({ json: { skills: [skill] } }));
  await page.route('**/api/catalog/preview', (route) => route.fulfill({ json: { ...preview, existing: true } }));
  await page.getByLabel('Search skills or paste a skills.sh link').fill(`https://skills.sh/${skill.source}/${skill.slug}`);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('button', { name: /^Review / }).click();
  await expect(page.getByRole('button', { name: 'Add to library' })).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.route('**/api/catalog/preview', (route) => route.fulfill({ json: preview }));
  await page.route('**/api/catalog/install', (route) => route.fulfill({ status: 409, json: { message: 'This preview expired. Review the skill again before adding it.' } }));
  await page.getByRole('button', { name: /^Review / }).click();
  await page.getByRole('button', { name: 'Add to library' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('preview expired');
});

test('demo suggestions open the existing review flow without a search', async ({ page }, testInfo) => {
  let requested: unknown;
  await page.route('**/api/catalog/preview', (route) => {
    requested = route.request().postDataJSON();
    return route.fulfill({ json: { ...preview, name: 'nestjs-best-practices', source: 'kadajett/agent-nestjs-skills' } });
  });
  await page.goto('/discover');
  await expect(page.getByRole('heading', { name: 'Suggested skills' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Review / })).toHaveCount(5);
  await expect(page.getByRole('heading', { name: 'Cloudflare Workers', exact: true })).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
  await page.screenshot({ path: `.impeccable/review/demo-skills-${testInfo.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Review NestJS best practices from kadajett/agent-nestjs-skills' }).click();
  expect(requested).toEqual({ source: 'kadajett/agent-nestjs-skills', slug: 'nestjs-best-practices' });
  await expect(page.getByRole('dialog', { name: 'Review skill' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add to library' })).toBeEnabled();
});
