"use client";

import { createContext, useContext, useRef, useState } from "react";
import { logMealAction } from "@/app/actions";
import { dayBounds, dayKey } from "@/lib/day";
import { reattachFoodExtras, stripFoodExtras } from "@/lib/products";
import { makeThumbnail, MEAL_PHOTO_EDGE, resizeToJpeg, toDisplayableBlob } from "@/lib/resize";
import { scaleFood, sumTotals } from "@/lib/scale";
import type { FoodItem, MealAnalysis } from "@/lib/schema";

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
  /** YYYY-MM-DD day the next log lands on; null means today */
  logDate: string | null;
  setLogDate: (key: string | null) => void;
  latest: HistoryEntry | undefined;
  handleSelect: (selected: File) => Promise<void>;
  handleClear: () => void;
  handleLog: () => Promise<void>;
  addScannedFood: (food: FoodItem) => void;
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
  // Day the next log lands on; null = today. Backdating is the exception, not a
  // sticky mode, so this resets after a successful log and on clear.
  const [logDate, setLogDateState] = useState<string | null>(null);
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
    setLogDateState(null);
    resizedRef.current = null;
  }

  // Selecting today (or clearing the input) is just "not backdating"
  function setLogDate(key: string | null) {
    setLogDateState(key && key !== dayKey(new Date()) ? key : null);
  }

  /**
   * The meal's cover, chosen once at log time: the meal photo if there is one
   * (resized here if "Analyze" never ran, e.g. photo + barcode only), else the
   * first scanned food's image, else nothing. Both sizes come from the same
   * source so the list thumbnail and the viewer photo always match.
   */
  async function makeCover(
    foods: readonly FoodItem[],
  ): Promise<{ thumbnail: string | null; photo: string | null }> {
    if (sourceBlob) {
      if (!resizedRef.current) resizedRef.current = await resizeToJpeg(sourceBlob);
      const [photo, thumbnail] = await Promise.all([
        makeThumbnail(resizedRef.current, MEAL_PHOTO_EDGE),
        makeThumbnail(resizedRef.current),
      ]);
      return { thumbnail, photo };
    }
    const image = foods.find((f) => f.imageUrl)?.imageUrl;
    if (!image) return { thumbnail: null, photo: null };
    return { thumbnail: await makeThumbnail(image), photo: image };
  }

  async function handleLog() {
    if (!latest || logging) return;
    setLogging(true);
    setError(null);
    try {
      const { thumbnail, photo } = await makeCover(latest.analysis.foods);
      // When backdating, the server assigns the timestamp within the day's
      // bounds; the loggedAt sent here is only a placeholder
      const result = await logMealAction(
        {
          id: crypto.randomUUID(),
          loggedAt: new Date().toISOString(),
          description: description.trim(),
          analysis: latest.analysis,
          thumbnail,
          photo,
        },
        logDate ? dayBounds(logDate) : undefined,
      );
      if (result.error) throw new Error(result.error);
      setLoggedAtLength(history.length);
      setLogDateState(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the meal");
    } finally {
      setLogging(false);
    }
  }

  function addScannedFood(food: FoodItem) {
    const note = "Packaged-product nutrition was added from a barcode.";
    const withBarcodeNote = (notes: string) =>
      notes.includes(note) ? notes : notes ? `${notes} ${note}` : note;
    setHistory((prev) => {
      const last = prev[prev.length - 1];
      if (!last) {
        const analysis: MealAnalysis = {
          foods: [food],
          totals: sumTotals([food]),
          notes: note,
        };
        return [{ correction: null, analysis, baseline: analysis }];
      }

      const analysisFoods = [...last.analysis.foods, food];
      const baselineFoods = [...last.baseline.foods, food];
      return [
        ...prev.slice(0, -1),
        {
          ...last,
          analysis: {
            ...last.analysis,
            foods: analysisFoods,
            totals: sumTotals(analysisFoods),
            notes: withBarcodeNote(last.analysis.notes),
          },
          baseline: {
            ...last.baseline,
            foods: baselineFoods,
            totals: sumTotals(baselineFoods),
            notes: withBarcodeNote(last.baseline.notes),
          },
        },
      ];
    });
    setLoggedAtLength(null);
    setError(null);
  }

  async function analyze(correction?: string) {
    // A photo, a description, or both — text-only analysis is fine
    if (!sourceBlob && !description.trim() && !(correction && latest)) return;
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
      const form = new FormData();
      if (sourceBlob) {
        if (!resizedRef.current) {
          resizedRef.current = await resizeToJpeg(sourceBlob);
        }
        form.append("image", resizedRef.current, "meal.jpg");
      }
      if (description.trim()) form.append("description", description.trim());
      if (correction && latest) {
        // The model never sees the client-only barcode/image fields
        const previous = { ...latest.analysis, foods: stripFoodExtras(latest.analysis.foods) };
        form.append("previousResult", JSON.stringify(previous));
        form.append("correction", correction);
      }

      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const raw = (await res.json()) as MealAnalysis | { error: string };
      if (!res.ok || "error" in raw) {
        throw new Error("error" in raw ? raw.error : `Request failed (${res.status})`);
      }
      // A corrected estimate comes back without barcodes/images — carry them over
      const body: MealAnalysis =
        correction && latest
          ? { ...raw, foods: reattachFoodExtras(raw.foods, latest.analysis.foods) }
          : raw;
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
        return base ? scaleFood(base, grams) : { ...food, grams };
      });
      const totals = sumTotals(foods);
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
        logDate,
        setLogDate,
        latest,
        handleSelect,
        handleClear,
        handleLog,
        addScannedFood,
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
