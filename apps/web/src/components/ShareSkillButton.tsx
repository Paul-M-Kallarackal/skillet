import { lazy, Suspense, useState } from 'react';
import { Share2 } from 'lucide-react';
import type { Skill } from '../api/client.types';
import { IconButton } from './IconButton';
const ShareSkillDialog = lazy(() => import('./ShareSkillDialog').then((module) => ({ default: module.ShareSkillDialog })));

export function ShareSkillButton({ skill }: { skill: Skill }) {
  const [open, setOpen] = useState(false);
  return <>
    <IconButton label="Share skill" onClick={() => setOpen(true)}><Share2 aria-hidden="true" /></IconButton>
    {open ? <Suspense fallback={<span role="status">Loading…</span>}><ShareSkillDialog skill={skill} onClose={() => setOpen(false)} /></Suspense> : null}
  </>;
}
