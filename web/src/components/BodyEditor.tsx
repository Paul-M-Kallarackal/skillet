import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';

export function BodyEditor(props: { value: string; onChange: (next: string) => void; readOnly: boolean }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
      <CodeMirror
        value={props.value}
        height="440px"
        extensions={[markdown()]}
        readOnly={props.readOnly}
        onChange={props.onChange}
        basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: false }}
      />
    </div>
  );
}
