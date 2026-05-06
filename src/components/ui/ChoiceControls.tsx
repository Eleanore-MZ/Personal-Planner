type ChoiceOption<Value extends string> = {
  value: Value;
  label: string;
  disabled?: boolean;
};

type SegmentedControlProps<Value extends string> = {
  ariaLabel: string;
  options: Array<ChoiceOption<Value>>;
  value: Value | "";
  onChange: (value: Value) => void;
  compact?: boolean;
};

export function SegmentedControl<Value extends string>({
  ariaLabel,
  options,
  value,
  onChange,
  compact = false,
}: SegmentedControlProps<Value>) {
  return (
    <div
      aria-label={ariaLabel}
      className={`segmented-control${compact ? " compact" : ""}`}
      role="group"
    >
      {options.map((option) => (
        <button
          aria-pressed={value === option.value}
          className={value === option.value ? "active" : ""}
          disabled={option.disabled}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

type ToggleRowProps = {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
};

export function ToggleRow({
  checked,
  disabled = false,
  label,
  onChange,
}: ToggleRowProps) {
  return (
    <label className="toggle-row">
      <input
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span className="toggle-row-track" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}
