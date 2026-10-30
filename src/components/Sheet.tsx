"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A panel for one focused task (add a food, edit a meal, pick an option). On
 * phones it slides up from the bottom, within thumb reach; on desktop it's a
 * centred dialog. Built on the native <dialog>, which brings focus trapping,
 * Escape to close and the dimmed backdrop for free.
 *
 * `open` is controlled by the parent; every way of closing (Escape, a tap on
 * the backdrop, a button calling onClose) reports back through `onClose`.
 */
export function Sheet({
  open,
  onClose,
  title,
  badge,
  focusPanel = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** A small chip beside the title, e.g. "No AI used" */
  badge?: React.ReactNode;
  /**
   * Focus the panel itself instead of its first field, so a phone keeps the
   * keyboard down until a field is tapped
   */
  focusPanel?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // The latest `open`, read when the dialog's close event fires
  const openRef = useRef(open);
  // The panel's content stays mounted while the sheet slides away
  const [shown, setShown] = useState(open);
  if (open && !shown) setShown(true);

  useEffect(() => {
    openRef.current = open;
    const dialog = ref.current;
    if (!dialog) return;
    // An autofocus attribute on the dialog makes showModal focus the dialog itself
    dialog.toggleAttribute("autofocus", focusPanel);
    if (open) {
      dialog.removeAttribute("data-closing");
      if (!dialog.open) dialog.showModal();
    }
    if (!open && dialog.open) {
      // Play the exit animation (none with reduced motion), then really close
      dialog.setAttribute("data-closing", "");
      void Promise.allSettled(dialog.getAnimations().map((animation) => animation.finished)).then(
        () => {
          // Reopened mid-exit: the exit animation was cancelled, keep it open
          if (openRef.current) return;
          dialog.removeAttribute("data-closing");
          dialog.close();
        },
      );
    }
    if (!open) return;
    // A modal dialog still lets the page behind it scroll on iOS
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [open, focusPanel]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      tabIndex={focusPanel ? -1 : undefined}
      // Escape asks the parent to close, so the sheet slides away like any
      // other close instead of vanishing
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // close also fires (a task later) after the parent sets `open` to false;
      // only a close the user made (a repeated Escape the browser won't let us
      // cancel) is reported, or a parent that swaps one sheet for another would
      // hear onClose for the old one
      onClose={(event) => {
        if (!event.currentTarget.open) setShown(false);
        if (openRef.current) onClose();
      }}
      // The dialog itself has no padding, so a click whose target is the
      // dialog element can only be on the backdrop around the panel
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="sheet m-0 mt-auto max-h-[88dvh] w-full max-w-none overflow-y-auto rounded-t-[28px] bg-surface p-0 text-foreground backdrop:bg-black/60 lg:m-auto lg:max-w-md lg:rounded-[24px] focus:outline-none"
    >
      {shown && (
        <div className="flex flex-col gap-3.5 px-[18px] pt-2.5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] lg:px-6 lg:pt-6 lg:pb-6">
          <span
            aria-hidden
            className="mx-auto mb-1 h-[5px] w-10 rounded-full bg-line-strong lg:hidden"
          />
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[19px] font-extrabold tracking-tight">{title}</h2>
            {badge}
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

/** The green chip beside a sheet title, e.g. "No AI used" or "Saved product". */
export function SheetBadge({ children }: { children: string }) {
  return (
    <span className="shrink-0 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-bold text-success">
      {children}
    </span>
  );
}
