import type { Skill } from '../api/client.types';

interface Presentation { title: string; summary: string; category: string }
const known: Record<string, Presentation> = {
  impeccable: { title: 'Polish an interface', summary: 'Improve a page’s layout, typography, colors, and overall visual clarity.', category: 'Design' },
  'emil-design-eng': { title: 'Refine UI details', summary: 'Make buttons, dialogs, and other interactions feel responsive and considered.', category: 'Design' },
  'review-animations': { title: 'Review your animations', summary: 'Check whether motion is useful, well timed, and comfortable to use.', category: 'Design' },
  'paul-website-workflow': { title: 'Design a website', summary: 'Go from a clear brief to reusable components and a browser-tested website.', category: 'Workflow' },
  'vercel-react-best-practices': { title: 'Improve React code', summary: 'Find unnecessary renders, slow data loading, and avoidable bundle weight.', category: 'Development' },
  accessibility: { title: 'Check accessibility', summary: 'Find barriers in keyboard navigation, contrast, forms, and screen-reader support.', category: 'Quality' },
  'core-web-vitals': { title: 'Improve page speed', summary: 'Investigate slow loading, delayed interactions, and unexpected layout shifts.', category: 'Quality' },
  'website-quality': { title: 'Test a website', summary: 'Check real browser behavior, accessibility, responsive layouts, and the build.', category: 'Quality' },
  'github-cli-existing-auth': { title: 'Use your GitHub login', summary: 'Reuse your existing GitHub CLI authentication without starting another device login.', category: 'Development' },
};

export function presentSkill(skill: Skill): Presentation {
  const match = known[skill.name];
  if (match) return match;
  const description = (skill.description.split(/\s+(?:Use when|Triggers? on|This skill should)/i)[0] ?? '').trim();
  return {
    title: skill.name.replace(/[-_]+/g, ' ').replace(/^./, (letter) => letter.toUpperCase()),
    summary: description || 'No summary provided. Read this skill’s instructions before using it.',
    category: 'Other',
  };
}
