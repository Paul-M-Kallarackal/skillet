import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function MarkdownView({ value }: { value: string }) {
  return <div className="skill-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{
    a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a>,
    img: ({ alt }) => <span className="markdown-image-description">{alt || 'Image'}</span>
  }}>{value}</ReactMarkdown></div>;
}
