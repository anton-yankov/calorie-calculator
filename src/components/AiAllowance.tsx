"use client";

import { usePathname } from "next/navigation";
import { createContext, use, useCallback, useEffect, useState } from "react";
import { Infinity as InfinityGlyph } from "lucide-react";
import { aiAllowanceAction } from "@/app/actions";
import type { AiAllowance } from "@/lib/ai-usage";

/** At this many left or fewer, the counter turns amber. */
const LOW_LEFT = 3;

interface AllowanceContext {
  /** null until loaded, and on pages without an account (login) */
  allowance: AiAllowance | null;
  /** Re-reads the count, e.g. after an AI request */
  refresh: () => void;
  /** Sets a count read elsewhere: the homepage loads it with the rest of its data */
  seed: (allowance: AiAllowance) => void;
}

const Context = createContext<AllowanceContext>({
  allowance: null,
  refresh: () => {},
  seed: () => {},
});

/**
 * Today's AI analyses for the nav counter and the AI controls. Mounted in the
 * root layout, above the nav and the analysis state. The count is re-read on
 * every navigation (the homepage reads it along with its own data), when the tab comes back into view (it may be past midnight),
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
    // The homepage reads it in the same request as the rest of its data
    if (pathname !== "/") refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [pathname, refresh]);

  return <Context value={{ allowance, refresh, seed: setAllowance }}>{children}</Context>;
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
 * The ∞ character sits high in the font, so "unlimited" is drawn as an icon
 * instead, centred on the text. It inherits the text's colour.
 */
function InfinityIcon() {
  return (
    <InfinityGlyph
      className="inline-block h-[1em] w-[1.5em] align-[-0.15em]"
      strokeWidth={2.25}
      role="img"
      aria-label="Unlimited"
    />
  );
}

/**
 * Desktop sidebar: today's analyses as a small card. Shows ∞ for the admin,
 * "Paused" when the admin set the cap to 0, otherwise how many are left with a
 * bar that turns amber when running low and red when none are left. (On phones
 * the count lives on the homepage's photo button.)
 */
export function AiCounterCard() {
  const { allowance } = useAiAllowance();
  if (!allowance) return null;

  let value: React.ReactNode;
  let left: number | null = null;
  let tone = "text-foreground";
  if (allowance.cap === null) {
    value = (
      <>
        <InfinityIcon /> unlimited
      </>
    );
  } else if (allowance.cap === 0) {
    // A cap of 0 is the admin pausing AI for this account, not a spent day
    value = "Paused";
    tone = "text-danger";
  } else {
    left = Math.max(allowance.cap - allowance.used, 0);
    value = `${left} of ${allowance.cap} left`;
    tone = left === 0 ? "text-danger" : left <= LOW_LEFT ? "text-amber" : "text-foreground";
  }
  const barColor =
    left === 0 ? "bg-danger" : left !== null && left <= LOW_LEFT ? "bg-amber" : "bg-accent";

  return (
    <div className="rounded-[16px] bg-surface p-3 text-[12.5px] text-muted">
      AI analyses today
      <span className={`mt-0.5 block text-lg font-extrabold tabular-nums ${tone}`}>{value}</span>
      {left !== null && allowance.cap ? (
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-line-strong">
          <span
            className={`block h-full rounded-full ${barColor}`}
            style={{ width: `${(left / allowance.cap) * 100}%` }}
          />
        </span>
      ) : null}
    </div>
  );
}
