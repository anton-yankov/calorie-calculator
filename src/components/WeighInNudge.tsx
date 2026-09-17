"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { latestWeighInAction } from "@/app/actions";
import { dayKey, daysBetween } from "@/lib/day";

/** A weigh-in this many days old (or none at all) brings the nudge back. */
const NUDGE_AFTER_DAYS = 7;
/** Holds the day the nudge was dismissed; it stays hidden for the rest of that day. */
const DISMISSED_KEY = "weigh-in-nudge-dismissed";

// localStorage only exists in the browser: the server snapshot counts as
// dismissed, so the banner never renders on the server and then vanishes
const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};

/**
 * A banner on Analyze when the last weigh-in is a week old or more. Dismissing
 * it hides it until tomorrow; the dismissal is remembered in this browser only,
 * which is all a reminder needs.
 */
export function WeighInNudge() {
  // undefined while loading; null when there are no weigh-ins
  const [lastDay, setLastDay] = useState<string | null | undefined>(undefined);
  const [dismissedNow, setDismissedNow] = useState(false);
  const today = dayKey(new Date());
  const dismissedEarlier = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(DISMISSED_KEY) === today,
    () => true,
  );

  useEffect(() => {
    let cancelled = false;
    void latestWeighInAction().then((result) => {
      if (!cancelled && result.day !== undefined) setLastDay(result.day);
    });
    return () => {
      cancelled = true;
    };
  }, [today]);

  if (lastDay === undefined || dismissedEarlier || dismissedNow) return null;
  const days = lastDay === null ? null : daysBetween(lastDay, today);
  if (days !== null && days < NUDGE_AFTER_DAYS) return null;

  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-r-panel border border-l-4 border-line border-l-accent bg-surface px-4 py-2.5 text-sm lg:col-span-2"
    >
      <span aria-hidden>⚖</span>
      <span className="min-w-0 flex-1">
        {days === null
          ? "You haven't logged a weigh-in yet."
          : `It's been ${days} days since your last weigh-in.`}
      </span>
      <Link href="/stats#weight" className="shrink-0 font-semibold text-accent hover:underline">
        Log weight
      </Link>
      <button
        type="button"
        aria-label="Hide until tomorrow"
        onClick={() => {
          localStorage.setItem(DISMISSED_KEY, today);
          setDismissedNow(true);
        }}
        className="shrink-0 px-1 text-lg leading-none text-muted hover:text-foreground"
      >
        ×
      </button>
    </div>
  );
}
