import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChefHat,
  Lock,
  RefreshCw,
  X,
} from "lucide-react";
import { MealMacroLine } from "@/components/MealMacroLine";
import { MealCard } from "@/components/MealCard";
import { MealPrepSheet } from "@/components/MealPrepSheet";
import { RecipeImage } from "@/components/RecipeImage";
import type { PlannedMeal, Recipe } from "@/types";
import { UsageNote } from "@/components/UsageNote";
import { MacroRedistributionNotice } from "@/components/MacroRedistributionNotice";
import { LowComplexityGenerateToggle } from "@/components/LowComplexityGenerateToggle";
import { useAppStore } from "@/store/useAppStore";
import {
  addDays,
  clampWeekStart,
  dateKeysForRange,
  endOfWeek,
  fromDateKey,
  isPreviousCalendarWeek,
  isWeekOlderThanPrevious,
  monthGridDates,
  monthHasVisibleWeeks,
  previousWeekStart,
  startOfWeek,
  toDateKey,
  weekDateKeys,
} from "@/utils/date";
import { sumPlannedMacros } from "@/utils/generateDayPlan";
import { formatHouseholdPlanningLine } from "@/utils/household";
import { effectiveCarbVariationId, effectiveVariationId, mealDisplayName, recipeFiberGrams, resolveRecipeMacros, variationLabels } from "@/utils/recipeDisplay";
import { useOverlayBack } from "@/hooks/useOverlayBack";
import { isLowComplexityLeftover, isMealPrepBatchBadge } from "@/utils/mealPrepDisplay";
import type { MealSlotId } from "@/types";

type PlanViewMode = "week" | "month";

const SLOT_LABELS: Record<PlannedMeal["slot"], string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

function formatWeekRange(weekStart: Date): string {
  const weekEnd = endOfWeek(weekStart);
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  if (sameMonth) {
    return `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekEnd.getDate()}`;
  }
  return `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function chunkMonthWeeks(dates: Date[]): Date[][] {
  const weeks: Date[][] = [];
  for (let i = 0; i < dates.length; i += 7) {
    weeks.push(dates.slice(i, i + 7));
  }
  return weeks;
}

function monthWeekLabel(week: Date[]): string {
  const start = week[0]!;
  const end = week[6]!;
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (start.getMonth() === end.getMonth()) {
    return `${fmt(start)} – ${end.getDate()}`;
  }
  return `${fmt(start)} – ${fmt(end)}`;
}

function confirmClearDay(dateKey: string): boolean {
  const label = fromDateKey(dateKey).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return window.confirm(
    `Remove all meals for ${label}? Locked meals will be kept.`,
  );
}

function confirmClearWeek(weekStart: Date): boolean {
  return window.confirm(
    `Remove all meals for the week of ${formatWeekRange(weekStart)}? Locked days and meals will be kept.`,
  );
}

function confirmClearRange(start: Date, dayCount: number): boolean {
  const end = addDays(start, dayCount - 1);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return window.confirm(
    `Remove all meals for ${fmt(start)} – ${fmt(end)}? Locked days and meals will be kept.`,
  );
}

const SLOT_ORDER: MealSlotId[] = ["breakfast", "lunch", "dinner", "snack"];

function truncateName(name: string, max = 22): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1).trim()}…`;
}

function sortMealsBySlot(meals: PlannedMeal[]): PlannedMeal[] {
  return [...meals].sort(
    (a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot),
  );
}

function compactMealSummary(meals: PlannedMeal[], maxLength = 72): string {
  if (meals.length === 0) return "No plan";
  const parts = sortMealsBySlot(meals).map((meal) =>
    truncateName(mealDisplayName(meal), 18),
  );
  let line = parts.join(" • ");
  if (line.length > maxLength) {
    line = `${line.slice(0, maxLength - 1).trim()}…`;
  }
  return line;
}

export function PlanScreen() {
  const [viewMode, setViewMode] = useState<PlanViewMode>("week");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [monthAnchor, setMonthAnchor] = useState(new Date());
  const [mealPrepRecipe, setMealPrepRecipe] = useState<Recipe | null>(null);
  const [expandedWeekDayKeys, setExpandedWeekDayKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedMonthWeekStart, setSelectedMonthWeekStart] = useState<Date | null>(
    null,
  );
  const [lowComplexityForGen, setLowComplexityForGen] = useState(false);
  const [rangeStartKey, setRangeStartKey] = useState(() => toDateKey(new Date()));
  const [activeRange, setActiveRange] = useState<{ startKey: string; dayCount: number } | null>(
    null,
  );
  const [expandedMealKey, setExpandedMealKey] = useState<string | null>(null);

  const userProfile = useAppStore((s) => s.userProfile);
  const selectedDateKey = useAppStore((s) => s.selectedPlanDateKey);
  const setSelectedPlanDateKey = useAppStore((s) => s.setSelectedPlanDateKey);
  const generateWeek = useAppStore((s) => s.generateWeek);
  const generateMonth = useAppStore((s) => s.generateMonth);
  const generateDays = useAppStore((s) => s.generateDays);
  const clearDayMeals = useAppStore((s) => s.clearDayMeals);
  const clearWeekMeals = useAppStore((s) => s.clearWeekMeals);
  const clearRangeMeals = useAppStore((s) => s.clearRangeMeals);
  const generateDay = useAppStore((s) => s.generateDay);
  const planNoteDismissed = useAppStore((s) => s.dismissedUsageNotes.plan);
  const dismissUsageNote = useAppStore((s) => s.dismissUsageNote);
  const dailyPlans = useAppStore((s) => s.dailyPlans);
  const lockedDays = useAppStore((s) => s.lockedDays);
  const toggleDayLock = useAppStore((s) => s.toggleDayLock);
  const macroRedistributionNotices = useAppStore((s) => s.macroRedistributionNotices);
  const dismissMacroRedistributionNotice = useAppStore(
    (s) => s.dismissMacroRedistributionNotice,
  );

  const weekKeys = useMemo(() => weekDateKeys(weekStart), [weekStart]);
  const weekDates = useMemo(() => weekKeys.map(fromDateKey), [weekKeys]);
  const actionWeekStart =
    viewMode === "week" ? weekStart : selectedMonthWeekStart;
  const monthWeekActionsReady = viewMode === "week" || selectedMonthWeekStart !== null;
  const todayKey = toDateKey(new Date());
  const selectedMeals = selectedDateKey ? (dailyPlans[selectedDateKey] ?? []) : [];
  const monthLabel = monthAnchor.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  useEffect(() => {
    setLowComplexityForGen(userProfile?.lowComplexityEnabled === true);
  }, [userProfile?.lowComplexityEnabled]);

  const genOverrides = { lowComplexity: lowComplexityForGen };
  const today = useMemo(() => new Date(), []);
  const earliestWeek = useMemo(() => previousWeekStart(today), [today]);
  const weekIsPrevious = isPreviousCalendarWeek(weekStart, today);
  const canGoPrevWeek =
    viewMode === "week"
      ? !isWeekOlderThanPrevious(addDays(weekStart, -7), today)
      : monthHasVisibleWeeks(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1), today);
  const rangeStartDate = fromDateKey(rangeStartKey);
  const activeRangeKeys = activeRange
    ? dateKeysForRange(fromDateKey(activeRange.startKey), activeRange.dayCount)
    : [];

  useOverlayBack(expandedWeekDayKeys.size > 0, () => {
    setExpandedMealKey(null);
    setExpandedWeekDayKeys(new Set());
  });
  useOverlayBack(expandedMealKey != null, () => setExpandedMealKey(null));

  function handleGenerateRange(dayCount: number) {
    generateDays(rangeStartDate, dayCount, genOverrides);
    setActiveRange({ startKey: rangeStartKey, dayCount });
  }

  function handleClearWeek() {
    if (!actionWeekStart) return;
    if (!confirmClearWeek(actionWeekStart)) return;
    clearWeekMeals(actionWeekStart);
  }

  function handleClearRange() {
    if (!activeRange) return;
    if (!confirmClearRange(fromDateKey(activeRange.startKey), activeRange.dayCount)) return;
    clearRangeMeals(activeRangeKeys);
    setActiveRange(null);
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-32 pt-3">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Meal Plan</h1>
        {userProfile && (
          <p className="mt-1 text-sm font-medium text-slate-600">
            {formatHouseholdPlanningLine(userProfile)}
          </p>
        )}
      </header>

      {!planNoteDismissed && (
        <UsageNote
          text="Your week at a glance. Tap a day to expand meals, then tap a meal to pick a variation."
          onDismiss={() => dismissUsageNote("plan")}
        />
      )}

      <section className="section-gap card-surface p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label={viewMode === "week" ? "Previous week" : "Previous month"}
            disabled={!canGoPrevWeek}
            onClick={() => {
              if (viewMode === "week") {
                setWeekStart((d) => clampWeekStart(addDays(d, -7), today));
                setExpandedWeekDayKeys(new Set());
                setExpandedMealKey(null);
              } else {
                const prev = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1);
                if (!monthHasVisibleWeeks(prev, today)) return;
                setMonthAnchor(prev);
                setSelectedMonthWeekStart(null);
              }
            }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
            <p className="truncate text-sm font-semibold text-slate-900">
              {viewMode === "week" ? formatWeekRange(weekStart) : monthLabel}
            </p>
            {monthWeekActionsReady && actionWeekStart && (
              <button
                type="button"
                onClick={handleClearWeek}
                className="shrink-0 rounded-full border border-slate-200 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
              >
                Clear
              </button>
            )}
          </div>
          <button
            type="button"
            aria-label={viewMode === "week" ? "Next week" : "Next month"}
            onClick={() => {
              if (viewMode === "week") {
                setWeekStart((d) => addDays(d, 7));
                setExpandedWeekDayKeys(new Set());
                setExpandedMealKey(null);
              } else {
                setMonthAnchor(
                  (d) => new Date(d.getFullYear(), d.getMonth() + 1, 1),
                );
                setSelectedMonthWeekStart(null);
              }
            }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {weekIsPrevious && viewMode === "week" && (
          <p className="mb-2 text-center text-[11px] font-medium text-slate-400">
            Previous week · view only
          </p>
        )}

        <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
          {(["week", "month"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                setViewMode(mode);
                setSelectedMonthWeekStart(null);
                if (mode === "month") {
                  setMonthAnchor(
                    new Date(weekStart.getFullYear(), weekStart.getMonth(), 1),
                  );
                }
              }}
              className={`min-h-[40px] rounded-lg text-sm font-semibold capitalize transition-colors ${
                viewMode === mode
                  ? "bg-white text-[#2563EB] shadow-sm"
                  : "text-slate-600 hover:text-slate-800"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {viewMode === "month" && (
          <p className="mb-2 text-center text-xs text-slate-500">
            {selectedMonthWeekStart ? (
              <>
                Selected week:{" "}
                <span className="font-semibold text-[#2563EB]">
                  {formatWeekRange(selectedMonthWeekStart)}
                </span>
              </>
            ) : (
              "Tap a week row to generate"
            )}
          </p>
        )}

        <LowComplexityGenerateToggle
          enabled={lowComplexityForGen}
          onChange={setLowComplexityForGen}
        />

        <label className="mt-3 block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Start date
          </span>
          <input
            type="date"
            value={rangeStartKey}
            min={toDateKey(earliestWeek)}
            onChange={(e) => setRangeStartKey(e.target.value || todayKey)}
            className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-[#2563EB]"
          />
        </label>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleGenerateRange(2)}
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-800 hover:border-[#2563EB]/40"
          >
            Generate 2 days
          </button>
          <button
            type="button"
            onClick={() => handleGenerateRange(3)}
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-800 hover:border-[#2563EB]/40"
          >
            Generate 3 days
          </button>
        </div>

        {activeRange && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-xs font-medium text-slate-600">
              {`${activeRange.dayCount}-day plan`} ·{" "}
              {fromDateKey(activeRange.startKey).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}{" "}
              –{" "}
              {addDays(fromDateKey(activeRange.startKey), activeRange.dayCount - 1).toLocaleDateString(
                "en-US",
                { month: "short", day: "numeric" },
              )}
            </p>
            <button
              type="button"
              onClick={handleClearRange}
              className="shrink-0 rounded-full border border-slate-200 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
            >
              Clear
            </button>
          </div>
        )}

        <button
          type="button"
          disabled={!monthWeekActionsReady || weekIsPrevious}
          onClick={() => actionWeekStart && generateWeek(actionWeekStart, genOverrides)}
          className="mt-2 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RefreshCw className="h-4 w-4 shrink-0" />
          Generate Week
        </button>

        {viewMode === "month" && (
          <button
            type="button"
            onClick={() => generateMonth(monthAnchor, genOverrides)}
            className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border-2 border-primary/30 bg-primary/5 px-3 text-sm font-semibold text-primary"
          >
            <RefreshCw className="h-4 w-4 shrink-0" />
            Generate Month
          </button>
        )}
      </section>

      {viewMode === "week" ? (
        <WeekListView
          weekDates={weekDates}
          weekKeys={weekKeys}
          todayKey={todayKey}
          dailyPlans={dailyPlans}
          lockedDays={lockedDays}
          expandedDayKeys={expandedWeekDayKeys}
          expandedMealKey={expandedMealKey}
          weekDisabled={weekIsPrevious}
          onToggleDay={(key) =>
            setExpandedWeekDayKeys((prev) => {
              const next = new Set(prev);
              if (next.has(key)) {
                next.delete(key);
                setExpandedMealKey(null);
              } else {
                next.add(key);
              }
              return next;
            })
          }
          onToggleMeal={(key) =>
            setExpandedMealKey((prev) => (prev === key ? null : key))
          }
          onManageDay={setSelectedPlanDateKey}
          onGenerateDay={(key) => generateDay(key, genOverrides)}
        />
      ) : (
        <MonthView
          anchorDate={monthAnchor}
          dailyPlans={dailyPlans}
          lockedDays={lockedDays}
          todayKey={todayKey}
          selectedDateKey={selectedDateKey}
          selectedWeekStartKey={
            selectedMonthWeekStart ? toDateKey(selectedMonthWeekStart) : null
          }
          onSelectWeek={(weekStart) =>
            setSelectedMonthWeekStart((prev) =>
              prev && toDateKey(prev) === toDateKey(weekStart) ? null : weekStart,
            )
          }
          onSelectDay={setSelectedPlanDateKey}
          onClearDay={(dateKey) => {
            if (!confirmClearDay(dateKey)) return;
            clearDayMeals(dateKey);
          }}
        />
      )}

      {selectedDateKey && (
        <DayDetailSheet
          dateKey={selectedDateKey}
          meals={selectedMeals}
          locked={lockedDays.includes(selectedDateKey)}
          showMacroNotice={macroRedistributionNotices.includes(selectedDateKey)}
          onClose={() => setSelectedPlanDateKey(null)}
          onToggleLock={() => toggleDayLock(selectedDateKey)}
          onRegenerate={() => generateDay(selectedDateKey, genOverrides)}
          onClearDay={() => {
            if (!confirmClearDay(selectedDateKey)) return;
            clearDayMeals(selectedDateKey);
          }}
          onDismissMacroNotice={() =>
            dismissMacroRedistributionNotice(selectedDateKey)
          }
          onMealPrep={setMealPrepRecipe}
        />
      )}

      {mealPrepRecipe && selectedDateKey && (
        <MealPrepSheet
          recipe={mealPrepRecipe}
          defaultStartDateKey={selectedDateKey}
          onClose={() => setMealPrepRecipe(null)}
        />
      )}
    </div>
  );
}

function WeekListView({
  weekDates,
  weekKeys,
  todayKey,
  dailyPlans,
  lockedDays,
  expandedDayKeys,
  expandedMealKey,
  weekDisabled,
  onToggleDay,
  onToggleMeal,
  onManageDay,
  onGenerateDay,
}: {
  weekDates: Date[];
  weekKeys: string[];
  todayKey: string;
  dailyPlans: Record<string, PlannedMeal[]>;
  lockedDays: string[];
  expandedDayKeys: Set<string>;
  expandedMealKey: string | null;
  weekDisabled: boolean;
  onToggleDay: (key: string) => void;
  onToggleMeal: (key: string) => void;
  onManageDay: (key: string) => void;
  onGenerateDay: (key: string) => void;
}) {
  return (
    <section className="space-y-3">
      {weekDates.map((date, index) => {
        const key = weekKeys[index]!;
        const meals = dailyPlans[key] ?? [];
        const hasPlan = meals.length > 0;
        const isToday = key === todayKey;
        const isLocked = lockedDays.includes(key);
        const isExpanded = expandedDayKeys.has(key);
        const summary = compactMealSummary(meals);
        const sortedMeals = sortMealsBySlot(meals);
        const dayKcal = hasPlan ? Math.round(sumPlannedMacros(meals).calories) : 0;

        return (
          <article
            key={key}
            className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow ${
              weekDisabled
                ? "border-slate-100 bg-slate-50 opacity-60"
                : isToday
                  ? "border-primary/40 ring-1 ring-primary/20"
                  : isExpanded
                    ? "border-primary/30 shadow-md"
                    : "border-slate-200/80"
            }`}
          >
            <button
              type="button"
              onClick={() => onToggleDay(key)}
              aria-expanded={isExpanded}
              className="flex w-full items-start gap-4 px-5 py-4 text-left"
            >
              <div className="min-w-[52px] pt-0.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {date.toLocaleDateString("en-US", { weekday: "short" })}
                </p>
                <p
                  className={`text-2xl font-bold tabular-nums leading-none ${
                    isToday ? "text-[#2563EB]" : "text-slate-900"
                  }`}
                >
                  {date.getDate()}
                </p>
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {isToday && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#2563EB]">
                          Today
                        </span>
                      )}
                      {isLocked && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                          <Lock className="h-2.5 w-2.5" />
                          Locked
                        </span>
                      )}
                      {hasPlan && !isExpanded && (
                        <span className="text-[10px] font-medium tabular-nums text-slate-400">
                          {dayKcal} kcal
                        </span>
                      )}
                    </div>
                    {!isExpanded && (
                      <p
                        className={`mt-1.5 truncate text-xs font-normal leading-relaxed ${
                          hasPlan ? "text-slate-400" : "italic text-slate-400"
                        }`}
                      >
                        {summary}
                      </p>
                    )}
                    {isExpanded && hasPlan && (
                      <p className="mt-1 text-xs font-medium tabular-nums text-slate-500">
                        {dayKcal} kcal planned
                      </p>
                    )}
                    {isExpanded && !hasPlan && (
                      <p className="mt-1 text-xs text-slate-400">No meals yet</p>
                    )}
                  </div>
                  <ChevronDown
                    className={`mt-1 h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${
                      isExpanded ? "rotate-180 text-[#2563EB]" : ""
                    }`}
                    aria-hidden
                  />
                </div>
              </div>
            </button>

            <div
              className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                {isExpanded && (
                  <div className="border-t border-slate-100 px-5 pb-4 pt-3">
                    {sortedMeals.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-5 text-center text-sm text-slate-500">
                        No meals planned — generate below or manage this day.
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {sortedMeals.map((meal) => (
                          <li key={meal.slot}>
                            <DayMealPreview
                              meal={meal}
                              dateKey={key}
                              expanded={expandedMealKey === `${key}:${meal.slot}`}
                              onToggle={() => onToggleMeal(`${key}:${meal.slot}`)}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                    {hasPlan && (
                      <button
                        type="button"
                        onClick={() => onManageDay(key)}
                        className="mt-3 w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-[#2563EB] hover:bg-blue-50"
                      >
                        Manage meals
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 px-4 py-2.5">
              <button
                type="button"
                disabled={isLocked || weekDisabled}
                onClick={() => onGenerateDay(key)}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RefreshCw className="h-4 w-4" />
                Generate
              </button>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function DayMealPreview({
  meal,
  dateKey,
  expanded,
  onToggle,
}: {
  meal: PlannedMeal;
  dateKey: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const setMealVariation = useAppStore((s) => s.setMealVariation);
  const macros = resolveRecipeMacros(
    meal.recipe,
    effectiveVariationId(meal),
    effectiveCarbVariationId(meal),
  );
  const kcal = Math.round(macros.calories * meal.scale);
  const protein = Math.round(macros.protein * meal.scale);
  const carbs = Math.round(macros.carbs * meal.scale);
  const fat = Math.round(macros.fat * meal.scale);
  const fiber = Math.round(
    recipeFiberGrams(meal.recipe, effectiveVariationId(meal), effectiveCarbVariationId(meal)) *
      meal.scale,
  );
  const variations = variationLabels(meal.recipe);
  const selectedId = effectiveVariationId(meal);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full gap-3 p-2 text-left"
      >
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg">
          <RecipeImage recipe={meal.recipe} aspect="square" className="h-full w-full" />
        </div>
        <div className="min-w-0 flex-1 py-0.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {SLOT_LABELS[meal.slot]}
          </p>
          <p className="mt-0.5 line-clamp-2 break-words text-sm font-semibold leading-snug text-slate-900 [overflow-wrap:anywhere]">
            {mealDisplayName(meal)}
          </p>
          <div className="mt-1">
            <MealMacroLine
              kcal={kcal}
              protein={protein}
              carbs={carbs}
              fat={fat}
              fiber={fiber}
              compact
            />
          </div>
        </div>
        <ChevronDown
          className={`mt-2 h-4 w-4 shrink-0 text-slate-400 transition-transform ${
            expanded ? "rotate-180 text-[#2563EB]" : ""
          }`}
          aria-hidden
        />
        {isLowComplexityLeftover(meal) && (
          <span className="inline-flex shrink-0 self-start items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
            Leftover
          </span>
        )}
        {isMealPrepBatchBadge(meal) && meal.mealPrep && (
          <span className="inline-flex shrink-0 self-start items-center gap-0.5 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800">
            <ChefHat className="h-3 w-3" aria-hidden />
            Prep
          </span>
        )}
      </button>
      {expanded && (
        <div className="border-t border-slate-100 px-3 pb-3 pt-2">
          {variations.length > 0 ? (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Variation
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {variations.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setMealVariation(dateKey, meal.slot, v.id)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                      selectedId === v.id
                        ? "border-[#2563EB] bg-blue-50 text-blue-900"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                Updates this meal on Plan and Grocery. Base variation is used until you change it.
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-500">No variations for this recipe.</p>
          )}
        </div>
      )}
    </div>
  );
}

function DayDetailSheet({
  dateKey,
  meals,
  locked,
  showMacroNotice,
  onClose,
  onToggleLock,
  onRegenerate,
  onClearDay,
  onDismissMacroNotice,
  onMealPrep,
}: {
  dateKey: string;
  meals: PlannedMeal[];
  locked: boolean;
  showMacroNotice: boolean;
  onClose: () => void;
  onToggleLock: () => void;
  onRegenerate: () => void;
  onClearDay: () => void;
  onDismissMacroNotice: () => void;
  onMealPrep: (recipe: Recipe) => void;
}) {
  useOverlayBack(true, onClose);
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close day details"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />
      <section className="relative z-[81] max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-slate-200 bg-[#f5f5f4] p-4 shadow-2xl sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">
            {fromDateKey(dateKey).toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {locked && (
          <p className="mb-3 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
            <Lock className="h-3 w-3" /> Day locked
          </p>
        )}
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
          <button
            type="button"
            onClick={onToggleLock}
            className="min-h-[40px] rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700"
          >
            {locked ? "Unlock Day" : "Lock Day"}
          </button>
          <button
            type="button"
            disabled={locked}
            onClick={onRegenerate}
            className="min-h-[40px] rounded-xl bg-[#2563EB] px-3 text-sm font-medium text-white disabled:opacity-40"
          >
            Regenerate Day
          </button>
          <button
            type="button"
            disabled={locked || meals.length === 0}
            onClick={onClearDay}
            className="min-h-[40px] rounded-xl border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700 disabled:opacity-40"
          >
            Remove Meals
          </button>
        </div>
        {showMacroNotice && (
          <MacroRedistributionNotice onDismiss={onDismissMacroNotice} />
        )}
        {meals.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
            No meals generated for this day yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {meals.map((meal) => (
              <li key={meal.slot}>
                <MealCard
                  meal={meal}
                  dateKey={dateKey}
                  dayMeals={meals}
                  inlineDetailsDropdown
                  onMealPrep={onMealPrep}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function MonthDayCell({
  date,
  dateKey,
  inMonth,
  meals,
  isToday,
  isLocked,
  isDaySelected,
  isWeekSelected,
  onSelectDay,
  onClearDay,
}: {
  date: Date;
  dateKey: string;
  inMonth: boolean;
  meals: PlannedMeal[];
  isToday: boolean;
  isLocked: boolean;
  isDaySelected: boolean;
  isWeekSelected: boolean;
  onSelectDay: (key: string) => void;
  onClearDay: (key: string) => void;
}) {
  const longPressTriggered = useRef(false);
  const timerRef = useRef<number | null>(null);
  const hasPlan = meals.length > 0;
  const calories = hasPlan ? Math.round(sumPlannedMacros(meals).calories) : null;

  const clearTimer = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handlePointerDown = () => {
    longPressTriggered.current = false;
    if (!hasPlan || isLocked) return;
    timerRef.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      onClearDay(dateKey);
    }, 650);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerUp={clearTimer}
        onPointerLeave={clearTimer}
        onPointerCancel={clearTimer}
        onClick={() => {
          if (longPressTriggered.current) {
            longPressTriggered.current = false;
            return;
          }
          onSelectDay(dateKey);
        }}
        className={`relative min-h-[56px] w-full rounded-lg px-1 py-1.5 text-left transition-colors ${
          inMonth ? "text-slate-700" : "text-slate-300"
        } ${
          isDaySelected
            ? "bg-blue-100 ring-2 ring-[#2563EB]/70"
            : isWeekSelected && inMonth
              ? "bg-blue-50/80 ring-1 ring-[#2563EB]/25"
              : hasPlan
                ? "bg-blue-50/60 ring-1 ring-[#2563EB]/20"
                : "bg-white hover:bg-slate-50"
        } ${isToday ? "font-semibold" : ""}`}
      >
        <p
          className={`text-xs leading-none ${isToday ? "text-[#2563EB]" : ""}`}
        >
          {date.getDate()}
        </p>
        {calories !== null && (
          <p
            className={`mt-1 text-[10px] font-medium leading-tight ${
              inMonth ? "text-slate-600" : "text-slate-400"
            }`}
          >
            {calories}
          </p>
        )}
        {hasPlan && (
          <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#2563EB]" />
        )}
        {isLocked && (
          <Lock
            className="absolute bottom-1 right-1 h-2.5 w-2.5 text-amber-600"
            aria-hidden
          />
        )}
      </button>
      {isDaySelected && hasPlan && !isLocked && (
        <button
          type="button"
          aria-label="Remove day meals"
          onClick={() => onClearDay(dateKey)}
          className="absolute right-0.5 top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-red-600 shadow-sm ring-1 ring-red-200 hover:bg-red-50"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function MonthView({
  anchorDate,
  dailyPlans,
  lockedDays,
  todayKey,
  selectedDateKey,
  selectedWeekStartKey,
  onSelectWeek,
  onSelectDay,
  onClearDay,
}: {
  anchorDate: Date;
  dailyPlans: Record<string, PlannedMeal[]>;
  lockedDays: string[];
  todayKey: string;
  selectedDateKey: string | null;
  selectedWeekStartKey: string | null;
  onSelectWeek: (weekStart: Date) => void;
  onSelectDay: (key: string) => void;
  onClearDay: (key: string) => void;
}) {
  const gridDates = monthGridDates(anchorDate);
  const calendarWeeks = useMemo(() => chunkMonthWeeks(gridDates), [gridDates]);
  const currentMonth = anchorDate.getMonth();
  const today = useMemo(() => new Date(), []);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 grid grid-cols-7 text-center text-[10px] font-medium uppercase text-slate-400">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="space-y-2">
        {calendarWeeks.map((week, weekIndex) => {
          const weekStart = week[0]!;
          if (isWeekOlderThanPrevious(weekStart, today)) return null;
          const weekStartKey = toDateKey(weekStart);
          const isWeekSelected = selectedWeekStartKey === weekStartKey;
          const isPrevWeek = isPreviousCalendarWeek(weekStart, today);
          const weekHasPlans = week.some(
            (date) => (dailyPlans[toDateKey(date)] ?? []).length > 0,
          );
          const weekInMonth = week.some((date) => date.getMonth() === currentMonth);

          return (
            <div
              key={weekStartKey}
              className={`rounded-xl transition-all ${
                isPrevWeek
                  ? "bg-slate-50 opacity-60"
                  : isWeekSelected
                    ? "bg-blue-50 ring-2 ring-[#2563EB]/50 shadow-sm"
                    : weekHasPlans
                      ? "border border-slate-200 bg-slate-50/40"
                      : "border border-dashed border-slate-200 bg-slate-50/30"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectWeek(weekStart)}
                disabled={isPrevWeek}
                aria-pressed={isWeekSelected}
                className={`mb-1 flex min-h-[36px] w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors ${
                  isPrevWeek
                    ? "cursor-not-allowed text-slate-400"
                    : isWeekSelected
                      ? "bg-[#2563EB]/10"
                      : weekInMonth
                        ? "hover:bg-white/80"
                        : "opacity-60 hover:bg-white/60"
                }`}
              >
                <span
                  className={`text-xs font-semibold ${
                    isPrevWeek
                      ? "text-slate-400"
                      : isWeekSelected
                        ? "text-[#2563EB]"
                        : "text-slate-600"
                  }`}
                >
                  {isPrevWeek ? "Previous · " : `Week ${weekIndex + 1} · `}
                  {monthWeekLabel(week)}
                </span>
                <span
                  className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
                    isWeekSelected
                      ? "border-[#2563EB] bg-[#2563EB]"
                      : "border-slate-300 bg-white"
                  }`}
                />
              </button>
              <div className="grid grid-cols-7 gap-1 px-1 pb-1.5">
                {week.map((date) => {
                  const key = toDateKey(date);
                  const meals = dailyPlans[key] ?? [];
                  const inMonth = date.getMonth() === currentMonth;
                  return (
                    <MonthDayCell
                      key={key}
                      date={date}
                      dateKey={key}
                      inMonth={inMonth}
                      meals={meals}
                      isToday={key === todayKey}
                      isLocked={lockedDays.includes(key)}
                      isDaySelected={selectedDateKey === key}
                      isWeekSelected={isWeekSelected}
                      onSelectDay={isPrevWeek ? () => undefined : onSelectDay}
                      onClearDay={isPrevWeek ? () => undefined : onClearDay}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 space-y-0.5 text-xs text-slate-500">
        <span className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0" />
          Tap a week row, then Generate Week above.
        </span>
        <span className="block pl-6">
          Tap a day for details · long-press or × to remove day meals.
        </span>
      </p>
    </section>
  );
}
