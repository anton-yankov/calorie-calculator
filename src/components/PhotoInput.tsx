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
        className="w-full overflow-hidden rounded-2xl border-2 border-dashed border-neutral-300 bg-white transition hover:border-neutral-400 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-500"
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL, next/image not applicable
          <img
            src={previewUrl}
            alt="Selected meal — tap to view full size"
            className={`w-full object-cover transition-all ${compact ? "max-h-28" : "max-h-80"}`}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 py-14 text-neutral-500">
            <span className="text-4xl" aria-hidden>
              📷
            </span>
            <span className="font-medium">Take or choose a photo</span>
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
            className="flex h-8 items-center rounded-full bg-black/60 px-3 text-xs font-semibold text-white backdrop-blur transition hover:bg-black/80 disabled:opacity-40"
          >
            Change
          </button>
          <button
            type="button"
            disabled={disabled}
            aria-label="Remove photo"
            title="Remove photo"
            onClick={onClear}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-sm font-semibold text-white backdrop-blur transition hover:bg-black/80 disabled:opacity-40"
          >
            ✕
          </button>
        </div>
      )}

      {preparing && (
        <div
          role="status"
          aria-label="Preparing photo"
          className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/70 backdrop-blur-sm dark:bg-neutral-950/70"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-200">
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
        className="m-auto h-dvh w-screen max-h-none max-w-none bg-transparent p-0 backdrop:bg-black/90"
      >
        {previewUrl && (
          <div className="flex h-full w-full items-center justify-center p-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
            <img
              src={previewUrl}
              alt="Selected meal, full size"
              className="max-h-full max-w-full rounded-lg object-contain"
            />
            <button
              type="button"
              aria-label="Close preview"
              className="fixed right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-lg font-semibold text-white backdrop-blur transition hover:bg-white/25"
            >
              ✕
            </button>
          </div>
        )}
      </dialog>
    </div>
  );
}
