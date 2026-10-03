"use client";

import type { TodayProgress } from "@/app/actions";
import { useAnalysis } from "@/components/AnalysisProvider";
import { useWaterTracking } from "@/components/WaterTracking";
import { formatWater } from "@/lib/water";

/** Quick-add water and the day's total, only when water tracking is on. */
export function WaterRow({
  progress,
  className = "",
}: {
  progress: TodayProgress | null;
  className?: string;
}) {
  const waterTracking = useWaterTracking();
  const { quickAddWater, quickWaterPending } = useAnalysis();
  if (!waterTracking) return null;
  const drunk = progress?.totals.water_ml ?? null;
  const goal = progress?.targets?.waterGoalMl ?? null;
  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`}>
      <span className="col-span-3 text-[13px] font-semibold text-muted">
        Water
        {drunk !== null &&
          ` · ${formatWater(drunk)}${goal !== null ? ` of ${formatWater(goal)}` : ""}`}
      </span>
      {[250, 500, 1000].map((ml) => (
        <button
          key={ml}
          type="button"
          disabled={quickWaterPending}
          onClick={() => void quickAddWater(ml)}
          className="h-11 rounded-panel bg-surface text-sm font-extrabold text-tint-lose transition hover:bg-surface-raised disabled:opacity-40"
        >
          +{ml === 1000 ? "1 L" : `${ml} ml`}
        </button>
      ))}
    </div>
  );
}
