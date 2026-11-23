import { formatQty } from "@/utils/grocery";
import {
  formatHouseholdServesLine,
  type HouseholdDayCounts,
} from "@/utils/household";
import {
  carbVariationLabels,
  fatVariationLabels,
  getVariationDetail,
  recipeFiberGrams,
  resolveRecipeInstructions,
  resolveRecipeMacros,
  scaledIngredientsForMeal,
  describeProteinForwardAdjustments,
  formatIngredientListHeading,
} from "@/utils/recipeDisplay";
import { NutritionDetails } from "@/components/NutritionDetails";
import { MicronutrientDetails } from "@/components/MicronutrientDetails";
import { notableMicronutrients } from "@/utils/micronutrients";
import { variationIsMealPrep } from "@/utils/mealPrep";
import { profileAvoidLists, visibleVariationLabels } from "@/utils/variationPrefs";
import { useAppStore } from "@/store/useAppStore";
import { resolveBeverage } from "@/utils/beverages";
import type { CarbVariationId, FatVariationId, PlannedMeal, Recipe } from "@/types";
import type { DailyTargets } from "@/types";
import type { UserProfile } from "@/types/profile";
import { useState } from "react";

export function RecipeDetailsBody({
  recipe,
  variationId,
  onVariationChange,
  carbVariationId,
  onCarbVariationChange,
  fatVariationId,
  onFatVariationChange,
  mealScale = 1,
  householdMult = 1,
  userProfile,
  countsOverride,
  targets: _targets,
  meal,
  showSaveVariation,
  onSaveVariation,
}: {
  recipe: Recipe;
  variationId?: string;
  onVariationChange?: (id: string) => void;
  carbVariationId?: CarbVariationId;
  onCarbVariationChange?: (id: CarbVariationId) => void;
  fatVariationId?: FatVariationId;
  onFatVariationChange?: (id: FatVariationId) => void;
  mealScale?: number;
  householdMult?: number;
  userProfile?: UserProfile | null;
  countsOverride?: HouseholdDayCounts | null;
  targets?: DailyTargets | null;
  meal?: PlannedMeal;
  showSaveVariation?: boolean;
  onSaveVariation?: () => void;
}) {
  const storedProfile = useAppStore((s) => s.userProfile);
  const profile = userProfile ?? storedProfile;
  const [yourPortion, setYourPortion] = useState(false);
  const avoids = profileAvoidLists(profile);
  const labels = visibleVariationLabels(recipe, avoids.chips, avoids.custom);
  const selectedId =
    (variationId && labels.some((v) => v.id === variationId) ? variationId : labels[0]?.id) ??
    variationId;
  const carbLabels = carbVariationLabels(recipe, selectedId);
  const selectedCarbId = carbVariationId ?? "white-rice";
  const fatLabels = fatVariationLabels(recipe, selectedId);
  const selectedFatId = fatVariationId ?? "olive-oil";
  const variation = getVariationDetail(recipe, selectedId);
  const macros = resolveRecipeMacros(recipe, selectedId, selectedCarbId);
  const ingredients = scaledIngredientsForMeal(
    recipe,
    selectedId,
    mealScale,
    householdMult,
    profile?.prioritizeMinProtein === true,
    selectedCarbId,
    selectedFatId,
  );
  const instructions = resolveRecipeInstructions(
    recipe,
    selectedId,
    selectedCarbId,
    selectedFatId,
  );
  const fiber = Math.round(recipeFiberGrams(recipe, selectedId, selectedCarbId, selectedFatId) * mealScale);
  const serveLine = formatHouseholdServesLine(profile, countsOverride);
  const proteinNote = describeProteinForwardAdjustments(
    recipe,
    selectedId,
    mealScale,
    householdMult,
    profile?.prioritizeMinProtein === true,
    selectedCarbId,
    selectedFatId,
  );
  const micros = notableMicronutrients(recipe, selectedId, mealScale);
  const drink = meal ? resolveBeverage(meal.beverageId) : null;
  const food = {
    calories: Math.round(macros.calories * mealScale),
    protein: Math.round(macros.protein * mealScale),
    carbs: Math.round(macros.carbs * mealScale),
    fat: Math.round(macros.fat * mealScale),
    fiber,
  };
  const drinkAdds =
    drink != null &&
    (drink.calories > 0 || drink.protein > 0 || drink.carbs > 0 || drink.fat > 0 || drink.fiber > 0);
  const shownIngredients = yourPortion
    ? ingredients.map((ing) => ({
        ...ing,
        quantity: ing.quantity / Math.max(householdMult, 0.01),
      }))
    : ingredients;
  const canTogglePortion = householdMult > 1.05;

  return (
    <>
      {labels.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Variation
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {labels.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => onVariationChange?.(v.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedId === v.id
                    ? "border-[#2563EB] bg-blue-50 text-blue-900"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          {showSaveVariation && onSaveVariation && selectedId && (
            <button
              type="button"
              onClick={onSaveVariation}
              className="mt-2 text-sm font-semibold text-[#2563EB]"
            >
              Save {variation?.label ?? "this variation"} to meal
            </button>
          )}
        </div>
      )}

      {carbLabels.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Carb base
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {carbLabels.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onCarbVariationChange?.(c.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedCarbId === c.id
                    ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {fatLabels.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Cooking fat
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {fatLabels.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onFatVariationChange?.(f.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedFatId === f.id
                    ? "border-amber-600 bg-amber-50 text-amber-950"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {serveLine && (
        <p className="mt-3 text-sm font-medium text-slate-800">{serveLine}</p>
      )}

      {proteinNote && (
        <p className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold leading-snug text-blue-950">
          {proteinNote}
        </p>
      )}

      <NutritionDetails
        calories={food.calories + (drinkAdds && drink ? drink.calories : 0)}
        protein={food.protein + (drinkAdds && drink ? drink.protein : 0)}
        carbs={food.carbs + (drinkAdds && drink ? drink.carbs : 0)}
        fat={food.fat + (drinkAdds && drink ? drink.fat : 0)}
        fiber={food.fiber + (drinkAdds && drink ? drink.fiber : 0)}
        parts={
          drinkAdds && drink
            ? [
                { label: "Meal", ...food },
                {
                  label: drink.label,
                  calories: drink.calories,
                  protein: drink.protein,
                  carbs: drink.carbs,
                  fat: drink.fat,
                  fiber: drink.fiber,
                },
              ]
            : undefined
        }
      />
      <MicronutrientDetails items={micros} />

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {formatIngredientListHeading(householdMult, serveLine, yourPortion && canTogglePortion)}
        </p>
        {canTogglePortion && (
          <button
            type="button"
            onClick={() => setYourPortion((open) => !open)}
            className="shrink-0 text-xs font-semibold text-[#2563EB]"
          >
            {yourPortion ? "Show full recipe" : "Show your portion"}
          </button>
        )}
      </div>
      <ul className="mt-1.5 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
        {shownIngredients.map((ing) => (
          <li key={`${ing.name}-${ing.unit}`}>
            {formatQty(ing.quantity)} {ing.unit} {ing.name}
          </li>
        ))}
      </ul>

      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
        {instructions.map((step, idx) => (
          <li key={idx}>{step}</li>
        ))}
      </ol>

      {recipe.mealPrepNotes && variationIsMealPrep(recipe, selectedId) && (
        <p className="mt-3 rounded-lg bg-violet-50 px-3 py-2 text-xs leading-relaxed text-violet-900">
          <span className="font-semibold">Meal prep:</span> {recipe.mealPrepNotes}
        </p>
      )}
    </>
  );
}
