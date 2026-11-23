import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { MealPrepSheet } from "@/components/MealPrepSheet";
import type { MealSlotId, MealTrackingEntry, Recipe } from "@/types";
import { FeedbackCheckInButton } from "@/components/FeedbackCheckIn";
import { CheckInSheet } from "@/components/CheckInSheet";
import { SettingsSheet } from "@/components/SettingsSheet";
import { SmartAdjustmentBadge } from "@/components/SmartAdjustmentBadge";
import { TodayHeader } from "@/components/TodayHeader";
import { TodayHouseholdSheet } from "@/components/TodayHouseholdSheet";
import { TodayMealRow, UndoToast } from "@/components/TodayMealRow";
import { TodayProgressCard } from "@/components/TodayProgressCard";
import { UsageNote } from "@/components/UsageNote";
import { PersonalizationInsightBanner } from "@/components/PersonalizationInsightBanner";
import { MacroRedistributionNotice } from "@/components/MacroRedistributionNotice";
import { useAppStore } from "@/store/useAppStore";
import { slotsForMealsPerDay } from "@/utils/generateDayPlan";
import { fromDateKey } from "@/utils/date";
import {
  countsFromOverride,
  formatHouseholdChip,
  resolveHouseholdCounts,
} from "@/utils/household";
import { mealsForDateKey, sumTrackedMacros, trackingLabel } from "@/utils/mealTracking";

const fallbackOrder: MealSlotId[] = ["breakfast", "lunch", "dinner", "snack", "snack_2", "snack_3"];

function isRecentCheckIn(iso?: string | null, days = 14): boolean {
  if (!iso) return false;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return false;
  return Date.now() - then < days * 24 * 60 * 60 * 1000;
}

type UndoState = {
  slot: MealSlotId;
  previous: MealTrackingEntry | null;
  message: string;
};

export function TodayScreen() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openSettingsOnStart = useAppStore((s) => s.openSettingsOnStart);
  const consumeOpenSettingsRequest = useAppStore((s) => s.consumeOpenSettingsRequest);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [mealPrep, setMealPrep] = useState<{ recipe: Recipe; variationId?: string } | null>(
    null,
  );
  const [generateNotice, setGenerateNotice] = useState<string | null>(null);
  const [householdSheetOpen, setHouseholdSheetOpen] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [expandedSlot, setExpandedSlot] = useState<MealSlotId | "init" | null>("init");
  const [undo, setUndo] = useState<UndoState | null>(null);
  const undoTimer = useRef<number | null>(null);

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
    ? slotsForMealsPerDay(userProfile)
    : [...fallbackOrder];

  const todayCountsOverride = countsFromOverride(todayHouseholdOverride, todayDateKey);
  const householdChip = formatHouseholdChip(userProfile, todayCountsOverride);
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
  const nextUnlogged = sortedMeals.find((meal) => !dayTracking?.[meal.slot])?.slot ?? null;
  const resolvedExpanded: MealSlotId | null =
    expandedSlot === "init" ? nextUnlogged : expandedSlot;
  const checkInRecent = isRecentCheckIn(userProfile?.lastCheckInAt);
  const checkInDue = !checkInRecent;

  useEffect(() => {
    if (!generateNotice) return;
    const timer = window.setTimeout(() => setGenerateNotice(null), 7000);
    return () => window.clearTimeout(timer);
  }, [generateNotice]);

  useEffect(() => {
    if (!openSettingsOnStart) return;
    setSettingsOpen(true);
    consumeOpenSettingsRequest();
  }, [openSettingsOnStart, consumeOpenSettingsRequest]);

  useEffect(() => {
    return () => {
      if (undoTimer.current != null) window.clearTimeout(undoTimer.current);
    };
  }, []);

  function handleRegenerateToday() {
    const result = generateDay(todayDateKey, {
      lowComplexity: userProfile?.lowComplexityEnabled === true,
    });
    if (!result.ok) return;
    setGenerateNotice("Today’s plan has been replaced. Grocery list updated.");
    setExpandedSlot("init");
  }

  function showUndo(next: UndoState) {
    if (undoTimer.current != null) window.clearTimeout(undoTimer.current);
    setUndo(next);
    undoTimer.current = window.setTimeout(() => setUndo(null), 5000);
  }

  function handleLog(slot: MealSlotId, entry: MealTrackingEntry | null, fromCircle: boolean) {
    const previous = dayTracking?.[slot] ?? null;
    setMealTracking(todayDateKey, slot, entry);
    if (entry === null) {
      setUndo(null);
      return;
    }
    const remaining = sortedMeals.find((meal) => meal.slot !== slot && !dayTracking?.[meal.slot]);
    setExpandedSlot(remaining?.slot ?? null);
    showUndo({
      slot,
      previous,
      message: fromCircle && entry.status === "all" ? "Marked eaten" : trackingLabel(entry),
    });
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-32 pt-3">
      <TodayHeader
        viewDate={viewDate}
        householdChip={householdChip}
        onHousehold={() => setHouseholdSheetOpen(true)}
        onSettings={() => setSettingsOpen(true)}
        onRegenerate={() => setConfirmRegenerate(true)}
      />

      {!todayNoteDismissed && (
        <div className="section-gap">
          <UsageNote
            text="Tap the circle to mark a meal eaten. Open a row for details, or use ⋯ to log half, 1.5×, skip, or something else."
            onDismiss={() => dismissUsageNote("today")}
          />
        </div>
      )}

      {checkInRecent && (
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
        <TodayProgressCard targets={targets} eaten={eaten} />
      </div>

      <div className="section-gap flex justify-center">
        <FeedbackCheckInButton due={checkInDue} onOpen={() => setFeedbackOpen(true)} />
      </div>

      {confirmRegenerate && (
        <div className="section-gap rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
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
          className="section-gap flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3"
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

      <section aria-label="Today's meals" className="section-gap space-y-3">
        <div className="flex items-baseline justify-between gap-2 px-1">
          <h2 className="text-lg font-bold text-slate-900">Meals</h2>
          {sortedMeals.length > 0 && (
            <p className="text-xs text-slate-400">
              {loggedCount > 0
                ? `${loggedCount}/${sortedMeals.length} logged`
                : "Tap the circle to log"}
            </p>
          )}
        </div>

        {sortedMeals.length === 0 ? (
          <div className="card-surface px-6 py-14 text-center">
            <p className="text-base leading-relaxed text-slate-500">
              No meals yet — open{" "}
              <span className="font-semibold text-primary">⋯</span> and tap Regenerate Today.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {sortedMeals.map((meal) => (
              <li key={meal.slot}>
                <TodayMealRow
                  meal={meal}
                  dateKey={todayDateKey}
                  expanded={resolvedExpanded === meal.slot}
                  upNext={nextUnlogged === meal.slot}
                  trackingEntry={dayTracking?.[meal.slot]}
                  onToggleExpand={() =>
                    setExpandedSlot((current) => {
                      const open = current === "init" ? nextUnlogged : current;
                      return open === meal.slot ? null : meal.slot;
                    })
                  }
                  onLog={(entry) => handleLog(meal.slot, entry, entry?.status === "all")}
                  onMealPrep={(recipe, variationId) => setMealPrep({ recipe, variationId })}
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
      {mealPrep && (
        <MealPrepSheet
          recipe={mealPrep.recipe}
          variationId={mealPrep.variationId}
          defaultStartDateKey={todayDateKey}
          onClose={() => setMealPrep(null)}
        />
      )}
      {undo && (
        <UndoToast
          message={undo.message}
          onUndo={() => {
            setMealTracking(todayDateKey, undo.slot, undo.previous);
            setUndo(null);
            if (undoTimer.current != null) window.clearTimeout(undoTimer.current);
          }}
          onDismiss={() => {
            setUndo(null);
            if (undoTimer.current != null) window.clearTimeout(undoTimer.current);
          }}
        />
      )}
    </div>
  );
}
