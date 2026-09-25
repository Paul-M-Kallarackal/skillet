import { test, expect } from '../helpers/fixture';
import { expectNoSeriousAccessibilityViolations } from '../helpers/accessibility';

test('card access indicators respect disabled installations and retain an enabled copy', async ({ page }) => {
  const agents = [
    { id: 'codex', name: 'Codex', installed: true, resolvedGlobalDir: '/fixture/codex' },
    { id: 'claude-code', name: 'Claude Code', installed: true, resolvedGlobalDir: '/fixture/claude' }
  ];
  const source = { id: 'global', kind: 'canonical', scope: 'global', readers: ['codex'], absPath: '/fixture/codex/demo', isHub: false };
  const makeSkill = (id: string, enabledCopy: boolean) => ({
    id, name: id, scope: 'global', canonicalId: source.id, description: 'Review changes', errors: [],
    instances: enabledCopy ? [source, { ...source, id: 'project', scope: 'project', absPath: '/fixture/repo/demo' }] : [source]
  });
  const disabled = { agentId: 'codex', agentName: 'Codex', state: 'off', instanceId: 'global', conditions: [] };
  await page.route('**/api/index', (route) => route.fulfill({ json: {
    scannedAt: '', scanMs: 1, stalePluginVersions: 0, repos: [], agents,
    skills: [makeSkill('disabled-skill', false), makeSkill('enabled-copy', true)],
    cells: {
      'disabled-skill': [disabled],
      'enabled-copy': [disabled, { ...disabled, instanceId: 'project', state: 'auto' }]
    }
  } }));
  await page.goto('/skills');
  const disabledCard = page.getByRole('article', { name: 'disabled-skill', exact: true });
  await expect(disabledCard).toBeVisible();
  await expect(disabledCard.getByRole('img', { name: 'Codex', exact: true })).toHaveCount(0);
  await expect(disabledCard.getByRole('img', { name: 'Available to all agents' })).toHaveCount(0);
  await expect(page.getByRole('article', { name: 'enabled-copy', exact: true }).getByRole('img', { name: 'Codex', exact: true })).toBeVisible();
  await page.goto('/skills?agent=codex');
  await expect(page.getByRole('article', { name: 'disabled-skill', exact: true })).toHaveCount(0);
  await expect(page.getByRole('article', { name: 'enabled-copy', exact: true })).toBeVisible();
});

test('agent icons identify access and keep named keyboard-operable filters', async ({ page }, testInfo) => {
  const agents = [['codex', 'Codex'], ['claude-code', 'Claude Code'], ['cursor', 'Cursor'], ['pi', 'Pi'], ['opencode', 'OpenCode']].map(([id, name]) => ({ id, name, installed: true, custom: false }));
  await page.route('**/api/index', (route) => route.fulfill({ json: {
    scannedAt: '', scanMs: 1, stalePluginVersions: 0, repos: [], agents,
    skills: [{ id: 'example', name: 'react-best-practices', scope: 'global', canonicalId: 'source', description: 'Review React components for performance and maintainability.', errors: [], diverged: false, shadowed: false, repoName: '', repoId: '', pluginName: '', instances: [{ id: 'source', kind: 'canonical', absPath: '/fixture/hub/example', isHub: true }] }],
    cells: { example: agents.map((agent) => ({ agentId: agent.id, agentName: agent.name, state: 'auto', instanceId: 'source' })) }
  } }));
  await page.goto('/skills');
  const card = page.getByRole('article', { name: 'react-best-practices' });
  for (const agent of agents.slice(0, 3)) await expect(card.getByRole('img', { name: agent.name, exact: true })).toBeVisible();
  await expect(card.getByLabel('2 more agents')).toHaveText('+2');
  for (const icon of ['openai', 'claude', 'cursor', 'pi', 'opencode']) expect((await page.request.get(`/agent-icons/${icon}.svg`)).ok()).toBe(true);
  const nav = page.getByRole('navigation', { name: 'Workspace' });
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Toggle navigation' }).click();
  const codex = nav.getByRole('link', { name: 'Codex', exact: true });
  await codex.focus();
  await expect(codex.locator('.sidebar-link-label')).toHaveText('Codex');
  await expect(codex.locator('.agent-icon')).toHaveCSS('color', 'rgb(0, 0, 0)');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/agent=codex/);
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await expect(codex).toHaveAttribute('aria-current', 'page');
  await expectNoSeriousAccessibilityViolations(page);
  await codex.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `.impeccable/review/agent-icons-${testInfo.project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('shared hub excludes agent-only folders and attention explains its filter', async ({ page }) => {
  const makeSkill = (name: string, isHub: boolean, diverged = false) => ({ id: name, name, scope: 'global', canonicalId: name, description: 'Example skill', errors: [], diverged, shadowed: false, repoName: '', repoId: '', pluginName: '', instances: [{ id: name, kind: 'canonical', absPath: `/fixture/${name}`, isHub }] });
  await page.route('**/api/index', (route) => route.fulfill({ json: { scannedAt: '', scanMs: 1, stalePluginVersions: 0, repos: [], agents: [], cells: {}, skills: [makeSkill('hub-skill', true), makeSkill('agent-only', false, true)] } }));
  await page.goto('/skills?hub=1');
  await expect(page.getByRole('article', { name: 'hub-skill' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'agent-only' })).toHaveCount(0);
  await page.goto('/skills');
  await expect(page.getByRole('article')).toHaveCount(2);
  await expect(page.getByLabel('Needs attention')).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Filter skills by purpose' })).toHaveCount(0);
  await expect(page.locator('.skill-card .chip, .skill-card .badge')).toHaveCount(0);
});


test('identical global and project skills collapse to one globe-only card', async ({ page }) => {
  const agent = { id: 'cline', name: 'Cline', installed: false, resolvedGlobalDir: '/fixture/agents/skills', projectDir: '.agents/skills' };
  const instance = { id: 'global-source', kind: 'copy', scope: 'global', readers: ['cline'], absPath: '/fixture/agents/skills/accessibility', contentHash: 'same-content', isHub: false };
  const skill = { id: 'global:accessibility', name: 'accessibility', scope: 'global', canonicalId: instance.id, description: 'Check accessibility', errors: [], instances: [instance] };
  await page.route('**/api/index', (route) => route.fulfill({ json: { agents: [agent], repos: [], cells: {}, skills: [{ ...skill, instances: [instance, { ...instance, id: 'project-source', absPath: '/fixture/repo/.agents/skills/accessibility', scope: 'project', repoId: 'repo' }] }] } }));
  await page.goto('/skills');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('img', { name: 'Available to all agents' })).toBeVisible();
  await expect(page.getByText('shadowed', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Manage visibility', exact: true }).click();
  const manage = page.getByRole('dialog', { name: 'Manage accessibility', exact: true });
  await expect(manage.getByRole('button', { name: 'Cline', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.route('**/api/skills/**', (route) => route.fulfill({ json: { steps: [], applied: false } }));
  await manage.getByRole('button', { name: 'Cline', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Remove Cline access?', exact: true })).toBeVisible();
});


test('agent filtering retains a project installation when the global copy belongs to another agent', async ({ page }) => {
  const makeSkill = (scope: string, reader: string) => ({ id: `${scope}:demo`, name: 'demo', scope, canonicalId: scope, description: 'Same content', errors: [], shadowed: scope === 'project', instances: [{ id: scope, scope, readers: [reader], absPath: `/fixture/${scope}/demo`, contentHash: 'identical' }] });
  await page.route('**/api/index', (route) => route.fulfill({ json: { agents: [{ id: 'cline', name: 'Cline', installed: false }], repos: [], cells: {}, skills: [makeSkill('global', 'codex'), makeSkill('project', 'cline')] } }));
  await page.goto('/skills?agent=cline');
  await expect(page.getByRole('article', { name: 'demo' })).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Open Demo', exact: true })).toHaveAttribute('href', '/skills/project%3Ademo');
});
