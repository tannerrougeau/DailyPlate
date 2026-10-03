import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Lock, X } from "lucide-react";
import { MealCard } from "@/components/MealCard";
import { MealPrepSheet } from "@/components/MealPrepSheet";
import type { PlannedMeal, Recipe } from "@/types";
import { MacroRedistributionNotice } from "@/components/MacroRedistributionNotice";
import { RollingWeekCalendar } from "@/components/RollingWeekCalendar";
import { useAppStore } from "@/store/useAppStore";
import {
  dateKeysInclusive,
  fromDateKey,
  isDateKeyBefore,
  isDateKeyOnOrAfter,
  rollingVisibleWeeks,
  toDateKey,
} from "@/utils/date";
import { formatHouseholdPlanningLine } from "@/utils/household";
import { mealsForDateKey } from "@/utils/mealTracking";
import { sumPlannedMacros } from "@/utils/generateDayPlan";
import { useOverlayBack } from "@/hooks/useOverlayBack";

function formatDayHeading(key: string): string {
  return fromDateKey(key).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function PlanScreen() {
  const todayKey = useAppStore((s) => s.todayDateKey);
  const plannedMeals = useAppStore((s) => s.plannedMeals);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [rangeAnchor, setRangeAnchor] = useState<string | null>(null);
  const [mealPrep, setMealPrep] = useState<{ recipe: Recipe; variationId?: string } | null>(
    null,
  );
  const [extraFutureWeeks, setExtraFutureWeeks] = useState(0);

  const userProfile = useAppStore((s) => s.userProfile);
  const targets = useAppStore((s) => s.targets);
  const selectedDateKey = useAppStore((s) => s.selectedPlanDateKey);
  const setSelectedPlanDateKey = useAppStore((s) => s.setSelectedPlanDateKey);
  const generateForDateKeys = useAppStore((s) => s.generateForDateKeys);
  const generateDay = useAppStore((s) => s.generateDay);
  const clearDayMeals = useAppStore((s) => s.clearDayMeals);
  const dailyPlans = useAppStore((s) => s.dailyPlans);
  const lockedDays = useAppStore((s) => s.lockedDays);
  const toggleDayLock = useAppStore((s) => s.toggleDayLock);
  const macroRedistributionNotices = useAppStore((s) => s.macroRedistributionNotices);
  const dismissMacroRedistributionNotice = useAppStore(
    (s) => s.dismissMacroRedistributionNotice,
  );

  const selectedDateSet = useMemo(() => new Set(selectedKeys), [selectedKeys]);
  const visibleDays = useMemo(
    () =>
      rollingVisibleWeeks(new Date(), 5 + extraFutureWeeks)
        .flat()
        .map((d) => toDateKey(d)),
    [extraFutureWeeks],
  );
  const mealsOn = (key: string) =>
    mealsForDateKey(key, dailyPlans, plannedMeals, todayKey);
  const selectedMeals = selectedDateKey ? mealsOn(selectedDateKey) : [];

  function exitSelectMode() {
    setSelectMode(false);
    setRangeAnchor(null);
    setSelectedKeys([]);
  }

  function handleDayClick(key: string) {
    if (!selectMode) {
      setSelectedPlanDateKey(key);
      return;
    }
    if (isDateKeyBefore(key, todayKey)) return;
    if (rangeAnchor && rangeAnchor !== key) {
      const range = dateKeysInclusive(rangeAnchor, key).filter((k) =>
        isDateKeyOnOrAfter(k, todayKey),
      );
      setSelectedKeys((prev) => [...new Set([...prev, ...range])]);
      setRangeAnchor(null);
      return;
    }
    const alreadyOn = selectedKeys.includes(key);
    setSelectedKeys((prev) =>
      alreadyOn ? prev.filter((k) => k !== key) : [...prev, key],
    );
    setRangeAnchor(alreadyOn ? null : key);
  }

  function handleSelectWeek(week: Date[]) {
    const keys = week.map((d) => toDateKey(d)).filter((key) => isDateKeyOnOrAfter(key, todayKey));
    if (keys.length === 0) return;
    setSelectedKeys((prev) => {
      const allOn = keys.every((k) => prev.includes(k));
      if (allOn) return prev.filter((k) => !keys.includes(k));
      return [...new Set([...prev, ...keys])];
    });
    setRangeAnchor(null);
  }

  function handleGenerateSelected() {
    const unlocked = selectedKeys.filter((key) => !lockedDays.includes(key));
    const lockedCount = selectedKeys.length - unlocked.length;
    if (unlocked.length === 0) {
      window.alert(
        lockedCount > 0
          ? `${lockedCount} locked ${lockedCount === 1 ? "day" : "days"} will be skipped.`
          : "Select days first.",
      );
      return;
    }
    const withMeals = unlocked.filter((key) => mealsOn(key).length > 0);
    let message = "";
    if (withMeals.length > 0) {
      message = `Replace meals on ${withMeals.length} ${withMeals.length === 1 ? "day" : "days"}?`;
    }
    if (lockedCount > 0) {
      const skip = `${lockedCount} locked ${lockedCount === 1 ? "day" : "days"} will be skipped.`;
      message = message ? `${message} ${skip}` : skip;
    }
    if (message && !window.confirm(message)) return;
    generateForDateKeys(unlocked);
    exitSelectMode();
  }

  return (
    <div className={`mx-auto max-w-lg px-4 pt-3 ${selectMode ? "pb-44" : "pb-32"}`}>
      <header className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Meal Plan</h1>
        {userProfile && (
          <p className="mt-1 text-sm font-medium text-slate-600">
            {formatHouseholdPlanningLine(userProfile)}
          </p>
        )}
      </header>

      <div className="mb-3 flex items-center justify-between gap-2">
        {selectMode ? (
          <button
            type="button"
            onClick={exitSelectMode}
            className="min-h-[40px] rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white"
          >
            Done
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setSelectMode(true);
              setSelectedKeys([]);
              setRangeAnchor(null);
            }}
            className="min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800"
          >
            Select days
          </button>
        )}
      </div>

      <RollingWeekCalendar
        todayDateKey={todayKey}
        selectedDateKeys={selectedDateSet}
        selectMode={selectMode}
        onDayClick={(key) => handleDayClick(key)}
        onSelectWeek={handleSelectWeek}
        dayHasMeals={(key) => mealsOn(key).length > 0}
        extraFutureWeeks={extraFutureWeeks}
        onLoadMoreDates={() => setExtraFutureWeeks((n) => n + 4)}
      />

      {selectMode && (
        <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 px-4">
          <div className="mx-auto flex max-w-lg items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-lg">
            <p className="min-w-0 flex-1 text-sm font-semibold text-slate-800">
              {selectedKeys.length} {selectedKeys.length === 1 ? "day" : "days"} selected
            </p>
            <button
              type="button"
              onClick={handleGenerateSelected}
              disabled={selectedKeys.length === 0}
              className="min-h-[40px] rounded-xl bg-[#2563EB] px-3 text-sm font-semibold text-white disabled:opacity-40"
            >
              Generate
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedKeys([]);
                setRangeAnchor(null);
              }}
              className="min-h-[40px] rounded-xl px-2 text-sm font-semibold text-slate-600"
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

      {selectedDateKey && (
        <DayDetailSheet
          dateKey={selectedDateKey}
          meals={selectedMeals}
          locked={lockedDays.includes(selectedDateKey)}
          showMacroNotice={macroRedistributionNotices.includes(selectedDateKey)}
          calories={Math.round(sumPlannedMacros(selectedMeals).calories)}
          protein={Math.round(sumPlannedMacros(selectedMeals).protein)}
          targetCalories={targets.calories}
          targetProtein={targets.protein}
          visibleDays={visibleDays}
          onClose={() => setSelectedPlanDateKey(null)}
          onGoToDay={(key) => setSelectedPlanDateKey(key)}
          onToggleLock={() => toggleDayLock(selectedDateKey)}
          onRegenerate={() => {
            if (selectedMeals.length > 0) {
              const ok = window.confirm("Replace meals on this day?");
              if (!ok) return;
            }
            generateDay(selectedDateKey);
          }}
          onClearDay={() => {
            if (selectedMeals.length === 0) return;
            const ok = window.confirm(`Remove meals for ${formatDayHeading(selectedDateKey)}?`);
            if (!ok) return;
            clearDayMeals(selectedDateKey);
          }}
          onDismissMacroNotice={() =>
            dismissMacroRedistributionNotice(selectedDateKey)
          }
          onMealPrep={(recipe, variationId) => setMealPrep({ recipe, variationId })}
        />
      )}

      {mealPrep && selectedDateKey && (
        <MealPrepSheet
          recipe={mealPrep.recipe}
          variationId={mealPrep.variationId}
          defaultStartDateKey={selectedDateKey}
          onClose={() => setMealPrep(null)}
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
  calories,
  protein,
  targetCalories,
  targetProtein,
  visibleDays,
  onClose,
  onGoToDay,
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
  calories: number;
  protein: number;
  targetCalories: number;
  targetProtein: number;
  visibleDays: string[];
  onClose: () => void;
  onGoToDay: (key: string) => void;
  onToggleLock: () => void;
  onRegenerate: () => void;
  onClearDay: () => void;
  onDismissMacroNotice: () => void;
  onMealPrep: (recipe: Recipe, variationId?: string) => void;
}) {
  useOverlayBack(true, onClose);
  const startX = useRef(0);
  const startY = useRef(0);

  function go(delta: number) {
    const i = visibleDays.indexOf(dateKey);
    if (i < 0) return;
    const next = visibleDays[i + delta];
    if (next) onGoToDay(next);
  }

  function onPointerDown(event: ReactPointerEvent) {
    if (event.button !== 0) return;
    startX.current = event.clientX;
    startY.current = event.clientY;
  }

  function onPointerUp(event: ReactPointerEvent) {
    const dx = event.clientX - startX.current;
    const dy = event.clientY - startY.current;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
    if (event.target instanceof HTMLElement && event.target.closest("button, a, input, select, textarea, label")) {
      return;
    }
    go(dx < 0 ? 1 : -1);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close day details"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />
      <section
        className="relative z-[81] max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-slate-200 bg-[#f5f5f4] p-4 shadow-2xl sm:rounded-3xl"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{formatDayHeading(dateKey)}</h2>
            <p className="mt-1 text-sm font-medium text-slate-600">
              {calories.toLocaleString()} / {targetCalories.toLocaleString()} kcal · Protein{" "}
              {protein} / {targetProtein} g
            </p>
          </div>
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
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleLock}
            className="min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
          >
            {locked ? "Unlock Day" : "Lock Day"}
          </button>
          {meals.length > 0 && (
            <button
              type="button"
              disabled={locked}
              onClick={onRegenerate}
              className="min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 disabled:opacity-40"
            >
              Regenerate
            </button>
          )}
          {meals.length > 0 && (
            <button
              type="button"
              disabled={locked}
              onClick={onClearDay}
              className="min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 disabled:opacity-40"
            >
              Remove meals
            </button>
          )}
        </div>
        {showMacroNotice && (
          <MacroRedistributionNotice onDismiss={onDismissMacroNotice} />
        )}
        {meals.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5">
            <p className="text-sm text-slate-500">No meals yet</p>
            <button
              type="button"
              disabled={locked}
              onClick={onRegenerate}
              className="mt-3 min-h-[44px] w-full rounded-xl bg-[#2563EB] text-sm font-semibold text-white disabled:opacity-40"
            >
              Generate this day
            </button>
          </div>
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
