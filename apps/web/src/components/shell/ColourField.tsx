import { useEffect, useState } from 'react';

const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;

export function ColourField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = (next: string) => {
    let normalized = next.trim();
    if (!normalized.startsWith('#')) {
      normalized = `#${normalized}`;
    }
    if (HEX_COLOUR.test(normalized)) {
      onChange(normalized.toUpperCase());
      return;
    }
    setDraft(value);
  };

  return (
    <span className="shell-colour-field">
      <span className="shell-colour-swatch-wrap" style={{ background: value }}>
        <input type="color" aria-label={`${label} colour picker`} value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} />
      </span>
      <input className="shell-colour-hex" aria-label={`${label} hex value`} value={draft} spellCheck={false} onChange={(event) => setDraft(event.target.value)} onBlur={(event) => commit(event.target.value)} onKeyDown={(event) => {
        if (event.key === 'Enter') {
          commit(event.currentTarget.value);
        }
      }} />
    </span>
  );
}
