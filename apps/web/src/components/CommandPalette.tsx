import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIndex } from '../app/IndexProvider';
import { Dialog } from './Dialog';
import { presentSkill } from './skill-presentation';

export function CommandPalette() {
  const { index } = useIndex();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (!open && document.querySelector('dialog[open]')) return;
        setOpen((current) => !current);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (index?.skills ?? []).map((skill) => ({ skill, presentation: presentSkill(skill) }))
      .filter(({ skill, presentation }) => `${skill.name} ${presentation.title} ${presentation.summary}`.toLowerCase().includes(needle))
      .slice(0, 12);
  }, [index, query]);

  if (!open) return null;
  return (
    <Dialog title="Find a skill" onClose={() => setOpen(false)}>
      <label className="palette-search">Search by task or skill name
        <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Jump to a skill" />
      </label>
      <div className="palette-results">
        {matches.map(({ skill, presentation }) => (
          <button className="palette-result" key={skill.id} onClick={() => {
            setOpen(false);
            setQuery('');
            navigate(`/skills/${encodeURIComponent(skill.id)}`);
          }}>
            <strong>{presentation.title}</strong><span>{skill.name}</span>
          </button>
        ))}
        {matches.length === 0 ? <p role="status">No matches. Try a task such as “design” or “accessibility”.</p> : null}
      </div>
    </Dialog>
  );
}
