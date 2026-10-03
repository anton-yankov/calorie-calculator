"use client";

import { Ellipsis, PencilLine, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/Button";
import { DatePicker } from "@/components/DatePicker";
import { Field } from "@/components/fields";
import { Sheet } from "@/components/Sheet";
import { dayLabel } from "@/lib/day";
import type { WeightEntry } from "@/lib/weights";
import { deleteWeightAction, saveWeightAction } from "./actions";

/** "83.4", "70": one decimal at most, no trailing zero. */
const formatKg = (kg: number) =>
  kg.toLocaleString("en-US", { maximumFractionDigits: 1, useGrouping: false });

/** A typed weight, accepting a decimal comma; null when it isn't a number. */
const typedKg = (text: string) => {
  const n = Number(text.trim().replace(",", "."));
  return text.trim() === "" || !Number.isFinite(n) ? null : n;
};

/** How many weigh-ins the list shows before "Show all". */
const SHOWN = 4;

/**
 * Log a weigh-in for today or an earlier day. A day holds one weigh-in, so
 * picking a day that already has one says it will be replaced.
 */
function WeightForm({
  weights,
  today,
  onDone,
}: {
  weights: WeightEntry[];
  today: string;
  onDone: () => void;
}) {
  const [value, setValue] = useState("");
  const [day, setDay] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const existing = weights.find((w) => w.day === day);
  const dayName = day === today ? "today" : dayLabel(day);

  function save() {
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
      toast.success(`${formatKg(weightKg)} kg logged for ${dayName}`);
      onDone();
    });
  }

  return (
    <>
      <Field label="Weight" unit="kg" value={value} onChange={setValue} inputMode="decimal" />
      {existing && (
        <p className="-mt-1.5 text-[12.5px] text-muted">
          Replaces the {formatKg(existing.weightKg)} kg already logged for {dayName}.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <DatePicker
          value={day}
          max={today}
          disabled={pending}
          onChange={setDay}
          ariaLabel="Day of this weigh-in"
          className="h-12 rounded-panel border-[1.5px] border-line-strong bg-transparent px-3.5 text-sm font-bold"
        />
        <Button className="flex-1" pending={pending} onClick={save}>
          {pending ? "Saving…" : "Save weight"}
        </Button>
      </div>
    </>
  );
}

/** The Log weight button and the sheet it opens. */
export function LogWeightButton({ weights, today }: { weights: WeightEntry[]; today: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className="w-full" onClick={() => setOpen(true)}>
        Log weight
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Log weight">
        {open && <WeightForm weights={weights} today={today} onDone={() => setOpen(false)} />}
      </Sheet>
    </>
  );
}

/** One weigh-in: its day, weight and the change from the one before; ⋯ to edit or delete. */
function WeightRow({
  entry,
  previous,
  readOnly,
}: {
  entry: WeightEntry;
  previous: WeightEntry | null;
  readOnly: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(formatKg(entry.weightKg));
  const [pending, startTransition] = useTransition();
  const change = previous ? Math.round((entry.weightKg - previous.weightKg) * 10) / 10 : null;

  function save() {
    const weightKg = typedKg(draft);
    if (weightKg === null) {
      toast.error("Enter your weight in kg.");
      return;
    }
    startTransition(async () => {
      const result = await saveWeightAction({ day: entry.day, weightKg });
      if (result.error) toast.error(result.error);
      else {
        toast.success("Weigh-in updated");
        setEditing(false);
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteWeightAction(entry.day);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Weigh-in deleted", {
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
      className={`flex min-h-14 items-center gap-3 border-t border-line py-1.5 first:border-t-0 ${pending ? "opacity-50" : ""}`}
    >
      <span className="min-w-0 flex-1 text-[14.5px] text-muted">{dayLabel(entry.day)}</span>
      <b className="text-[15px] font-extrabold tabular-nums">{formatKg(entry.weightKg)} kg</b>
      <span className="w-12 text-right text-[12.5px] text-muted tabular-nums">
        {change === null
          ? ""
          : change === 0
            ? "±0"
            : `${change > 0 ? "+" : "−"}${formatKg(Math.abs(change))}`}
      </span>
      {!readOnly && (
        <>
          <Button
            variant="outline"
            size="icon"
            aria-label={`More for the weigh-in on ${dayLabel(entry.day)}`}
            onClick={() => setMenuOpen(true)}
          >
            <Ellipsis className="h-5 w-5" strokeWidth={2} aria-hidden />
          </Button>
          <Sheet
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            title={`Weigh-in · ${dayLabel(entry.day)}`}
          >
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                setMenuOpen(false);
                setDraft(formatKg(entry.weightKg));
                setEditing(true);
              }}
            >
              <PencilLine className="h-[19px] w-[19px]" strokeWidth={2} aria-hidden />
              Edit weight
            </Button>
            <Button
              variant="destructive"
              className="w-full justify-start"
              onClick={() => {
                setMenuOpen(false);
                remove();
              }}
            >
              <Trash2 className="h-[19px] w-[19px]" strokeWidth={2} aria-hidden />
              Delete weigh-in
            </Button>
          </Sheet>
          <Sheet
            open={editing}
            onClose={() => setEditing(false)}
            title={`Edit · ${dayLabel(entry.day)}`}
          >
            <Field label="Weight" unit="kg" value={draft} onChange={setDraft} inputMode="decimal" />
            <div className="flex gap-2">
              <Button variant="outline" disabled={pending} onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button className="flex-1" pending={pending} onClick={save}>
                {pending ? "Saving…" : "Save weight"}
              </Button>
            </div>
          </Sheet>
        </>
      )}
    </li>
  );
}

/** Every weigh-in, newest first: the latest few, then the rest on request. */
export function WeightEntries({
  weights,
  readOnly,
}: {
  weights: WeightEntry[];
  readOnly: boolean;
}) {
  const [all, setAll] = useState(false);
  const newestFirst = [...weights].reverse();
  const shown = all ? newestFirst : newestFirst.slice(0, SHOWN);
  return (
    <section aria-label="Weigh-ins" className="flex flex-col gap-2">
      <div className="mt-1.5 flex items-baseline justify-between gap-3">
        <h2 className="text-[17px] font-extrabold tracking-tight">Weigh-ins</h2>
        <span className="text-[13px] text-muted">{weights.length} in total</span>
      </div>
      {weights.length === 0 ? (
        <p className="rounded-[20px] bg-surface px-5 py-6 text-center text-sm text-muted">
          {readOnly ? "No weigh-ins yet." : "No weigh-ins yet. Log one to start your weight chart."}
        </p>
      ) : (
        <ul className="rounded-[22px] bg-surface px-3.5">
          {shown.map((entry, i) => (
            <WeightRow
              key={entry.day}
              entry={entry}
              previous={newestFirst[i + 1] ?? null}
              readOnly={readOnly}
            />
          ))}
        </ul>
      )}
      {!all && weights.length > SHOWN && (
        <Button variant="outline" className="w-full" onClick={() => setAll(true)}>
          Show all {weights.length}
        </Button>
      )}
    </section>
  );
}
