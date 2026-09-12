import { randomUUID } from 'node:crypto';
import { lstat, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { loadConfig } from '../config/config';
import { SkilletError } from '../errors';
import { appendEntry } from '../hub/journal';
import { step } from '../hub/steps';
import { parseSkillFile } from '../scan/frontmatter';

export interface CatalogSkill { source: string; slug: string; name: string }
interface TreeEntry { path: string; mode: string; type: string; size?: number }
interface StoredFile { path: string; bytes: Uint8Array; mode: number }
export interface ImportPreview extends CatalogSkill {
  token: string; description: string; instructions: string; files: string[];
  destination: string; commit: string; existing: boolean;
}
interface Staged { preview: ImportPreview; files: StoredFile[]; expires: number; busy: boolean }
const previews = new Map<string, Staged>();
const MAX_BYTES = 10 * 1024 * 1024;
const validPart = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}$/;
const validSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function fail(message: string, status = 400): never {
  throw new SkilletError({ message, status, code: 'CATALOG_ERROR', service: 'Catalog', method: 'import', error: null });
}

export function catalogReference(source: unknown, slug: unknown): CatalogSkill {
  if (typeof source !== 'string' || source.split('/').length !== 2 || !source.split('/').every((p) => validPart.test(p)) || typeof slug !== 'string' || !validSlug.test(slug) || slug.length > 64) {
    fail('Choose a skill from the results or paste a complete skills.sh skill link.');
  }
  return { source, slug, name: slug };
}

export function referenceFromLink(value: string): CatalogSkill | null {
  if (!/^(https?:\/\/|(?:www\.)?skills\.sh\/)/i.test(value)) return null;
  let url: URL;
  try { url = new URL(value.startsWith('http') ? value : `https://${value}`); } catch { fail('Enter a valid skills.sh skill link.'); }
  if (url.protocol !== 'https:' || !['skills.sh', 'www.skills.sh'].includes(url.hostname) || url.port || url.username || url.password) fail('Use an https://skills.sh/owner/repository/skill link.');
  const parts = url.pathname.replace(/\/$/, '').split('/').slice(1);
  if (parts.length !== 3) fail('Paste the complete skill link, including its name.');
  return catalogReference(`${parts[0]}/${parts[1]}`, parts[2]);
}

async function remote(url: string, limit = MAX_BYTES, signal?: AbortSignal): Promise<Uint8Array> {
  let response: Response;
  try { response = await fetch(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000), redirect: 'error', headers: { 'User-Agent': 'Skillet', Accept: 'application/json' } }); }
  catch { fail('Could not reach the skill source. Check your connection and try again.', 502); }
  if (!response.ok) fail(response.status === 403 || response.status === 429 ? 'The source is rate limited. Please try again later.' : 'The skill source is unavailable or no longer public. Try another skill.', 502);
  const reader = response.body?.getReader();
  if (!reader) fail('The source returned an empty response.', 502);
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length; if (size > limit) fail('This skill exceeds the 10 MB import limit.');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

async function json<T>(url: string, signal?: AbortSignal): Promise<T> {
  try { return JSON.parse(new TextDecoder().decode(await remote(url, MAX_BYTES, signal))) as T; }
  catch (error) { if (error instanceof SkilletError) throw error; fail('The source returned an unexpected response. Try again later.', 502); }
}

export async function searchCatalog(query: string): Promise<CatalogSkill[]> {
  const value = query.trim();
  if (value.length < 2 || value.length > 300) fail('Enter at least two characters, or a skills.sh link.');
  const link = referenceFromLink(value); if (link) return [link];
  const data = await json<{ skills: { source: string; skillId?: string; id: string; name: string }[] }>(`https://skills.sh/api/search?${new URLSearchParams({ q: value, limit: '20' })}`);
  if (!Array.isArray(data.skills)) fail('Search is temporarily unavailable. Please try again.', 502);
  return data.skills.flatMap((entry) => {
    try { return [catalogReference(entry.source, entry.skillId ?? entry.id?.split('/').at(-1))]; } catch { return []; }
  });
}

async function exists(path: string): Promise<boolean> {
  try { await lstat(path); return true; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
}

function safePath(path: string): boolean {
  return path.length > 0 && path.length < 1024 && !path.includes('\\') && !/[\x00-\x1f]/.test(path) && path.split('/').every((part) => part && part !== '.' && part !== '..' && part !== '.git');
}

export async function previewImport(source: unknown, slug: unknown): Promise<ImportPreview> {
  const skill = catalogReference(source, slug);
  const signal = AbortSignal.timeout(45_000);
  for (const [key, value] of previews) if (value.expires < Date.now() && !value.busy) previews.delete(key);
  if (previews.size >= 3) {
    const oldest = [...previews].find(([, value]) => !value.busy);
    if (oldest) previews.delete(oldest[0]); else fail('Another import is in progress. Try again shortly.', 409);
  }
  const commitData = await json<{ sha: string }>(`https://api.github.com/repos/${skill.source}/commits/HEAD`, signal);
  const commit = commitData.sha;
  if (!/^[a-f0-9]{40}$/.test(commit)) fail('The repository returned an invalid revision.', 502);
  const tree = await json<{ tree: TreeEntry[]; truncated: boolean }>(`https://api.github.com/repos/${skill.source}/git/trees/${commit}?recursive=1`, signal);
  if (tree.truncated || !Array.isArray(tree.tree)) fail('This repository is too large to import reliably.');
  const candidates = tree.tree.filter((file) => file.type === 'blob' && /(^|\/)SKILL\.md$/.test(file.path) && safePath(file.path) && /^100(644|755)$/.test(file.mode));
  // Prefer folder names but also support catalog names that differ from the folder.
  candidates.sort((a, b) => Number(b.path.split('/').at(-2) === skill.slug) - Number(a.path.split('/').at(-2) === skill.slug));
  if (candidates.length > 100) fail('This repository has too many skill folders to search.');
  const rawUrl = (path: string) => `https://raw.githubusercontent.com/${skill.source}/${commit}/${path.split('/').map(encodeURIComponent).join('/')}`;
  let selected: TreeEntry | undefined; let instructions = ''; let description = '';
  for (const candidate of candidates) {
    const raw = new TextDecoder().decode(await remote(rawUrl(candidate.path), 512 * 1024, signal));
    const parsed = parseSkillFile(raw, skill.slug);
    if (parsed.frontmatter.name === skill.slug) { selected = candidate; instructions = raw; description = parsed.frontmatter.description; break; }
  }
  if (!selected) fail('This skill could not be found in its source repository. Its catalog entry may be out of date.', 404);
  const prefix = selected.path.slice(0, -'SKILL.md'.length);
  const entries = tree.tree.filter((file) => file.path.startsWith(prefix) && file.type !== 'tree');
  if (entries.length > 200 || entries.some((file) => !safePath(file.path.slice(prefix.length)) || file.type !== 'blob' || !/^100(644|755)$/.test(file.mode))) fail('This skill contains unsupported links, submodules, paths, or more than 200 files.');
  if (entries.some((file) => file.path.slice(prefix.length) === '.skillet-source.json')) fail('The skill contains a reserved Skillet metadata file.');
  let bytes = 0; const files: StoredFile[] = [];
  // Small batches bound simultaneous requests and memory.
  for (let i = 0; i < entries.length; i += 6) {
    const batch = await Promise.all(entries.slice(i, i + 6).map(async (file) => ({ path: file.path.slice(prefix.length), bytes: await remote(rawUrl(file.path), MAX_BYTES, signal), mode: file.mode === '100755' ? 0o755 : 0o644 })));
    for (const file of batch) { bytes += file.bytes.length; if (bytes > MAX_BYTES) fail('This skill exceeds the 10 MB import limit.'); files.push(file); }
  }
  const config = await loadConfig();
  const destination = resolve(config.hubPath, skill.slug);
  const preview: ImportPreview = { ...skill, token: randomUUID(), description, instructions, files: files.map((f) => f.path).sort(), destination, commit, existing: await exists(destination) };
  // Concurrent previews may have completed while this download was running.
  while (previews.size >= 3) {
    const oldest = [...previews].find(([, value]) => !value.busy);
    if (!oldest) fail('Another import is in progress. Try again shortly.', 409);
    previews.delete(oldest[0]);
  }
  previews.set(preview.token, { preview, files, expires: Date.now() + 10 * 60_000, busy: false });
  return preview;
}

export async function installImport(token: unknown): Promise<{ destination: string; name: string }> {
  const staged = typeof token === 'string' ? previews.get(token) : undefined;
  if (!staged || staged.expires < Date.now()) fail('This preview expired. Review the skill again before adding it.', 409);
  if (staged.busy) fail('This skill is already being added.', 409);
  staged.busy = true;
  const { preview, files } = staged;
  let created = false;
  try {
    const config = await loadConfig();
    if (resolve(config.hubPath, preview.slug) !== preview.destination) fail('Your hub location changed. Review the skill again.', 409);
    await mkdir(config.hubPath, { recursive: true });
    try { await mkdir(preview.destination); created = true; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'EEXIST') fail('This skill is already in your hub. Existing files were kept.', 409); throw error; }
    for (const file of files) {
      const target = join(preview.destination, file.path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, file.bytes, { flag: 'wx', mode: file.mode });
    }
    await writeFile(join(preview.destination, '.skillet-source.json'), JSON.stringify({ source: preview.source, skill: preview.slug, commit: preview.commit, importedAt: new Date().toISOString() }, null, 2), { flag: 'wx' });
    await appendEntry({ action: 'catalog-import', skillId: `global:${preview.slug}`, steps: [step('mkdir', '', preview.destination, `Import ${preview.source}/${preview.slug} at ${preview.commit}`)] }, [step('removeDir', '', preview.destination, `Undo import of ${preview.slug}`)]);
    previews.delete(preview.token);
    return { destination: preview.destination, name: preview.slug };
  } catch (error) { if (created) await rm(preview.destination, { recursive: true, force: true }); throw error; }
  finally { staged.busy = false; }
}
