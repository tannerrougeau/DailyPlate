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

/** Previous week plus `futureWeeks` ahead. Default 5 future weeks = 6 visible weeks. */
export function rollingVisibleWeeks(today = new Date(), futureWeeks = 5): Date[][] {
  const start = previousWeekStart(today);
  const weeks: Date[][] = [];
  for (let i = 0; i < futureWeeks + 1; i += 1) {
    const weekStart = addDays(start, i * 7);
    weeks.push(Array.from({ length: 7 }, (_, d) => addDays(weekStart, d)));
  }
  return weeks;
}

export function weekRangeLabel(week: Date[]): string {
  const start = week[0]!;
  const end = week[6] ?? week[week.length - 1]!;
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (start.getMonth() === end.getMonth()) {
    return `${fmt(start)} – ${end.getDate()}`;
  }
  return `${fmt(start)} – ${fmt(end)}`;
}

/** Month heading when a week starts a new month, or for the first visible week. */
export function weekMonthHeading(week: Date[], isFirst: boolean): string | null {
  const firstOfMonth = week.find((d) => d.getDate() === 1);
  if (firstOfMonth) {
    return firstOfMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
  if (isFirst) {
    return week[0]!.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
  return null;
}

