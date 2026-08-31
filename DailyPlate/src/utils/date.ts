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

export function dateKeysForRange(start: Date, dayCount: number): string[] {
  const n = Math.max(1, Math.round(dayCount));
  return Array.from({ length: n }, (_, i) => toDateKey(addDays(start, i)));
}

export function previousWeekStart(today = new Date()): Date {
  return startOfWeek(addDays(today, -7));
}

export function isWeekOlderThanPrevious(weekStart: Date, today = new Date()): boolean {
  return toDateKey(startOfWeek(weekStart)) < toDateKey(previousWeekStart(today));
}

export function isPreviousCalendarWeek(weekStart: Date, today = new Date()): boolean {
  return toDateKey(startOfWeek(weekStart)) === toDateKey(previousWeekStart(today));
}

export function clampWeekStart(weekStart: Date, today = new Date()): Date {
  const earliest = previousWeekStart(today);
  if (toDateKey(startOfWeek(weekStart)) < toDateKey(earliest)) return earliest;
  return startOfWeek(weekStart);
}

export function monthHasVisibleWeeks(anchor: Date, today = new Date()): boolean {
  const weeks = monthGridDates(anchor);
  for (let i = 0; i < weeks.length; i += 7) {
    if (!isWeekOlderThanPrevious(weeks[i]!, today)) return true;
  }
  return false;
}

