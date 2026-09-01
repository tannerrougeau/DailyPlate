import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { GenerateDayButton } from "@/components/GenerateDayButton";
import { MealCard } from "@/components/MealCard";
import { MealPrepSheet } from "@/components/MealPrepSheet";
import type { Recipe } from "@/types";
import { NutritionDashboard } from "@/components/NutritionDashboard";
import { FeedbackCheckInButton } from "@/components/FeedbackCheckIn";
import { CheckInSheet } from "@/components/CheckInSheet";
import { SettingsSheet } from "@/components/SettingsSheet";
import { SmartAdjustmentBadge } from "@/components/SmartAdjustmentBadge";
import { TodayHeader } from "@/components/TodayHeader";
import { TodayHouseholdSheet } from "@/components/TodayHouseholdSheet";
import { UsageNote } from "@/components/UsageNote";
import { PersonalizationInsightBanner } from "@/components/PersonalizationInsightBanner";
import { MacroRedistributionNotice } from "@/components/MacroRedistributionNotice";
import { useAppStore } from "@/store/useAppStore";
import { slotsForMealsPerDay } from "@/utils/generateDayPlan";
import { fromDateKey } from "@/utils/date";
import {
  countsFromOverride,
  formatHouseholdCookingLine,
  resolveHouseholdCounts,
} from "@/utils/household";
import { mealsForDateKey, sumTrackedMacros } from "@/utils/mealTracking";

const fallbackOrder = ["breakfast", "lunch", "dinner", "snack"] as const;

function isRecentCheckIn(iso?: string | null, days = 14): boolean {
  if (!iso) return false;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return false;
  return Date.now() - then < days * 24 * 60 * 60 * 1000;
}

export function TodayScreen() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [mealPrepRecipe, setMealPrepRecipe] = useState<Recipe | null>(null);
  const [generateNotice, setGenerateNotice] = useState<string | null>(null);
  const [householdSheetOpen, setHouseholdSheetOpen] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  const targets = useAppStore((s) => s.targets);
  const plannedMeals = useAppStore((s) => s.plannedMeals);
  const dailyPlans = useAppStore((s) => s.dailyPlans);
  const mealTracking = useAppStore((s) => s.mealTracking);
  const todayDateKey = useAppStore((s) => s.todayDateKey);
  const userProfile = useAppStore((s) => s.userProfile);
  const todayHouseholdOverride = useAppStore((s) => s.todayHouseholdOverride);
  const setTodayHouseholdOverride = useAppStore((s) => s.setTodayHouseholdOverride);
  const generateDay = useAppStore((s) => s.generateDay);
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

  const todayCountsOverride = countsFromOverride(todayHouseholdOverride, todayDateKey);
  const cookingLine = formatHouseholdCookingLine(userProfile, todayCountsOverride);
  const currentCounts = resolveHouseholdCounts(userProfile, todayCountsOverride);

  const viewDate = fromDateKey(todayDateKey);
  const mealsForViewDate = mealsForDateKey(
    todayDateKey,
    dailyPlans,
    plannedMeals,
    todayDateKey,
  );
  const dayTracking = mealTracking[todayDateKey];
  const { eaten, loggedCount } = sumTrackedMacros(
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

  function handleRegenerateToday() {
    // Future: dedicated low-complexity vs detailed generate mode. Honor profile flag until then.
    const result = generateDay(todayDateKey, {
      lowComplexity: userProfile?.lowComplexityEnabled === true,
    });
    if (!result.ok) return;
    setGenerateNotice("Today’s plan has been replaced. Grocery list updated.");
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-32 pt-3">
      <TodayHeader
        viewDate={viewDate}
        onSettings={() => setSettingsOpen(true)}
        trailing={<FeedbackCheckInButton onOpen={() => setFeedbackOpen(true)} />}
      />

      {!todayNoteDismissed && (
        <div className="section-gap">
          <UsageNote
            text="Mark Eaten or Skip on each meal. Open Recipe/Prep details for ingredients and variations — use ⋯ to replace or remove."
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

      {macroRedistributionNotices.includes(todayDateKey) && (
        <MacroRedistributionNotice
          onDismiss={() => dismissMacroRedistributionNotice(todayDateKey)}
        />
      )}

      {personalizationInsight && (
        <PersonalizationInsightBanner
          message={personalizationInsight.message}
          onDismiss={dismissPersonalizationInsight}
        />
      )}

      <div className="section-gap">
        <button
          type="button"
          onClick={() => setHouseholdSheetOpen(true)}
          className="card-surface flex min-h-[44px] w-full items-center justify-center px-4 py-2.5 text-center text-sm font-medium text-slate-700"
        >
          {cookingLine}
        </button>
      </div>

      <div className="section-gap">
        <NutritionDashboard
          targets={targets}
          eaten={eaten}
          loggedCount={loggedCount}
          mealCount={sortedMeals.length}
        />
      </div>

      <div className="section-gap">
        <div className="flex justify-center">
          <GenerateDayButton
            label="Regenerate Today"
            compact
            onClick={() => setConfirmRegenerate(true)}
          />
        </div>
        {confirmRegenerate && (
          <div className="mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-sm font-medium text-slate-800">Replace today’s meals?</p>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmRegenerate(false)}
                className="min-h-[36px] rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmRegenerate(false);
                  handleRegenerateToday();
                }}
                className="min-h-[36px] rounded-xl bg-[#2563EB] px-3 text-sm font-semibold text-white"
              >
                Confirm
              </button>
            </div>
          </div>
        )}
        {generateNotice && (
          <div
            className="mt-2 flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3"
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
      </div>

      <section aria-label="Today's meals" className="space-y-5">
        <div className="flex items-baseline justify-between gap-2 px-1">
          <h2 className="text-lg font-bold text-slate-900">Meals</h2>
          {sortedMeals.length > 0 && (
            <p className="text-xs text-slate-400">
              {loggedCountDisplay > 0
                ? `${loggedCountDisplay}/${sortedMeals.length} logged`
                : "Mark eaten or skip"}
            </p>
          )}
        </div>

        {sortedMeals.length === 0 ? (
          <div className="card-surface px-6 py-14 text-center">
            <p className="text-base leading-relaxed text-slate-500">
              No meals yet — tap{" "}
              <span className="font-semibold text-primary">Regenerate Today</span> to fill your
              day.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-5">
            {sortedMeals.map((meal) => (
              <li key={meal.slot}>
                <MealCard
                  meal={meal}
                  dateKey={todayDateKey}
                  dayMeals={sortedMeals}
                  inlineDetailsDropdown
                  onMealPrep={setMealPrepRecipe}
                  trackingEntry={dayTracking?.[meal.slot]}
                  showEatenSkip
                  onEaten={() => {
                    const current = dayTracking?.[meal.slot];
                    setMealTracking(
                      todayDateKey,
                      meal.slot,
                      current?.status === "all"
                        ? null
                        : { status: "all", loggedAt: new Date().toISOString() },
                    );
                  }}
                  onSkip={() => {
                    const current = dayTracking?.[meal.slot];
                    setMealTracking(
                      todayDateKey,
                      meal.slot,
                      current?.status === "skipped"
                        ? null
                        : { status: "skipped", loggedAt: new Date().toISOString() },
                    );
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
      {feedbackOpen && <CheckInSheet onClose={() => setFeedbackOpen(false)} />}
      {householdSheetOpen && (
        <TodayHouseholdSheet
          profile={userProfile}
          current={currentCounts}
          onSave={(counts) =>
            setTodayHouseholdOverride({ dateKey: todayDateKey, ...counts })
          }
          onReset={() => setTodayHouseholdOverride(null)}
          onClose={() => setHouseholdSheetOpen(false)}
        />
      )}
      {mealPrepRecipe && (
        <MealPrepSheet
          recipe={mealPrepRecipe}
          defaultStartDateKey={todayDateKey}
          onClose={() => setMealPrepRecipe(null)}
        />
      )}
    </div>
  );
}
