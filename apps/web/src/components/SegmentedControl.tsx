import { SkipForward } from 'lucide-react';

export function SegmentedControl<T extends string>({ label, value, options, disabled = false, onChange }: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; disabled?: boolean }[];
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  return <div className="segmented-control" role="group" aria-label={label}>
    {options.map((option) => <button type="button" key={option.value} aria-pressed={value === option.value} disabled={disabled || option.disabled} onClick={() => onChange(option.value)}>
      {disabled || option.disabled ? <SkipForward aria-hidden="true" /> : null}{option.label}
    </button>)}
  </div>;
}
