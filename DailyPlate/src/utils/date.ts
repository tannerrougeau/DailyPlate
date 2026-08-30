export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Compare YYYY-MM-DD keys (lexicographic order matches chronological). */
export function isDateKeyOnOrAfter(dateKey: string, otherKey: string): boolean {
  return dateKey >= otherKey;
}

export function isDateKeyBefore(dateKey: string, otherKey: string): boolean {
  return dateKey < otherKey;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  return addDays(d, -diff);
}

export function endOfWeek(date: Date): Date {
  return addDays(startOfWeek(date), 6);
}

export function weekDateKeys(anchor: Date): string[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => toDateKey(addDays(start, i)));
}

export function monthGridDates(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

