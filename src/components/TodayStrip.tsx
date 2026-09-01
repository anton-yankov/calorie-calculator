"use client";

import { useEffect, useState } from "react";
import { todayProgressAction, type TodayProgress } from "@/app/actions";
import { useAnalysis } from "@/components/AnalysisProvider";
import { GoalBars } from "@/components/GoalBars";
import { dayBounds, dayKey, dayLabel } from "@/lib/day";

/**
 * Progress vs the daily goals, shown on the Analyze page so you can see your
 * headroom before deciding what to eat. Follows the selected log date (today
 * by default) so backdating is visible at a glance. Day bounds are computed
 * here in the viewer's timezone (the server can't know it) and summed
 * server-side. Renders nothing until goals are set. Re-fetches after a meal
 * is logged.
 */
export function TodayStrip() {
  const { loggedAtLength, logDate } = useAnalysis();
  const [progress, setProgress] = useState<TodayProgress | null>(null);

  useEffect(() => {
    let cancelled = false;
    const { startIso, endIso } = dayBounds(logDate ?? dayKey(new Date()));
    void todayProgressAction(startIso, endIso).then((result) => {
      if (!cancelled && result.progress) setProgress(result.progress);
    });
    return () => {
      cancelled = true;
    };
  }, [loggedAtLength, logDate]);

  if (!progress?.goals) return null;
  const { totals, goals } = progress;

  return (
    <div className="flex flex-col gap-2 rounded-panel border border-line bg-surface px-4 py-3 lg:col-span-2">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
        {logDate ? `Logging to ${dayLabel(logDate)}` : "Today"}
      </span>
      <GoalBars totals={totals} goals={goals} />
    </div>
  );
}
