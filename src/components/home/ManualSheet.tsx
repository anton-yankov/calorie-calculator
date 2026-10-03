"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { DatePicker } from "@/components/DatePicker";
import { Field } from "@/components/fields";
import { logFoodsNow } from "@/components/meals/logFood";
import { Sheet, SheetBadge } from "@/components/Sheet";
import { dayKey, dayLabel } from "@/lib/day";
import { quickEntryAnalysis, type QuickEntryInput } from "@/lib/quick-entry";

const EMPTY: QuickEntryInput = { name: "", calories: "", protein: "", carbs: "", fat: "" };

/** Mounted fresh each time the sheet opens, so it always starts empty and on today. */
function ManualForm({
  onLogged,
}: {
  onLogged: (id: string, name: string, day: string | null) => void;
}) {
  const [fields, setFields] = useState<QuickEntryInput>(EMPTY);
  // null means today; a key is only held for an earlier day
  const [day, setDay] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const todayKey = dayKey(new Date());
  const set = (key: keyof QuickEntryInput) => (value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  async function add() {
    const analysis = quickEntryAnalysis(fields);
    if (typeof analysis === "string") {
      setError(analysis);
      return;
    }
    setError(null);
    setPending(true);
    const result = await logFoodsNow(analysis.foods, day, analysis.notes);
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onLogged(result.id, analysis.foods[0]?.name ?? "Food", day);
  }

  return (
    <>
      <Field label="Food" value={fields.name} onChange={set("name")} inputMode="text" />
      <div className="grid grid-cols-2 gap-2.5">
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
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <DatePicker
          value={day ?? todayKey}
          max={todayKey}
          disabled={pending}
          onChange={(key) => setDay(key === todayKey ? null : key)}
          ariaLabel="Day to add this food to"
          className="h-12 rounded-panel border-[1.5px] border-line-strong bg-transparent px-3.5 text-sm font-bold"
        />
        <Button className="flex-1" pending={pending} onClick={() => void add()}>
          {pending ? "Adding…" : `Add to ${day ? dayLabel(day) : "today"}`}
        </Button>
      </div>
      <p className="text-xs text-muted">
        Typed numbers are used as they are; nothing is estimated.
      </p>
    </>
  );
}

/** Add a food by typing its numbers: no photo, no AI, so it never uses an analysis. */
export function ManualSheet({
  open,
  onClose,
  onLogged,
}: {
  open: boolean;
  onClose: () => void;
  onLogged: (id: string, name: string, day: string | null) => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add manually"
      badge={<SheetBadge>No AI used</SheetBadge>}
    >
      {open && <ManualForm onLogged={onLogged} />}
    </Sheet>
  );
}
