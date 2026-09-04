/** One headline number with its label and a one-line caption for context. */
export function StatTile({
  label,
  value,
  unit,
  caption,
}: {
  label: string;
  value: string;
  unit?: string;
  caption: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-panel border border-line bg-surface px-4 py-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
        {label}
      </span>
      {/* Proportional figures on purpose: tabular digits look loose at this size */}
      <span className="text-2xl font-semibold leading-tight text-foreground">
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-muted">{unit}</span>}
      </span>
      <span className="font-mono text-[11px] leading-snug text-muted">{caption}</span>
    </div>
  );
}
