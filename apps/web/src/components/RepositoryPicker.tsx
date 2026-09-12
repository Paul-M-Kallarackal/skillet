import { Select } from './Select';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '../api/client';
import type { Repo } from '../api/client.types';
import { useIndex } from '../app/IndexProvider';

export function RepositoryPicker({ value, onChange }: { value: string; onChange: (repo: Repo) => void }) {
  const { index, refresh } = useIndex();
  const [repos, setRepos] = useState<Repo[]>(index?.repos ?? []);
  const [discovering, setDiscovering] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [path, setPath] = useState('');
  useEffect(() => {
    let active = true;
    api.discoverProjects().then((data) => { if (active) setRepos((current) => [...new Map([...current, ...data.repos].map((repo) => [repo.id, repo])).values()]); }).catch((cause) => { if (active) setError(errorMessage(cause, 'Could not find repositories. Enter a repository path below.')); }).finally(() => { if (active) setDiscovering(false); });
    return () => { active = false; };
  }, []);
  async function choose(root: string) {
    setBusy(true); setError('');
    try {
      const result = await api.addProject(root);
      const selected = result.repos.find((repo) => repo.id === result.selectedId);
      if (!selected) throw new Error('Repository was not found after scanning. Check the folder path.');
      setRepos((current) => [...new Map([...current, ...result.repos].map((repo) => [repo.id, repo])).values()]);
      onChange(selected); refresh(); setPath('');
    } catch (cause) { setError(errorMessage(cause, 'Could not add this repository.')); }
    finally { setBusy(false); }
  }
  return <div className="repository-picker">
    <label>Destination project<Select value={value} disabled={busy} onChange={(event) => {
      const repo = repos.find((entry) => entry.id === event.target.value);
      if (repo) { if (index?.repos.some((entry) => entry.id === repo.id)) onChange(repo); else void choose(repo.gitRoot); }
    }}><option value="">{busy ? 'Adding repository…' : 'Choose a repository'}</option>{repos.map((repo) => <option key={repo.id} value={repo.id}>{repo.label} — {repo.gitRoot}</option>)}</Select></label>
    <details><summary>Use another repository</summary><label>Repository folder<input placeholder="/full/path/to/repository" value={path} onChange={(event) => setPath(event.target.value)} disabled={busy} /></label><button disabled={busy || !path.trim()} onClick={() => { void choose(path.trim()); }}>{busy ? 'Adding…' : 'Add repository'}</button></details>
    {discovering ? <p className="sharing-note" role="status">Finding repositories…</p> : null}
    {!discovering && !repos.length && !error ? <p className="sharing-note">No repositories found yet. Enter a repository folder above.</p> : null}
    {error ? <p className="inline-feedback" role="alert">{error}</p> : null}
  </div>;
}
