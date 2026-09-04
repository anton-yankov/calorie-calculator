/**
 * Local-timezone day helpers. Day boundaries are always computed on the client
 * in the viewer's timezone (the server runs UTC on Vercel and never decides
 * what "today" is) and passed around as YYYY-MM-DD keys or absolute ISO bounds.
 *
 * Labels are English with Bulgarian-style numeric dates: "Today", "Yesterday",
 * "Thu 28.08" inside the current Monday-to-Sunday week, "28.08" otherwise,
 * and "28.08.2025" when the year differs from the current one.
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

/** Local midnight of the Monday that starts the week containing `d`. */
function weekStart(d: Date): Date {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

/** "dd.mm", with the year appended only when it isn't the current one. */
export function shortDate(key: string): string {
  const d = new Date(`${key}T12:00:00`);
  const base = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
  return d.getFullYear() === new Date().getFullYear() ? base : `${base}.${d.getFullYear()}`;
}

export function dayLabel(key: string): string {
  const now = new Date();
  if (key === dayKey(now)) return "Today";
  if (key === dayKey(new Date(Date.now() - 86_400_000))) return "Yesterday";
  // Reconstruct at noon so DST shifts can't move the label to a neighboring day
  const d = new Date(`${key}T12:00:00`);
  const date = shortDate(key);
  if (weekStart(d).getTime() !== weekStart(now).getTime()) return date;
  return `${d.toLocaleDateString("en-GB", { weekday: "short" })} ${date}`;
}

/** 24-hour "HH:MM" in the viewer's timezone. */
export function timeLabel(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
