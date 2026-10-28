"use client";

import { createContext, useContext, useRef, useState } from "react";
import { toast } from "sonner";
import { deleteMealAction, logMealAction } from "@/app/actions";
import { useAiAllowance } from "@/components/AiAllowance";
import { waterAnalysis, withDrinkType, type DrinkType } from "@/lib/water";
import { dayBounds, dayKey } from "@/lib/day";
import { reattachFoodExtras, stripFoodExtras } from "@/lib/products";
import { makeThumbnail, MEAL_PHOTO_EDGE, resizeToJpeg, toDisplayableBlob } from "@/lib/resize";
import { scaleFood, sumTotals } from "@/lib/scale";
import type { FoodItem, MealAnalysis } from "@/lib/schema";

interface HistoryEntry {
  /** Stable for the entry's lifetime, so an Undo can tell it still applies */
  id: number;
  /** One stable key per food, in order: list keys, and where an undone food goes back */
  keys: number[];
  /** The correction that produced this estimate; null for the first estimate of a photo */
  correction: string | null;
  analysis: MealAnalysis;
  /**
   * The model's estimate as returned, before any gram edits. Gram edits recompute
   * macros from this baseline so setting grams to 0 doesn't destroy the per-gram
   * ratios (0 × anything stays 0 when scaling the current values).
   */
  baseline: MealAnalysis;
  /** How long the request took, for "Done in 14 s"; null for barcode-only plates */
  durationMs: number | null;
}

/** What handleLog saved, so the page can offer Undo and point at the new meal. */
interface LoggedPlate {
  id: string;
  /** The day it landed on (YYYY-MM-DD) */
  day: string;
}

interface AnalysisState {
  quickWaterPending: boolean;
  progressVersion: number;
  /** Re-read the day's totals and meals, e.g. after a meal was edited or deleted */
  refreshDay: () => void;
  /** When the running analysis started (ms since epoch); null when none is running */
  loadingSince: number | null;
  quickAddWater: (ml: number) => Promise<void>;
  handleDrinkTypeChange: (index: number, type: DrinkType | null) => void;
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
  /** YYYY-MM-DD day the next log lands on; null means today */
  logDate: string | null;
  setLogDate: (key: string | null) => void;
  latest: HistoryEntry | undefined;
  /**
   * Bumps on every full reset. The homepage keys child components that own
   * their own state (the barcode panel) on it so a reset also closes them.
   */
  session: number;
  handleSelect: (selected: File) => Promise<void>;
  /** Reset everything on the page: photo, description, estimates, barcode panel, log day */
  handleClear: () => void;
  /** Logs the plate and resets the page; null when nothing was saved */
  handleLog: () => Promise<LoggedPlate | null>;
  addScannedFood: (food: FoodItem) => void;
  analyze: (correction?: string) => Promise<void>;
  handleGramsChange: (foodIndex: number, grams: number) => void;
  /** Takes the food with this key off the latest estimate, with an Undo toast */
  removeFood: (key: number) => void;
}

/** A food taken off an estimate, kept so Undo can put it back where it was. */
interface RemovedFood {
  entryId: number;
  key: number;
  food: FoodItem;
  base: FoodItem;
}

/** The entry with new food lists, its totals recomputed. */
function withFoods(
  entry: HistoryEntry,
  keys: number[],
  foods: FoodItem[],
  baselineFoods: FoodItem[],
): HistoryEntry {
  return {
    ...entry,
    keys,
    analysis: { ...entry.analysis, foods, totals: sumTotals(foods) },
    baseline: { ...entry.baseline, foods: baselineFoods, totals: sumTotals(baselineFoods) },
  };
}

const AnalysisContext = createContext<AnalysisState | null>(null);

/**
 * Owns all analysis state and lives in the root layout, which persists across
 * navigation. The homepage unmounts when the user switches tabs; keeping the
 * state (and the in-flight /api/analyze request) here means nothing is lost —
 * results that arrive while the page is away are waiting on return.
 */
export function AnalysisProvider({ children }: { children: React.ReactNode }) {
  const { refresh: refreshAllowance } = useAiAllowance();
  // The selected photo, converted to a browser-displayable format if needed (HEIC → JPEG)
  const [progressVersion, setProgressVersion] = useState(0);
  const quickAdding = useRef(false);
  const [quickWaterPending, setQuickWaterPending] = useState(false);
  const [sourceBlob, setSourceBlob] = useState<Blob | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [pendingCorrection, setPendingCorrection] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSince, setLoadingSince] = useState<number | null>(null);
  const [logging, setLogging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Day the next log lands on; null = today. Backdating is the exception, not a
  // sticky mode, so this resets after a successful log and on clear.
  const [logDate, setLogDateState] = useState<string | null>(null);
  const [session, setSession] = useState(0);
  // The resized JPEG is cached so corrections re-send the same bytes
  const resizedRef = useRef<Blob | null>(null);
  // Source of entry ids and food keys; only ever counts up
  const nextId = useRef(0);
  // Undo toasts for removed foods, dismissed once the estimate they belong to is gone
  const removalToasts = useRef<(string | number)[]>([]);

  const latest = history.length > 0 ? history[history.length - 1] : undefined;

  // Object URLs must outlive page unmounts (the preview reappears on return),
  // so they're revoked only when replaced or cleared — never on unmount.
  function replacePreviewUrl(next: string | null) {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return next;
    });
  }

  function newEntry(
    correction: string | null,
    analysis: MealAnalysis,
    durationMs: number | null,
  ): HistoryEntry {
    const keys = analysis.foods.map(() => nextId.current++);
    return { id: nextId.current++, keys, correction, analysis, baseline: analysis, durationMs };
  }

  function dismissRemovalToasts() {
    removalToasts.current.forEach((id) => toast.dismiss(id));
    removalToasts.current = [];
  }

  async function handleSelect(selected: File) {
    dismissRemovalToasts();
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

  async function quickAddWater(ml: number) {
    if (quickAdding.current) return;
    quickAdding.current = true;
    setQuickWaterPending(true);
    const id = crypto.randomUUID();
    try {
      const result = await logMealAction(
        {
          id,
          loggedAt: new Date().toISOString(),
          description: "",
          analysis: waterAnalysis(ml),
          thumbnail: null,
        },
        logDate ? dayBounds(logDate) : undefined,
      );
      if (result.error) throw new Error(result.error);
      setProgressVersion((n) => n + 1);
      toast.success(`${ml === 1000 ? "1 L" : `${ml} ml`} water logged`, {
        action: {
          label: "Undo",
          onClick: () => {
            void deleteMealAction(id)
              .then((result) => {
                if (result.error) toast.error(result.error);
                else setProgressVersion((n) => n + 1);
              })
              .catch(() => toast.error("Couldn't undo. Try deleting the entry from Log."));
          },
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't log water");
    } finally {
      quickAdding.current = false;
      setQuickWaterPending(false);
    }
  }

  function handleDrinkTypeChange(index: number, type: DrinkType | null) {
    setHistory((prev) =>
      prev.map((entry, i) => {
        if (i !== prev.length - 1) return entry;
        const foods = entry.analysis.foods.map((food, j) =>
          j === index ? withDrinkType(food, type) : food,
        );
        const baselineFoods = entry.baseline.foods.map((food, j) =>
          j === index ? withDrinkType(food, type) : food,
        );
        return {
          ...entry,
          analysis: { ...entry.analysis, foods, totals: sumTotals(foods) },
          baseline: { ...entry.baseline, foods: baselineFoods, totals: sumTotals(baselineFoods) },
        };
      }),
    );
  }

  function handleClear() {
    dismissRemovalToasts();
    setSourceBlob(null);
    replacePreviewUrl(null);
    setDescription("");
    setHistory([]);
    setError(null);
    setLogDateState(null);
    setSession((n) => n + 1);
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

  async function handleLog(): Promise<LoggedPlate | null> {
    if (!latest || logging || latest.analysis.foods.length === 0) return null;
    setLogging(true);
    setError(null);
    const id = crypto.randomUUID();
    const day = logDate ?? dayKey(new Date());
    try {
      const { thumbnail, photo } = await makeCover(latest.analysis.foods);
      // When backdating, the server assigns the timestamp within the day's
      // bounds; the loggedAt sent here is only a placeholder
      const result = await logMealAction(
        {
          id,
          loggedAt: new Date().toISOString(),
          description: description.trim(),
          analysis: latest.analysis,
          thumbnail,
          photo,
        },
        logDate ? dayBounds(logDate) : undefined,
      );
      if (result.error) throw new Error(result.error);
      if (result.warning) toast.warning(result.warning);
      // A logged plate is done: the page goes back to "add food"
      handleClear();
      setProgressVersion((n) => n + 1);
      return { id, day };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the meal");
      return null;
    } finally {
      setLogging(false);
    }
  }

  /** Adds a scanned product to the plate being put together. */
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
        return [newEntry(null, analysis, null)];
      }

      const analysisFoods = [...last.analysis.foods, food];
      const baselineFoods = [...last.baseline.foods, food];
      return [
        ...prev.slice(0, -1),
        {
          ...last,
          keys: [...last.keys, nextId.current++],
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
    setError(null);
  }

  async function analyze(correction?: string) {
    // A photo, a description, or both — text-only analysis is fine
    if (!sourceBlob && !description.trim() && !(correction && latest)) return;
    const started = Date.now();
    setLoading(true);
    setLoadingSince(started);
    setError(null);
    // A new estimate replaces the one any pending Undo would restore into
    dismissRemovalToasts();
    if (correction) {
      setPendingCorrection(correction);
    } else {
      // First analysis or "Start over": the result replaces the whole thread,
      // so clear it now; the analyzing card takes its place, not a stale thread
      setHistory([]);
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
      const durationMs = Date.now() - started;
      const entry = newEntry(correction ?? null, body, durationMs);
      setHistory((prev) => (correction ? [...prev, entry] : [entry]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      setLoadingSince(null);
      setPendingCorrection(null);
      refreshAllowance();
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

  function removeFood(key: number) {
    const index = latest?.keys.indexOf(key) ?? -1;
    if (!latest || index < 0) return;
    const removed: RemovedFood = {
      entryId: latest.id,
      key,
      food: latest.analysis.foods[index]!,
      base: latest.baseline.foods[index]!,
    };
    setHistory((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.id !== removed.entryId) return prev;
      const keep = (_: unknown, i: number) => last.keys[i] !== key;
      return [
        ...prev.slice(0, -1),
        withFoods(
          last,
          last.keys.filter((k) => k !== key),
          last.analysis.foods.filter(keep),
          last.baseline.foods.filter(keep),
        ),
      ];
    });
    const id = toast.success(`${removed.food.name} removed`, {
      duration: 5000,
      action: { label: "Undo", onClick: () => restoreFood(removed) },
    });
    removalToasts.current.push(id);
  }

  /** Puts a removed food back in its old place, as long as its estimate is still the latest. */
  function restoreFood(removed: RemovedFood) {
    setHistory((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.id !== removed.entryId || last.keys.includes(removed.key)) return prev;
      // Keys count up in list order, so the food goes before the first later key
      const after = last.keys.findIndex((k) => k > removed.key);
      const at = after < 0 ? last.keys.length : after;
      const insert = <T,>(list: T[], item: T) => [...list.slice(0, at), item, ...list.slice(at)];
      return [
        ...prev.slice(0, -1),
        withFoods(
          last,
          insert(last.keys, removed.key),
          insert(last.analysis.foods, removed.food),
          insert(last.baseline.foods, removed.base),
        ),
      ];
    });
  }

  return (
    <AnalysisContext.Provider
      value={{
        quickWaterPending,
        progressVersion,
        refreshDay: () => setProgressVersion((n) => n + 1),
        loadingSince,
        quickAddWater,
        handleDrinkTypeChange,
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
        logDate,
        setLogDate,
        latest,
        session,
        handleSelect,
        handleClear,
        handleLog,
        addScannedFood,
        analyze,
        handleGramsChange,
        removeFood,
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
