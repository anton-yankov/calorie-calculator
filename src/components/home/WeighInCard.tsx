"use client";

import { Check, Clock, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { latestWeighInAction } from "@/app/actions";
import { saveWeightAction } from "@/app/(app)/stats/actions";
import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { addDays, dayKey, daysBetween, longDate } from "@/lib/day";
import type { WeightEntry } from "@/lib/weights";

/** A weigh-in this many days old (or none at all) brings the card back. */
const REMIND_AFTER_DAYS = 7;
/** The day until which the card stays snoozed (YYYY-MM-DD), in this browser only. */
const SNOOZE_KEY = "weigh-in-snoozed-until";
/** How long the "Saved" confirmation stays before the card goes away. */
const SAVED_FOR_MS = 4000;

// localStorage only exists in the browser: the server snapshot counts as
// snoozed, so the card never renders on the server and then vanishes
const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};

const kg = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });

/** A typed weight, accepting a decimal comma; null when it isn't a number. */
const typedKg = (text: string) => {
  const n = Number(text.trim().replace(",", "."));
  return text.trim() === "" || !Number.isFinite(n) ? null : n;
};

/**
 * The homepage's weigh-in reminder: shows when the last weigh-in is a week old
 * (or there's none), saves the weight right here, says how it moved, then gets
 * out of the way. ✕ snoozes it for a day or three.
 */
export function WeighInCard({ className = "" }: { className?: string }) {
  // undefined while loading; null when there are no weigh-ins
  const [latest, setLatest] = useState<WeightEntry | null | undefined>(undefined);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState<{ weightKg: number; previous: WeightEntry | null } | null>(
    null,
  );
  const [snoozing, setSnoozing] = useState(false);
  const [snoozedNow, setSnoozedNow] = useState(false);
  const today = dayKey(new Date());
  const snoozedUntil = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(SNOOZE_KEY) ?? "",
    () => "9999-12-31",
  );

  useEffect(() => {
    let cancelled = false;
    void latestWeighInAction().then((result) => {
      if (!cancelled && result.latest !== undefined) setLatest(result.latest);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // The confirmation stays a moment, then the card is done until the next one is due
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => {
      setSaved(null);
      setLatest({ day: today, weightKg: saved.weightKg });
    }, SAVED_FOR_MS);
    return () => clearTimeout(timer);
  }, [saved, today]);

  if (latest === undefined || snoozedNow || today < snoozedUntil) return null;
  const days = latest === null ? null : daysBetween(latest.day, today);
  if (!saved && days !== null && days < REMIND_AFTER_DAYS) return null;

  async function save() {
    const weightKg = typedKg(value);
    if (weightKg === null) {
      setError("Enter your weight in kg.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await saveWeightAction({ day: today, weightKg });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved({ weightKg, previous: latest ?? null });
  }

  function snooze(forDays: number) {
    localStorage.setItem(SNOOZE_KEY, addDays(today, forDays));
    setSnoozedNow(true);
    setSnoozing(false);
  }

  if (saved) {
    const change = saved.previous ? saved.weightKg - saved.previous.weightKg : null;
    return (
      <section
        role="status"
        className={`flex items-start gap-3 rounded-[22px] bg-success-soft p-4 ${className}`}
      >
        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-success">Saved · {kg(saved.weightKg)} kg</p>
          {change !== null && saved.previous && (
            <p className="text-[13px]">
              {change === 0
                ? "Same as"
                : `${change > 0 ? "+" : "−"}${kg(Math.abs(change))} kg since`}{" "}
              {longDate(saved.previous.day)}.
            </p>
          )}
        </div>
        <Check className="h-5 w-5 text-success" strokeWidth={2.5} aria-hidden />
      </section>
    );
  }

  return (
    <section
      aria-label="Weigh-in reminder"
      className={`flex flex-col gap-3 rounded-[22px] bg-surface p-4 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-extrabold">
            {latest ? "Time to weigh in" : "Log your first weigh-in"}
          </h2>
          <p className="text-[13px] text-muted">
            {latest
              ? `Last: ${kg(latest.weightKg)} kg, ${days} days ago`
              : "It starts your weight trend on Stats"}
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Remind me later"
          onClick={() => setSnoozing(true)}
          className="-mt-1 -mr-1"
        >
          <X className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden />
        </Button>
      </div>
      <div className="flex gap-2">
        <label className="flex h-12 min-w-0 flex-1 items-center rounded-panel border-[1.5px] border-line bg-background pr-4 focus-within:border-accent">
          <input
            type="text"
            inputMode="decimal"
            value={value}
            disabled={pending}
            aria-label="Weight in kg"
            placeholder="Weight"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
            }}
            className="w-full min-w-0 bg-transparent px-4 text-[15px] tabular-nums placeholder:text-muted focus:outline-none"
          />
          <span className="text-sm text-muted">kg</span>
        </label>
        <Button pending={pending} onClick={() => void save()}>
          Save
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
      <Sheet open={snoozing} onClose={() => setSnoozing(false)} title="Remind me…">
        <Button variant="outline" className="w-full justify-start" onClick={() => snooze(1)}>
          <Clock className="h-[19px] w-[19px]" strokeWidth={2} aria-hidden />
          Tomorrow
        </Button>
        <Button variant="outline" className="w-full justify-start" onClick={() => snooze(3)}>
          <Clock className="h-[19px] w-[19px]" strokeWidth={2} aria-hidden />
          In 3 days
        </Button>
      </Sheet>
    </section>
  );
}
