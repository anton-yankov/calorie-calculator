"use client";

import { useEffect, useState } from "react";
import { todayProgressAction, type TodayProgress } from "@/app/actions";
import { useAnalysis } from "@/components/AnalysisProvider";
import { GoalBars } from "@/components/GoalBars";

/**
 * "Today so far" vs the daily goals, shown on the Analyze page so you can see
 * your headroom before deciding what to eat. Day bounds are computed here in
 * the viewer's timezone (the server can't know it) and summed server-side.
 * Renders nothing until goals are set. Re-fetches after a meal is logged.
 */
export function TodayStrip() {
  const { loggedAtLength } = useAnalysis();
  const [progress, setProgress] = useState<TodayProgress | null>(null);

  useEffect(() => {
    let cancelled = false;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    void todayProgressAction(start.toISOString(), end.toISOString()).then((result) => {
      if (!cancelled && result.progress) setProgress(result.progress);
    });
    return () => {
      cancelled = true;
    };
  }, [loggedAtLength]);

  if (!progress?.goals) return null;
  const { totals, goals } = progress;

  return (
    <div className="flex flex-col gap-2 rounded-panel border border-line bg-surface px-4 py-3 lg:col-span-2">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Today</span>
      <GoalBars totals={totals} goals={goals} />
    </div>
  );
}
