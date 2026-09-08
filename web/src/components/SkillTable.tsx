import { Link } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { Badge } from './Badge';
import type { Skill, VisibilityCell } from '../api/client.types';

const clampStyle: CSSProperties = {
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden'
};

function scopeLabel(skill: Skill): string {
  if (skill.scope === 'global') {
    return 'global';
  }
  if (skill.scope === 'plugin') {
    return skill.pluginName.split('@')[0] ?? skill.pluginName;
  }
  return skill.repoName;
}

function visibleNames(cells: VisibilityCell[]): string[] {
  const names: string[] = [];
  for (const cell of cells) {
    if (cell.state === 'not-linked' || cell.state === 'n-a' || cell.state === 'off') {
      continue;
    }
    names.push(cell.agentName);
  }
  return names;
}

export function SkillTable(props: { skills: Skill[]; cells: Record<string, VisibilityCell[]> }) {
  if (props.skills.length === 0) {
    return <div style={{ color: 'var(--text-muted)', padding: '24px 0' }}>No skills match this view.</div>;
  }
  return (
    <table>
      <thead>
        <tr>
          <th style={{ width: '24%' }}>Name</th>
          <th>Description</th>
          <th style={{ width: 120 }}>Scope</th>
          <th style={{ width: 210 }}>Visible to</th>
          <th style={{ width: 140 }}>Flags</th>
        </tr>
      </thead>
      <tbody>
        {props.skills.map((skill) => {
          let cells = props.cells[skill.id];
          if (!cells) {
            cells = [];
          }
          const visible = visibleNames(cells);
          let errorCount = 0;
          for (const error of skill.errors) {
            if (error.severity === 'error') {
              errorCount += 1;
            }
          }
          return (
            <tr key={skill.id}>
              <td>
                <Link to={`/skills/${encodeURIComponent(skill.id)}`} style={{ color: 'var(--accent)' }}>
                  {skill.name}
                </Link>
                {skill.instances.length > 1 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                    {`${skill.instances.length} copies`}
                  </div>
                ) : null}
              </td>
              <td style={{ color: 'var(--text-muted)' }}>
                <div style={clampStyle}>{skill.description}</div>
              </td>
              <td>{scopeLabel(skill)}</td>
              <td>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {visible.map((name) => (
                    <Badge key={name} tone="neutral" title="can read this skill">
                      {name}
                    </Badge>
                  ))}
                  {visible.length === 0 ? (
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>no agent</span>
                  ) : null}
                </div>
              </td>
              <td>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {skill.diverged ? (
                    <Badge tone="amber" title="copies of this skill differ">
                      diverged
                    </Badge>
                  ) : null}
                  {skill.shadowed ? (
                    <Badge tone="amber" title="a global skill of the same name takes priority">
                      shadowed
                    </Badge>
                  ) : null}
                  {errorCount > 0 ? (
                    <Badge tone="red" title="frontmatter validation errors">
                      invalid
                    </Badge>
                  ) : null}
                  {skill.scope === 'plugin' ? (
                    <Badge tone="accent" title="read-only plugin skill">
                      plugin
                    </Badge>
                  ) : null}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
