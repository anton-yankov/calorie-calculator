"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/loaders";

export function ImageLightbox({
  open,
  src,
  alt,
  loading = false,
  loadError = null,
  onClose,
  onRetry,
}: {
  open: boolean;
  src: string | null;
  alt: string;
  loading?: boolean;
  loadError?: string | null;
  onClose: () => void;
  onRetry?: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function close() {
    onClose();
    requestAnimationFrame(() => returnFocusRef.current?.focus());
  }

  const imageFailed = src !== null && failedSrc === src;
  const error = loadError ?? (imageFailed ? "This image couldn't be displayed." : null);

  function retry() {
    setFailedSrc(null);
    onRetry?.();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label="Image preview"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClose={() => {
        if (open) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      className="m-auto h-dvh w-screen max-h-none max-w-none bg-transparent p-0 backdrop:bg-background/95"
    >
      <div
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        className="flex h-full w-full items-center justify-center p-[max(12px,env(safe-area-inset-top))_max(12px,env(safe-area-inset-right))_max(12px,env(safe-area-inset-bottom))_max(12px,env(safe-area-inset-left))]"
      >
        {src && !imageFailed && (
          // eslint-disable-next-line @next/next/no-img-element -- supports blob, data and catalog URLs
          <img
            src={src}
            alt={alt}
            onError={() => setFailedSrc(src)}
            className="max-h-[calc(100dvh-24px)] w-[min(92vw,1000px)] rounded-panel object-contain"
          />
        )}

        {(loading || error) && (
          <div
            role={error ? "alert" : "status"}
            className="fixed bottom-[max(20px,env(safe-area-inset-bottom))] left-1/2 flex max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-2 rounded-full border border-line bg-surface/90 px-4 py-2 text-sm text-foreground shadow-lg backdrop-blur"
          >
            {loading && <Spinner className="h-4 w-4" />}
            <span>{error ?? "Loading full-size image…"}</span>
            {error && onRetry && (
              <button type="button" onClick={retry} className="font-semibold text-accent">
                Retry
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          aria-label="Close image preview"
          onClick={close}
          className="fixed right-[max(12px,env(safe-area-inset-right))] top-[max(12px,env(safe-area-inset-top))] z-10 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface/90 text-xl font-semibold text-foreground shadow-lg backdrop-blur transition hover:border-accent focus-visible:border-accent focus-visible:outline-none"
        >
          ✕
        </button>
      </div>
    </dialog>
  );
}
