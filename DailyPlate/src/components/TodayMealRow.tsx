import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ChefHat, Heart, MoreHorizontal, ThumbsDown, X } from "lucide-react";
import { LogSomethingElseSheet } from "@/components/LogSomethingElseSheet";
import { RecipeDetailsBody } from "@/components/RecipeDetailsBody";
import { RecipeImage } from "@/components/RecipeImage";
import type {
  BeverageId,
  CarbVariationId,
  FatVariationId,
  MealTrackingEntry,
  PlannedMeal,
} from "@/types";
import {
  BEVERAGES,
  beverageOptionLabel,
  mealMacrosWithBeverage,
  plannedMealFoodScale,
  resolveBeverage,
} from "@/utils/beverages";
import {
  countsFromOverride,
  formatHouseholdServesLine,
  householdMultiplierFor,
} from "@/utils/household";
import { foodLogFromPlannedMeal, trackingLabel } from "@/utils/mealTracking";
import { variationIsMealPrep } from "@/utils/mealPrep";
import { SLOT_LABELS } from "@/utils/planningPrefs";
import {
  effectiveCarbVariationId,
  effectiveFatVariationId,
  effectiveVariationId,
  mealDisplayName,
} from "@/utils/recipeDisplay";
import { useAppStore } from "@/store/useAppStore";
import { useOverlayBack } from "@/hooks/useOverlayBack";

export function TodayMealRow({
  meal,
  dateKey,
  expanded,
  upNext,
  trackingEntry,
  onToggleExpand,
  onLog,
  onMealPrep,
}: {
  meal: PlannedMeal;
  dateKey: string;
  expanded: boolean;
  upNext: boolean;
  trackingEntry?: MealTrackingEntry;
  onToggleExpand: () => void;
  onLog: (entry: MealTrackingEntry | null) => void;
  onMealPrep?: (recipe: PlannedMeal["recipe"], variationId?: string) => void;
}) {
  const { recipe, slot } = meal;
  const [menuOpen, setMenuOpen] = useState(false);
  const [elseOpen, setElseOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [variationId, setVariationId] = useState(() => effectiveVariationId(meal));
  const [carbVariationId, setCarbVariationId] = useState<CarbVariationId>(() =>
    effectiveCarbVariationId(meal),
  );
  const [fatVariationId, setFatVariationId] = useState<FatVariationId>(() =>
    effectiveFatVariationId(meal),
  );

  useEffect(() => {
    setVariationId(effectiveVariationId(meal));
    setCarbVariationId(effectiveCarbVariationId(meal));
    setFatVariationId(effectiveFatVariationId(meal));
  }, [
    meal.selectedVariationId,
    meal.selectedCarbVariationId,
    meal.selectedFatVariationId,
    meal.recipe.id,
  ]);

  const favoriteIds = useAppStore((s) => s.favoriteIds);
  const dislikedIds = useAppStore((s) => s.dislikedIds);
  const userProfile = useAppStore((s) => s.userProfile);
  const targets = useAppStore((s) => s.targets);
  const todayDateKey = useAppStore((s) => s.todayDateKey);
  const todayHouseholdOverride = useAppStore((s) => s.todayHouseholdOverride);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const toggleDislike = useAppStore((s) => s.toggleDislike);
  const setMealVariation = useAppStore((s) => s.setMealVariation);
  const setMealCarbVariation = useAppStore((s) => s.setMealCarbVariation);
  const setMealFatVariation = useAppStore((s) => s.setMealFatVariation);
  const setMealBeverage = useAppStore((s) => s.setMealBeverage);

  const householdCounts =
    dateKey === todayDateKey
      ? countsFromOverride(todayHouseholdOverride, todayDateKey)
      : null;
  const householdMult = householdMultiplierFor(userProfile, householdCounts);
  const macros = mealMacrosWithBeverage(meal);
  const foodScale = plannedMealFoodScale(meal);
  const fav = favoriteIds.includes(recipe.id);
  const dislike = dislikedIds.includes(recipe.id);
  const kcal = Math.round(macros.calories);
  const protein = Math.round(macros.protein);
  const servingLine = formatHouseholdServesLine(userProfile, householdCounts);
  const skipped = trackingEntry?.status === "skipped";
  const checked = Boolean(trackingEntry) && !skipped;

  function handleCircle() {
    if (trackingEntry?.status === "all") {
      onLog(null);
      return;
    }
    onLog(foodLogFromPlannedMeal(dateKey, meal, 1));
  }

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-colors ${
        upNext && !trackingEntry
          ? "border-[#2563EB] ring-2 ring-[#2563EB]/15"
          : checked
            ? "border-emerald-200"
            : skipped
              ? "border-slate-200"
              : "border-slate-200/80"
      }`}
    >
      <div className="flex items-center gap-2.5 px-2.5 py-2">
        <button
          type="button"
          onClick={handleCircle}
          aria-label={checked ? "Undo eaten" : `Mark ${SLOT_LABELS[slot]} eaten`}
          aria-pressed={checked}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            checked
              ? "border-emerald-500 bg-emerald-500 text-white"
              : skipped
                ? "border-slate-300 bg-slate-100 text-slate-400"
                : "border-slate-300 bg-white text-transparent hover:border-[#2563EB]"
          }`}
        >
          <Check className="h-6 w-6" strokeWidth={2.5} />
        </button>

        <button
          type="button"
          onClick={onToggleExpand}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100">
            <RecipeImage recipe={recipe} fill />
          </div>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {SLOT_LABELS[slot]}
              {upNext && !trackingEntry && (
                <span className="rounded-full bg-[#2563EB]/10 px-1.5 py-0.5 text-[10px] font-bold normal-case tracking-normal text-[#2563EB]">
                  Up next
                </span>
              )}
              {trackingEntry && trackingEntry.status !== "all" && (
                <span className="truncate text-[10px] font-semibold normal-case tracking-normal text-slate-500">
                  {trackingLabel(trackingEntry)}
                </span>
              )}
            </span>
            <span
              className={`mt-0.5 block truncate text-sm font-bold leading-snug ${
                skipped ? "text-slate-400 line-through" : "text-slate-900"
              }`}
            >
              {mealDisplayName(meal)}
            </span>
            <span className="mt-0.5 block text-xs tabular-nums text-slate-500">
              {kcal} kcal · {protein}g protein
            </span>
          </span>
        </button>

        <button
          type="button"
          aria-label="Log options"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-600"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 px-3 pb-3 pt-2">
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs tabular-nums text-slate-600">
            <span>
              Protein <span className="font-semibold text-slate-800">{protein}g</span>
            </span>
            <span>
              Carbs <span className="font-semibold text-slate-800">{Math.round(macros.carbs)}g</span>
            </span>
            <span>
              Fat <span className="font-semibold text-slate-800">{Math.round(macros.fat)}g</span>
            </span>
            <span>
              Fiber{" "}
              <span className="font-semibold text-slate-800">{Math.round(macros.fiber ?? 0)}g</span>
            </span>
          </div>
          {servingLine && (
            <p className="mt-1.5 text-[11px] leading-snug text-slate-500">{servingLine}</p>
          )}
          <label className="mt-2 flex min-w-0 items-center gap-1 text-[11px] text-slate-600">
            <span className="shrink-0 font-medium text-slate-500">Drink:</span>
            <select
              value={resolveBeverage(meal.beverageId).id}
              aria-label="Drink"
              onChange={(e) =>
                setMealBeverage(dateKey, slot, e.target.value as BeverageId)
              }
              className="min-w-0 flex-1 truncate rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-700"
            >
              {BEVERAGES.map((drink) => (
                <option key={drink.id} value={drink.id}>
                  {beverageOptionLabel(drink)}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-2 flex gap-1">
            <button
              type="button"
              onClick={() => toggleFavorite(recipe.id)}
              className={`flex min-h-[36px] flex-1 items-center justify-center gap-1 rounded-lg border text-xs font-semibold ${
                fav
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-slate-200 text-slate-600"
              }`}
            >
              <Heart className={`h-3.5 w-3.5 ${fav ? "fill-current" : ""}`} />
              Like
            </button>
            <button
              type="button"
              onClick={() => toggleDislike(recipe.id)}
              className={`flex min-h-[36px] flex-1 items-center justify-center gap-1 rounded-lg border text-xs font-semibold ${
                dislike
                  ? "border-slate-400 bg-slate-100 text-slate-800"
                  : "border-slate-200 text-slate-600"
              }`}
            >
              <ThumbsDown className={`h-3.5 w-3.5 ${dislike ? "fill-current" : ""}`} />
              Dislike
            </button>
          </div>
          {onMealPrep && variationIsMealPrep(recipe, variationId) && (
            <button
              type="button"
              onClick={() => onMealPrep(recipe, variationId)}
              className="mt-2 flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 text-xs font-semibold text-violet-800"
            >
              <ChefHat className="h-3.5 w-3.5" />
              Prep this meal
            </button>
          )}
          <button
            type="button"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((open) => !open)}
            className="mt-2 flex min-h-[40px] w-full items-center justify-between rounded-lg px-1 text-sm font-semibold text-primary"
          >
            <span>Recipe/Prep details</span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 transition-transform ${detailsOpen ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
          {detailsOpen && (
            <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
              <p className="text-xs leading-relaxed text-slate-500">
                Prep {recipe.prepMinutes} min · Cook {recipe.cookMinutes} min
              </p>
              <RecipeDetailsBody
                recipe={recipe}
                variationId={variationId}
                onVariationChange={(id) => {
                  setVariationId(id);
                  setMealVariation(dateKey, slot, id);
                }}
                carbVariationId={carbVariationId}
                onCarbVariationChange={(id) => {
                  setCarbVariationId(id);
                  setMealCarbVariation(dateKey, slot, id);
                }}
                fatVariationId={fatVariationId}
                onFatVariationChange={(id) => {
                  setFatVariationId(id);
                  setMealFatVariation(dateKey, slot, id);
                }}
                mealScale={foodScale}
                householdMult={householdMult}
                userProfile={userProfile}
                countsOverride={householdCounts}
                targets={targets}
                meal={{
                  ...meal,
                  selectedVariationId: variationId,
                  selectedCarbVariationId: carbVariationId,
                  selectedFatVariationId: fatVariationId,
                }}
              />
            </div>
          )}
        </div>
      )}

      {menuOpen &&
        createPortal(
          <TodayLogMenu
            mealName={mealDisplayName(meal)}
            onClose={() => setMenuOpen(false)}
            onSkip={() => onLog(foodLogFromPlannedMeal(dateKey, meal, 0))}
            onHalf={() => onLog(foodLogFromPlannedMeal(dateKey, meal, 0.5))}
            onExtra={() => onLog(foodLogFromPlannedMeal(dateKey, meal, 1.5))}
            onSomethingElse={() => setElseOpen(true)}
          />,
          document.body,
        )}

      {elseOpen && (
        <LogSomethingElseSheet
          dateKey={dateKey}
          meal={meal}
          onClose={() => setElseOpen(false)}
          onSave={onLog}
        />
      )}
    </article>
  );
}

function TodayLogMenu({
  mealName,
  onClose,
  onSkip,
  onHalf,
  onExtra,
  onSomethingElse,
}: {
  mealName: string;
  onClose: () => void;
  onSkip: () => void;
  onHalf: () => void;
  onExtra: () => void;
  onSomethingElse: () => void;
}) {
  useOverlayBack(true, onClose);
  function run(action: () => void) {
    action();
    onClose();
  }
  return (
    <div className="fixed inset-0 z-[88] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close menu"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-labelledby="today-log-title"
        className="relative z-[89] w-full max-w-lg rounded-t-3xl border border-slate-200 bg-white p-2 shadow-2xl sm:rounded-3xl sm:p-3"
      >
        <div className="flex items-start justify-between gap-3 px-3 pb-2 pt-2">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Log meal
            </p>
            <h2 id="today-log-title" className="mt-0.5 truncate text-base font-bold text-slate-900">
              {mealName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-1">
          <LogAction label="Skipped" hint="Don't count this meal" onClick={() => run(onSkip)} />
          <LogAction label="Ate half" hint="Log 50% of calories and protein" onClick={() => run(onHalf)} />
          <LogAction label="Ate 1.5×" hint="Log 150% of calories and protein" onClick={() => run(onExtra)} />
          <LogAction
            label="Ate something else"
            hint="Pick another recipe or enter kcal and protein"
            onClick={() => run(onSomethingElse)}
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full rounded-2xl py-3 text-center text-sm font-semibold text-slate-500 hover:bg-slate-50"
        >
          Cancel
        </button>
      </section>
    </div>
  );
}

function LogAction({
  label,
  hint,
  onClick,
}: {
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[52px] w-full flex-col items-start justify-center rounded-2xl px-3 py-2 text-left hover:bg-slate-50"
    >
      <span className="text-sm font-semibold text-slate-900">{label}</span>
      <span className="text-xs text-slate-400">{hint}</span>
    </button>
  );
}

export function UndoToast({
  message,
  onUndo,
  onDismiss,
}: {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-24 z-[80] mx-auto flex max-w-lg items-center gap-3 px-4"
    >
      <div className="flex w-full items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-xl">
        <p className="flex-1 text-sm font-medium">{message}</p>
        <button
          type="button"
          onClick={onUndo}
          className="text-sm font-bold text-emerald-300"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:text-white"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
