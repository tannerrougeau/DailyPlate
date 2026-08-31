import { useEffect, useMemo, useState } from "react";
import { ChefHat, X } from "lucide-react";
import type { MealSlotId, Recipe } from "@/types";
import { useAppStore } from "@/store/useAppStore";
import { formatQty } from "@/utils/grocery";
import { fromDateKey } from "@/utils/date";
import { formatHouseholdServingSplit, householdMultiplierFor } from "@/utils/household";
import { useOverlayBack } from "@/hooks/useOverlayBack";
import { scaledIngredientsForMeal } from "@/utils/recipeDisplay";
import {
  MEAL_PREP_PORTION_PRESETS,
  defaultSlotForRecipe,
  formatMealPrepDayLabel,
  mealPrepDayPickerKeys,
  suggestMealPrepDateKeys,
} from "@/utils/mealPrep";
import { slotsForMealsPerDay } from "@/utils/generateDayPlan";

const slotOptions: { id: MealSlotId; label: string }[] = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
  { id: "snack", label: "Snack" },
];

export function MealPrepSheet({
  recipe,
  defaultSlot,
  defaultStartDateKey,
  onClose,
}: {
  recipe: Recipe;
  defaultSlot?: MealSlotId;
  defaultStartDateKey?: string;
  onClose: () => void;
}) {
  useOverlayBack(true, onClose);
  const userProfile = useAppStore((s) => s.userProfile);
  const lockedDays = useAppStore((s) => s.lockedDays);
  const assignMealPrepBatch = useAppStore((s) => s.assignMealPrepBatch);

  const [portions, setPortions] = useState<number>(4);
  const [customPortions, setCustomPortions] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [slot, setSlot] = useState<MealSlotId>(
    defaultSlot ?? defaultSlotForRecipe(recipe),
  );
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const portionsCooked = useCustom
    ? Math.min(20, Math.max(2, Math.round(Number(customPortions) || 2)))
    : portions;

  const startDate = defaultStartDateKey
    ? fromDateKey(defaultStartDateKey)
    : new Date();

  const pickerKeys = useMemo(
    () => mealPrepDayPickerKeys(startDate, portionsCooked, lockedDays),
    [startDate, portionsCooked, lockedDays],
  );

  useEffect(() => {
    setSelectedKeys(suggestMealPrepDateKeys(startDate, portionsCooked, lockedDays));
  }, [portionsCooked, lockedDays, defaultStartDateKey]);

  const householdMult = householdMultiplierFor(userProfile);
  const batchIngredients = scaledIngredientsForMeal(
    recipe,
    undefined,
    portionsCooked,
    householdMult,
    userProfile?.prioritizeMinProtein === true,
  );
  const profileSlots = userProfile
    ? slotsForMealsPerDay(userProfile.mealsPerDay)
    : slotOptions.map((s) => s.id);

  const slotChoices = slotOptions.filter(
    (s) => recipe.mealSlots.includes(s.id) && profileSlots.includes(s.id),
  );

  function toggleDay(key: string) {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key].sort(),
    );
  }

  function applySuggestions() {
    setSelectedKeys(suggestMealPrepDateKeys(startDate, portionsCooked, lockedDays));
  }

  const canSubmit =
    selectedKeys.length >= 1 && selectedKeys.length <= portionsCooked;

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close meal prep"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-labelledby="meal-prep-title"
        className="relative z-[96] flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl border border-slate-200 bg-[#f5f5f4] shadow-2xl sm:rounded-3xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-[#2563EB]" aria-hidden />
            <h2 id="meal-prep-title" className="text-lg font-bold text-slate-900">
              Meal prep
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5">
          <p className="mb-1 text-sm font-semibold text-slate-900">{recipe.name}</p>
          <p className="mb-5 text-xs text-slate-500">
            Cook once, eat across selected days. Grocery counts one batch (portions × adult and
            child servings).
          </p>

          <section className="mb-5 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Portions to cook</p>
            <div className="flex flex-wrap gap-2">
              {MEAL_PREP_PORTION_PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setUseCustom(false);
                    setPortions(n);
                    setSelectedKeys(suggestMealPrepDateKeys(startDate, n, lockedDays));
                  }}
                  className={`min-h-[44px] min-w-[52px] rounded-xl border-2 px-3 text-sm font-semibold ${
                    !useCustom && portions === n
                      ? "border-[#2563EB] bg-blue-50 text-blue-900"
                      : "border-slate-200 text-slate-700"
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setUseCustom(true)}
                className={`min-h-[44px] rounded-xl border-2 px-3 text-sm font-semibold ${
                  useCustom
                    ? "border-[#2563EB] bg-blue-50 text-blue-900"
                    : "border-slate-200 text-slate-700"
                }`}
              >
                Custom
              </button>
            </div>
            {useCustom && (
              <input
                type="number"
                min={2}
                max={20}
                value={customPortions}
                onChange={(e) => setCustomPortions(e.target.value)}
                placeholder="2–20"
                className="min-h-[48px] w-full rounded-2xl border-2 border-slate-200 px-4 text-lg font-semibold outline-none focus:border-[#2563EB]"
              />
            )}
          </section>

          <section className="mb-5 space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Meal slot</p>
            <div className="flex flex-wrap gap-2">
              {(slotChoices.length > 0 ? slotChoices : slotOptions).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSlot(s.id)}
                  className={`min-h-[40px] rounded-full border-2 px-4 text-sm font-semibold ${
                    slot === s.id
                      ? "border-[#2563EB] bg-blue-50 text-blue-900"
                      : "border-slate-200 text-slate-700"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </section>

          <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">Assign to days</p>
              <button
                type="button"
                onClick={applySuggestions}
                className="text-xs font-semibold text-[#2563EB] hover:underline"
              >
                Smart fill
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              Pick up to {portionsCooked} day(s) — we suggest consecutive open days.
            </p>
            <ul className="space-y-2">
              {pickerKeys.map((key) => (
                <li key={key}>
                  <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={selectedKeys.includes(key)}
                      onChange={() => toggleDay(key)}
                      className="h-5 w-5 rounded border-slate-300"
                    />
                    <span className="text-sm font-medium text-slate-800">
                      {formatMealPrepDayLabel(key)}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>

          <section className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4">
            <p className="text-sm font-semibold text-emerald-950">Batch ingredients</p>
            <p className="mt-1 text-xs text-emerald-900/80">
              {portionsCooked} portion-days · {formatHouseholdServingSplit(userProfile)} each
              {householdMult !== 1 ? ` (${householdMult.toFixed(2)}× recipe)` : ""}
            </p>
            <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs text-emerald-950">
              {batchIngredients.map((ing) => (
                <li key={`${ing.name}-${ing.unit}`}>
                  {formatQty(ing.quantity)} {ing.unit} {ing.name}
                </li>
              ))}
            </ul>
          </section>

          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              assignMealPrepBatch({
                recipe,
                slot,
                portionsCooked,
                dateKeys: selectedKeys.slice(0, portionsCooked),
              });
              onClose();
            }}
            className="min-h-[56px] w-full rounded-2xl bg-[#2563EB] py-3 text-base font-semibold text-white disabled:opacity-40"
          >
            Cook as meal prep ({selectedKeys.length} day
            {selectedKeys.length === 1 ? "" : "s"})
          </button>
        </div>
      </div>
    </div>
  );
}
