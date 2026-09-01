import type { ReactNode } from "react";
import {
  isDateKeyBefore,
  isPreviousCalendarWeek,
  rollingVisibleWeeks,
  toDateKey,
  weekMonthHeading,
  weekRangeLabel,
} from "@/utils/date";

const DEFAULT_FUTURE_WEEKS = 5;

export function RollingWeekCalendar({
  todayDateKey,
  selectedDateKeys,
  selectedWeekStartKey,
  onDayClick,
  onViewDay,
  onToggleHighlight,
  onWeekClick,
  dayHasMeals,
  dayDisabled,
  showChecks = false,
  extraFutureWeeks = 0,
  onLoadMoreDates,
  caption,
  footer,
}: {
  todayDateKey: string;
  selectedDateKeys: ReadonlySet<string>;
  selectedWeekStartKey?: string | null;
  onDayClick?: (dateKey: string, date: Date) => void;
  onViewDay?: (dateKey: string, date: Date) => void;
  onToggleHighlight?: (dateKey: string, date: Date) => void;
  onWeekClick: (week: Date[]) => void;
  dayHasMeals?: (dateKey: string) => boolean;
  dayDisabled?: (dateKey: string, date: Date, isPrevWeek: boolean) => boolean;
  showChecks?: boolean;
  extraFutureWeeks?: number;
  onLoadMoreDates?: () => void;
  caption?: ReactNode;
  footer?: ReactNode;
}) {
  const calendarWeeks = rollingVisibleWeeks(new Date(), DEFAULT_FUTURE_WEEKS + extraFutureWeeks);
  const splitSelect = onToggleHighlight != null || onViewDay != null;

  return (
    <section className="section-gap card-surface p-3">
      <h2 className="mb-1 text-center text-sm font-semibold text-slate-900">Calendar</h2>
      <p className="mb-2 text-center text-xs font-medium text-slate-500">
        Scroll weeks. Previous week is grey; older weeks are gone.
      </p>
      {caption}
      <div className="mb-2 grid grid-cols-7 text-center text-[10px] font-medium uppercase text-slate-400">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="max-h-[280px] space-y-2 overflow-y-auto overscroll-contain">
        {calendarWeeks.map((week, weekIndex) => {
          const weekStart = week[0]!;
          const weekStartKey = toDateKey(weekStart);
          const isPrevWeek = isPreviousCalendarWeek(weekStart);
          const keys = week.map((d) => toDateKey(d));
          const eligibleKeys = keys.filter((key) => !isDateKeyBefore(key, todayDateKey));
          const weekSelected =
            selectedWeekStartKey != null
              ? selectedWeekStartKey === weekStartKey
              : eligibleKeys.length > 0 && eligibleKeys.every((k) => selectedDateKeys.has(k));
          const weekPartial =
            !weekSelected && keys.some((k) => selectedDateKeys.has(k));
          const monthHeading = weekMonthHeading(week, weekIndex === 0);
          const weekClickDisabled = isPrevWeek && showChecks;
          return (
            <div key={weekStartKey}>
              {monthHeading && (
                <p className="mb-1 px-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {monthHeading}
                </p>
              )}
              <div
                className={`rounded-xl transition-all ${
                  isPrevWeek
                    ? "bg-slate-50 opacity-60"
                    : weekSelected
                      ? "bg-blue-50 ring-2 ring-primary/50 shadow-sm"
                      : weekPartial
                        ? "bg-blue-50/40 ring-1 ring-primary/25"
                        : "border border-dashed border-slate-200 bg-slate-50/50"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onWeekClick(week)}
                  disabled={weekClickDisabled || (showChecks && eligibleKeys.length === 0)}
                  className={`mb-1 flex min-h-[40px] w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                    weekClickDisabled || (showChecks && eligibleKeys.length === 0)
                      ? "cursor-not-allowed opacity-50"
                      : weekSelected || weekPartial
                        ? "bg-primary/10"
                        : "hover:bg-white/80"
                  }`}
                  aria-pressed={weekSelected}
                  aria-label={`${weekSelected ? "Selected week" : "Select week"} ${weekRangeLabel(week)}`}
                >
                  <span
                    className={`text-xs font-semibold ${
                      isPrevWeek
                        ? "text-slate-400"
                        : weekSelected || weekPartial
                          ? "text-primary"
                          : "text-slate-700"
                    }`}
                  >
                    {isPrevWeek ? "Previous · " : "Week · "}
                    {weekRangeLabel(week)}
                  </span>
                  {showChecks && (
                    <span
                      className={`mt-0.5 h-4 w-4 shrink-0 rounded border ${
                        weekSelected
                          ? "border-primary bg-primary"
                          : weekPartial
                            ? "border-primary bg-primary/40"
                            : "border-slate-300 bg-white"
                      }`}
                    />
                  )}
                </button>
                <div className="grid grid-cols-7 gap-1 px-0.5 pb-1">
                  {week.map((date) => {
                    const key = toDateKey(date);
                    const disabled =
                      dayDisabled?.(key, date, isPrevWeek) ??
                      (showChecks && isDateKeyBefore(key, todayDateKey) && !splitSelect);
                    const highlightBlocked =
                      isPrevWeek || isDateKeyBefore(key, todayDateKey);
                    const selected = !highlightBlocked && selectedDateKeys.has(key);
                    const isToday = key === todayDateKey;
                    const hasMeals = dayHasMeals?.(key) === true;
                    const dateLabel = date.toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    });

                    function viewDay() {
                      if (disabled) return;
                      if (onViewDay) onViewDay(key, date);
                      else onDayClick?.(key, date);
                    }

                    function toggleHighlight() {
                      if (disabled || highlightBlocked) return;
                      if (onToggleHighlight) onToggleHighlight(key, date);
                      else onDayClick?.(key, date);
                    }

                    return (
                      <div
                        key={key}
                        className={`relative min-h-[52px] rounded-lg border px-0.5 py-1 ${
                          disabled
                            ? "border-slate-100 bg-slate-50 opacity-50"
                            : selected
                              ? "border-primary bg-blue-50 ring-1 ring-primary/40"
                              : isToday
                                ? "border-slate-800 bg-white"
                                : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-0.5">
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={viewDay}
                            className="min-w-0 flex-1 rounded-md px-0.5 pb-2 text-left disabled:cursor-not-allowed"
                            aria-label={`${hasMeals ? "View meals for" : "Open"} ${dateLabel}`}
                          >
                            <span className="text-xs font-semibold text-slate-800">
                              {date.getDate()}
                            </span>
                          </button>
                          {showChecks && (
                            <button
                              type="button"
                              disabled={disabled || (splitSelect && highlightBlocked)}
                              onClick={toggleHighlight}
                              aria-pressed={selected}
                              aria-label={`${selected ? "Unhighlight" : "Highlight"} ${dateLabel}`}
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <span
                                className={`h-3.5 w-3.5 rounded border ${
                                  selected
                                    ? "border-primary bg-primary"
                                    : "border-slate-300 bg-white"
                                }`}
                              />
                            </button>
                          )}
                        </div>
                        {hasMeals && (
                          <span className="absolute bottom-1.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-primary" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {onLoadMoreDates && (
        <button
          type="button"
          onClick={onLoadMoreDates}
          className="mt-2 min-h-[36px] w-full rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700"
        >
          Load more dates
        </button>
      )}
      {footer}
    </section>
  );
}
