"use client";

import { useEffect, useState } from "react";
import { todayProgressAction, type TodayProgress } from "@/app/actions";
import { useAnalysis } from "@/components/AnalysisProvider";
import { dayBounds, dayKey } from "@/lib/day";

/**
 * The day the homepage is showing: today, or the earlier day a meal is about
 * to be backdated to. Its totals, targets and meals are fetched from the
 * browser (only it knows the viewer's timezone) and fetched again whenever the
 * analysis state reports a change. The last answer stays on screen while the
 * next one loads, so nothing flickers after logging.
 */
export function useDay() {
  const { logDate, progressVersion } = useAnalysis();
  const day = logDate ?? dayKey(new Date());
  const [loaded, setLoaded] = useState<{ day: string; progress: TodayProgress } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const { startIso, endIso } = dayBounds(day);
    void todayProgressAction(day, startIso, endIso).then((result) => {
      if (cancelled) return;
      if (result.progress) {
        setLoaded({ day, progress: result.progress });
        setFailed(false);
      } else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [day, progressVersion]);

  return {
    day,
    // Backdating judges the day as finished, not as still in progress
    isToday: day === dayKey(new Date()),
    // A different day's numbers never stand in for this one's
    progress: loaded?.day === day ? loaded.progress : null,
    failed,
  };
}
