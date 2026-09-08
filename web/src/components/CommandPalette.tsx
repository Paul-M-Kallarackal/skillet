import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { useIndex } from '../app/IndexProvider';

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.35)',
  zIndex: 60,
  paddingTop: '12vh'
};

const panelStyle: CSSProperties = {
  width: 560,
  maxWidth: '92vw',
  margin: '0 auto',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  overflow: 'hidden',
  boxShadow: '0 12px 40px rgba(0,0,0,0.25)'
};

export function CommandPalette() {
  const { index } = useIndex();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
        return;
      }
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const matches = useMemo(() => {
    if (!index) {
      return [];
    }
    const needle = query.trim().toLowerCase();
    const out: { id: string; label: string }[] = [];
    for (const skill of index.skills) {
      if (out.length >= 12) {
        break;
      }
      if (needle.length > 0 && !skill.name.toLowerCase().includes(needle)) {
        continue;
      }
      let suffix: string = skill.scope;
      if (skill.repoName.length > 0) {
        suffix = skill.repoName;
      }
      if (skill.scope === 'plugin') {
        suffix = skill.pluginName;
      }
      out.push({ id: skill.id, label: `${skill.name}  ${suffix}` });
    }
    return out;
  }, [index, query]);

  if (!open) {
    return null;
  }

  return (
    <div style={backdropStyle} onClick={() => setOpen(false)}>
      <div style={panelStyle} onClick={(event) => event.stopPropagation()}>
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Jump to a skill"
          style={{
            width: '100%',
            padding: '12px 14px',
            border: 'none',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text)',
            font: 'inherit',
            fontSize: 15
          }}
        />
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {matches.map((match) => (
            <button
              key={match.id}
              onClick={() => {
                setOpen(false);
                setQuery('');
                navigate(`/skills/${encodeURIComponent(match.id)}`);
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                border: 'none',
                borderRadius: 0,
                padding: '8px 14px'
              }}
            >
              {match.label}
            </button>
          ))}
          {matches.length === 0 ? (
            <div style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>No matches</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
