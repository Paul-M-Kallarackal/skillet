import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../api/client';
import type { CatalogSkill, ImportPreview } from '../api/client';
import { useIndex } from '../app/IndexProvider';
import { catalogSuggestions } from '../components/catalog-suggestions';
import { Dialog } from '../components/Dialog';
import '../styles/discover.css';

export function DiscoverPage() {
  const { refresh } = useIndex();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CatalogSkill[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importError, setImportError] = useState('');
  const [added, setAdded] = useState<{ name: string; skillId: string } | null>(null);

  async function search(event: FormEvent) {
    event.preventDefault(); setBusy('search'); setError(''); setAdded(null); setResults([]);
    try { const data = await api.searchCatalog(query.trim()); setResults(data.skills); setSearched(true); }
    catch (cause) { setError(errorMessage(cause, 'Search failed. Try again.')); setSearched(false); }
    finally { setBusy(''); }
  }
  async function review(skill: CatalogSkill) {
    setBusy(`${skill.source}/${skill.slug}`); setError(''); setImportError(''); setAdded(null);
    try { setPreview(await api.previewImport(skill)); }
    catch (cause) { setError(errorMessage(cause, 'Could not load this skill. Try again.')); }
    finally { setBusy(''); }
  }
  async function install() {
    if (!preview) return;
    setBusy('install'); setImportError('');
    try { const result = await api.installImport(preview.token); setAdded(result); setPreview(null); refresh(); }
    catch (cause) { setImportError(errorMessage(cause, 'Could not add the skill. Try again.')); }
    finally { setBusy(''); }
  }
  return <div className="discover-page">
    <header className="page-header"><div><h1>Find skills</h1><p>Search skills.sh or paste a skill link to add it to your library.</p></div></header>
    <form className="catalog-search" onSubmit={(event) => { void search(event); }}>
      <label className="sr-only" htmlFor="catalog-query">Search skills or paste a skills.sh link</label>
      <input id="catalog-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try react, testing, or a skills.sh link" required minLength={2} maxLength={300} disabled={!!busy} />
      <button className="primary" disabled={!!busy || query.trim().length < 2}>{busy === 'search' ? 'Searching…' : 'Search'}</button>
    </form>
    {error ? <p className="inline-feedback" role="alert">{error}</p> : null}
    {added ? <p className="catalog-success" role="status">{added.name} added to your library. <Link to={added.skillId ? `/skills/${encodeURIComponent(added.skillId)}` : '/skills?scope=global'}>Open skill</Link></p> : null}
    <div aria-live="polite" className="catalog-status">
      {busy === 'search' ? 'Searching skills.sh…' : busy && busy !== 'install' ? 'Preparing the complete skill folder for review…' : searched ? results.length ? `${results.length} ${results.length === 1 ? 'result' : 'results'} from skills.sh` : 'No skills found. Try another keyword or paste a skills.sh link.' : !error ? 'Find a skill by what you want it to do, then review it before adding.' : ''}
    </div>
    {!searched && !error ? <h2 className="catalog-suggestions-heading">Suggested skills</h2> : null}
    <ul className="catalog-results">
      {(searched || error ? results : catalogSuggestions).map((skill) => <li key={`${skill.source}/${skill.slug}`}>
        <div className="catalog-result-copy"><h2>{skill.name}</h2>{'description' in skill ? <p className="catalog-suggestion-description">{String(skill.description)}</p> : null}<a href={`https://skills.sh/${skill.source}/${skill.slug}`} target="_blank" rel="noreferrer">{skill.source}<span className="sr-only"> on skills.sh (opens in a new tab)</span></a></div>
        <button aria-disabled={!!busy} aria-label={`Review ${skill.name} from ${skill.source}`} onClick={() => { if (!busy) void review(skill); }}>{busy === `${skill.source}/${skill.slug}` ? 'Loading…' : 'Review'}</button>
      </li>)}
    </ul>
    {preview ? <Dialog title="Review skill" description={preview.source} busy={busy === 'install'} onClose={() => setPreview(null)}>
      <div className="catalog-review">
        <div><h3>{preview.name}</h3><p>{preview.description}</p></div>
        <div className="catalog-destination"><span>Destination: Global hub</span><code>{preview.destination}</code></div>
        <details><summary>{preview.files.length} files · View contents</summary><ul>{preview.files.map((file) => <li key={file}>{file}</li>)}</ul></details>
        <details open><summary>Skill instructions</summary>
          {/* Keyboard users need to focus this scrollable instruction region. */}
          <div role="region" aria-label="Skill instruction content" className="catalog-instructions" tabIndex={0}>{preview.instructions}</div>
        </details>
        <p className="catalog-note">The complete skill folder is added to your hub. You can share it with agents from the library.</p>
        <a className="catalog-source" href={`https://github.com/${preview.source}/tree/${preview.commit}`} target="_blank" rel="noreferrer">View source revision<span className="sr-only"> (opens in a new tab)</span></a>
        {preview.existing ? <p role="status">This skill is already in your hub. Your existing files will be kept.</p> : null}
        {importError ? <p className="inline-feedback" role="alert">{importError}</p> : null}
        <div className="dialog-actions"><button disabled={busy === 'install'} onClick={() => setPreview(null)}>Cancel</button><button className="primary" disabled={preview.existing || busy === 'install'} onClick={() => { void install(); }}>{busy === 'install' ? 'Adding…' : 'Add to library'}</button></div>
      </div>
    </Dialog> : null}
  </div>;
}
