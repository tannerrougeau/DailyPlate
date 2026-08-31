import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { GenerateDayButton } from "@/components/GenerateDayButton";
import { LowComplexityGenerateToggle } from "@/components/LowComplexityGenerateToggle";
import {
  MealCard,
  mealDragPayload,
  parseMealDragPayload,
} from "@/components/MealCard";
import { MealPrepSheet } from "@/components/MealPrepSheet";
import { MealTrackingSheet } from "@/components/MealTrackingSheet";
import type { MealSlotId, PlannedMeal, Recipe } from "@/types";
import { NutritionDashboard } from "@/components/NutritionDashboard";
import { FeedbackCheckInButton } from "@/components/FeedbackCheckIn";
import { CheckInSheet } from "@/components/CheckInSheet";
import { SettingsSheet } from "@/components/SettingsSheet";
import { SmartAdjustmentBadge } from "@/components/SmartAdjustmentBadge";
import { TodayHeader } from "@/components/TodayHeader";
import { UsageNote } from "@/components/UsageNote";
import { PersonalizationInsightBanner } from "@/components/PersonalizationInsightBanner";
import { MacroRedistributionNotice } from "@/components/MacroRedistributionNotice";
import { useAppStore } from "@/store/useAppStore";
import { slotsForMealsPerDay } from "@/utils/generateDayPlan";
import { sumTrackedMacros } from "@/utils/mealTracking";
import { toDateKey } from "@/utils/date";

const fallbackOrder = ["breakfast", "lunch", "dinner", "snack"] as const;

function isRecentCheckIn(iso?: string | null, days = 14): boolean {
  if (!iso) return false;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return false;
  return Date.now() - then < days * 24 * 60 * 60 * 1000;
}

export function TodayScreen() {
  const [dayOffset, setDayOffset] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [mealPrepRecipe, setMealPrepRecipe] = useState<Recipe | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<MealSlotId | null>(null);
  const [trackingMeal, setTrackingMeal] = useState<PlannedMeal | null>(null);
  const [generateNotice, setGenerateNotice] = useState<string | null>(null);

  const targets = useAppStore((s) => s.targets);
  const plannedMeals = useAppStore((s) => s.plannedMeals);
  const dailyPlans = useAppStore((s) => s.dailyPlans);
  const mealTracking = useAppStore((s) => s.mealTracking);
  const todayDateKey = useAppStore((s) => s.todayDateKey);
  const userProfile = useAppStore((s) => s.userProfile);
  const [lowComplexityForGen, setLowComplexityForGen] = useState(false);
  const generateDay = useAppStore((s) => s.generateDay);
  const generateDays = useAppStore((s) => s.generateDays);
  const moveMealToSlot = useAppStore((s) => s.moveMealToSlot);
  const setMealTracking = useAppStore((s) => s.setMealTracking);
  const todayNoteDismissed = useAppStore((s) => s.dismissedUsageNotes.today);
  const dismissUsageNote = useAppStore((s) => s.dismissUsageNote);
  const macroRedistributionNotices = useAppStore((s) => s.macroRedistributionNotices);
  const dismissMacroRedistributionNotice = useAppStore(
    (s) => s.dismissMacroRedistributionNotice,
  );
  const personalizationInsight = useAppStore((s) => s.personalizationInsight);
  const dismissPersonalizationInsight = useAppStore((s) => s.dismissPersonalizationInsight);

  const slotOrder = userProfile
    ? slotsForMealsPerDay(userProfile.mealsPerDay)
    : [...fallbackOrder];

  const viewDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    return d;
  }, [dayOffset]);

  const viewDateKey = toDateKey(viewDate);
  const mealsForViewDate = dailyPlans[viewDateKey] ?? (dayOffset === 0 ? plannedMeals : []);
  const dayTracking = mealTracking[viewDateKey];
  const { eaten, planned, hasTracking, loggedCount } = sumTrackedMacros(
    mealsForViewDate,
    dayTracking,
  );
  const sortedMeals = [...mealsForViewDate].sort(
    (a, b) => slotOrder.indexOf(a.slot) - slotOrder.indexOf(b.slot),
  );
  const loggedCountDisplay = dayTracking ? Object.keys(dayTracking).length : 0;
  const showCheckInBadge = isRecentCheckIn(userProfile?.lastCheckInAt);

  useEffect(() => {
    if (!generateNotice) return;
    const timer = window.setTimeout(() => setGenerateNotice(null), 7000);
    return () => window.clearTimeout(timer);
  }, [generateNotice]);

  useEffect(() => {
    setLowComplexityForGen(userProfile?.lowComplexityEnabled === true);
  }, [userProfile?.lowComplexityEnabled]);

  function handleGenerateDay() {
    const result = generateDay(viewDateKey, { lowComplexity: lowComplexityForGen });
    if (!result.ok) return;
    const dayLabel =
      viewDateKey === todayDateKey
        ? "Today's"
        : viewDate.toLocaleDateString("en-US", { weekday: "long" }) + "'s";
    setGenerateNotice(
      `${dayLabel} plan has been replaced with a new generated plan. Grocery list updated.`,
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-32 pt-3">
      <TodayHeader
        viewDate={viewDate}
        onPrevDay={() => setDayOffset((o) => o - 1)}
        onNextDay={() => setDayOffset((o) => o + 1)}
        onSettings={() => setSettingsOpen(true)}
        trailing={<FeedbackCheckInButton onOpen={() => setFeedbackOpen(true)} />}
      />

      {!todayNoteDismissed && (
        <div className="section-gap">
          <UsageNote
            text="Tap a meal to log what you ate. Expand Recipe details on any meal for ingredients and variations — use ⋯ for replace, regenerate, or remove."
            onDismiss={() => dismissUsageNote("today")}
          />
        </div>
      )}

      {showCheckInBadge && (
        <div className="section-gap flex justify-center">
          <SmartAdjustmentBadge variant="success">
            Adjusted based on your recent check-in
          </SmartAdjustmentBadge>
        </div>
      )}

      {macroRedistributionNotices.includes(viewDateKey) && (
        <MacroRedistributionNotice
          onDismiss={() => dismissMacroRedistributionNotice(viewDateKey)}
        />
      )}

      {personalizationInsight && (
        <PersonalizationInsightBanner
          message={personalizationInsight.message}
          onDismiss={dismissPersonalizationInsight}
        />
      )}

      <div className="section-gap">
        <NutritionDashboard
          targets={targets}
          eaten={eaten}
          planned={planned}
          hasTracking={hasTracking}
          loggedCount={loggedCount}
          mealCount={sortedMeals.length}
          anchorDateKey={viewDateKey}
          storeTodayDateKey={todayDateKey}
          isViewingToday={viewDateKey === todayDateKey}
          dailyPlans={dailyPlans}
          plannedMeals={plannedMeals}
          mealTracking={mealTracking}
        />
      </div>

      <div className="section-gap space-y-3">
        <LowComplexityGenerateToggle
          enabled={lowComplexityForGen}
          onChange={setLowComplexityForGen}
        />
        <GenerateDayButton onClick={handleGenerateDay} />
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              generateDays(viewDate, 2, { lowComplexity: lowComplexityForGen });
              setGenerateNotice("2-day plan generated from this date. Grocery list updated.");
            }}
            className="min-h-[44px] rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800"
          >
            Generate 2 days
          </button>
          <button
            type="button"
            onClick={() => {
              generateDays(viewDate, 3, { lowComplexity: lowComplexityForGen });
              setGenerateNotice("3-day plan generated from this date. Grocery list updated.");
            }}
            className="min-h-[44px] rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800"
          >
            Generate 3 days
          </button>
        </div>
        {generateNotice && (
          <div
            className="mt-3 flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3"
            role="status"
          >
            <p className="flex-1 text-sm leading-relaxed text-emerald-900">{generateNotice}</p>
            <button
              type="button"
              onClick={() => setGenerateNotice(null)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-emerald-700 hover:bg-emerald-100/80"
              aria-label="Dismiss notice"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <p className="mt-3 text-center text-sm text-slate-400">
          We aim for your day within about ±50 kcal of your goal.
        </p>
      </div>

      <section aria-label="Today's meals" className="space-y-5">
        <div className="flex items-baseline justify-between gap-2 px-1">
          <h2 className="text-lg font-bold text-slate-900">Meals</h2>
          {sortedMeals.length > 0 && (
            <p className="text-xs text-slate-400">
              {loggedCountDisplay > 0
                ? `${loggedCountDisplay}/${sortedMeals.length} logged · tap to update`
                : "Tap a meal to log"}
            </p>
          )}
        </div>

        {sortedMeals.length === 0 ? (
          <div className="card-surface px-6 py-14 text-center">
            <p className="text-base leading-relaxed text-slate-500">
              No meals yet — tap{" "}
              <span className="font-semibold text-primary">Generate Day Plan</span> to fill your
              day.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-5">
            {sortedMeals.map((meal) => (
              <li key={meal.slot}>
                <MealCard
                  meal={meal}
                  dateKey={viewDateKey}
                  dayMeals={sortedMeals}
                  inlineDetailsDropdown
                  draggable
                  isDragOver={dragOverSlot === meal.slot}
                  onMealPrep={setMealPrepRecipe}
                  trackingEntry={dayTracking?.[meal.slot]}
                  onTrackTap={() => setTrackingMeal(meal)}
                  onAddNote={() => setTrackingMeal(meal)}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(
                      "application/json",
                      mealDragPayload(viewDateKey, meal.slot),
                    );
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOverSlot(meal.slot);
                  }}
                  onDragLeave={() => setDragOverSlot(null)}
                  onDrop={(event) => {
                    event.preventDefault();
                    const payload = parseMealDragPayload(
                      event.dataTransfer.getData("application/json"),
                    );
                    if (payload) {
                      moveMealToSlot(payload.dateKey, payload.slot, viewDateKey, meal.slot);
                    }
                    setDragOverSlot(null);
                  }}
                  onDragEnd={() => setDragOverSlot(null)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {trackingMeal && (
        <MealTrackingSheet
          meal={trackingMeal}
          existing={dayTracking?.[trackingMeal.slot]}
          onClose={() => setTrackingMeal(null)}
          onSave={(entry) => setMealTracking(viewDateKey, trackingMeal.slot, entry)}
          onClear={() => setMealTracking(viewDateKey, trackingMeal.slot, null)}
        />
      )}

      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
      {feedbackOpen && <CheckInSheet onClose={() => setFeedbackOpen(false)} />}
      {mealPrepRecipe && (
        <MealPrepSheet
          recipe={mealPrepRecipe}
          defaultStartDateKey={viewDateKey}
          onClose={() => setMealPrepRecipe(null)}
        />
      )}
    </div>
  );
}
