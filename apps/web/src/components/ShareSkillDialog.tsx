import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Skill } from '../api/client.types';
import { Dialog } from './Dialog';
import { SegmentedControl } from './SegmentedControl';
import { useToast } from './Toaster';

export function ShareSkillDialog({ skill, onClose }: { skill: Skill; onClose: () => void }) {
  const source = skill.instances.find((entry) => entry.id === skill.canonicalId) ?? skill.instances[0];
  const markdown = source ? [`# ${skill.name}`, source.frontmatter.description, source.body].filter(Boolean).join('\n\n') : '';
  const [format, setFormat] = useState<'markdown' | 'text'>('markdown');
  const [plain, setPlain] = useState('');
  const [error, setError] = useState('');
  const rendered = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();
  useEffect(() => { setPlain(rendered.current?.innerText.trim() ?? ''); }, [markdown]);
  const text = format === 'markdown' ? markdown : plain;
  async function copy() {
    setError('');
    try { await navigator.clipboard.writeText(text); toast.push('Copied', 'ok'); onClose(); }
    catch { setError('Clipboard access is unavailable. Select and copy the text below.'); textarea.current?.focus(); textarea.current?.select(); }
  }
  return <Dialog title={`Share ${skill.name}`} onClose={onClose} footer={<button className="primary" disabled={!text} onClick={() => void copy()}>Copy</button>}>
    <div className="share-content">
      <SegmentedControl label="Copy format" value={format} options={[{ value: 'markdown', label: 'Markdown' }, { value: 'text', label: 'Plain text' }]} onChange={setFormat} />
      {error ? <p role="alert">{error}</p> : null}
      <textarea ref={textarea} className="share-message" aria-label="Text to copy" readOnly value={text} />
      <div ref={rendered} className="share-text-renderer" aria-hidden="true" inert>
        <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{
          a: ({ href, children }) => <span>{children}{href ? ` (${href})` : ''}</span>,
          img: ({ alt }) => <span>{alt || 'Image'}</span>,
          li: ({ children }) => <div>• {children}</div>
        }}>{markdown}</ReactMarkdown>
      </div>
    </div>
  </Dialog>;
}
