"use client";

import { useRef } from "react";
import { Spinner } from "@/components/loaders";

interface PhotoInputProps {
  previewUrl: string | null;
  disabled: boolean;
  /** Photo is being decoded/converted (HEIC) — shows the in-frame overlay */
  preparing: boolean;
  /** Once results exist the photo shrinks so the estimates own the screen */
  compact: boolean;
  onSelect: (file: File) => void;
  /** Remove the current photo (and its results) */
  onClear: () => void;
}

export function PhotoInput({
  previewUrl,
  disabled,
  preparing,
  compact,
  onSelect,
  onClear,
}: PhotoInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSelect(file);
          e.target.value = ""; // allow re-selecting the same file
        }}
      />
      {/* With a photo: tap = full-screen preview. Without: tap = pick a photo. */}
      <button
        type="button"
        disabled={preparing || (!previewUrl && disabled)}
        title={previewUrl ? "View photo" : undefined}
        onClick={() => (previewUrl ? dialogRef.current?.showModal() : inputRef.current?.click())}
        className="group w-full overflow-hidden rounded-panel border-2 border-dashed border-line bg-surface transition duration-200 hover:border-accent hover:bg-surface-raised disabled:opacity-50"
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL, next/image not applicable
          <img
            src={previewUrl}
            alt="Selected meal — tap to view full size"
            className={`w-full object-cover transition-all duration-500 group-hover:scale-[1.01] ${compact ? "max-h-28" : "max-h-80"}`}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 px-5 py-14 text-muted">
            <span
              className="mb-1 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-background font-mono text-xl text-accent transition-transform group-hover:-translate-y-0.5"
              aria-hidden
            >
              +
            </span>
            <span className="font-semibold text-foreground">Take or choose a photo</span>
            <span className="text-sm">One photo of the whole meal works best</span>
          </div>
        )}
      </button>

      {previewUrl && !preparing && (
        <div className="absolute right-2 top-2 flex items-center gap-1.5">
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="flex h-8 items-center rounded-full border border-line bg-background/85 px-3 text-xs font-semibold text-foreground backdrop-blur transition hover:border-accent disabled:opacity-40"
          >
            Change
          </button>
          <button
            type="button"
            disabled={disabled}
            aria-label="Remove photo"
            title="Remove photo"
            onClick={onClear}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-background/85 text-sm font-semibold text-foreground backdrop-blur transition hover:border-accent disabled:opacity-40"
          >
            ✕
          </button>
        </div>
      )}

      {preparing && (
        <div
          role="status"
          aria-label="Preparing photo"
          className="absolute inset-0 flex items-center justify-center rounded-panel bg-background/75 backdrop-blur-sm"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Spinner />
            Preparing photo…
          </span>
        </div>
      )}

      {/* Full-screen preview — native <dialog>: Esc, focus trap, and backdrop for free.
          Tap anywhere (or ✕) to close. */}
      <dialog
        ref={dialogRef}
        aria-label="Photo preview"
        onClick={(e) => e.currentTarget.close()}
        className="m-auto h-dvh w-screen max-h-none max-w-none bg-transparent p-0 backdrop:bg-background/95"
      >
        {previewUrl && (
          <div className="flex h-full w-full items-center justify-center p-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
            <img
              src={previewUrl}
              alt="Selected meal, full size"
              className="max-h-full max-w-full rounded-panel object-contain"
            />
            <button
              type="button"
              aria-label="Close preview"
              className="fixed right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface/85 text-lg font-semibold text-foreground backdrop-blur transition hover:border-accent"
            >
              ✕
            </button>
          </div>
        )}
      </dialog>
    </div>
  );
}
