export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export function SegmentedTabs<T extends string>({ value, options, onChange, label }: { value: T; options: SegmentedOption<T>[]; onChange: (value: T) => void; label: string }) {
  return (
    <div className="shell-segmented" role="tablist" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" role="tab" aria-selected={option.value === value} className="shell-segmented-tab" onClick={() => onChange(option.value)}>
          {option.label}
          {option.count !== undefined && <span className="shell-segmented-count">{option.count}</span>}
        </button>
      ))}
    </div>
  );
}
