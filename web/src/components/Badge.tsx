export type BadgeTone = 'neutral' | 'green' | 'amber' | 'red' | 'accent';

export function Badge(props: { children: string; tone: BadgeTone; title: string }) {
  let color = 'var(--text-muted)';
  let border = 'var(--border)';
  if (props.tone === 'green') {
    color = 'var(--green)';
    border = 'var(--green)';
  }
  if (props.tone === 'amber') {
    color = 'var(--amber)';
    border = 'var(--amber)';
  }
  if (props.tone === 'red') {
    color = 'var(--red)';
    border = 'var(--red)';
  }
  if (props.tone === 'accent') {
    color = 'var(--accent)';
    border = 'var(--accent)';
  }
  return (
    <span
      title={props.title}
      style={{
        color,
        border: `1px solid ${border}`,
        borderRadius: 999,
        padding: '1px 7px',
        fontSize: 11,
        whiteSpace: 'nowrap',
        display: 'inline-block'
      }}
    >
      {props.children}
    </span>
  );
}
