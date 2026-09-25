import { test, expect } from '../helpers/fixture';
import { buildSkills } from '../../apps/server/src/scan/index-builder';
import { parseSkillFile } from '../../apps/server/src/scan/frontmatter';
import type { SkillInstance } from '../../apps/server/src/scan/walk.types';

const raw = '---\nname: code-review\ndescription: Review code carefully\n---\nReview the changes.';
const parsed = parseSkillFile(raw, 'code-review');
const paths = ['/fixture/global/code-review', '/fixture/repo-a/.claude/skills/code-review', '/fixture/repo-b/.claude/skills/code-review', '/fixture/plugin/code-review'];
const instances: SkillInstance[] = paths.map((path, i) => ({
  id: path, absPath: path, parentDir: path.slice(0, path.lastIndexOf('/')), name: 'code-review', kind: i === 3 ? 'plugin' : 'canonical',
  scope: i === 0 ? 'global' : i === 3 ? 'plugin' : 'project', readers: ['claude-code'], repoId: i === 1 ? '/fixture/repo-a' : i === 2 ? '/fixture/repo-b' : '',
  nestedDir: '', symlinkTarget: '', contentHash: 'same-content', frontmatter: parsed.frontmatter, body: parsed.body,
  files: ['SKILL.md'], gitState: 'none', errors: [], pluginName: i === 3 ? 'package' : '', pluginVersion: '', isHub: false
}));
const skills = buildSkills(instances, []);
const skill = skills[0]!;
const fixture = {
  skills, agents: [{ id: 'claude-code', name: 'Claude Code', installed: true, custom: false, resolvedGlobalDir: '/fixture/global', projectDir: '.claude/skills' }],
  repos: [{ id: '/fixture/repo-a', label: 'Repo A' }, { id: '/fixture/repo-b', label: 'Repo B' }], scannedAt: '', scanMs: 1, stalePluginVersions: 0,
  cells: { [skill.id]: instances.map((instance, i) => ({ agentId: 'claude-code', agentName: 'Claude Code', state: i === 0 ? 'off' : 'auto', conditions: [], instanceId: instance.id })) }
};
test.beforeEach(async ({ page }) => {
  await page.route('**/api/index', (route) => route.fulfill({ json: fixture }));
});

test('counts one skill in the inventory and search, retaining project and agent filters', async ({ page }) => {
  await page.goto('/skills');
  await expect(page.getByRole('article', { name: 'code-review', exact: true })).toHaveCount(1);
  await expect(page.locator('.page-count')).toHaveText('1');
  await expect(page.locator('.sidebar-link').filter({ hasText: 'All skills' }).locator('.sidebar-count')).toHaveText('1');
  await page.keyboard.press('Control+k');
  await expect(page.locator('.palette-result')).toHaveCount(1);
  await page.keyboard.press('Escape');
  for (const query of ['repo=/fixture/repo-a', 'repo=/fixture/repo-b', 'scope=project', 'scope=plugin', 'agent=claude-code', 'repo=/fixture/repo-a&agent=claude-code']) {
    await page.goto(`/skills?${query}`);
    await expect(page.getByRole('article', { name: 'code-review', exact: true })).toHaveCount(1);
  }
  await page.goto('/skills?scope=global&agent=claude-code');
  await expect(page.getByRole('article')).toHaveCount(0);
});

test('retains every copy in details and sends removal to the selected project installation', async ({ page }) => {
  const writes: { instanceId: string; dryRun: boolean }[] = [];
  await page.route('**/api/skills/**', (route) => {
    writes.push(route.request().postDataJSON());
    return route.fulfill({ json: { applied: false, steps: [{ op: 'move', from: paths[1], to: '/fixture/trash' }] } });
  });
  await page.goto(`/skills/${encodeURIComponent(skill.id)}`);
  const dialog = page.getByRole('dialog');
  const copies = dialog.getByRole('combobox', { name: 'Editing copy', exact: true });
  await expect(copies.getByRole('option')).toHaveCount(4);
  await copies.selectOption(paths[3]!);
  await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await copies.selectOption(paths[1]!);
  await dialog.getByRole('button', { name: 'Move to trash', exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toEqual({ instanceId: paths[1], dryRun: true });
});
