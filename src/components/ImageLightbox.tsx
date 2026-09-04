"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/loaders";

export interface LightboxImage {
  /** What to show right away — a thumbnail, data URL, or object URL */
  src: string;
  alt: string;
  /**
   * Optional loader for a larger version. The viewer opens on `src` at once
   * and swaps to the loaded image when it resolves; null keeps `src`.
   */
  load?: () => Promise<string | null>;
}

interface LightboxState {
  open: (image: LightboxImage) => void;
}

const LightboxContext = createContext<LightboxState | null>(null);

/**
 * One full-screen image viewer for the whole app, mounted in the root layout.
 * A single native <dialog> outside every page: it can't be a DOM child of a
 * <summary> (taps inside would toggle the meal card) and there's no dialog per
 * row. showModal() gives Escape, a focus trap and the backdrop for free.
 */
export function LightboxProvider({ children }: { children: React.ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [image, setImage] = useState<LightboxImage | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Identifies the current open() so a late loader can't overwrite a newer image
  const requestRef = useRef(0);

  const open = useCallback((next: LightboxImage) => {
    const request = ++requestRef.current;
    setImage(next);
    setSrc(next.src);
    setLoading(!!next.load);
    dialogRef.current?.showModal();
    if (!next.load) return;
    next
      .load()
      .then((large) => {
        if (requestRef.current !== request) return;
        if (large) setSrc(large);
      })
      .catch(() => {
        // The small image is already showing; nothing more to do
      })
      .finally(() => {
        if (requestRef.current === request) setLoading(false);
      });
  }, []);

  function handleClose() {
    requestRef.current++;
    setImage(null);
    setSrc(null);
    setLoading(false);
  }

  // Lock page scroll while the viewer is open (the dialog itself scrolls nothing)
  useEffect(() => {
    if (!image) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [image]);

  return (
    <LightboxContext.Provider value={{ open }}>
      {children}
      {/* Tap anywhere (or ✕) to close. Padding includes the safe-area insets so
          neither the image nor the close button sits under a notch. */}
      <dialog
        ref={dialogRef}
        aria-label={image?.alt || "Image preview"}
        onClick={(e) => e.currentTarget.close()}
        onClose={handleClose}
        className="m-auto h-dvh max-h-none w-screen max-w-none cursor-pointer bg-transparent p-0 backdrop:bg-background/95"
      >
        {image && src && (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{
              padding:
                "max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left))",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- data or object URL */}
            <img
              src={src}
              alt={image.alt}
              // Small originals (old 160px thumbnails) are shown at up to 2× their
              // size, not stretched to the screen, so they read as a preview
              // rather than a blur; anything larger simply fits the viewport.
              className="max-h-full rounded-panel object-contain"
              style={{ width: "min(100%, 2 * var(--natural-w, 100vw))" }}
              onLoad={(e) => {
                e.currentTarget.style.setProperty(
                  "--natural-w",
                  `${e.currentTarget.naturalWidth}px`,
                );
              }}
            />
            {loading && (
              <span
                role="status"
                aria-label="Loading full-size image"
                className="fixed flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface/85 text-foreground backdrop-blur"
                style={{
                  left: "max(16px, env(safe-area-inset-left))",
                  top: "max(16px, env(safe-area-inset-top))",
                }}
              >
                <Spinner className="h-4 w-4" />
              </span>
            )}
            <button
              type="button"
              aria-label="Close preview"
              className="fixed flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface/85 text-lg font-semibold text-foreground backdrop-blur transition hover:border-accent"
              style={{
                right: "max(16px, env(safe-area-inset-right))",
                top: "max(16px, env(safe-area-inset-top))",
              }}
            >
              ✕
            </button>
          </div>
        )}
      </dialog>
    </LightboxContext.Provider>
  );
}

export function useLightbox() {
  const ctx = useContext(LightboxContext);
  if (!ctx) throw new Error("useLightbox must be used within LightboxProvider");
  return ctx;
}

/**
 * An image that opens in the viewer when tapped. The whole image is the tap
 * target; `preventDefault` keeps a tap inside a <summary> from toggling it.
 */
export function ZoomableImage({
  src,
  alt,
  className,
  imgClassName,
  load,
  label,
}: {
  src: string;
  alt: string;
  /** Classes for the button (size, shape, border) */
  className?: string;
  /** Classes for the <img> (object-fit etc.) */
  imgClassName?: string;
  load?: () => Promise<string | null>;
  /** Accessible name, e.g. "View photo of Lunch" */
  label?: string;
}) {
  const { open } = useLightbox();
  return (
    <button
      type="button"
      aria-label={label ?? "View image"}
      title={label ?? "View image"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        open({ src, alt, load });
      }}
      className={`overflow-hidden transition hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${className ?? ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- data or object URL */}
      <img src={src} alt={alt} className={`h-full w-full ${imgClassName ?? "object-cover"}`} />
    </button>
  );
}
