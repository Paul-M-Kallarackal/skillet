import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, stat, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { FsStep } from '../../apps/server/src/hub/steps.types';

const state = vi.hoisted(() => ({ root: '', inverse: [] as FsStep[], journalFail: false }));
vi.mock('../../apps/server/src/config/config', () => ({ loadConfig: async () => ({ hubPath: state.root }) }));
vi.mock('../../apps/server/src/hub/journal', () => ({ appendEntry: async (_input: unknown, inverse: FsStep[]) => { if (state.journalFail) throw new Error('journal unavailable'); state.inverse = inverse; } }));
import { catalogReference, installImport, previewImport, referenceFromLink, searchCatalog } from '../../apps/server/src/catalog/catalog';
import { applySteps } from '../../apps/server/src/hub/steps';

const sha = 'a'.repeat(40);
const raw = '---\nname: example\ndescription: Example instructions\n---\n\nRead the reference.';
let entries: { path: string; type: string; mode: string }[];
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(async () => {
  state.root = await mkdtemp(join(tmpdir(), 'skillet-catalog-')); state.journalFail = false;
  entries = ['skills/different-folder/SKILL.md', 'skills/different-folder/references/guide.md', 'skills/different-folder/scripts/run.sh', 'skills/different-folder/asset.bin'].map((path) => ({ path, type: 'blob', mode: path.endsWith('.sh') ? '100755' : '100644' }));
  fetchMock = vi.fn(async (url: string) => {
    if (url.includes('skills.sh/api/search')) return Response.json({ skills: [{ source: 'owner/repo', skillId: 'example', name: 'example' }] });
    if (url.endsWith('/commits/HEAD')) return Response.json({ sha });
    if (url.includes('/git/trees/')) return Response.json({ tree: entries, truncated: false });
    if (url.endsWith('/SKILL.md')) return new Response(raw);
    if (url.endsWith('/guide.md')) return new Response('Preserve this reference');
    if (url.endsWith('/run.sh')) return new Response('#!/bin/sh\nexit 1');
    if (url.endsWith('/asset.bin')) return new Response(new Uint8Array([0, 255, 128]));
    throw new Error(`Unexpected request ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(async () => { vi.unstubAllGlobals(); vi.useRealTimers(); await rm(state.root, { recursive: true, force: true }); });

it('searches the public catalog and supports direct links without a remote search', async () => {
  expect(await searchCatalog('react')).toEqual([{ source: 'owner/repo', slug: 'example', name: 'example' }]);
  expect(referenceFromLink('https://skills.sh/owner/repo/example')).toMatchObject({ source: 'owner/repo', slug: 'example' });
  fetchMock.mockClear();
  expect(await searchCatalog('skills.sh/owner/repo/example')).toHaveLength(1);
  expect(fetchMock).not.toHaveBeenCalled();
});
it.each(['https://evil.test/owner/repo/example', 'http://skills.sh/owner/repo/example', 'https://skills.sh/owner/repo', 'https://skills.sh/owner/repo/%2e%2e'])('rejects unsupported or malformed link %s', (link) => {
  expect(() => referenceFromLink(link)).toThrow();
});
it('rejects unsafe references before any network request', async () => {
  expect(() => catalogReference('owner/../repo', 'example')).toThrow();
  await expect(previewImport('owner/repo', '../escape')).rejects.toThrow();
  expect(fetchMock).not.toHaveBeenCalled();
});
it('reviews without writes, imports exact complete files at a pinned revision, and supports undo', async () => {
  const preview = await previewImport('owner/repo', 'example');
  expect(preview.instructions).toBe(raw);
  await expect(stat(preview.destination)).rejects.toThrow();
  expect(preview.files).toHaveLength(4);
  fetchMock.mockClear();
  await installImport(preview.token);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(await readFile(join(preview.destination, 'SKILL.md'), 'utf8')).toBe(raw);
  expect(await readFile(join(preview.destination, 'references/guide.md'), 'utf8')).toBe('Preserve this reference');
  expect([...await readFile(join(preview.destination, 'asset.bin'))]).toEqual([0, 255, 128]);
  expect((await stat(join(preview.destination, 'scripts/run.sh'))).mode & 0o111).toBeTruthy();
  expect(JSON.parse(await readFile(join(preview.destination, '.skillet-source.json'), 'utf8')).commit).toBe(sha);
  await applySteps(state.inverse);
  await expect(stat(preview.destination)).rejects.toThrow();
});
it('never overwrites an existing folder, including a destination created after preview', async () => {
  const first = await previewImport('owner/repo', 'example');
  const second = await previewImport('owner/repo', 'example');
  await installImport(first.token);
  await expect(installImport(second.token)).rejects.toThrow(/already in your hub/);
  expect(await readFile(join(first.destination, 'SKILL.md'), 'utf8')).toBe(raw);
  expect((await previewImport('owner/repo', 'example')).existing).toBe(true);
});
it('refuses broken symlink destinations', async () => {
  const preview = await previewImport('owner/repo', 'example');
  await symlink('/does-not-exist', preview.destination);
  await expect(installImport(preview.token)).rejects.toThrow(/already in your hub/);
});
it.each(['120000', '160000'])('rejects links and submodules (%s)', async (mode) => {
  entries.push({ path: 'skills/different-folder/external', type: mode === '160000' ? 'commit' : 'blob', mode });
  await expect(previewImport('owner/repo', 'example')).rejects.toThrow(/unsupported/);
});
it('rejects traversal paths and expires stale previews', async () => {
  entries.push({ path: 'skills/different-folder/../escape', type: 'blob', mode: '100644' });
  await expect(previewImport('owner/repo', 'example')).rejects.toThrow(/unsupported/);
  entries.pop();
  const preview = await previewImport('owner/repo', 'example');
  vi.useFakeTimers(); vi.setSystemTime(Date.now() + 11 * 60_000);
  await expect(installImport(preview.token)).rejects.toThrow(/expired/);
});
it('rolls back a failed import and allows retry', async () => {
  const preview = await previewImport('owner/repo', 'example'); state.journalFail = true;
  await expect(installImport(preview.token)).rejects.toThrow(/journal/);
  await expect(stat(preview.destination)).rejects.toThrow();
  state.journalFail = false; await installImport(preview.token);
  expect(await readFile(join(preview.destination, 'SKILL.md'), 'utf8')).toBe(raw);
});
it('reports rate limiting with a recovery action', async () => {
  fetchMock.mockResolvedValue(new Response('', { status: 429 }));
  await expect(searchCatalog('react')).rejects.toThrow(/try again later/);
});
