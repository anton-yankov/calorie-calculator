"use client";

import { useEffect, useRef } from "react";

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
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** A small chip beside the title, e.g. "No AI used" */
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (!open) return;
    // A modal dialog still lets the page behind it scroll on iOS
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      // The dialog itself has no padding, so a click whose target is the
      // dialog element can only be on the backdrop around the panel
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-0 mt-auto max-h-[88dvh] w-full max-w-none overflow-y-auto rounded-t-[28px] bg-surface p-0 text-foreground backdrop:bg-black/60 lg:m-auto lg:max-w-md lg:rounded-[24px]"
    >
      {open && (
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
