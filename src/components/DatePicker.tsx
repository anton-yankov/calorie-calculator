"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { dayKey, dayLabel } from "@/lib/day";

// Estimated popover footprint, used to pick a side before it renders
const POP_HEIGHT = 300;
const POP_WIDTH = 264;

// 2024-01-01 was a Monday — weeks here start on Monday
const WEEKDAYS = Array.from({ length: 7 }, (_, i) =>
  new Date(2024, 0, 1 + i).toLocaleDateString(undefined, { weekday: "narrow" }),
);

/**
 * Styled replacement for `<input type="date">`: a trigger button labeled with
 * the day ("Today", "Yesterday", "Thu 28 Aug") that opens a calendar popover.
 * The popover is position:fixed and portaled to <body> so it escapes both
 * overflow-hidden ancestors (the log's meal cards clip their children to the
 * panel radius) and transformed ancestors (the page-enter animation), which
 * would otherwise clip it or hijack its containing block.
 *
 * `value`/`max` are local-timezone YYYY-MM-DD keys; days after `max` are
 * disabled and can't be navigated to.
 */
export function DatePicker({
  value,
  max,
  disabled = false,
  onChange,
  className = "rounded-panel border-line bg-surface px-3 py-2.5 text-xs",
  ariaLabel = "Choose a day",
}: {
  value: string;
  max?: string;
  disabled?: boolean;
  onChange: (key: string) => void;
  /** Trigger skin (radius, background, padding, text size) — varies per context */
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  // [year, monthIndex] shown in the calendar; follows `value` on open
  const [view, setView] = useState<[number, number]>(() => {
    const d = new Date(`${value}T12:00:00`);
    return [d.getFullYear(), d.getMonth()];
  });
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - POP_WIDTH - 8));
    const spaceBelow = window.innerHeight - r.bottom;
    setPos(
      spaceBelow < POP_HEIGHT + 8 && r.top > POP_HEIGHT + 8
        ? { bottom: window.innerHeight - r.top + 6, left }
        : { top: r.bottom + 6, left },
    );
  }, []);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const d = new Date(`${value}T12:00:00`);
    setView([d.getFullYear(), d.getMonth()]);
    place();
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (!popRef.current?.contains(t) && !triggerRef.current?.contains(t)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    // Fixed positioning doesn't follow the page — track it instead of drifting
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  const [year, month] = view;
  const todayKey = dayKey(new Date());
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const nextDisabled = max !== undefined && dayKey(new Date(year, month + 1, 1)) > max;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={toggle}
        className={`flex shrink-0 items-center gap-1.5 border font-mono text-foreground transition-colors hover:border-accent disabled:text-muted disabled:hover:border-line ${className}`}
      >
        {dayLabel(value)}
        <svg
          aria-hidden
          viewBox="0 0 12 12"
          className={`h-3 w-3 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M2.5 4.5 6 8l3.5-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={popRef}
            role="dialog"
            aria-label="Choose a day"
            style={{ top: pos.top, bottom: pos.bottom, left: pos.left }}
            className="fixed z-50 rounded-panel border border-line bg-surface-raised p-3 shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setView(([y, m]) => (m === 0 ? [y - 1, 11] : [y, m - 1]))}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground"
              >
                ‹
              </button>
              <span className="font-serif text-sm font-semibold">{monthLabel}</span>
              <button
                type="button"
                aria-label="Next month"
                disabled={nextDisabled}
                onClick={() => setView(([y, m]) => (m === 11 ? [y + 1, 0] : [y, m + 1]))}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground disabled:text-muted/30 disabled:hover:bg-transparent"
              >
                ›
              </button>
            </div>

            <div className="grid grid-cols-7">
              {WEEKDAYS.map((label, i) => (
                <span
                  key={i}
                  aria-hidden
                  className="flex h-6 w-8 items-center justify-center text-[10px] uppercase tracking-[0.08em] text-muted"
                >
                  {label}
                </span>
              ))}
              {cells.map((day, i) => {
                if (day === null) return <span key={`blank-${i}`} />;
                const key = dayKey(new Date(year, month, day));
                const isSelected = key === value;
                const isToday = key === todayKey;
                const isDisabled = max !== undefined && key > max;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={isDisabled}
                    aria-pressed={isSelected}
                    onClick={() => {
                      onChange(key);
                      setOpen(false);
                    }}
                    className={`h-8 w-8 rounded-md font-mono text-xs tabular-nums transition-colors ${
                      isSelected
                        ? "bg-accent font-semibold text-background"
                        : isDisabled
                          ? "text-muted/30"
                          : `hover:bg-accent-soft ${isToday ? "font-semibold text-accent" : ""}`
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
