import type { CSSProperties } from 'react';
import type { SkillFrontmatter } from '../api/client.types';

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  background: 'var(--bg)',
  color: 'var(--text)',
  font: 'inherit'
};

const labelStyle: CSSProperties = { display: 'grid', gap: 4 };
const captionStyle: CSSProperties = { color: 'var(--text-muted)', fontSize: 12 };

function splitCommaList(value: string): string[] {
  const next: string[] = [];
  for (const part of value.split(',')) {
    const trimmed = part.trim();
    if (trimmed.length > 0) {
      next.push(trimmed);
    }
  }
  return next;
}

export function FrontmatterForm(props: {
  value: SkillFrontmatter;
  onChange: (next: SkillFrontmatter) => void;
  readOnly: boolean;
}) {
  const set = (patch: Partial<SkillFrontmatter>) => {
    props.onChange({ ...props.value, ...patch });
  };

  const extraKeys: string[] = [];
  for (const key of Object.keys(props.value.extras)) {
    extraKeys.push(key);
  }

  let descriptionColor = 'var(--text-muted)';
  if (props.value.description.length > 1024) {
    descriptionColor = 'var(--red)';
  }

  return (
    <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
      <label style={labelStyle}>
        <span style={captionStyle}>name</span>
        <input
          value={props.value.name}
          readOnly={props.readOnly}
          onChange={(event) => set({ name: event.target.value })}
          style={inputStyle}
        />
      </label>
      <label style={labelStyle}>
        <span style={{ ...captionStyle, color: descriptionColor }}>
          {`description (${props.value.description.length} of 1024)`}
        </span>
        <textarea
          value={props.value.description}
          readOnly={props.readOnly}
          rows={3}
          onChange={(event) => set({ description: event.target.value })}
          style={inputStyle}
        />
      </label>
      <label style={labelStyle}>
        <span style={captionStyle}>paths, comma separated globs, empty means always</span>
        <input
          value={props.value.paths.join(',')}
          readOnly={props.readOnly}
          onChange={(event) => set({ paths: splitCommaList(event.target.value) })}
          style={inputStyle}
        />
      </label>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={props.value.disableModelInvocation}
            disabled={props.readOnly}
            onChange={(event) => set({ disableModelInvocation: event.target.checked })}
          />
          disable-model-invocation
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={props.value.userInvocable}
            disabled={props.readOnly}
            onChange={(event) => set({ userInvocable: event.target.checked })}
          />
          user-invocable
        </label>
      </div>
      <label style={labelStyle}>
        <span style={captionStyle}>allowed-tools</span>
        <input
          value={props.value.allowedTools}
          readOnly={props.readOnly}
          onChange={(event) => set({ allowedTools: event.target.value })}
          style={inputStyle}
        />
      </label>
      {extraKeys.length > 0 ? (
        <div style={captionStyle}>{`other keys preserved on save: ${extraKeys.join(', ')}`}</div>
      ) : null}
    </div>
  );
}
