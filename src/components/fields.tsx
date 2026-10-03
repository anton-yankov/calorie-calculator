"use client";

import { Check } from "lucide-react";

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
      <span className="mb-1.5 block text-[12.5px] font-semibold text-muted">{label}</span>
      <span className="relative block">
        <input
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`h-12 w-full rounded-panel border-[1.5px] border-line bg-background pl-4 text-[15px] tabular-nums text-foreground transition-colors focus:border-accent focus:outline-none ${
            unit ? "pr-12" : "pr-4"
          }`}
        />
        {unit && (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted">
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
  icon,
  onSelect,
}: {
  selected: boolean;
  label: string;
  hint: string;
  /** Shown in a tile at the start, e.g. the goal's arrow */
  icon?: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`flex min-h-15 w-full items-center gap-3 rounded-[18px] border-2 px-4 py-3 text-left transition-colors ${
        selected
          ? "border-accent bg-accent-soft"
          : "border-transparent bg-surface hover:border-line"
      }`}
    >
      {icon && (
        <span
          aria-hidden
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px] bg-surface-raised text-accent"
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold leading-snug">{label}</span>
        <span className="block text-[12.5px] text-muted">{hint}</span>
      </span>
      {/* A visible radio, so it's obvious which card is picked */}
      <span
        aria-hidden
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
          selected ? "border-accent bg-accent text-background" : "border-line-strong"
        }`}
      >
        {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </span>
    </button>
  );
}

/** Equal-width buttons where exactly one is picked, e.g. sex or goal. */
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
    <div className="grid auto-cols-fr grid-flow-col gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`h-12 rounded-panel border-2 text-[15px] font-bold transition-colors ${
            value === option.value
              ? "border-accent bg-accent-soft text-foreground"
              : "border-transparent bg-surface text-muted hover:text-foreground"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
