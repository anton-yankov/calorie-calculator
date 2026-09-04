"use client";

/** Inline spinner for button-level action feedback. Static under prefers-reduced-motion. */
export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={`motion-safe:animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GhostBar({ className, style }: { className: string; style?: React.CSSProperties }) {
  return <div className={`ghost-shimmer rounded bg-line ${className}`} style={style} />;
}

/** Ghost version of the meal-log list: one day header + a few entry rows. */
export function SkeletonLog() {
  return (
    <div role="status" aria-label="Meal log loading" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between px-1" aria-hidden>
        <GhostBar className="h-3.5 w-16" />
        <GhostBar className="h-3.5 w-36" />
      </div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          aria-hidden
          className="flex items-center gap-3 rounded-panel border border-line bg-surface px-4 py-3"
        >
          <GhostBar className="h-12 w-12 rounded-lg" />
          <div className="min-w-0 flex-1">
            <GhostBar className={`h-4 ${i === 1 ? "w-40" : "w-28"}`} />
            <GhostBar className="mt-1.5 h-3 w-12" />
          </div>
          <div className="flex flex-col items-end">
            <GhostBar className="h-4 w-16" />
            <GhostBar className="mt-1.5 h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Ghost version of the product library: a count line + a few product cards. */
export function SkeletonProducts() {
  return (
    <div role="status" aria-label="Products loading" className="flex flex-col gap-3">
      <div aria-hidden>
        <GhostBar className="h-3.5 w-20" />
      </div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          aria-hidden
          className="overflow-hidden rounded-panel border border-line bg-surface"
        >
          <div className="flex items-start gap-4 p-4">
            <GhostBar className="h-[72px] w-[72px] rounded-lg" />
            <div className="min-w-0 flex-1">
              <GhostBar className={`h-5 ${i === 1 ? "w-48" : "w-36"}`} />
              <GhostBar className="mt-2 h-3 w-28" />
            </div>
            <GhostBar className="h-7 w-14" />
          </div>
          <div className="px-4 pb-4">
            <GhostBar className="h-1.5 w-full" />
            <GhostBar className="mt-2.5 h-3 w-56" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Ghost version of AnalysisCard, shown wherever an estimate is about to land —
 * first analysis and correction re-analysis alike. Same footprint as the real
 * card so the result "fills in" instead of popping from nowhere.
 */
export function SkeletonEstimate({ label }: { label: string }) {
  return (
    <section
      role="status"
      aria-label={`${label} loading`}
      className="overflow-hidden rounded-panel border border-line bg-surface"
    >
      <header className="flex items-center gap-2 border-b border-line bg-surface-raised px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
          {label}
        </span>
      </header>
      <ul className="divide-y divide-line" aria-hidden>
        {[0, 1, 2].map((i) => (
          <li key={i} className="px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <GhostBar className={`h-4 ${i === 1 ? "w-44" : "w-32"}`} />
              <GhostBar className="h-7 w-14 rounded-md" />
            </div>
            <GhostBar className="mt-1.5 h-3 w-40" />
            <div className="mt-2 flex items-center justify-between gap-2">
              <GhostBar className="h-3.5 w-16" />
              <GhostBar className="h-3 w-28" />
            </div>
          </li>
        ))}
      </ul>
      <footer
        className="flex items-center justify-between gap-2 border-t-2 border-foreground px-4 py-3"
        aria-hidden
      >
        <GhostBar className="h-5 w-24" />
        <GhostBar className="h-3 w-28" />
      </footer>
    </section>
  );
}

const GHOST_BARS = [62, 78, 55, 84, 70, 66, 88, 74, 58, 80, 68, 76, 64, 82];

/**
 * Ghost version of the stats page: range pill and four tiles in one column,
 * two chart frames in the other. `contents` lets the page grid place the two
 * columns itself, exactly where StatsView's columns land.
 */
export function SkeletonStats() {
  return (
    <div role="status" aria-label="Stats loading" className="contents">
      <div className="flex flex-col gap-4" aria-hidden>
        <GhostBar className="h-9 w-44 rounded-full" />
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-panel border border-line bg-surface px-4 py-3">
              <GhostBar className="h-2.5 w-20" />
              <GhostBar className={`mt-2.5 h-7 ${i % 2 ? "w-14" : "w-20"}`} />
              <GhostBar className="mt-2.5 h-2.5 w-28" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4" aria-hidden>
        {[0, 1].map((i) => (
          <div key={i} className="rounded-panel border border-line bg-surface px-4 pb-3 pt-3">
            <GhostBar className="h-3.5 w-32" />
            <div className="mt-4 flex h-44 items-end gap-1.5">
              {GHOST_BARS.map((h, j) => (
                <GhostBar key={j} className="flex-1 rounded-t" style={{ height: `${h}%` }} />
              ))}
            </div>
            <GhostBar className="mt-3 h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
