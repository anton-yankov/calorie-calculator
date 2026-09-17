"use client";

import { usePathname } from "next/navigation";
import { createContext, use, useCallback, useEffect, useState } from "react";
import { aiAllowanceAction } from "@/app/actions";
import type { AiAllowance } from "@/lib/ai-usage";

/** At this many left or fewer, the counter turns amber. */
const LOW_LEFT = 3;

interface AllowanceContext {
  /** null until loaded, and on pages without an account (login) */
  allowance: AiAllowance | null;
  /** Re-reads the count, e.g. after an AI request */
  refresh: () => void;
}

const Context = createContext<AllowanceContext>({ allowance: null, refresh: () => {} });

/**
 * Today's AI analyses for the nav counter and the AI controls. Mounted in the
 * root layout, above the nav and the analysis state. The count is re-read on
 * every navigation, when the tab comes back into view (it may be past midnight),
 * and whenever an AI request finishes.
 */
export function AiAllowanceProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [allowance, setAllowance] = useState<AiAllowance | null>(null);

  const refresh = useCallback(() => {
    void aiAllowanceAction().then((result) => setAllowance(result.allowance ?? null));
  }, []);

  useEffect(() => {
    if (pathname === "/login") return;
    refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [pathname, refresh]);

  return <Context value={{ allowance, refresh }}>{children}</Context>;
}

export function useAiAllowance(): AllowanceContext & { capReached: boolean } {
  const context = use(Context);
  const { allowance } = context;
  return {
    ...context,
    capReached: allowance !== null && allowance.cap !== null && allowance.used >= allowance.cap,
  };
}

/**
 * The ∞ character sits high in the monospace font, so "unlimited" is drawn
 * instead and centred on the text. `currentColor` keeps the text's colour.
 */
function InfinityIcon() {
  return (
    <svg
      viewBox="0 0 24 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      className="inline-block h-[0.75em] w-[1.5em] align-[-0.05em]"
      role="img"
      aria-label="Unlimited"
    >
      <path d="M12 6c-2-3-3.5-4.5-6-4.5a4.5 4.5 0 0 0 0 9c2.5 0 4-1.5 6-4.5s3.5-4.5 6-4.5a4.5 4.5 0 0 1 0 9c-2.5 0-4-1.5-6-4.5z" />
    </svg>
  );
}

/**
 * What the counter says in each state: the number, its colour (neutral, amber
 * when running low, red when none are left) and the words around it on the
 * desktop pill and the phone strip.
 */
function describe(allowance: AiAllowance): {
  count: React.ReactNode;
  tone: string;
  pill: string;
  label: string;
  note: string;
} {
  if (allowance.cap === null) {
    return {
      count: <InfinityIcon />,
      tone: "text-foreground",
      pill: " analyses",
      label: "Analyses today",
      note: " · unlimited",
    };
  }
  // A cap of 0 is the admin pausing AI for this account, not a spent day
  if (allowance.cap === 0) {
    return {
      count: "Paused",
      tone: "text-danger",
      pill: " · AI analyses",
      label: "AI analyses",
      note: " by the admin",
    };
  }
  const left = Math.max(allowance.cap - allowance.used, 0);
  return {
    count: `${left} of ${allowance.cap}`,
    tone: left === 0 ? "text-danger" : left <= LOW_LEFT ? "text-amber" : "text-foreground",
    pill: " left today",
    label: "Analyses left today",
    note: " · resets at midnight",
  };
}

/** Desktop: a pill beside the tabs. */
export function AiCounterPill() {
  const { allowance } = useAiAllowance();
  if (!allowance) return null;
  const { count, tone, pill } = describe(allowance);
  return (
    <span
      className={`hidden shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface px-3 py-1.5 font-mono text-[11px] font-semibold lg:inline-flex ${tone}`}
    >
      {count}
      {pill}
    </span>
  );
}

/** Phones and tablets: a slim strip under the tabs, part of the sticky bar. */
export function AiCounterStrip() {
  const { allowance } = useAiAllowance();
  if (!allowance) return null;
  const { count, tone, label, note } = describe(allowance);
  return (
    <div className="border-t border-line/60 lg:hidden">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-5 py-1 text-[11px] text-muted sm:px-6">
        <span>{label}</span>
        <span>
          <span className={`font-mono font-semibold ${tone}`}>{count}</span>
          {note}
        </span>
      </div>
    </div>
  );
}
