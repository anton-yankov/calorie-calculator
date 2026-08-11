import type { MealAnalysis } from "@/lib/schema";

export interface LoggedMeal {
  id: string;
  /** ISO timestamp of when the meal was logged */
  loggedAt: string;
  /** The user's description text at log time, for context in the list */
  description: string;
  analysis: MealAnalysis;
  /** Small JPEG data URL (~160px) so entries are recognizable; null if unavailable */
  thumbnail: string | null;
}

const KEY = "calorie-log-v1";
const EMPTY: LoggedMeal[] = [];

// Tiny external store over localStorage, consumed via useSyncExternalStore.
// The snapshot is cached by raw string so an unchanged store returns a
// referentially stable array (required to avoid render loops).
let cacheRaw: string | null = null;
let cacheParsed: LoggedMeal[] = EMPTY;
const listeners = new Set<() => void>();

function parseRaw(raw: string | null): LoggedMeal[] {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LoggedMeal[]) : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function getLogSnapshot(): LoggedMeal[] {
  const raw = window.localStorage.getItem(KEY);
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    cacheParsed = parseRaw(raw);
  }
  return cacheParsed;
}

export function getServerLogSnapshot(): LoggedMeal[] {
  return EMPTY;
}

export function subscribeToLog(callback: () => void): () => void {
  listeners.add(callback);
  // Also react to writes from other tabs
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

function write(log: LoggedMeal[]): void {
  window.localStorage.setItem(KEY, JSON.stringify(log));
  listeners.forEach((l) => l());
}

export function saveMeal(meal: LoggedMeal): void {
  try {
    write([meal, ...getLogSnapshot()]);
  } catch {
    // Almost certainly the ~5MB quota — retry without the new thumbnail before giving up
    try {
      write([{ ...meal, thumbnail: null }, ...getLogSnapshot()]);
    } catch {
      throw new Error("Couldn't save — browser storage is full. Delete some old log entries.");
    }
  }
}

export function deleteMeal(id: string): void {
  write(getLogSnapshot().filter((m) => m.id !== id));
}
