"use client";

import { useState, useSyncExternalStore } from "react";
import { importMealsAction } from "@/app/actions";
import { Spinner } from "@/components/loaders";
import { clearLocalMeals, readLocalMeals } from "@/lib/log";

// true only after hydration — localStorage doesn't exist during SSR
const noopSubscribe = () => () => {};
const useHydrated = () =>
  useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

/**
 * One-time migration banner: the log used to live in this device's
 * localStorage. If entries are still there, offer to move them to the
 * database. Safe to delete this component (and the helpers in lib/log.ts)
 * once every device has been imported — tracked in FUTURE-TASKS.md.
 */
export function ImportLocalMeals() {
  const hydrated = useHydrated();
  const [done, setDone] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = hydrated && !done ? readLocalMeals().length : 0;
  if (count === 0) return null;

  async function handleImport() {
    setImporting(true);
    setError(null);
    try {
      const meals = readLocalMeals();
      // Server Actions cap request bodies at ~1MB; thumbnails make whole-log
      // payloads risky, so send small batches
      for (let i = 0; i < meals.length; i += 20) {
        const result = await importMealsAction(meals.slice(i, i + 20));
        if (result.error) throw new Error(result.error);
      }
      clearLocalMeals();
      setDone(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Import failed — your local entries are untouched.",
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="rounded-panel border border-accent/50 bg-accent-soft px-4 py-3">
      <p className="text-sm">
        <span className="font-semibold">
          {count} meal{count === 1 ? "" : "s"}
        </span>{" "}
        from before the database switch {count === 1 ? "is" : "are"} saved only on this device.
      </p>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      <button
        type="button"
        disabled={importing}
        onClick={() => void handleImport()}
        className="mt-2 flex items-center gap-2 rounded-panel bg-accent px-3 py-1.5 text-sm font-semibold text-background transition hover:brightness-110 disabled:opacity-40"
      >
        {importing && <Spinner className="h-3.5 w-3.5" />}
        {importing ? "Importing…" : "Import into the log"}
      </button>
    </div>
  );
}
