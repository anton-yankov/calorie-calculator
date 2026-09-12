"use client";

import { DRINK_TYPES, DRINK_LABELS, type DrinkType } from "@/lib/water";

/** Optional correction; detection always supplies the initial value. */
export function DrinkTypeSelect({
  value,
  onChange,
  disabled,
  name = "item",
}: {
  value: DrinkType | null;
  onChange: (value: DrinkType | null) => void;
  disabled?: boolean;
  name?: string;
}) {
  return (
    <label className="flex flex-wrap items-center gap-2 text-xs text-muted">
      Counts toward Water
      <select
        aria-label={`Water category for ${name}`}
        value={value ?? "food"}
        disabled={disabled}
        onChange={(event) =>
          onChange(event.target.value === "food" ? null : (event.target.value as DrinkType))
        }
        className="max-w-full rounded-md border border-line bg-background px-2 py-1.5 text-xs text-foreground focus:border-accent focus:outline-none"
      >
        <option value="food">No — food / ingredient</option>
        {DRINK_TYPES.map((type) => (
          <option key={type} value={type}>
            {DRINK_LABELS[type]}
          </option>
        ))}
      </select>
    </label>
  );
}
