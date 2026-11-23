import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { AddSnackSheet } from "@/components/AddSnackSheet";
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
import { useAppStore } from "@/store/useAppStore";
import { slotsForMealsPerDay } from "@/utils/generateDayPlan";
import { fromDateKey } from "@/utils/date";
import {
  countsFromOverride,
  formatHouseholdChip,
  resolveHouseholdCounts,
} from "@/utils/household";
import { mealsForDateKey, sumTrackedMacros, trackingLabel } from "@/utils/mealTracking";
import { remainingToday } from "@/utils/snackItems";
import { QuestionCard } from "@/components/QuestionCard";
import { useDisplayPrefs } from "@/hooks/useDisplayPrefs";
import { canAskOnOpen, MAX_ON_OPEN, nextQuestions, type Question } from "@/utils/questionQueue";

const fallbackOrder: MealSlotId[] = ["breakfast", "lunch", "dinner", "snack", "snack_2", "snack_3"];

function isRecentCheckIn(iso?: string | null, days = 14): boolean {
  if (!iso) return false;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return false;
  return Date.now() - then < days * 24 * 60 * 60 * 1000;
}

type UndoState = {
  message: string;
  undo: () => void;
};

const REGENERATE_CONFIRM =
  "Replace today's meals? This also updates today on your plan, calendar and grocery list. Meals you kept or marked eaten won't change.";

export function TodayScreen() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openSettingsOnStart = useAppStore((s) => s.openSettingsOnStart);
  const consumeOpenSettingsRequest = useAppStore((s) => s.consumeOpenSettingsRequest);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [mealPrep, setMealPrep] = useState<{ recipe: Recipe; variationId?: string } | null>(
    null,
  );
  const [snackOpen, setSnackOpen] = useState(false);
  const [question, setQuestion] = useState<Question | null>(null);
  const display = useDisplayPrefs();
  const recordUsage = useAppStore((s) => s.recordUsage);
  const refreshQuestions = useAppStore((s) => s.refreshQuestions);
  const answerQuestion = useAppStore((s) => s.answerQuestion);
  const restoreCheckpoint = useAppStore((s) => s.restoreCheckpoint);
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
  const regenerateToday = useAppStore((s) => s.regenerateToday);
  const restoreDay = useAppStore((s) => s.restoreDay);
  const setMealTracking = useAppStore((s) => s.setMealTracking);
  const snackLogs = useAppStore((s) => s.snackLogs);
  const addSnackLog = useAppStore((s) => s.addSnackLog);
  const removeSnackLog = useAppStore((s) => s.removeSnackLog);
  const todayNoteDismissed = useAppStore((s) => s.dismissedUsageNotes.today);
  const dismissUsageNote = useAppStore((s) => s.dismissUsageNote);
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
  const todaySnacks = snackLogs[todayDateKey] ?? [];
  const { eaten, loggedCount } = sumTrackedMacros(
    mealsForViewDate,
    dayTracking,
    todaySnacks,
  );
  const sortedMeals = [...mealsForViewDate].sort(
    (a, b) => slotOrder.indexOf(a.slot) - slotOrder.indexOf(b.slot),
  );
  const nextUnlogged = sortedMeals.find((meal) => !dayTracking?.[meal.slot])?.slot ?? null;
  const resolvedExpanded: MealSlotId | null =
    expandedSlot === "init" ? nextUnlogged : expandedSlot;
  const checkInRecent = isRecentCheckIn(userProfile?.lastCheckInAt);
  const checkInDue = !checkInRecent;

  // App open: count the meal cards shown, then maybe ask one question (3-day spacing).
  useEffect(() => {
    recordUsage("cards", mealsForViewDate.length);
    refreshQuestions();
    const s = useAppStore.getState();
    if (!canAskOnOpen(s.lastQuestionAskedAt, new Date())) return;
    setQuestion(nextQuestions(s.questionQueue, s.questionLog, new Date(), MAX_ON_OPEN)[0] ?? null);
    // Once per visit to Today.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dev panel: show a forced question right away.
  const devForcedQuestionId = useAppStore((s) => s.devForcedQuestionId);
  useEffect(() => {
    if (!devForcedQuestionId) return;
    const forced = useAppStore.getState().questionQueue.find((x) => x.id === devForcedQuestionId);
    if (forced) setQuestion(forced);
    useAppStore.getState().clearDevForcedQuestion();
  }, [devForcedQuestionId]);

  function handleAnswer(q: Question, answer: Parameters<typeof answerQuestion>[1]) {
    setQuestion(null);
    const cp = answerQuestion(q.id, answer);
    if (cp) {
      showUndo({ message: `${cp.what}.`, undo: () => restoreCheckpoint(cp.id) }, 10000);
    }
  }

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
    const result = regenerateToday();
    if (!result.ok) return;
    const { previous } = result;
    setExpandedSlot("init");
    showUndo(
      {
        message: "Today's meals were replaced.",
        undo: () => restoreDay(previous.dateKey, previous.meals, previous.tracking),
      },
      10000,
    );
  }

  function showUndo(next: UndoState, ms = 5000) {
    if (undoTimer.current != null) window.clearTimeout(undoTimer.current);
    setUndo(next);
    undoTimer.current = window.setTimeout(() => setUndo(null), ms);
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
      message: fromCircle && entry.status === "all" ? "Marked eaten" : trackingLabel(entry),
      undo: () => setMealTracking(todayDateKey, slot, previous),
    });
  }

  function handleSnackLogged(entry: MealTrackingEntry) {
    addSnackLog(todayDateKey, entry);
    // Remaining meals are not re-sized; show what's left instead.
    const after = remainingToday(targets, {
      ...eaten,
      calories: eaten.calories + (entry.calories ?? 0),
      protein: eaten.protein + (entry.protein ?? 0),
    });
    showUndo({
      message: `Logged ${entry.note ?? "snack"} · ${after.calories.toLocaleString()} kcal and ${after.protein} g protein left today`,
      undo: () => removeSnackLog(todayDateKey, entry.loggedAt),
    });
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-32 pt-3 lg:max-w-5xl lg:pb-12">
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
            text="Tap the circle to mark a meal eaten. Open a row for details, or use ⋯ to adjust servings, skip, or log something else."
            onDismiss={() => dismissUsageNote("today")}
          />
        </div>
      )}

      {question && (
        <div className="section-gap">
          <QuestionCard question={question} onAnswer={(a) => handleAnswer(question, a)} />
        </div>
      )}

      {display.insightBanners && checkInRecent && (
        <div className="section-gap flex justify-center">
          <SmartAdjustmentBadge variant="success">
            Adjusted based on your recent check-in
          </SmartAdjustmentBadge>
        </div>
      )}

      {display.insightBanners && personalizationInsight && (
        <PersonalizationInsightBanner
          message={personalizationInsight.message}
          onDismiss={dismissPersonalizationInsight}
        />
      )}

      {confirmRegenerate && (
        <div className="section-gap rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-sm font-medium leading-relaxed text-slate-800">{REGENERATE_CONFIRM}</p>
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
              Regenerate
            </button>
          </div>
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
      <aside className="lg:sticky lg:top-4 lg:order-2">
        <div className="section-gap">
          <TodayProgressCard targets={targets} eaten={eaten} />
        </div>
        <div className="section-gap">
          <button
            type="button"
            onClick={() => setSnackOpen(true)}
            className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-[#2563EB] shadow-sm"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add snack
          </button>
        </div>
        <div className="section-gap flex justify-center">
          <FeedbackCheckInButton due={checkInDue} onOpen={() => setFeedbackOpen(true)} />
        </div>
      </aside>

      <div className="lg:order-1">
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
              <span className="font-semibold text-primary">⋯</span> and tap Regenerate today.
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

      {todaySnacks.length > 0 && (
        <section aria-label="Snacks logged today" className="section-gap">
          <h2 className="px-1 text-lg font-bold text-slate-900">Snacks</h2>
          <ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white">
            {todaySnacks.map((entry) => (
              <li key={entry.loggedAt} className="flex items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">{entry.note}</span>
                  <span className="block text-xs tabular-nums text-slate-500">
                    {entry.calories ?? 0} kcal · {entry.protein ?? 0}g protein
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => removeSnackLog(todayDateKey, entry.loggedAt)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-50"
                  aria-label={`Remove ${entry.note ?? "snack"}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      </div>
      </div>

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
      {snackOpen && (
        <AddSnackSheet
          dateKey={todayDateKey}
          remaining={remainingToday(targets, eaten)}
          onClose={() => setSnackOpen(false)}
          onLogged={handleSnackLogged}
        />
      )}
      {undo && (
        <UndoToast
          message={undo.message}
          onUndo={() => {
            undo.undo();
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
