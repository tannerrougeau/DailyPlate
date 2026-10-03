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
  selectMode = false,
  onDayClick,
  onSelectWeek,
  dayHasMeals,
  extraFutureWeeks = 0,
  onLoadMoreDates,
}: {
  todayDateKey: string;
  selectedDateKeys: ReadonlySet<string>;
  selectMode?: boolean;
  onDayClick: (dateKey: string, date: Date) => void;
  onSelectWeek?: (week: Date[]) => void;
  dayHasMeals?: (dateKey: string) => boolean;
  extraFutureWeeks?: number;
  onLoadMoreDates?: () => void;
}) {
  const calendarWeeks = rollingVisibleWeeks(new Date(), DEFAULT_FUTURE_WEEKS + extraFutureWeeks);

  return (
    <section className="section-gap">
      <div className="sticky top-0 z-20 -mx-1 bg-[#f5f5f4] px-1 pb-2 pt-1">
        <div className="grid grid-cols-7 text-center text-[10px] font-medium uppercase text-slate-400">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {calendarWeeks.map((week, weekIndex) => {
          const weekStart = week[0]!;
          const weekStartKey = toDateKey(weekStart);
          const isPrevWeek = isPreviousCalendarWeek(weekStart);
          const keys = week.map((d) => toDateKey(d));
          const eligibleKeys = keys.filter((key) => !isDateKeyBefore(key, todayDateKey));
          const weekSelected =
            selectMode &&
            eligibleKeys.length > 0 &&
            eligibleKeys.every((k) => selectedDateKeys.has(k));
          const monthHeading = weekMonthHeading(week, weekIndex === 0);
          return (
            <div key={weekStartKey}>
              {monthHeading && (
                <p className="mb-1 px-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {monthHeading}
                </p>
              )}
              <div className="rounded-xl">
                <div className="mb-1 flex min-h-[32px] items-center justify-between gap-2 px-1">
                  <span
                    className={`text-xs font-semibold ${
                      isPrevWeek ? "text-slate-400" : "text-slate-700"
                    }`}
                  >
                    {isPrevWeek ? "Previous · " : "Week · "}
                    {weekRangeLabel(week)}
                  </span>
                  {selectMode && onSelectWeek && eligibleKeys.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onSelectWeek(week)}
                      className="text-xs font-semibold text-[#2563EB]"
                    >
                      {weekSelected ? "Clear week" : "Select week"}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {week.map((date) => {
                    const key = toDateKey(date);
                    const selected = selectMode && selectedDateKeys.has(key);
                    const isToday = key === todayDateKey;
                    const hasMeals = dayHasMeals?.(key) === true;
                    const dateLabel = date.toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    });
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => onDayClick(key, date)}
                        aria-pressed={selectMode ? selected : undefined}
                        aria-current={isToday ? "date" : undefined}
                        aria-label={`${hasMeals ? "Meals on" : "Open"} ${dateLabel}`}
                        className={`relative min-h-[52px] rounded-lg px-0.5 py-1 text-left ${
                          selected
                            ? `bg-[#2563EB] text-white ${isToday ? "ring-2 ring-slate-900 ring-offset-1" : ""}`
                            : isToday
                              ? "border-2 border-slate-900 bg-white"
                              : "border border-slate-200 bg-white"
                        } ${isPrevWeek && !selected ? "opacity-60" : ""}`}
                      >
                        <span
                          className={`text-xs font-semibold ${
                            selected ? "text-white" : "text-slate-800"
                          }`}
                        >
                          {date.getDate()}
                        </span>
                        {hasMeals && (
                          <span
                            className={`absolute bottom-1.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${
                              selected ? "bg-white" : "bg-[#2563EB]"
                            }`}
                          />
                        )}
                      </button>
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
          className="mt-3 min-h-[36px] w-full rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700"
        >
          Load more dates
        </button>
      )}
    </section>
  );
}
