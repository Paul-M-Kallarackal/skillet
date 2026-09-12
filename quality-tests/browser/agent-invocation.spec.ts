import { test, expect } from '../helpers/fixture';
import { parseSkillFile } from '../../apps/server/src/scan/frontmatter';
import { expectNoSeriousAccessibilityViolations } from '../helpers/accessibility';

const ids = ['codex', 'claude-code', 'pi', 'opencode', 'cursor'];
const frontmatter = parseSkillFile('---\nname: demo\ndescription: Use for demos\n---\nDemo instructions', 'demo').frontmatter;

test('inline usage toggle saves across agents without tabs or extra confirmation', async ({ page }) => {
  const source = { id: 'source', name: 'demo', absPath: '/fixture/demo', parentDir: '/fixture', kind: 'canonical', scope: 'global', readers: ids, repoId: '', nestedDir: '', symlinkTarget: '', contentHash: 'abc', frontmatter, body: 'Demo instructions', files: ['SKILL.md'], gitState: 'none', errors: [], pluginName: '', pluginVersion: '', isHub: false, codexImplicitAllowed: false };
  const skill = { id: 'demo', name: 'demo', scope: 'global', canonicalId: 'source', description: 'Use for demos', errors: [], diverged: false, shadowed: false, repoName: '', repoId: '', pluginName: '', instances: [source] };
  await page.route('**/api/index', (route) => route.fulfill({ json: { scannedAt: '', scanMs: 1, stalePluginVersions: 0, repos: [], agents: ids.map((id) => ({ id, name: id, installed: true, custom: false, resolvedGlobalDir: `/fixture/${id}`, projectDir: `.${id}/skills` })), skills: [skill], cells: { demo: ids.map((agentId) => ({ agentId, agentName: agentId, state: 'auto', instanceId: 'source', conditions: [] })) } } }));
  const writes: { automatic: boolean; dryRun: boolean }[] = [];
  let releaseSave: () => void = () => {};
  const firstSave = new Promise<void>((resolve) => { releaseSave = resolve; });
  await page.route('**/api/skills/**', async (route) => {
    writes.push(route.request().postDataJSON());
    if (writes.length === 1) await firstSave;
    return route.fulfill({ json: { steps: [], applied: true, journalId: '' } });
  });
  await page.goto('/skills/demo');
  await expect(page.getByRole('tab')).toHaveCount(0);
  const toggle = page.getByRole('group', { name: 'Use this skill' });
  await expect(toggle.getByRole('button', { name: 'Only when I ask' })).toHaveAttribute('aria-pressed', 'true');
  await toggle.getByRole('button', { name: 'Always', exact: true }).click();
  await expect(toggle.getByRole('button', { name: 'Always', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => writes.length).toBe(1);
  expect(writes).toEqual([{ automatic: true, dryRun: false }]);
  await expect(toggle.getByRole('button', { name: 'Only when I ask' })).toBeEnabled();
  await toggle.getByRole('button', { name: 'Only when I ask' }).click();
  await expect(toggle.getByRole('button', { name: 'Only when I ask' })).toHaveAttribute('aria-pressed', 'true');
  releaseSave();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1]).toEqual({ automatic: false, dryRun: false });
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(1);
  await page.screenshot({ path: `test-results/invocation-${test.info().project.name}.png`, fullPage: true });
  await expectNoSeriousAccessibilityViolations(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});
