import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { useIndex } from '../app/IndexProvider';
import { Badge } from '../components/Badge';
import { ContentTab } from '../components/ContentTab';
import { HistoryList } from '../components/HistoryList';
import { InstanceList } from '../components/InstanceList';
import { TriggerPanel } from '../components/TriggerPanel';
import { VisibilityGrid } from '../components/VisibilityGrid';
import type { Skill, SkillInstance, VisibilityCell } from '../api/client.types';

type TabKey = 'content' | 'visibility' | 'instances' | 'triggers' | 'history';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'content', label: 'Content' },
  { key: 'visibility', label: 'Visibility' },
  { key: 'instances', label: 'Instances' },
  { key: 'triggers', label: 'Triggers' },
  { key: 'history', label: 'History' }
];

const pathStyle: CSSProperties = {
  color: 'var(--text-muted)',
  fontFamily: 'var(--mono)',
  fontSize: 12,
  marginBottom: 18,
  wordBreak: 'break-all'
};

export function SkillDetailPage() {
  const params = useParams();
  const { index } = useIndex();
  const [tab, setTab] = useState<TabKey>('content');
  let skillId = '';
  if (params.id) {
    skillId = decodeURIComponent(params.id);
  }

  const skill = useMemo<Skill | null>(() => {
    if (!index) {
      return null;
    }
    for (const candidate of index.skills) {
      if (candidate.id === skillId) {
        return candidate;
      }
    }
    return null;
  }, [index, skillId]);

  if (!index) {
    return <div>Scanning your machine...</div>;
  }
  if (!skill) {
    return (
      <div>
        <div style={{ marginBottom: 8 }}>{`This skill is no longer on disk: ${skillId}`}</div>
        <Link to="/skills" style={{ color: 'var(--accent)' }}>
          Back to all skills
        </Link>
      </div>
    );
  }

  let cells: VisibilityCell[] = [];
  const found = index.cells[skill.id];
  if (found) {
    cells = found;
  }

  let canonical: SkillInstance | null = null;
  for (const instance of skill.instances) {
    if (instance.id === skill.canonicalId) {
      canonical = instance;
    }
  }
  if (!canonical) {
    const head = skill.instances[0];
    if (head) {
      canonical = head;
    }
  }

  let breadcrumb: string = skill.scope;
  if (skill.repoName.length > 0) {
    breadcrumb = `${skill.scope} / ${skill.repoName}`;
  }
  if (skill.scope === 'plugin') {
    breadcrumb = `plugin / ${skill.pluginName}`;
  }

  return (
    <div>
      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
        <Link to="/skills" style={{ color: 'var(--text-muted)' }}>
          Skills
        </Link>
        {` / ${breadcrumb}`}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '6px 0 4px', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 21, margin: 0 }}>{skill.name}</h1>
        {skill.diverged ? (
          <Badge tone="amber" title="the copies of this skill differ">
            diverged
          </Badge>
        ) : null}
        {skill.shadowed ? (
          <Badge tone="amber" title="a global skill of the same name takes priority">
            shadowed
          </Badge>
        ) : null}
        {skill.scope === 'plugin' ? (
          <Badge tone="accent" title="read-only">
            plugin
          </Badge>
        ) : null}
      </div>
      <div style={pathStyle}>{canonical ? canonical.absPath : ''}</div>

      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', marginBottom: 22 }}>
        {TABS.map((entry) => {
          let borderBottom = '2px solid transparent';
          let color = 'var(--text-muted)';
          if (entry.key === tab) {
            borderBottom = '2px solid var(--accent)';
            color = 'var(--text)';
          }
          return (
            <button
              key={entry.key}
              onClick={() => setTab(entry.key)}
              style={{ border: 'none', borderBottom, borderRadius: 0, color, padding: '6px 12px' }}
            >
              {entry.label}
            </button>
          );
        })}
      </div>

      {tab === 'content' ? <ContentTab skill={skill} /> : null}
      {tab === 'visibility' ? <VisibilityGrid skill={skill} cells={cells} /> : null}
      {tab === 'instances' ? <InstanceList skill={skill} /> : null}
      {tab === 'triggers' ? <TriggerPanel skill={skill} cells={cells} /> : null}
      {tab === 'history' ? <HistoryList skillId={skill.id} /> : null}
    </div>
  );
}
