import { api } from '../api/client';
import { useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useIndex } from '../app/IndexProvider';
import { ContentTab } from '../components/ContentTab';
import { Dialog } from '../components/Dialog';
import { SkillsPage } from './SkillsPage';
import type { Skill } from '../api/client.types';

export function SkillDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const { index, refresh } = useIndex();
  const skillId = params.id ?? '';
  const skill = index?.skills.find((entry) => entry.id === skillId);
  return <><SkillsPage /><Dialog title={skill?.name ?? 'Skill'} wide onRename={skill && skill.scope !== 'plugin' ? async (newName) => {
    await api.rename(skill.id, { newName, dryRun: false });
    refresh();
    navigate(`/skills/${encodeURIComponent(skill.id.slice(0, skill.id.lastIndexOf(':') + 1) + newName)}`, { replace: true });
  } : undefined} onClose={() => navigate('/skills')}><SkillDetails key={skillId} skillId={skillId} /></Dialog></>;
}

function SkillDetails({ skillId }: { skillId: string }) {
  const { index } = useIndex();
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

  return <ContentTab skill={skill} />;
}
