import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir, realpath, stat } from 'node:fs/promises';
import { join } from 'node:path';

/** Hash the installed content, independent of its location or whether it is linked. */
export async function fingerprint(root: string): Promise<{ files: string[]; contentHash: string }> {
  const hash = createHash('sha256');
  const files: string[] = [];
  const ancestors = new Set<string>();
  async function visit(directory: string, prefix: string): Promise<void> {
    const resolved = await realpath(directory);
    if (ancestors.has(resolved)) throw new Error('Cyclic skill resource link');
    ancestors.add(resolved);
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.name === '.DS_Store') continue;
      const path = join(directory, entry.name);
      const relative = `${prefix}${entry.name}`;
      const info = await stat(path);
      if (info.isDirectory()) {
        hash.update(JSON.stringify(['directory', relative]));
        await visit(path, `${relative}/`);
      } else {
        files.push(relative);
        // Import provenance is local bookkeeping, not part of a skill's behavior.
        if (relative === '.skillet-source.json') continue;
        if (!info.isFile()) throw new Error('Unsupported skill resource');
        hash.update(JSON.stringify(['file', relative, info.mode & 0o111, info.size]));
        for await (const chunk of createReadStream(path)) hash.update(chunk);
      }
    }
    ancestors.delete(resolved);
  }
  try {
    await visit(root, '');
    return { files: files.sort(), contentHash: hash.digest('hex') };
  } catch {
    // Unreadable resources must never provide evidence that two copies are identical.
    return { files: files.sort(), contentHash: '' };
  }
}
