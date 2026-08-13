"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveGoalsAction } from "@/app/actions";
import { Spinner } from "@/components/loaders";
import type { Goals } from "@/lib/settings";

/** Inline daily-goal editor in the log header — no settings page needed. */
export function GoalsEditor({ goals }: { goals: Goals | null }) {
  const [open, setOpen] = useState(false);
  const [calories, setCalories] = useState(goals?.calorieGoal.toString() ?? "");
  const [protein, setProtein] = useState(goals?.proteinGoal?.toString() ?? "");
  const [pending, startTransition] = useTransition();

  function handleSave() {
    const cal = Number(calories);
    if (calories.trim() === "" || !Number.isFinite(cal) || cal <= 0) {
      toast.error("Enter a daily calorie goal");
      return;
    }
    const prot = protein.trim() === "" ? null : Number(protein);
    if (prot !== null && (!Number.isFinite(prot) || prot <= 0)) {
      toast.error("The protein goal must be a positive number");
      return;
    }
    startTransition(async () => {
      const result = await saveGoalsAction({
        calorieGoal: Math.round(cal),
        proteinGoal: prot === null ? null : Math.round(prot),
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Goals saved");
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-sm font-semibold text-accent hover:underline"
      >
        {goals
          ? `Goals: ${goals.calorieGoal} kcal${
              goals.proteinGoal !== null ? ` · ${goals.proteinGoal} g protein` : ""
            } — edit`
          : "Set daily goals"}
      </button>
    );
  }

  const inputClass =
    "w-24 rounded-panel border border-line bg-surface px-3 py-2 text-right font-mono text-sm tabular-nums text-foreground focus:border-accent focus:outline-none";

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-panel border border-line bg-surface px-4 py-3">
      <label className="flex flex-col gap-1 text-xs text-muted">
        Daily calories
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={calories}
          disabled={pending}
          onChange={(e) => setCalories(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Protein g (optional)
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={protein}
          disabled={pending}
          onChange={(e) => setProtein(e.target.value)}
          className={inputClass}
        />
      </label>
      <div className="flex items-center gap-3 pb-1.5 text-xs font-semibold">
        <button
          type="button"
          disabled={pending}
          onClick={handleSave}
          className="flex items-center gap-1.5 text-success hover:underline disabled:text-muted"
        >
          {pending && <Spinner className="h-3 w-3" />}
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setOpen(false)}
          className="text-muted hover:underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
