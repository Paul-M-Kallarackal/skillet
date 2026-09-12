import type { CSSProperties } from 'react';
import type { SkillFrontmatter } from '../api/client.types';

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius)',
  background: 'var(--bg-surface)',
  color: 'var(--text)',
  font: 'inherit'
};

const labelStyle: CSSProperties = { display: 'grid', gap: 7 };
const captionStyle: CSSProperties = { color: 'var(--text-muted)', fontSize: 12 };

export function FrontmatterForm(props: {
  value: SkillFrontmatter;
  onChange: (next: SkillFrontmatter) => void;
  readOnly: boolean;
}) {
  const set = (patch: Partial<SkillFrontmatter>) => {
    props.onChange({ ...props.value, ...patch });
  };

  let descriptionColor = 'var(--text-muted)';
  if (props.value.description.length > 1024) {
    descriptionColor = 'var(--red)';
  }

  return (
    <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
      <label style={labelStyle}>
        <span style={{ ...captionStyle, color: descriptionColor }}>Description</span>
        <textarea
          value={props.value.description}
          readOnly={props.readOnly}
          rows={2}
          onChange={(event) => set({ description: event.target.value })}
          style={inputStyle}
        />
      </label>
    </div>
  );
}
