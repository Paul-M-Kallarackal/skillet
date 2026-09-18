import { test, expect } from '../helpers/fixture';

const agents = [
  { id: 'codex', name: 'Codex', installed: true, resolvedGlobalDir: '/fixture/codex/skills', projectDir: '.agents/skills' },
  { id: 'claude-code', name: 'Claude Code', installed: true, resolvedGlobalDir: '/fixture/claude/skills', projectDir: '.claude/skills' }
];
const fixture = { repos: [], agents, skills: [{ id: 'example', name: 'example', scope: 'global', canonicalId: 'source', description: 'Example', errors: [], instances: [{ id: 'source', kind: 'canonical', scope: 'global', absPath: '/fixture/hub/example', isHub: true }, { id: 'link', kind: 'symlink', scope: 'global', absPath: '/fixture/codex/skills/example' }] }], cells: { example: [{ agentId: 'codex', state: 'auto', instanceId: 'link' }, { agentId: 'claude-code', state: 'not-linked', instanceId: '' }] } };
test.beforeEach(async ({ page }) => { await page.route('**/api/index', (route) => route.fulfill({ json: fixture })); });

test('agent chips use a plain install confirmation and keep its footer inset', async ({ page }) => {
  const actions: boolean[] = [];
  await page.route('**/api/skills/**', (route) => { actions.push(route.request().postDataJSON().dryRun); return route.fulfill({ json: { steps: [{ op: 'copyDir', from: '/private/source', to: '/private/target' }], applied: false } }); });
  await page.goto('/skills');
  await page.getByRole('button', { name: 'Manage visibility', exact: true }).click();
  const manage = page.getByRole('dialog', { name: 'Manage example', exact: true });
  for (const name of ['Link to agent', 'Install copy', 'Move to folder']) await expect(manage.getByRole('button', { name, exact: true })).toHaveCount(0);
  await expect(manage.getByLabel('Install for')).toHaveCount(0);
  await manage.getByRole('button', { name: 'Claude Code', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Install example for Claude Code?', exact: true });
  await expect(confirm).not.toContainText('copyDir');
  await expect(confirm).not.toContainText('/private/');
  await expect(confirm.getByRole('button', { name: 'Install', exact: true })).toBeInViewport();
  const bounds = await confirm.boundingBox();
  const button = await confirm.getByRole('button', { name: 'Install', exact: true }).boundingBox();
  expect(bounds!.y + bounds!.height - button!.y - button!.height).toBeGreaterThanOrEqual(24);
  await confirm.screenshot({ path: `test-results/confirm-install-${test.info().project.name}.png` });
  expect(actions).toEqual([true]);
  await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
  await manage.getByRole('button', { name: 'Codex', exact: true }).click();
  await page.getByRole('dialog', { name: 'Remove Codex access?', exact: true }).getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(actions).toEqual([true, true]);
});

test('All agents chip confirms one installation across the configured agents', async ({ page }) => {
  const requests: boolean[] = [];
  await page.route('**/api/skills/example/install-all', (route) => { requests.push(route.request().postDataJSON().dryRun); return route.fulfill({ json: { steps: [], applied: false } }); });
  await page.goto('/skills');
  await page.getByRole('button', { name: 'Manage visibility', exact: true }).click();
  const manage = page.getByRole('dialog', { name: 'Manage example', exact: true });
  await manage.getByRole('button', { name: 'All agents', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Install example globally?', exact: true });
  await expect(confirm).toContainText('all listed agents across all projects');
  expect(requests).toEqual([true]);
  await confirm.getByRole('button', { name: 'Install', exact: true }).click();
  await expect(confirm).not.toBeVisible();
  expect(requests).toEqual([true, false]);
});

test('project selection stays contained and the agent chip uses that repository', async ({ page }) => {
  const repo = { id: '/fixture/repo', gitRoot: '/fixture/repo', label: 'A very long repository name that must not widen the modal', isWorktree: false, worktreeIds: [] };
  await page.route('**/api/projects', (route) => route.fulfill({ json: { repos: [repo], selectedId: repo.id } }));
  const requests: unknown[] = [];
  await page.route('**/api/skills/**', (route) => { requests.push(route.request().postDataJSON()); return route.fulfill({ json: { steps: [], applied: false } }); });
  await page.goto('/skills');
  await page.getByRole('button', { name: 'Manage visibility', exact: true }).click();
  const manage = page.getByRole('dialog', { name: 'Manage example', exact: true });
  await manage.getByLabel('Use in').selectOption('project');
  await expect(manage.getByRole('option', { name: `${repo.label} — ${repo.gitRoot}` })).toBeAttached();
  await manage.getByLabel('Destination project').selectOption(repo.id);
  await expect(manage.getByLabel('Destination project')).toHaveValue(repo.id);
  await expect(manage.getByLabel('Destination project')).toHaveCSS('padding-right', '48px');
  expect(await manage.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await manage.getByRole('button', { name: 'Claude Code', exact: true }).click();
  await page.getByRole('dialog', { name: 'Install example for Claude Code?', exact: true }).getByRole('button', { name: 'Install', exact: true }).click();
  expect(requests).toEqual([true, false].map((dryRun) => ({ target: { agentId: 'claude-code', scope: 'project', repoId: repo.id }, mode: 'copy', dryRun })));
});
