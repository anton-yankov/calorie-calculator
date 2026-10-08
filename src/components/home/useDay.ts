"use client";

import { useEffect, useState } from "react";
import { homeDataAction, type HomeData } from "@/app/actions";
import { useAiAllowance } from "@/components/AiAllowance";
import { useAnalysis } from "@/components/AnalysisProvider";
import { dayBounds, dayKey } from "@/lib/day";

/**
 * The day the homepage is showing: today, or the earlier day a meal is about
 * to be backdated to. Its totals, targets and meals are fetched from the
 * browser (only it knows the viewer's timezone) and fetched again whenever the
 * analysis state reports a change. The last answer stays on screen while the
 * next one loads, so nothing flickers after logging.
 *
 * The same request brings the weigh-in reminder and the AI count, so the
 * homepage loads in one round trip and everything on it appears together.
 */
export function useDay() {
  const { logDate, progressVersion } = useAnalysis();
  const { seed: seedAllowance } = useAiAllowance();
  const day = logDate ?? dayKey(new Date());
  const [loaded, setLoaded] = useState<{ day: string; home: HomeData } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const { startIso, endIso } = dayBounds(day);
    void homeDataAction(day, startIso, endIso).then((result) => {
      if (cancelled) return;
      if (result.home) {
        setLoaded({ day, home: result.home });
        if (result.home.allowance) seedAllowance(result.home.allowance);
        setFailed(false);
      } else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [day, progressVersion, seedAllowance]);

  return {
    day,
    // Backdating judges the day as finished, not as still in progress
    isToday: day === dayKey(new Date()),
    // A different day's numbers never stand in for this one's
    progress: loaded?.day === day ? loaded.home.progress : null,
    // Not tied to the day: undefined while loading, null when it couldn't be read
    weighIn: loaded ? loaded.home.weighIn : undefined,
    failed,
  };
}
