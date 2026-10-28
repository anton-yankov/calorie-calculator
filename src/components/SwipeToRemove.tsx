"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";

/** The Delete pill when open; the row moves this plus GAP so the two never touch */
const PILL_W = 92;
const GAP = 10;
const REVEAL = PILL_W + GAP;
/** Past this share of the row's width, letting go removes the food */
const COMMIT_AT = 0.55;
const LEAVE_MS = 220;
const FOLD_MS = 280;
const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
const EASE_SPRING = "cubic-bezier(0.34, 1.28, 0.64, 1)";
/** How many first estimates nudge a row to show it can be swiped */
const HINT_KEY = "swipe-remove-hints";
const HINT_RUNS = 2;

type Motion = "none" | "settle" | "spring" | "leave";

// Only one row is open at a time, across every list
let openRow: { owner: object; close: () => void } | null = null;

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A list whose rows unfold when they arrive after it first rendered (an undone
 * removal, a scanned food joining the plate), but not on its first paint.
 */
export function SwipeList({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLUListElement>(null);
  useEffect(() => {
    ref.current?.setAttribute("data-ready", "");
  }, []);
  return (
    <ul ref={ref} className={className}>
      {children}
    </ul>
  );
}

/**
 * One list row that can be swiped left to reveal Delete. A short drag stops at
 * the pill; a long drag or a fast flick removes the row straight away. The row
 * slides off and folds its height before `onRemove` runs, so the list closes
 * the gap smoothly. Keyboard users reach the same pill with Tab.
 */
export function SwipeToRemove({
  label,
  disabled = false,
  hint = false,
  onRemove,
  children,
}: {
  /** What's being removed, for "Remove …" */
  label: string;
  disabled?: boolean;
  /** Nudge this row once on the first few estimates, to show it can be swiped */
  hint?: boolean;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const itemRef = useRef<HTMLLIElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const onRemoveRef = useRef(onRemove);
  const drag = useRef({
    pointer: null as number | null,
    startX: 0,
    startY: 0,
    base: 0,
    x: 0,
    lock: null as "x" | "y" | null,
    committed: false,
    samples: [] as { x: number; t: number }[],
    frame: 0,
    open: false,
    removing: false,
    swallowClick: false,
    outside: null as ((e: PointerEvent) => void) | null,
    scroll: null as (() => void) | null,
  });

  useEffect(() => {
    onRemoveRef.current = onRemove;
  });

  /** Moves the row to `x` and sizes the pill to the space it left, minus the gap. */
  function place(x: number, committed = false) {
    const row = rowRef.current;
    const pill = pillRef.current;
    const content = contentRef.current;
    const text = textRef.current;
    if (!row || !pill || !content || !text) return;
    const width = Math.max(0, -x - GAP);
    row.style.transform = x ? `translate3d(${x}px, 0, 0)` : "";
    pill.style.width = `${width}px`;
    const withText = width >= content.offsetWidth + 14;
    text.style.opacity = withText ? "1" : "0";
    // Centred while it fits; past the commit point it hugs the row's edge
    const shown = withText ? content.offsetWidth : 18;
    const offset = committed ? 16 : (width - shown) / 2;
    const scale = 0.7 + 0.3 * Math.min(1, width / PILL_W);
    content.style.transform = `translate3d(${offset}px, 0, 0) scale(${scale})`;
    content.style.opacity = String(Math.min(1, Math.max(0, (width - 10) / 30)));
    pill.toggleAttribute("data-commit", committed);
  }

  function setMotion(motion: Motion) {
    const row = rowRef.current;
    const pill = pillRef.current;
    if (!row || !pill) return;
    const reduced = reducedMotion();
    const transition =
      motion === "none"
        ? ""
        : reduced
          ? "120ms ease"
          : motion === "leave"
            ? `${LEAVE_MS}ms cubic-bezier(0.4, 0, 1, 1)`
            : `380ms ${motion === "spring" ? EASE_SPRING : EASE_OUT}`;
    row.style.transition = transition && `transform ${transition}`;
    pill.style.transition = transition && `width ${transition}`;
  }

  function stopListening() {
    const state = drag.current;
    if (state.outside) document.removeEventListener("pointerdown", state.outside, true);
    if (state.scroll) window.removeEventListener("scroll", state.scroll, true);
    state.outside = null;
    state.scroll = null;
  }

  function close() {
    const state = drag.current;
    if (state.removing) return;
    setMotion("settle");
    place(0);
    state.open = false;
    if (openRow?.owner === state) openRow = null;
    stopListening();
  }

  function closeOthers() {
    if (openRow && openRow.owner !== drag.current) openRow.close();
  }

  function open() {
    const state = drag.current;
    closeOthers();
    setMotion("spring");
    place(-REVEAL);
    state.open = true;
    openRow = { owner: state, close };
    if (!state.outside) {
      // A tap anywhere else, or scrolling, closes it
      state.outside = (e: PointerEvent) => {
        if (!itemRef.current?.contains(e.target as Node)) close();
      };
      state.scroll = () => close();
      document.addEventListener("pointerdown", state.outside, true);
      window.addEventListener("scroll", state.scroll, { capture: true, passive: true });
    }
  }

  function remove() {
    const state = drag.current;
    const item = itemRef.current;
    if (state.removing || !item) return;
    state.removing = true;
    state.open = false;
    if (openRow?.owner === state) openRow = null;
    stopListening();
    const reduced = reducedMotion();
    setMotion("leave");
    place(-item.offsetWidth - GAP, true);
    setTimeout(
      () => {
        item.setAttribute("data-folded", "");
        setTimeout(() => onRemoveRef.current(), reduced ? 0 : FOLD_MS);
      },
      reduced ? 0 : LEAVE_MS,
    );
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (disabled || state.removing || e.button !== 0) return;
    state.pointer = e.pointerId;
    state.startX = e.clientX;
    state.startY = e.clientY;
    state.lock = null;
    state.committed = false;
    state.base = state.open ? -REVEAL : 0;
    state.x = state.base;
    state.samples = [{ x: e.clientX, t: e.timeStamp }];
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    const item = itemRef.current;
    if (e.pointerId !== state.pointer || !item) return;
    let dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    if (state.lock === null) {
      // Only a clearly sideways drag swipes; anything else scrolls the page
      if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        state.lock = "x";
        e.currentTarget.setPointerCapture(e.pointerId);
        e.currentTarget.style.userSelect = "none";
        setMotion("none");
        closeOthers();
        state.startX = e.clientX;
        dx = 0;
      } else if (Math.abs(dy) > 8) {
        state.lock = "y";
        return;
      } else return;
    }
    if (state.lock !== "x") return;
    const raw = state.base + dx;
    // A little rubber band to the right of rest
    state.x = raw > 0 ? Math.min(18, raw * 0.22) : Math.max(raw, -item.offsetWidth + 24);
    const committed = -state.x > item.offsetWidth * COMMIT_AT;
    if (committed !== state.committed) {
      state.committed = committed;
      const content = contentRef.current;
      if (content) {
        content.style.transition = `transform 220ms ${EASE_OUT}, opacity 150ms ease`;
        setTimeout(() => (content.style.transition = ""), 230);
      }
      if (committed) navigator.vibrate?.(8);
    }
    state.samples.push({ x: e.clientX, t: e.timeStamp });
    if (state.samples.length > 5) state.samples.shift();
    cancelAnimationFrame(state.frame);
    state.frame = requestAnimationFrame(() => place(state.x, state.committed));
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    const item = itemRef.current;
    if (e.pointerId !== state.pointer || !item) return;
    state.pointer = null;
    e.currentTarget.style.userSelect = "";
    if (state.lock !== "x") {
      // A tap on an open row closes it instead of reaching the field underneath
      if (state.lock === null && state.open) {
        state.swallowClick = true;
        close();
      }
      return;
    }
    state.swallowClick = true;
    cancelAnimationFrame(state.frame);
    const first = state.samples[0]!;
    const last = state.samples[state.samples.length - 1]!;
    const velocity = last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0;
    if (state.committed || (velocity < -1.2 && -state.x > item.offsetWidth * 0.35)) remove();
    else if (velocity > 0.3 || (velocity > -0.3 && -state.x < REVEAL * 0.45)) close();
    else open();
  }

  function onPointerCancel(e: React.PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (e.pointerId !== state.pointer) return;
    state.pointer = null;
    e.currentTarget.style.userSelect = "";
    if (state.lock === "x") close();
  }

  // A swipe ends in a click on whatever was under the finger; don't let it land
  function onClickCapture(e: React.MouseEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state.swallowClick) return;
    state.swallowClick = false;
    e.preventDefault();
    e.stopPropagation();
    const active = document.activeElement;
    if (active instanceof HTMLElement && e.currentTarget.contains(active)) active.blur();
  }

  // Busy (re-estimating, logging): close and stay closed
  useEffect(() => {
    if (disabled && drag.current.open) close();
  });

  useEffect(() => {
    const state = drag.current;
    return () => {
      cancelAnimationFrame(state.frame);
      if (state.outside) document.removeEventListener("pointerdown", state.outside, true);
      if (state.scroll) window.removeEventListener("scroll", state.scroll, true);
      if (openRow?.owner === state) openRow = null;
    };
  }, []);

  // The first-run nudge: once the row is in view, slide it left a little and back
  useEffect(() => {
    const item = itemRef.current;
    if (!hint || !item || reducedMotion()) return;
    const shown = Number(localStorage.getItem(HINT_KEY) ?? 0);
    if (shown >= HINT_RUNS) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        observer.disconnect();
        localStorage.setItem(HINT_KEY, String(shown + 1));
        timers.push(
          setTimeout(() => {
            const state = drag.current;
            if (state.open || state.pointer !== null || state.removing) return;
            setMotion("settle");
            place(-64);
            timers.push(
              setTimeout(() => {
                if (drag.current.pointer !== null) return;
                setMotion("spring");
                place(0);
              }, 750),
            );
          }, 700),
        );
      },
      { threshold: 0.6 },
    );
    observer.observe(item);
    return () => {
      observer.disconnect();
      timers.forEach(clearTimeout);
    };
    // Once per mount: the nudge is a first impression, not a reaction to props
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <li ref={itemRef} className="swipe-fold border-t border-line first:border-t-0">
      <div className="relative overflow-hidden">
        <div
          ref={rowRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onClickCapture={onClickCapture}
          className="relative z-[1] touch-pan-y bg-surface py-2.5 will-change-transform"
        >
          {children}
        </div>
        <button
          ref={pillRef}
          type="button"
          disabled={disabled}
          aria-label={`Remove ${label}`}
          onClick={remove}
          onFocus={(e) => {
            if (e.currentTarget.matches(":focus-visible") && !drag.current.open) open();
          }}
          onBlur={() => {
            if (drag.current.open && drag.current.pointer === null) close();
          }}
          className="swipe-pill absolute top-2.5 right-0 z-0 h-11 w-0 overflow-hidden rounded-panel bg-danger text-background"
        >
          <span
            ref={contentRef}
            aria-hidden
            className="absolute inset-y-0 left-0 flex origin-[9px_50%] items-center gap-1.5 text-sm font-extrabold whitespace-nowrap opacity-0"
          >
            <Trash2 className="h-[18px] w-[18px]" strokeWidth={2.4} aria-hidden />
            <span ref={textRef} className="transition-opacity duration-150">
              Delete
            </span>
          </span>
        </button>
      </div>
    </li>
  );
}
