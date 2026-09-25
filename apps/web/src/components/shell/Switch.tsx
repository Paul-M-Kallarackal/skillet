export function Switch({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean }) {
  let className = 'shell-switch';
  if (checked) {
    className += ' is-on';
  }
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={className} disabled={disabled} onClick={() => onChange(!checked)}>
      <span className="shell-switch-knob" aria-hidden="true" />
    </button>
  );
}
