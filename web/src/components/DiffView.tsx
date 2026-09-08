export function DiffView(props: { patch: string }) {
  const lines = props.patch.split('\n');
  let changed = 0;
  for (const line of lines) {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      changed += 1;
    }
    if (line.startsWith('-') && !line.startsWith('---')) {
      changed += 1;
    }
  }
  return (
    <div>
      {changed === 0 ? (
        <div style={{ color: 'var(--green)', marginTop: 12 }}>These two copies are identical.</div>
      ) : null}
      <pre
        style={{
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: 12,
          overflowX: 'auto',
          background: 'var(--bg-subtle)',
          margin: '12px 0 0'
        }}
      >
        {lines.map((line, position) => {
          let color = 'var(--text)';
          if (line.startsWith('+') && !line.startsWith('+++')) {
            color = 'var(--green)';
          }
          if (line.startsWith('-') && !line.startsWith('---')) {
            color = 'var(--red)';
          }
          if (line.startsWith('@@')) {
            color = 'var(--accent)';
          }
          return (
            <div key={`${position}-${line.slice(0, 16)}`} style={{ color }}>
              {line}
            </div>
          );
        })}
      </pre>
    </div>
  );
}
