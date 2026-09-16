"use client";

/** The form controls shared by setup and Settings, so both look and behave the same. */

export function Field({
  label,
  unit,
  value,
  onChange,
  inputMode = "numeric",
  type = "text",
  autoComplete,
}: {
  label: string;
  unit?: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: "numeric" | "decimal" | "text";
  type?: "text" | "password";
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted">{label}</span>
      <span className="relative block">
        <input
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-panel border border-line bg-surface py-2.5 pl-4 font-mono text-[15px] tabular-nums text-foreground focus:border-accent focus:outline-none ${
            unit ? "pr-12" : "pr-4"
          }`}
        />
        {unit && (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted">
            {unit}
          </span>
        )}
      </span>
    </label>
  );
}

export function Choice({
  selected,
  label,
  hint,
  onSelect,
}: {
  selected: boolean;
  label: string;
  hint: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`flex w-full items-start gap-3 rounded-panel border px-3 py-2.5 text-left transition-colors ${
        selected ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-muted/60"
      }`}
    >
      <span
        aria-hidden
        className={`mt-1 h-4 w-4 shrink-0 rounded-full border-2 ${
          selected ? "border-accent bg-accent" : "border-line"
        }`}
      />
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
    </button>
  );
}

/** A pill row where exactly one option is picked, e.g. sex or goal. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex rounded-full border border-line bg-surface p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`flex-1 rounded-full py-2 text-[13px] font-semibold transition-colors ${
            value === option.value ? "bg-accent text-background" : "text-muted"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
