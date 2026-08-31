import { formatQty } from "@/utils/grocery";
import {
  adultPortionMultiplier,
  childPortionMultiplier,
  formatHouseholdServingSplit,
  resolveHouseholdCounts,
} from "@/utils/household";
import {
  batchWeightLabel,
  carbVariationLabels,
  estimateServingWeightGrams,
  getVariationDetail,
  perPersonIngredientQty,
  platingNoteForHousehold,
  recipeFiberGrams,
  resolveRecipeInstructions,
  resolveRecipeMacros,
  resolveRecipeIngredients,
  scaledIngredientsForMeal,
  servingWeightForMeal,
  shouldShowProteinAdjustNote,
  variationLabels,
} from "@/utils/recipeDisplay";
import { MealMacroLine } from "@/components/MealMacroLine";
import type { CarbVariationId, PlannedMeal, Recipe } from "@/types";
import type { DailyTargets } from "@/types";
import type { UserProfile } from "@/types/profile";

export function RecipeDetailsBody({
  recipe,
  variationId,
  onVariationChange,
  carbVariationId,
  onCarbVariationChange,
  mealScale = 1,
  householdMult = 1,
  userProfile,
  targets,
  meal,
  showSaveVariation,
  onSaveVariation,
}: {
  recipe: Recipe;
  variationId?: string;
  onVariationChange?: (id: string) => void;
  carbVariationId?: CarbVariationId;
  onCarbVariationChange?: (id: CarbVariationId) => void;
  mealScale?: number;
  householdMult?: number;
  userProfile?: UserProfile | null;
  targets?: DailyTargets | null;
  meal?: PlannedMeal;
  showSaveVariation?: boolean;
  onSaveVariation?: () => void;
}) {
  const labels = variationLabels(recipe);
  const selectedId = variationId ?? labels[0]?.id;
  const carbLabels = carbVariationLabels(recipe, selectedId);
  const selectedCarbId = carbVariationId ?? "white-rice";
  const variation = getVariationDetail(recipe, selectedId);
  const macros = resolveRecipeMacros(recipe, selectedId, selectedCarbId);
  const ingredients = scaledIngredientsForMeal(
    recipe,
    selectedId,
    mealScale,
    householdMult,
    userProfile?.prioritizeMinProtein === true,
    selectedCarbId,
  );
  const instructions = resolveRecipeInstructions(recipe, selectedId, selectedCarbId);
  const baseIngredients = resolveRecipeIngredients(recipe, selectedId, selectedCarbId);
  const prioritizeProtein = userProfile?.prioritizeMinProtein === true;
  const { children: childCount } = resolveHouseholdCounts(userProfile);
  const adultMult = adultPortionMultiplier(userProfile);
  const childMult = childPortionMultiplier(userProfile);
  const platingNote = platingNoteForHousehold(userProfile);
  const fiber = Math.round(recipeFiberGrams(recipe, selectedId, selectedCarbId) * mealScale);
  const weightGrams = meal
    ? servingWeightForMeal(meal, householdMult, targets)
    : (() => {
        const explicit = variation?.servingWeightGrams ?? recipe.servingWeightGrams;
        const est = estimateServingWeightGrams(
          macros.protein,
          macros.carbs,
          macros.fat,
          explicit,
          mealScale * householdMult,
        );
        return est > 0 ? est : null;
      })();
  const batchLabel = meal ? batchWeightLabel(meal, householdMult) : null;
  const proteinNote =
    meal && shouldShowProteinAdjustNote(userProfile ?? null, meal);

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

      {weightGrams != null && weightGrams > 0 && (
        <p className="mt-3 text-sm text-slate-600">
          <span className="font-medium text-slate-800">Batch weight:</span> ~{weightGrams} g
          {batchLabel && (
            <span className="mt-1 block text-xs text-slate-500">{batchLabel}</span>
          )}
        </p>
      )}

      <p className="mt-3 text-sm font-medium text-slate-800">
        {formatHouseholdServingSplit(userProfile)}
      </p>

      {proteinNote && (
        <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-900">
          Protein-forward scaling: protein ingredients are bumped slightly; oats, fats, and
          sweeteners are trimmed to keep texture balanced while meeting your protein target.
        </p>
      )}

      <div className="mt-3">
        <MealMacroLine
          kcal={Math.round(macros.calories * mealScale)}
          protein={Math.round(macros.protein * mealScale)}
          carbs={Math.round(macros.carbs * mealScale)}
          fat={Math.round(macros.fat * mealScale)}
          fiber={fiber}
        />
      </div>

      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
        {ingredients.map((ing) => {
          const base = baseIngredients.find(
            (b) => b.name === ing.name && b.unit === ing.unit,
          );
          const perAdult =
            base != null
              ? perPersonIngredientQty(base.quantity, mealScale, adultMult, ing, prioritizeProtein)
              : null;
          const perChild =
            base != null
              ? perPersonIngredientQty(base.quantity, mealScale, childMult, ing, prioritizeProtein)
              : null;
          return (
            <li key={`${ing.name}-${ing.unit}`}>
              <span>
                {formatQty(ing.quantity)} {ing.unit} {ing.name}
              </span>
              {childCount > 0 && perAdult != null && perChild != null && (
                <span className="mt-0.5 block text-xs text-slate-500">
                  {formatQty(perAdult)} / adult · {formatQty(perChild)} / child
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
        {platingNote && <li>{platingNote}</li>}
        {instructions.map((step, idx) => (
          <li key={idx}>{step}</li>
        ))}
      </ol>

      {recipe.mealPrepNotes && (
        <p className="mt-3 rounded-lg bg-violet-50 px-3 py-2 text-xs leading-relaxed text-violet-900">
          <span className="font-semibold">Meal prep:</span> {recipe.mealPrepNotes}
        </p>
      )}
    </>
  );
}
