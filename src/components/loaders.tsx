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

function GhostBar({ className }: { className: string }) {
  return <div className={`rounded bg-neutral-200 dark:bg-neutral-800 ${className}`} />;
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
      className="overflow-hidden rounded-2xl border border-neutral-200 bg-white motion-safe:animate-pulse dark:border-neutral-800 dark:bg-neutral-900"
    >
      <header className="flex items-center gap-2 border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {label}
        </span>
      </header>
      <ul className="divide-y divide-neutral-100 dark:divide-neutral-800/60" aria-hidden>
        {[0, 1, 2].map((i) => (
          <li key={i} className="px-3 py-2.5">
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
        className="flex items-center justify-between gap-2 border-t-2 border-neutral-300 px-3 py-3 dark:border-neutral-700"
        aria-hidden
      >
        <GhostBar className="h-5 w-24" />
        <GhostBar className="h-3 w-28" />
      </footer>
    </section>
  );
}
