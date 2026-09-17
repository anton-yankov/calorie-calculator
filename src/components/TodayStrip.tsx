"use client";

import { useEffect, useState } from "react";
import { todayProgressAction, type TodayProgress } from "@/app/actions";
import { useAnalysis } from "@/components/AnalysisProvider";
import { GoalBars } from "@/components/GoalBars";
import { SkeletonGoalBars } from "@/components/loaders";
import { useWaterTracking } from "@/components/WaterTracking";
import { dayBounds, dayKey, dayLabel } from "@/lib/day";

/**
 * Progress vs the daily goals, shown on the Analyze page so you can see your
 * headroom before deciding what to eat. Follows the selected log date (today
 * by default) so backdating is visible at a glance. Day bounds are computed
 * here in the viewer's timezone (the server can't know it) and summed
 * server-side. Shows a skeleton until the first answer arrives (every user
 * past onboarding has a plan, so bars always follow). Re-fetches after a meal
 * is logged, keeping the current bars until the new ones land.
 */
export function TodayStrip() {
  const { loggedAtLength, logDate, progressVersion } = useAnalysis();
  const waterTracking = useWaterTracking();
  const [progress, setProgress] = useState<TodayProgress | null>(null);
  // A failed first load hides the strip instead of leaving a skeleton forever
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // The day key decides which plan's targets apply, so it travels with the bounds
    const day = logDate ?? dayKey(new Date());
    const { startIso, endIso } = dayBounds(day);
    void todayProgressAction(day, startIso, endIso).then((result) => {
      if (cancelled) return;
      if (result.progress) setProgress(result.progress);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [loggedAtLength, logDate, progressVersion]);

  if (progress ? !progress.targets : failed) return null;
  // Backdating to an earlier day judges it as finished, not as still in progress
  const isToday = !logDate || logDate === dayKey(new Date());

  return (
    <div className="flex flex-col gap-2 rounded-panel border border-line bg-surface px-4 py-3 lg:col-span-2">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted">
        {logDate ? `Logging to ${dayLabel(logDate)}` : "Today"}
      </span>
      {progress?.targets ? (
        <GoalBars totals={progress.totals} targets={progress.targets} isToday={isToday} />
      ) : (
        <SkeletonGoalBars water={waterTracking} />
      )}
    </div>
  );
}
