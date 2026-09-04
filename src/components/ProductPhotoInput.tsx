"use client";

import { useRef, useState } from "react";
import { Spinner } from "@/components/loaders";
import { ImageLightbox } from "@/components/ImageLightbox";
import { makeThumbnail, toDisplayableBlob } from "@/lib/resize";

export function ProductPhotoInput({
  imageUrl,
  productName,
  disabled = false,
  onChange,
}: {
  imageUrl: string | null;
  productName: string;
  disabled?: boolean;
  onChange: (imageUrl: string | null) => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  async function select(file: File) {
    setPreparing(true);
    setError(null);
    try {
      // Match meal photos: normalize HEIC when needed, remove metadata, and
      // persist a small JPEG data URL rather than the original upload.
      const displayable = await toDisplayableBlob(file);
      const thumbnail = await makeThumbnail(displayable, 320);
      await onChange(thumbnail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't prepare this image.");
    } finally {
      setPreparing(false);
    }
  }

  async function remove() {
    setPreparing(true);
    setError(null);
    try {
      await onChange(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove this image.");
    } finally {
      setPreparing(false);
    }
  }

  const unavailable = disabled || preparing;

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={unavailable}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void select(file);
          event.target.value = "";
        }}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={unavailable}
          aria-label={imageUrl ? `View image for ${productName}` : `Add image for ${productName}`}
          onClick={() => (imageUrl ? setPreviewOpen(true) : inputRef.current?.click())}
          className="group relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-panel border border-line bg-background transition hover:border-accent disabled:opacity-50"
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- locally generated data URL
            <img src={imageUrl} alt={productName} className="h-full w-full object-contain" />
          ) : (
            <span className="flex flex-col items-center text-muted">
              <span className="font-mono text-xl text-accent" aria-hidden>
                +
              </span>
              <span className="text-[10px] font-semibold">Photo</span>
            </span>
          )}
          {preparing && (
            <span className="absolute inset-0 flex items-center justify-center bg-background/80">
              <Spinner className="h-4 w-4" />
            </span>
          )}
        </button>
        <div className="flex min-w-0 flex-col items-start gap-1">
          <button
            type="button"
            disabled={unavailable}
            onClick={() => inputRef.current?.click()}
            className="text-xs font-semibold text-accent hover:underline disabled:text-muted"
          >
            {preparing ? "Preparing…" : imageUrl ? "Change image" : "Add image"}
          </button>
          {imageUrl && (
            <button
              type="button"
              disabled={unavailable}
              onClick={() => void remove()}
              className="text-xs text-muted hover:text-danger hover:underline disabled:opacity-50"
            >
              Remove
            </button>
          )}
          {!imageUrl && !error && <p className="text-[11px] text-muted">Optional</p>}
          {error && <p className="text-[11px] text-danger">{error}</p>}
        </div>
      </div>
      <ImageLightbox
        open={previewOpen}
        src={imageUrl}
        alt={productName}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
}
