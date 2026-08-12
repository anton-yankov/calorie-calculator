"use client";

import { createContext, useContext, useRef, useState } from "react";
import { logMealAction } from "@/app/actions";
import { makeThumbnail, resizeToJpeg, toDisplayableBlob } from "@/lib/resize";
import type { MealAnalysis } from "@/lib/schema";

export interface HistoryEntry {
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

interface AnalysisState {
  sourceBlob: Blob | null;
  preparing: boolean;
  previewUrl: string | null;
  description: string;
  setDescription: (value: string) => void;
  history: HistoryEntry[];
  pendingCorrection: string | null;
  loading: boolean;
  logging: boolean;
  error: string | null;
  loggedAtLength: number | null;
  latest: HistoryEntry | undefined;
  handleSelect: (selected: File) => Promise<void>;
  handleClear: () => void;
  handleLog: () => Promise<void>;
  analyze: (correction?: string) => Promise<void>;
  handleGramsChange: (foodIndex: number, grams: number) => void;
}

const AnalysisContext = createContext<AnalysisState | null>(null);

/**
 * Owns all analysis state and lives in the root layout, which persists across
 * navigation. The Analyze page unmounts when the user switches tabs; keeping the
 * state (and the in-flight /api/analyze request) here means nothing is lost —
 * results that arrive while the page is away are waiting on return.
 */
export function AnalysisProvider({ children }: { children: React.ReactNode }) {
  // The selected photo, converted to a browser-displayable format if needed (HEIC → JPEG)
  const [sourceBlob, setSourceBlob] = useState<Blob | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [pendingCorrection, setPendingCorrection] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [logging, setLogging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // History length at the moment of logging — logging re-enables after a correction
  const [loggedAtLength, setLoggedAtLength] = useState<number | null>(null);
  // The resized JPEG is cached so corrections re-send the same bytes
  const resizedRef = useRef<Blob | null>(null);

  const latest = history.length > 0 ? history[history.length - 1] : undefined;

  // Object URLs must outlive page unmounts (the preview reappears on return),
  // so they're revoked only when replaced or cleared — never on unmount.
  function replacePreviewUrl(next: string | null) {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return next;
    });
  }

  async function handleSelect(selected: File) {
    setHistory([]);
    setError(null);
    resizedRef.current = null;
    setPreparing(true);
    try {
      const displayable = await toDisplayableBlob(selected);
      setSourceBlob(displayable);
      replacePreviewUrl(URL.createObjectURL(displayable));
    } catch (err) {
      console.error("photo preparation failed:", err);
      const detail =
        err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err);
      setSourceBlob(null);
      replacePreviewUrl(null);
      setError(`Couldn't read that image (${detail}). Try a JPEG/PNG, or take the photo directly.`);
    } finally {
      setPreparing(false);
    }
  }

  function handleClear() {
    setSourceBlob(null);
    replacePreviewUrl(null);
    setHistory([]);
    setError(null);
    setLoggedAtLength(null);
    resizedRef.current = null;
  }

  async function handleLog() {
    if (!latest || logging) return;
    setLogging(true);
    setError(null);
    try {
      const thumbnail = resizedRef.current ? await makeThumbnail(resizedRef.current) : null;
      const result = await logMealAction({
        id: crypto.randomUUID(),
        loggedAt: new Date().toISOString(),
        description: description.trim(),
        analysis: latest.analysis,
        thumbnail,
      });
      if (result.error) throw new Error(result.error);
      setLoggedAtLength(history.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the meal");
    } finally {
      setLogging(false);
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
    <AnalysisContext.Provider
      value={{
        sourceBlob,
        preparing,
        previewUrl,
        description,
        setDescription,
        history,
        pendingCorrection,
        loading,
        logging,
        error,
        loggedAtLength,
        latest,
        handleSelect,
        handleClear,
        handleLog,
        analyze,
        handleGramsChange,
      }}
    >
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalysis must be used within AnalysisProvider");
  return ctx;
}
