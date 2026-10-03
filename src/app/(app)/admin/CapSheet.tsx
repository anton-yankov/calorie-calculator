"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/Button";
import { Field } from "@/components/fields";
import { Sheet } from "@/components/Sheet";
import { setDailyCapAction } from "./actions";

/** The common caps as one tap each; 0 is "Pause". */
const PICKS = [0, 10, 20, 50, 100];

function CapForm({
  userId,
  email,
  cap,
  usedToday,
  onDone,
}: {
  userId: string;
  email: string;
  cap: number;
  usedToday: number;
  onDone: () => void;
}) {
  const [value, setValue] = useState(String(cap));
  const [pending, startTransition] = useTransition();
  const next = Number(value);
  const valid = value.trim() !== "" && Number.isInteger(next) && next >= 0 && next <= 1000;

  function save() {
    startTransition(async () => {
      const result = await setDailyCapAction(userId, next);
      if (result.error) toast.error(result.error);
      else {
        toast.success(next === 0 ? `AI paused for ${email}` : `${email}: ${next} analyses a day`);
        onDone();
      }
    });
  }

  return (
    <>
      <p className="-mt-1.5 text-[13.5px] text-muted">
        {email} · used {usedToday} today
      </p>
      <div role="radiogroup" aria-label="Quick picks" className="grid grid-cols-5 gap-2">
        {PICKS.map((pick) => {
          const active = valid && next === pick;
          return (
            <button
              key={pick}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setValue(String(pick))}
              className={`h-12 rounded-panel border-2 text-[15px] font-extrabold transition-colors ${
                active ? "border-accent bg-accent-soft" : "border-transparent bg-background"
              } ${pick === 0 ? "text-[13px] text-danger" : ""}`}
            >
              {pick === 0 ? "Pause" : pick}
            </button>
          );
        })}
      </div>
      <Field label="Or type a number · 0–1000" unit="a day" value={value} onChange={setValue} />
      <p className="text-[12.5px] text-muted">
        Pause sets the cap to 0: photos and descriptions stop for this account until you change it.
        Barcodes and manual entry keep working.
      </p>
      <div className="flex gap-2">
        <Button variant="outline" disabled={pending} onClick={onDone}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          pending={pending}
          disabled={!valid || next === cap}
          onClick={save}
        >
          {pending
            ? "Saving…"
            : valid
              ? next === 0
                ? "Pause AI"
                : `Save cap · ${next} a day`
              : "Save cap"}
        </Button>
      </div>
    </>
  );
}

/**
 * A user's daily AI cap as a button ("Cap 20 a day", "Paused") that opens a
 * sheet with quick picks or any number. The admin's own account has no cap.
 */
export function CapButton({
  userId,
  email,
  cap,
  usedToday,
  label,
}: {
  userId: string;
  email: string;
  /** null for the admin: no cap, nothing to change */
  cap: number | null;
  usedToday: number;
  /** Replaces the button text, e.g. "Change AI cap" */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  if (cap === null) {
    return label ? null : (
      <span className="inline-flex h-11 items-center rounded-panel border-[1.5px] border-line-strong px-3 text-[13.5px] font-bold text-muted">
        ∞ no cap
      </span>
    );
  }
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={`${cap === 0 ? "border-danger text-danger" : ""} ${label ? "w-full" : ""}`}
        aria-label={label ? undefined : `Daily AI cap for ${email}: ${cap === 0 ? "paused" : cap}`}
      >
        {label ?? (cap === 0 ? "Paused" : `Cap ${cap}`)}
        {!label && cap > 0 && <span className="text-xs font-semibold text-muted">a day</span>}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Daily AI cap">
        {open && (
          <CapForm
            userId={userId}
            email={email}
            cap={cap}
            usedToday={usedToday}
            onDone={() => setOpen(false)}
          />
        )}
      </Sheet>
    </>
  );
}
