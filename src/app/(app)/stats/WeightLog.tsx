"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { DatePicker } from "@/components/DatePicker";
import { Field } from "@/components/fields";
import { Spinner } from "@/components/loaders";
import { dayLabel } from "@/lib/day";
import type { WeightEntry } from "@/lib/weights";
import { deleteWeightAction, saveWeightAction } from "./actions";

/** "83.4", "70" — one decimal at most, no trailing zero. */
const formatKg = (kg: number) =>
  kg.toLocaleString("en-US", { maximumFractionDigits: 1, useGrouping: false });

/** A typed weight, accepting a decimal comma; null when it isn't a number. */
const typedKg = (text: string) => {
  const n = Number(text.trim().replace(",", "."));
  return text.trim() === "" || !Number.isFinite(n) ? null : n;
};

/**
 * Log a weigh-in for today or an earlier day. A day holds one weigh-in, so
 * picking a day that already has one says it will be replaced.
 */
export function WeightForm({ weights, today }: { weights: WeightEntry[]; today: string }) {
  const [value, setValue] = useState("");
  const [day, setDay] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const sectionRef = useRef<HTMLElement>(null);
  const existing = weights.find((w) => w.day === day);
  const dayName = day === today ? "today" : dayLabel(day);

  // The weigh-in nudge links to /stats#weight. Stats renders after mounting, so
  // the browser's own jump to the anchor finds nothing; scroll here instead.
  useEffect(() => {
    if (window.location.hash === "#weight") {
      sectionRef.current?.scrollIntoView({ block: "center" });
    }
  }, []);

  function handleSave() {
    const weightKg = typedKg(value);
    if (weightKg === null) {
      setError("Enter your weight in kg.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await saveWeightAction({ day, weightKg });
      if (result.error) {
        setError(result.error);
        return;
      }
      setValue("");
      toast.success(`${formatKg(weightKg)} kg logged for ${dayName}`);
    });
  }

  return (
    <section
      ref={sectionRef}
      id="weight"
      aria-label="Log weight"
      className="flex flex-col gap-3 rounded-panel border border-line bg-surface p-4"
    >
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Log weight</span>
      <Field label="Weight" unit="kg" value={value} onChange={setValue} inputMode="decimal" />
      <div className="flex items-center gap-2">
        <DatePicker
          value={day}
          max={today}
          disabled={pending}
          onChange={setDay}
          ariaLabel="Day of this weigh-in"
        />
        <button
          type="button"
          disabled={pending}
          onClick={handleSave}
          className="flex min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-panel bg-accent px-4 py-2.5 text-sm font-semibold text-background transition hover:brightness-110 disabled:opacity-40"
        >
          {pending && <Spinner className="h-3.5 w-3.5" />}
          {pending ? "Saving…" : "Save weight"}
        </button>
      </div>
      {existing && (
        <p className="text-xs text-muted">
          Replaces the {formatKg(existing.weightKg)} kg already logged for {dayName}.
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs font-semibold text-danger">
          {error}
        </p>
      )}
    </section>
  );
}

/** One weigh-in row: its weight can be edited in place or the entry deleted. */
function WeightRow({ entry, readOnly }: { entry: WeightEntry; readOnly: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSave() {
    const weightKg = typedKg(draft);
    if (weightKg === null) {
      toast.error("Enter your weight in kg.");
      return;
    }
    startTransition(async () => {
      const result = await saveWeightAction({ day: entry.day, weightKg });
      if (result.error) toast.error(result.error);
      else setEditing(false);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteWeightAction(entry.day);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast("Weigh-in deleted", {
        action: {
          label: "Undo",
          onClick: () =>
            void saveWeightAction(entry).then((r) => {
              if (r.error) toast.error(r.error);
            }),
        },
      });
    });
  }

  return (
    <li
      className={`flex items-center gap-3 border-t border-line/60 px-4 py-2 ${pending ? "opacity-50" : ""}`}
    >
      <span className="min-w-0 flex-1 font-mono text-[13px] tabular-nums">
        {dayLabel(entry.day)}
      </span>
      {readOnly ? (
        <span className="font-mono text-[13px] font-semibold tabular-nums">
          {formatKg(entry.weightKg)} kg
        </span>
      ) : editing ? (
        <>
          <label className="inline-flex items-center gap-1 font-mono text-xs text-muted">
            <input
              type="text"
              inputMode="decimal"
              value={draft}
              disabled={pending}
              aria-label={`Weight for ${dayLabel(entry.day)}`}
              onChange={(e) => setDraft(e.target.value)}
              className="w-16 rounded-md border border-line bg-background px-1.5 py-0.5 text-right tabular-nums text-foreground focus:border-accent focus:outline-none"
            />
            kg
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={handleSave}
            className="text-xs font-semibold text-success hover:underline disabled:text-muted"
          >
            Save
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setEditing(false)}
            className="text-xs font-semibold text-muted hover:underline"
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <span className="font-mono text-[13px] font-semibold tabular-nums">
            {formatKg(entry.weightKg)} kg
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setDraft(formatKg(entry.weightKg));
              setEditing(true);
            }}
            className="text-xs font-semibold text-accent hover:underline disabled:text-muted"
          >
            Edit
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={handleDelete}
            className="text-xs font-semibold text-danger hover:underline disabled:text-muted"
          >
            Delete
          </button>
        </>
      )}
    </li>
  );
}

/** Every weigh-in, newest first, folded away until opened. */
export function WeightEntries({
  weights,
  readOnly,
}: {
  weights: WeightEntry[];
  readOnly: boolean;
}) {
  return (
    <details className="overflow-hidden rounded-panel border border-line bg-surface">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">
        All weigh-ins <span className="font-normal text-muted">({weights.length})</span>
      </summary>
      {weights.length === 0 ? (
        <p className="border-t border-line/60 px-4 py-3 text-sm text-muted">
          {readOnly ? "No weigh-ins yet." : "No weigh-ins yet. Log one to start your weight chart."}
        </p>
      ) : (
        <ul>
          {[...weights].reverse().map((entry) => (
            <WeightRow key={entry.day} entry={entry} readOnly={readOnly} />
          ))}
        </ul>
      )}
    </details>
  );
}
