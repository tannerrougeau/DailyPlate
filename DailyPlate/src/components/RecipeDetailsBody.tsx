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
} from "@/utils/recipeDisplay";
import { formatPortionLine, portionLineKey } from "@/utils/goalPortions";
import {
  batchServings,
  estimatedBatchCookedGrams,
  isPackagedRecipe,
  mealFoodNutrition,
  mealPortionLines,
  servingSummary,
} from "@/utils/mealPortions";
import { prepTips, stepsWithAmounts } from "@/utils/prepSteps";
import { sideLabel, sideLines } from "@/utils/mealSides";
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
  dateKey,
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
  /** Day of the meal; enables "Weigh your batch". */
  dateKey?: string;
  showSaveVariation?: boolean;
  onSaveVariation?: () => void;
}) {
  const storedProfile = useAppStore((s) => s.userProfile);
  const profile = userProfile ?? storedProfile;
  const setWeighedBatch = useAppStore((s) => s.setWeighedBatch);
  const removeMealSide = useAppStore((s) => s.removeMealSide);
  const [openTip, setOpenTip] = useState<string | null>(null);
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
  const previewMeal: PlannedMeal | null = meal
    ? {
        ...meal,
        selectedVariationId: selectedId,
        selectedCarbVariationId: selectedCarbId,
        selectedFatVariationId: selectedFatId,
      }
    : null;
  const servings = previewMeal ? batchServings(previewMeal, householdMult) : householdMult;
  const batchLines = previewMeal ? mealPortionLines(previewMeal, servings) : null;
  const yourLines = previewMeal && servings > 1.05 ? mealPortionLines(previewMeal, 1) : null;
  const previewIngredients = batchLines
    ? null
    : scaledIngredientsForMeal(recipe, selectedId, mealScale, householdMult, selectedCarbId, selectedFatId);
  const baseInstructions = resolveRecipeInstructions(
    recipe,
    selectedId,
    selectedCarbId,
    selectedFatId,
  );
  const instructions = batchLines ? stepsWithAmounts(baseInstructions, batchLines) : baseInstructions;
  const tips = batchLines ? prepTips(batchLines) : [];
  const serveLine = formatHouseholdServesLine(profile, countsOverride);
  const portioned = previewMeal ? mealFoodNutrition(previewMeal) : null;
  const foodScale =
    portioned && macros.calories > 0 ? portioned.calories / macros.calories : mealScale;
  const micros = notableMicronutrients(recipe, selectedId, foodScale);
  const drink = meal ? resolveBeverage(meal.beverageId) : null;
  const food = portioned
    ? {
        calories: Math.round(portioned.calories),
        protein: Math.round(portioned.protein),
        carbs: Math.round(portioned.carbs),
        fat: Math.round(portioned.fat),
        fiber: Math.round(portioned.fiber),
      }
    : {
        calories: Math.round(macros.calories * mealScale),
        protein: Math.round(macros.protein * mealScale),
        carbs: Math.round(macros.carbs * mealScale),
        fat: Math.round(macros.fat * mealScale),
        fiber: Math.round(recipeFiberGrams(recipe, selectedId, selectedCarbId, selectedFatId) * mealScale),
      };
  const drinkAdds =
    drink != null &&
    (drink.calories > 0 || drink.protein > 0 || drink.carbs > 0 || drink.fat > 0 || drink.fiber > 0);
  const serving = previewMeal ? servingSummary(previewMeal, householdMult) : null;
  const canWeigh =
    previewMeal != null && dateKey != null && serving?.grams != null && !isPackagedRecipe(recipe);
  const estimatedBatch =
    canWeigh && previewMeal
      ? Math.round(estimatedBatchCookedGrams(previewMeal, householdMult) / 10) * 10
      : null;
  const servingsLabel = formatServings(servings);
  const listHeading = batchLines
    ? servings > 1.05
      ? `Ingredients — batch for ${servingsLabel} servings${serveLine ? ` (${serveLine.replace(/^Serves\s+/i, "")})` : ""}`
      : "Ingredients — your serving"
    : "Ingredients";

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

      {serving && (
        <p className="mt-3 text-sm font-semibold text-slate-800">{serving.text}</p>
      )}
      {canWeigh && meal && dateKey && (
        <label className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span>Weigh your batch (cooked):</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={estimatedBatch ? `about ${estimatedBatch}` : "grams"}
            defaultValue={meal.weighedBatchGrams ?? ""}
            onBlur={(e) => {
              const v = e.currentTarget.value.trim();
              setWeighedBatch(dateKey, meal.slot, v === "" ? null : Number(v));
            }}
            className="w-24 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800"
          />
          <span>g</span>
        </label>
      )}

      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{listHeading}</p>
      <ul className="mt-1.5 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
        {batchLines
          ? batchLines.map((line) => <li key={portionLineKey(line)}>{formatPortionLine(line)}</li>)
          : (previewIngredients ?? []).map((ing) => (
              <li key={`${ing.name}-${ing.unit}`}>
                {formatQty(ing.quantity)} {ing.unit} {ing.name}
              </li>
            ))}
      </ul>

      {yourLines && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Your portion (1 of {servingsLabel} servings)
          </p>
          <ul className="mt-1 space-y-1 text-sm text-slate-700">
            {yourLines
              .filter((line) => line.role !== "flavor")
              .map((line) => (
                <li key={portionLineKey(line)}>{formatPortionLine(line)}</li>
              ))}
          </ul>
        </div>
      )}

      {meal?.sides?.length ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Side (your serving)
          </p>
          <ul className="mt-1 space-y-1 text-sm text-slate-700">
            {sideLines(meal.sides).map((line, i) => (
              <li key={`${portionLineKey(line)}-${i}`} className="flex items-center justify-between gap-2">
                <span>{formatPortionLine(line)}</span>
                {dateKey && (
                  <button
                    type="button"
                    onClick={() => removeMealSide(dateKey, meal.slot, i)}
                    aria-label={`Remove ${sideLabel(meal.sides![i]!)}`}
                    className="shrink-0 text-xs font-semibold text-slate-500"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
        {instructions.map((step, idx) => (
          <li key={idx}>{step}</li>
        ))}
      </ol>

      {tips.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {tips.map((tip) => (
            <li key={tip.id} className="rounded-lg border border-slate-200 bg-white text-sm">
              <button
                type="button"
                aria-expanded={openTip === tip.id}
                onClick={() => setOpenTip((cur) => (cur === tip.id ? null : tip.id))}
                className="flex w-full items-center justify-between px-3 py-2 text-left font-medium text-slate-800"
              >
                <span>{tip.title}</span>
                <span aria-hidden className="text-slate-400">{openTip === tip.id ? "−" : "+"}</span>
              </button>
              {openTip === tip.id && (
                <p className="px-3 pb-2 text-xs leading-relaxed text-slate-600">{tip.detail}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {recipe.mealPrepNotes && variationIsMealPrep(recipe, selectedId) && (
        <p className="mt-3 rounded-lg bg-violet-50 px-3 py-2 text-xs leading-relaxed text-violet-900">
          <span className="font-semibold">Meal prep:</span> {recipe.mealPrepNotes}
        </p>
      )}
    </>
  );
}

function formatServings(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
