"use client";

import { useEffect, useRef, useState } from "react";
import { AnalysisCard, CompactAnalysis } from "@/components/AnalysisCard";
import { CorrectionBar } from "@/components/CorrectionBar";
import { SkeletonEstimate, Spinner } from "@/components/loaders";
import { PhotoInput } from "@/components/PhotoInput";
import { resizeToJpeg, toDisplayableBlob } from "@/lib/resize";
import type { MealAnalysis } from "@/lib/schema";

interface HistoryEntry {
  /** The correction that produced this estimate; null for the first estimate of a photo */
  correction: string | null;
  analysis: MealAnalysis;
  /**
   * The model's estimate as returned, before any gram edits. Gram edits recompute
   * macros from this baseline so setting grams to 0 doesn't destroy the per-gram
   * ratios (0 × anything stays 0 when scaling the current values).
   */
  baseline: MealAnalysis;
}

function CorrectionBubble({ text }: { text: string }) {
  return (
    <div className="self-end max-w-[85%] rounded-2xl rounded-br-sm border border-emerald-600/30 bg-emerald-600/10 px-3 py-2 text-sm">
      {text}
    </div>
  );
}

export default function Home() {
  // The selected photo, converted to a browser-displayable format if needed (HEIC → JPEG)
  const [sourceBlob, setSourceBlob] = useState<Blob | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [pendingCorrection, setPendingCorrection] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The resized JPEG is cached so corrections re-send the same bytes
  const resizedRef = useRef<Blob | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const latest = history.length > 0 ? history[history.length - 1] : undefined;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (history.length > 1 || pendingCorrection) {
      threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [history.length, pendingCorrection]);

  async function handleSelect(selected: File) {
    setHistory([]);
    setError(null);
    resizedRef.current = null;
    setPreparing(true);
    try {
      const displayable = await toDisplayableBlob(selected);
      setSourceBlob(displayable);
      setPreviewUrl(URL.createObjectURL(displayable));
    } catch (err) {
      console.error("photo preparation failed:", err);
      const detail =
        err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err);
      setSourceBlob(null);
      setPreviewUrl(null);
      setError(`Couldn't read that image (${detail}). Try a JPEG/PNG, or take the photo directly.`);
    } finally {
      setPreparing(false);
    }
  }

  function handleClear() {
    setSourceBlob(null);
    setPreviewUrl(null); // the effect cleanup revokes the old object URL
    setHistory([]);
    setError(null);
    resizedRef.current = null;
  }

  async function analyze(correction?: string) {
    if (!sourceBlob) return;
    setLoading(true);
    setError(null);
    if (correction) setPendingCorrection(correction);
    try {
      if (!resizedRef.current) {
        resizedRef.current = await resizeToJpeg(sourceBlob);
      }
      const form = new FormData();
      form.append("image", resizedRef.current, "meal.jpg");
      if (description.trim()) form.append("description", description.trim());
      if (correction && latest) {
        form.append("previousResult", JSON.stringify(latest.analysis));
        form.append("correction", correction);
      }

      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const body = (await res.json()) as MealAnalysis | { error: string };
      if (!res.ok || "error" in body) {
        throw new Error("error" in body ? body.error : `Request failed (${res.status})`);
      }
      setHistory((prev) =>
        correction
          ? [...prev, { correction, analysis: body, baseline: body }]
          : [{ correction: null, analysis: body, baseline: body }],
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      setPendingCorrection(null);
    }
  }

  function handleGramsChange(foodIndex: number, grams: number) {
    setHistory((prev) => {
      const last = prev[prev.length - 1];
      if (!last) return prev;
      const foods = last.analysis.foods.map((food, i) => {
        if (i !== foodIndex) return food;
        // Recompute from the untouched baseline, not the current (possibly zeroed) values
        const base = last.baseline.foods[i];
        if (!base || base.grams <= 0) return { ...food, grams };
        const ratio = grams / base.grams;
        return {
          ...food,
          grams,
          calories: base.calories * ratio,
          protein_g: base.protein_g * ratio,
          carbs_g: base.carbs_g * ratio,
          fat_g: base.fat_g * ratio,
        };
      });
      const totals = foods.reduce(
        (acc, f) => ({
          calories: acc.calories + f.calories,
          protein_g: acc.protein_g + f.protein_g,
          carbs_g: acc.carbs_g + f.carbs_g,
          fat_g: acc.fat_g + f.fat_g,
        }),
        { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
      );
      return [...prev.slice(0, -1), { ...last, analysis: { ...last.analysis, foods, totals } }];
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-3 px-4 py-6">
      <header>
        <h1 className="text-2xl font-bold">Calorie Calculator</h1>
        <p className="text-sm text-neutral-500">
          Photo in, macros out. Estimates — correct them below.
        </p>
      </header>

      <PhotoInput
        previewUrl={previewUrl}
        disabled={loading || preparing}
        preparing={preparing}
        compact={history.length > 0}
        onSelect={(f) => void handleSelect(f)}
        onClear={handleClear}
      />

      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Optional details — e.g. rye bread, whole milk, olive oil"
        className="rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
      />

      <button
        type="button"
        disabled={!sourceBlob || loading || preparing}
        onClick={() => analyze()}
        className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-40"
      >
        {/* During photo prep the frame overlay is the loader — the button stays plain */}
        {loading && <Spinner />}
        {loading ? "Analyzing…" : latest ? "Start over with this photo" : "Analyze"}
      </button>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {history.map((entry, idx) => {
        const isLatest = idx === history.length - 1;
        const previous = idx > 0 ? (history[idx - 1]?.analysis ?? null) : null;
        const label = history.length > 1 ? `Estimate ${idx + 1}` : "Estimate";
        return (
          <div key={idx} className="flex flex-col gap-3">
            {entry.correction && <CorrectionBubble text={entry.correction} />}
            {isLatest ? (
              <AnalysisCard
                analysis={entry.analysis}
                previous={previous}
                label={label}
                disabled={loading}
                onGramsChange={handleGramsChange}
              />
            ) : (
              <CompactAnalysis analysis={entry.analysis} label={label} />
            )}
          </div>
        );
      })}

      {loading && !pendingCorrection && (
        <SkeletonEstimate label={latest ? "New estimate" : "Estimate"} />
      )}

      {pendingCorrection && (
        <>
          <CorrectionBubble text={pendingCorrection} />
          <SkeletonEstimate label={`Estimate ${history.length + 1}`} />
        </>
      )}

      {latest && !pendingCorrection && (
        <>
          <CorrectionBar
            disabled={loading}
            loading={loading}
            onSubmit={(correction) => analyze(correction)}
          />
          <p className="text-center text-xs text-neutral-400">
            Edit grams for instant recalculation, or describe what’s wrong to re-analyze.
          </p>
        </>
      )}

      <div ref={threadEndRef} />
    </main>
  );
}
