/**
 * Local-timezone day helpers. Day boundaries are always computed on the client
 * in the viewer's timezone (the server runs UTC on Vercel and never decides
 * what "today" is) and passed around as YYYY-MM-DD keys or absolute ISO bounds.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** Local-timezone YYYY-MM-DD key for a Date or ISO timestamp. */
export function dayKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local midnight-to-midnight ISO bounds for a YYYY-MM-DD key. */
export function dayBounds(key: string): { startIso: string; endIso: string } {
  const start = new Date(`${key}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export function dayLabel(key: string): string {
  if (key === dayKey(new Date())) return "Today";
  if (key === dayKey(new Date(Date.now() - 86_400_000))) return "Yesterday";
  // Reconstruct at noon so DST shifts can't move the label to a neighboring day
  return new Date(`${key}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
