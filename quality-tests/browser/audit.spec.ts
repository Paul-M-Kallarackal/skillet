import { test, expect } from '../helpers/fixture';
import { expectNoSeriousAccessibilityViolations } from '../helpers/accessibility';

const frontmatter = {
  name: 'example', description: 'Example skill for safe browser tests', paths: [],
  disableModelInvocation: false, userInvocable: true, allowedTools: '', disallowedTools: '',
  license: '', compatibility: '', model: '', agent: '', context: '', metadata: {}, extras: {}, presentKeys: []
};
const fixtureIndex = {
  scannedAt: '', scanMs: 1, stalePluginVersions: 0, repos: [],
  agents: [{ id: 'codex', name: 'Codex', installed: true, custom: false, projectDir: '.agents/skills', resolvedGlobalDir: '/fixture/agents/skills' }],
  skills: [{
    id: 'example', name: 'example', scope: 'project', canonicalId: 'source', description: 'Example skill',
    errors: [], diverged: false, shadowed: false, repoName: '', repoId: '', pluginName: '',
    instances: [{ files: ['SKILL.md'], id: 'source', kind: 'canonical', absPath: '/fixture/project/example', isHub: false, frontmatter, body: '# Example\n\nUse for a test task.\n'.repeat(50), errors: [] }]
  }],
  cells: { example: [{ agentId: 'codex', agentName: 'Codex', state: 'not-linked', instanceId: '', conditions: [] }] }
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/index', (route) => route.fulfill({ json: fixtureIndex }));
});

test('editor is keyboard accessible and usage is inline without tabs', async ({ page }) => {
  await page.goto('/skills/example');
  await page.getByRole('button', { name: 'Edit Markdown', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Skill instructions', exact: true });
  await expect(editor).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeInViewport();
  await expectNoSeriousAccessibilityViolations(page);
  await editor.focus();
  await page.keyboard.press('Tab');
  await expect(editor).not.toBeFocused();
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Use this skill' })).toBeVisible();
  for (const width of [375, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.locator('main').evaluate((element) => element.clientWidth)).toBeGreaterThan(0);
    expect(await page.locator('main').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  }
});

test('title rename auto-saves once and trash retains its confirmation', async ({ page }) => {
  const requests: { path: string; dryRun: boolean }[] = [];
  await page.route('**/api/skills/**', (route) => {
    const payload = route.request().postDataJSON() as { dryRun: boolean };
    requests.push({ path: new URL(route.request().url()).pathname, dryRun: payload.dryRun });
    return route.fulfill({ json: { steps: [{ op: 'move', from: '/fixture/project/example', to: '/fixture/destination/example' }], applied: !payload.dryRun } });
  });
  await page.goto('/skills/example');
  await page.getByRole('button', { name: 'Rename example', exact: true }).click();
  await page.getByLabel('Skill name', { exact: true }).fill('renamed');
  await page.getByLabel('Skill name', { exact: true }).press('Enter');
  await expect(page).toHaveURL(/skills\/renamed$/);
  expect(requests.map((request) => request.dryRun)).toEqual([false]);
  await page.goto('/skills/example');
  await page.getByRole('button', { name: 'Move to trash', exact: true }).click();
  const trash = page.getByRole('dialog', { name: 'Move example to trash', exact: true });
  await expect(trash).toBeVisible();
  expect(requests.map((request) => request.dryRun)).toEqual([false, true]);
  await trash.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(trash).not.toBeVisible();
  expect(requests.map((request) => request.dryRun)).toEqual([false, true, false]);
});

test('sharing failures stay visible inside the active dialog', async ({ page }) => {
  let failPreview = true;
  await page.route('**/api/skills/**', (route) => {
    const { dryRun } = route.request().postDataJSON() as { dryRun: boolean };
    if (failPreview || !dryRun) return route.fulfill({ status: 409, json: { error: 'Destination already exists' } });
    return route.fulfill({ json: { steps: [{ op: 'symlink', from: '/fixture/source', to: '/fixture/destination' }] } });
  });
  await page.goto('/skills');
  await page.getByRole('button', { name: 'Manage visibility', exact: true }).click();
  const manage = page.getByRole('dialog', { name: 'Manage example', exact: true });
  await manage.getByRole('combobox', { name: 'Use in', exact: true }).selectOption('global');
  await manage.getByRole('button', { name: 'Codex', exact: true }).click();
  await expect(manage.getByRole('alert')).toContainText('Destination already exists');
  failPreview = false;
  await manage.getByRole('button', { name: 'Codex', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Install example for Codex?', exact: true });
  await preview.getByRole('button', { name: 'Install', exact: true }).click();
  await expect(preview.getByRole('alert')).toContainText('Destination already exists');
  await expect(preview.getByRole('button', { name: 'Install', exact: true })).toBeEnabled();
});

test('clicking a skill opens its actual instructions without a starter prompt', async ({ page }) => {
  await page.goto('/skills');
  await page.getByRole('link', { name: 'Open Example', exact: true }).click();
  await expect(page).toHaveURL(/\/skills\/example$/);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.skill-markdown h1').first()).toHaveText('Example');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeInViewport();
  await page.screenshot({ path: `test-results/skill-preview-${test.info().project.name}.png` });
  await page.getByRole('button', { name: 'Read full instructions', exact: true }).click();
  await expect(page.locator('.markdown-reader')).toHaveCSS('overflow', 'auto');
  await page.getByRole('textbox', { name: 'Description', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Read full instructions', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Read full instructions', exact: true }).click();
  await page.screenshot({ path: `test-results/skill-modal-${test.info().project.name}.png` });
  await expect(page.getByText('Starter prompt', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'History', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('New skill name')).toHaveCount(0);
});

test('share copies a portable skill message and provides selectable text if clipboard is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => { sessionStorage.setItem('shared-skill', value); } } });
  });
  await page.goto('/skills');
  await page.getByRole('button', { name: 'Share skill', exact: true }).click();
  await page.getByRole('dialog', { name: 'Share example' }).getByRole('button', { name: 'Copy', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Copied');
  const text = await page.evaluate(() => sessionStorage.getItem('shared-skill'));
  expect(text).toContain('# example');
  expect(text).toContain(fixtureIndex.skills[0]!.instances[0]!.body);
  expect(text).not.toContain('/fixture/project');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('blocked'); } } }); });
  await page.getByRole('button', { name: 'Share skill', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Share example' });
  await dialog.getByRole('button', { name: 'Copy', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Clipboard access is unavailable');
  await expect(dialog.getByRole('textbox', { name: 'Text to copy' })).toHaveValue(text!);
  await expectNoSeriousAccessibilityViolations(page);
});
