"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/loaders";
import { ImageLightbox } from "@/components/ImageLightbox";
import type { NutritionLabelAnalysis } from "@/lib/nutrition-label";
import { resizeToJpeg, toDisplayableBlob } from "@/lib/resize";

function basisMessage(result: NutritionLabelAnalysis): string {
  if (result.basis === "per_100_ml") return "Filled from values per 100 ml (treated as 100 g).";
  if (result.basis === "calculated_per_100")
    return "Filled after converting serving values to 100 g/ml.";
  if (result.basis === "per_100_g") return "Filled from values per 100 g.";
  return "Filled the values that were readable. Check the label carefully.";
}

export function NutritionLabelInput({
  disabled,
  onExtracted,
}: {
  disabled: boolean;
  onExtracted: (result: NutritionLabelAnalysis) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NutritionLabelAnalysis | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function analyze(file: File) {
    setAnalyzing(true);
    setError(null);
    setResult(null);
    try {
      const displayable = await toDisplayableBlob(file);
      const nextPreviewUrl = URL.createObjectURL(displayable);
      setPreviewUrl(nextPreviewUrl);
      const resized = await resizeToJpeg(displayable, 1800);
      const form = new FormData();
      form.append("image", resized, "nutrition-label.jpg");

      const response = await fetch("/api/products/analyze-label", { method: "POST", body: form });
      const body = (await response.json()) as NutritionLabelAnalysis | { error: string };
      if (!response.ok || "error" in body) {
        throw new Error("error" in body ? body.error : "Couldn't read the nutrition label.");
      }
      setResult(body);
      onExtracted(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read the nutrition label.");
    } finally {
      setAnalyzing(false);
    }
  }

  const unavailable = disabled || analyzing;

  return (
    <section className="rounded-panel border border-accent/40 bg-accent-soft/45 p-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={unavailable}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void analyze(file);
          event.target.value = "";
        }}
      />
      <div className="flex items-center gap-3">
        {previewUrl ? (
          <button
            type="button"
            aria-label="View nutrition label photo"
            onClick={() => setPreviewOpen(true)}
            className="h-16 w-16 shrink-0 overflow-hidden rounded-panel border border-line bg-background transition hover:border-accent focus-visible:border-accent focus-visible:outline-none"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          </button>
        ) : (
          <span
            aria-hidden
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-panel border border-line bg-background text-2xl text-accent"
          >
            ▤
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Scan the nutrition label</p>
          <p className="mt-0.5 text-xs text-muted">
            Photograph the full table, straight-on and in good light.
          </p>
          <button
            type="button"
            disabled={unavailable}
            onClick={() => inputRef.current?.click()}
            className="mt-2 flex items-center gap-2 rounded-panel bg-accent px-3 py-2 text-xs font-semibold text-background transition hover:brightness-110 disabled:opacity-50"
          >
            {analyzing && <Spinner className="h-3.5 w-3.5" />}
            {analyzing ? "Reading label…" : previewUrl ? "Retake photo" : "Take label photo"}
          </button>
        </div>
      </div>
      {result && (
        <div role="status" className="mt-3 border-t border-accent/25 pt-2 text-xs">
          <p className="font-medium text-success">{basisMessage(result)}</p>
          {result.warnings.length > 0 && (
            <p className="mt-1 text-muted">{result.warnings.join(" ")}</p>
          )}
          <p className="mt-1 text-muted">Review every filled value before saving.</p>
        </div>
      )}
      {error && <p className="mt-3 text-xs text-danger">{error}</p>}
      <ImageLightbox
        open={previewOpen}
        src={previewUrl}
        alt="Nutrition label, full size"
        onClose={() => setPreviewOpen(false)}
      />
    </section>
  );
}
