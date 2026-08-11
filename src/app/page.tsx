"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnalysisCard, CompactAnalysis } from "@/components/AnalysisCard";
import { CorrectionBar } from "@/components/CorrectionBar";
import { SkeletonEstimate, Spinner } from "@/components/loaders";
import { PhotoInput } from "@/components/PhotoInput";
import { saveMeal } from "@/lib/log";
import { makeThumbnail, resizeToJpeg, toDisplayableBlob } from "@/lib/resize";
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
    <div className="self-end max-w-[85%] rounded-panel rounded-br-sm bg-surface px-4 py-2.5 text-sm text-foreground">
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
  // History length at the moment of logging — logging re-enables after a correction
  const [loggedAtLength, setLoggedAtLength] = useState<number | null>(null);
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
    setLoggedAtLength(null);
    resizedRef.current = null;
  }

  async function handleLog() {
    if (!latest) return;
    try {
      const thumbnail = resizedRef.current ? await makeThumbnail(resizedRef.current) : null;
      saveMeal({
        id: crypto.randomUUID(),
        loggedAt: new Date().toISOString(),
        description: description.trim(),
        analysis: latest.analysis,
        thumbnail,
      });
      setLoggedAtLength(history.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the meal");
    }
  }

  async function analyze(correction?: string) {
    if (!sourceBlob) return;
    setLoading(true);
    setError(null);
    if (correction) {
      setPendingCorrection(correction);
    } else {
      // First analysis or "Start over": the result replaces the whole thread,
      // so clear it now — the skeleton takes its place, not a stale thread
      setHistory([]);
      setLoggedAtLength(null);
    }
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
    <main className="page-enter mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-4 px-5 py-8 sm:px-6 sm:py-11">
      <header className="mb-2 border-b border-line pb-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-label">
          Meal analysis
        </p>
        <h1 className="font-serif text-[clamp(2rem,8vw,2.45rem)] font-semibold leading-[1.08] tracking-[-0.035em]">
          What’s on your plate?
        </h1>
        <p className="mt-2 max-w-xl text-[15px] text-muted sm:text-base">
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
        className="rounded-panel border border-line bg-surface px-4 py-3 text-sm text-foreground placeholder:text-placeholder transition-colors hover:border-muted/30 focus:border-focus focus:outline-none"
      />

      <button
        type="button"
        disabled={!sourceBlob || loading || preparing}
        onClick={() => analyze()}
        className="flex items-center justify-center gap-2 rounded-panel bg-accent px-4 py-3 font-semibold text-accent-foreground transition duration-200 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        {/* During photo prep the frame overlay is the loader — the button stays plain */}
        {loading && <Spinner />}
        {loading ? "Analyzing…" : latest ? "Start over with this photo" : "Analyze"}
      </button>

      {error && (
        <p className="rounded-panel border-l-4 border-danger bg-danger-soft px-4 py-3 text-sm text-danger">
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

      {loading && !pendingCorrection && <SkeletonEstimate label="Estimate" />}

      {pendingCorrection && (
        <>
          <CorrectionBubble text={pendingCorrection} />
          <SkeletonEstimate label={`Estimate ${history.length + 1}`} />
        </>
      )}

      {latest && !pendingCorrection && (
        <>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading || loggedAtLength === history.length}
              onClick={() => void handleLog()}
              className="flex-1 rounded-panel border border-success px-4 py-2.5 text-sm font-semibold text-success transition-colors hover:bg-success-soft disabled:border-line disabled:text-muted"
            >
              {loggedAtLength === history.length ? "Logged ✓" : "Log meal"}
            </button>
            {loggedAtLength === history.length && (
              <Link
                href="/log"
                className="shrink-0 rounded-panel bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover"
              >
                View log
              </Link>
            )}
          </div>
          <CorrectionBar
            disabled={loading}
            loading={loading}
            onSubmit={(correction) => analyze(correction)}
          />
          <p className="text-center text-xs text-muted">
            Edit grams for instant recalculation, or describe what’s wrong to re-analyze.
          </p>
        </>
      )}

      <div ref={threadEndRef} />
    </main>
  );
}
