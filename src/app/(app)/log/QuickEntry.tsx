"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteMealAction, logMealAction } from "@/app/actions";
import { DatePicker } from "@/components/DatePicker";
import { Field } from "@/components/fields";
import { Spinner } from "@/components/loaders";
import { dayBounds, dayKey, dayLabel } from "@/lib/day";
import { quickEntryAnalysis, type QuickEntryInput } from "@/lib/quick-entry";

const EMPTY: QuickEntryInput = { name: "", calories: "", protein: "", carbs: "", fat: "" };

/**
 * Add a food by typing its numbers — no photo, no AI, so it never uses the
 * day's analyses. On phones it opens from a button; on desktop the rail shows
 * it open all the time. After adding, the fields clear but the day stays, so
 * several foods can go to the same day in a row.
 */
export function QuickEntry() {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<QuickEntryInput>(EMPTY);
  // null means today; a key is only held for an earlier day
  const [day, setDay] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const todayKey = dayKey(new Date());
  const set = (key: keyof QuickEntryInput) => (value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  function handleAdd() {
    const analysis = quickEntryAnalysis(fields);
    if (typeof analysis === "string") {
      setError(analysis);
      return;
    }
    setError(null);
    const id = crypto.randomUUID();
    startTransition(async () => {
      // For an earlier day the server picks the timestamp within that day
      const result = await logMealAction(
        { id, loggedAt: new Date().toISOString(), description: "", analysis, thumbnail: null },
        day ? dayBounds(day) : undefined,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setFields(EMPTY);
      toast.success(`${analysis.foods[0]?.name ?? "Food"} logged`, {
        action: {
          label: "Undo",
          onClick: () =>
            void deleteMealAction(id).then((r) => {
              if (r.error) toast.error(r.error);
            }),
        },
      });
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="rounded-panel border border-line px-4 py-2.5 text-sm font-semibold text-accent transition-colors hover:border-accent lg:hidden"
      >
        {open ? "Close manual entry" : "+ Add food manually"}
      </button>

      <section
        aria-label="Add food manually"
        className={`${open ? "flex" : "hidden"} flex-col gap-3 rounded-panel border border-line bg-surface p-4 lg:flex`}
      >
        <span className="hidden text-xs font-bold uppercase tracking-[0.14em] text-muted lg:block">
          Add food manually
        </span>
        <Field label="Food" value={fields.name} onChange={set("name")} inputMode="text" />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Calories"
            unit="kcal"
            value={fields.calories}
            onChange={set("calories")}
            inputMode="decimal"
          />
          <Field
            label="Protein"
            unit="g"
            value={fields.protein}
            onChange={set("protein")}
            inputMode="decimal"
          />
          <Field
            label="Carbs · optional"
            unit="g"
            value={fields.carbs}
            onChange={set("carbs")}
            inputMode="decimal"
          />
          <Field
            label="Fat · optional"
            unit="g"
            value={fields.fat}
            onChange={set("fat")}
            inputMode="decimal"
          />
        </div>
        <div className="flex items-center gap-2">
          <DatePicker
            value={day ?? todayKey}
            max={todayKey}
            disabled={pending}
            onChange={(key) => setDay(key === todayKey ? null : key)}
            ariaLabel="Day to add this food to"
          />
          <button
            type="button"
            disabled={pending}
            onClick={handleAdd}
            className="flex min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-panel border border-success px-4 py-2.5 text-sm font-semibold text-success transition-colors hover:bg-success-soft disabled:border-line disabled:text-muted"
          >
            {pending && <Spinner className="h-3.5 w-3.5" />}
            {pending ? "Adding…" : `Add to ${day ? dayLabel(day) : "today"}`}
          </button>
        </div>
        {error && (
          <p role="alert" className="text-xs font-semibold text-danger">
            {error}
          </p>
        )}
        <p className="text-xs text-muted">Typed numbers are used as-is; nothing is estimated.</p>
      </section>
    </div>
  );
}
