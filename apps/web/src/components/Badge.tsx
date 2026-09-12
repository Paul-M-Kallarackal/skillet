import { CheckCircle2, CircleAlert, CircleHelp } from 'lucide-react';
import { Chip } from './Chip';

export type BadgeTone = 'neutral' | 'green' | 'amber' | 'red' | 'accent';

export function Badge({ children, tone, title }: { children: string; tone: BadgeTone; title: string }) {
  if (tone === 'neutral' || tone === 'accent') return <Chip accent={tone === 'accent'} title={title}>{children}</Chip>;
  const Icon = tone === 'green' ? CheckCircle2 : tone === 'red' ? CircleAlert : CircleHelp;
  return <span className={`status-label status-${tone}`} title={title}><Icon aria-hidden="true" />{children}</span>;
}
