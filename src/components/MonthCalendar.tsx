"use client";

import type { GoalStatus } from "@/lib/goal-status";

/** How one calendar day reads: a goal outcome, nothing logged, or not in reach (future, out of range). */
export type CalendarDay = Exclude<GoalStatus, "progress"> | "today" | "empty" | "none";

const CELL: Record<CalendarDay, string> = {
  met: "bg-success text-[#10241d]",
  over: "bg-danger text-[#2c1015]",
  near: "bg-amber text-[#2c2410]",
  short: "bg-amber text-[#2c2410]",
  empty: "bg-surface-raised text-muted",
  today: "border-2 border-tint-lose text-tint-lose",
  none: "text-line-strong",
};

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (year: number, month: number, day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;

/**
 * Whole months as calendars, Monday first, with large dates: one square per
 * day coloured by how it went. The current month stops at this week, so there
 * are no rows of empty future dates. `onSelect` makes days with data tappable.
 */
export function MonthCalendar({
  months,
  today,
  dayStatus,
  onSelect,
  selected,
  summary,
}: {
  /** [year, monthIndex] pairs, shown in the order given */
  months: [number, number][];
  today: string;
  dayStatus: (key: string) => CalendarDay;
  onSelect?: (key: string) => void;
  selected?: string | null;
  /** Optional line beside each month's name, e.g. "19 of 27 on track" */
  summary?: (year: number, month: number) => string | null;
}) {
  return (
    <div className="flex flex-col gap-3.5">
      {months.map(([year, month], index) => {
        const first = new Date(year, month, 1);
        const lead = (first.getDay() + 6) % 7; // Monday = 0
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        // In the current month, stop at the end of this week
        const [ty, tm, td] = today.split("-").map(Number);
        const isCurrent = ty === year && tm === month + 1;
        const lastDay = isCurrent
          ? Math.min(daysInMonth, td! + (6 - ((new Date(year, month, td!).getDay() + 6) % 7)))
          : daysInMonth;
        const note = summary?.(year, month) ?? null;
        return (
          <div
            key={`${year}-${month}`}
            className={`flex flex-col gap-2.5 ${index > 0 ? "border-t border-line pt-3.5" : ""}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-extrabold">
                {first.toLocaleDateString("en-GB", {
                  month: "long",
                  year: ty === year ? undefined : "numeric",
                })}
              </span>
              {note && <span className="text-[12.5px] text-muted">{note}</span>}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <span key={i} aria-hidden className="text-center text-xs font-bold text-muted">
                  {d}
                </span>
              ))}
              {Array.from({ length: lead }, (_, i) => (
                <span key={`lead-${i}`} />
              ))}
              {Array.from({ length: lastDay }, (_, i) => {
                const key = keyOf(year, month, i + 1);
                const status = dayStatus(key);
                const clickable = onSelect && status !== "none" && status !== "empty";
                const className = `flex aspect-square items-center justify-center rounded-[12px] text-[15px] font-extrabold tabular-nums ${CELL[status]} ${
                  selected === key ? "ring-2 ring-foreground ring-offset-2 ring-offset-surface" : ""
                }`;
                return clickable ? (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onSelect(key)}
                    aria-label={new Date(`${key}T12:00:00`).toLocaleDateString("en-GB", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                    className={`${className} transition hover:brightness-110`}
                  >
                    {i + 1}
                  </button>
                ) : (
                  <span key={key} className={className}>
                    {i + 1}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
