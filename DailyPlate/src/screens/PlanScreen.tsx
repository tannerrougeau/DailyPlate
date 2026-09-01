import { useEffect, useMemo, useState } from "react";
import { Lock, RefreshCw, X } from "lucide-react";
import { MealCard } from "@/components/MealCard";
import { MealPrepSheet } from "@/components/MealPrepSheet";
import type { PlannedMeal, Recipe } from "@/types";
import { UsageNote } from "@/components/UsageNote";
import { MacroRedistributionNotice } from "@/components/MacroRedistributionNotice";
import { RollingWeekCalendar } from "@/components/RollingWeekCalendar";
import { LowComplexityGenerateToggle } from "@/components/LowComplexityGenerateToggle";
import { ClearDatesButton } from "@/components/ClearDatesButton";
import { useAppStore } from "@/store/useAppStore";
import {
  fromDateKey,
  isDateKeyBefore,
  isDateKeyOnOrAfter,
  isPreviousCalendarWeek,
  startOfWeek,
  toDateKey,
} from "@/utils/date";
import { formatHouseholdPlanningLine } from "@/utils/household";
import { mealsForDateKey } from "@/utils/mealTracking";
import { useOverlayBack } from "@/hooks/useOverlayBack";

function formatSelectedDateRange(keys: string[]): string | null {
  if (keys.length === 0) return null;
  const sorted = [...keys].sort();
  const fmt = (key: string) =>
    fromDateKey(key).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (sorted.length === 1) return fmt(sorted[0]!);
  return `${fmt(sorted[0]!)} – ${fmt(sorted[sorted.length - 1]!)}`;
}

function confirmClearKeys(keys: string[]): boolean {
  const sorted = [...keys].sort();
  if (sorted.length === 0) return false;
  const label = formatSelectedDateRange(sorted);
  return window.confirm(
    `Clear meals for ${label}? Locked days and meals will be kept.`,
  );
}

export function PlanScreen() {
  const todayKey = useAppStore((s) => s.todayDateKey);
  const plannedMeals = useAppStore((s) => s.plannedMeals);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(() => [
    useAppStore.getState().todayDateKey,
  ]);
  const [focusedDateKey, setFocusedDateKey] = useState<string | null>(() => useAppStore.getState().todayDateKey);
  const [mealPrepRecipe, setMealPrepRecipe] = useState<Recipe | null>(null);
  const [lowComplexityForGen, setLowComplexityForGen] = useState(false);
  const [selectPrompt, setSelectPrompt] = useState<string | null>(null);
  const [extraFutureWeeks, setExtraFutureWeeks] = useState(0);

  const userProfile = useAppStore((s) => s.userProfile);
  const selectedDateKey = useAppStore((s) => s.selectedPlanDateKey);
  const setSelectedPlanDateKey = useAppStore((s) => s.setSelectedPlanDateKey);
  const generateForDateKeys = useAppStore((s) => s.generateForDateKeys);
  const generateDay = useAppStore((s) => s.generateDay);
  const clearDayMeals = useAppStore((s) => s.clearDayMeals);
  const clearRangeMeals = useAppStore((s) => s.clearRangeMeals);
  const planNoteDismissed = useAppStore((s) => s.dismissedUsageNotes.plan);
  const dismissUsageNote = useAppStore((s) => s.dismissUsageNote);
  const dailyPlans = useAppStore((s) => s.dailyPlans);
  const lockedDays = useAppStore((s) => s.lockedDays);
  const toggleDayLock = useAppStore((s) => s.toggleDayLock);
  const macroRedistributionNotices = useAppStore((s) => s.macroRedistributionNotices);
  const dismissMacroRedistributionNotice = useAppStore(
    (s) => s.dismissMacroRedistributionNotice,
  );

  const selectedDateSet = useMemo(() => new Set(selectedKeys), [selectedKeys]);
  const sortedSelected = useMemo(() => [...selectedKeys].sort(), [selectedKeys]);
  const rangeStartKey = sortedSelected[0] ?? todayKey;
  const rangeLabel = formatSelectedDateRange(sortedSelected);
  const viewDateKey = focusedDateKey ?? rangeStartKey;
  const mealsOn = (key: string) =>
    mealsForDateKey(key, dailyPlans, plannedMeals, todayKey);
  const viewMeals = mealsOn(viewDateKey);
  const selectedMeals = selectedDateKey ? mealsOn(selectedDateKey) : [];

  useEffect(() => {
    setLowComplexityForGen(userProfile?.lowComplexityEnabled === true);
  }, [userProfile?.lowComplexityEnabled]);

  const genOverrides = { lowComplexity: lowComplexityForGen };

  function openDay(key: string) {
    setFocusedDateKey(key);
    setSelectedPlanDateKey(key);
  }

  function toggleHighlight(key: string, date: Date) {
    const pastOrPrev =
      isPreviousCalendarWeek(startOfWeek(date)) || isDateKeyBefore(key, todayKey);
    if (pastOrPrev) return;
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  function toggleWeek(week: Date[]) {
    const weekStart = week[0]!;
    if (isPreviousCalendarWeek(weekStart)) return;
    const keys = week.map((d) => toDateKey(d)).filter((key) => isDateKeyOnOrAfter(key, todayKey));
    if (keys.length === 0) return;
    setSelectedKeys((prev) => {
      const allOn = keys.every((k) => prev.includes(k));
      if (allOn) return prev.filter((k) => !keys.includes(k));
      return [...new Set([...prev, ...keys])];
    });
  }

  function handleGenerateHighlighted() {
    if (sortedSelected.length === 0) {
      setSelectPrompt("Select dates on the calendar first.");
      return;
    }
    setSelectPrompt(null);
    const wouldReplace = sortedSelected.some((key) => mealsOn(key).length > 0);
    if (wouldReplace) {
      const ok = window.confirm(
        `Replace existing meals for ${rangeLabel}? Locked days and meals will be kept.`,
      );
      if (!ok) return;
    }
    generateForDateKeys(sortedSelected, genOverrides);
  }

  function handleClearDates() {
    if (sortedSelected.length === 0) {
      setSelectPrompt("Select dates on the calendar first.");
      return;
    }
    setSelectPrompt(null);
    if (!confirmClearKeys(sortedSelected)) return;
    clearRangeMeals(sortedSelected);
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-32 pt-3">
      <header className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Meal Plan</h1>
        {userProfile && (
          <p className="mt-1 text-sm font-medium text-slate-600">
            {formatHouseholdPlanningLine(userProfile)}
          </p>
        )}
      </header>

      {!planNoteDismissed && (
        <UsageNote
          text="Tap a day number to view meals. Use the checkbox to highlight dates for Generate or Clear Dates."
          onDismiss={() => dismissUsageNote("plan")}
        />
      )}

      <RollingWeekCalendar
        todayDateKey={todayKey}
        selectedDateKeys={selectedDateSet}
        showChecks
        onWeekClick={toggleWeek}
        onViewDay={(key) => openDay(key)}
        onToggleHighlight={toggleHighlight}
        dayHasMeals={(key) => mealsOn(key).length > 0}
        extraFutureWeeks={extraFutureWeeks}
        onLoadMoreDates={() => setExtraFutureWeeks((n) => n + 4)}
        dayDisabled={() => false}
        caption={
          <div className="mb-2 flex flex-wrap items-center justify-center gap-2">
            <p
              className={`text-xs font-medium ${
                rangeLabel ? "text-slate-600" : "text-slate-400"
              }`}
            >
              {rangeLabel
                ? `${sortedSelected.length} ${sortedSelected.length === 1 ? "day" : "days"} · ${rangeLabel}`
                : "Check days to highlight a range"}
            </p>
            <ClearDatesButton onClear={handleClearDates} />
          </div>
        }
        footer={
          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={handleGenerateHighlighted}
              className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-[#2563EB] px-3 text-sm font-semibold text-white"
            >
              <RefreshCw className="h-3.5 w-3.5 shrink-0" />
              Generate
            </button>
            {selectPrompt && (
              <p className="text-center text-xs font-medium text-amber-800" role="status">
                {selectPrompt}
              </p>
            )}
            <button
              type="button"
              onClick={() => setSelectedPlanDateKey(viewDateKey)}
              className="flex min-h-[40px] w-full items-center justify-center rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white"
            >
              View{" "}
              {fromDateKey(viewDateKey).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
              {viewMeals.length > 0 ? ` · ${viewMeals.length} meals` : " · no meals"}
            </button>
            <LowComplexityGenerateToggle
              enabled={lowComplexityForGen}
              onChange={setLowComplexityForGen}
            />
          </div>
        }
      />

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
            if (!confirmClearKeys([selectedDateKey])) return;
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
            {meals.length === 0 ? "Generate Day" : "Regenerate Day"}
          </button>
          <ClearDatesButton
            disabled={locked || meals.length === 0}
            className="min-h-[40px] rounded-xl px-3"
            onClear={onClearDay}
          />
        </div>
        {showMacroNotice && (
          <MacroRedistributionNotice onDismiss={onDismissMacroNotice} />
        )}
        {meals.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
            No meals for this day yet. Generate from the calendar, or generate this day above.
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
