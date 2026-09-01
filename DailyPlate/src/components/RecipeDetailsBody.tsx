import { formatQty } from "@/utils/grocery";
import {
  formatHouseholdServingSplit,
  resolveHouseholdCounts,
  type HouseholdDayCounts,
} from "@/utils/household";
import {
  assembledServingGuidance,
  carbVariationLabels,
  fatVariationLabels,
  formatPersonServingWeights,
  getVariationDetail,
  mixedPersonServingWeights,
  platingNoteForHousehold,
  recipeFiberGrams,
  recipeIsMixedBatch,
  resolveRecipeInstructions,
  resolveRecipeMacros,
  scaledIngredientsForMeal,
  shouldShowProteinAdjustNote,
  variationLabels,
} from "@/utils/recipeDisplay";
import { NutritionDetails } from "@/components/NutritionDetails";
import { MicronutrientDetails } from "@/components/MicronutrientDetails";
import { notableMicronutrients } from "@/utils/micronutrients";
import type { CarbVariationId, FatVariationId, PlannedMeal, Recipe } from "@/types";
import type { DailyTargets } from "@/types";
import type { UserProfile } from "@/types/profile";

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
  const labels = variationLabels(recipe);
  const selectedId = variationId ?? labels[0]?.id;
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
    userProfile?.prioritizeMinProtein === true,
    selectedCarbId,
    selectedFatId,
  );
  const instructions = resolveRecipeInstructions(
    recipe,
    selectedId,
    selectedCarbId,
    selectedFatId,
  );
  const mixedBatch = recipeIsMixedBatch(recipe);
  const { children: childCount } = resolveHouseholdCounts(userProfile, countsOverride);
  const platingNote = mixedBatch ? platingNoteForHousehold(userProfile, countsOverride) : null;
  const servingGuide = assembledServingGuidance(recipe, {
    variationId: selectedId,
    carbVariationId: selectedCarbId,
    fatVariationId: selectedFatId,
    mealScale,
    profile: userProfile,
    countsOverride,
  });
  const fiber = Math.round(recipeFiberGrams(recipe, selectedId, selectedCarbId) * mealScale);
  const personWeights = mixedBatch
    ? mixedPersonServingWeights(recipe, {
        meal,
        variationId: selectedId,
        carbVariationId: selectedCarbId,
        mealScale,
        profile: userProfile,
        countsOverride,
        targets,
      })
    : null;
  const weightLine = formatPersonServingWeights(personWeights);
  const proteinNote =
    meal && shouldShowProteinAdjustNote(userProfile ?? null, meal);
  const micros = notableMicronutrients(recipe, selectedId, mealScale);

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

      {weightLine && (
        <p className="mt-3 whitespace-pre-line text-sm text-slate-600">{weightLine}</p>
      )}

      {servingGuide && (
        <p className="mt-3 text-sm leading-relaxed text-slate-700">{servingGuide}</p>
      )}

      <p className="mt-3 text-sm font-medium text-slate-800">
        {formatHouseholdServingSplit(userProfile, countsOverride)}
      </p>

      {proteinNote && (
        <p className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold leading-snug text-blue-950">
          Protein-forward: protein scaled up a little; oats and fats trimmed.
        </p>
      )}

      <NutritionDetails
        calories={Math.round(macros.calories * mealScale)}
        protein={Math.round(macros.protein * mealScale)}
        carbs={Math.round(macros.carbs * mealScale)}
        fat={Math.round(macros.fat * mealScale)}
        fiber={fiber}
      />
      <MicronutrientDetails items={micros} />

      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
        {ingredients.map((ing) => (
          <li key={`${ing.name}-${ing.unit}`}>
            {formatQty(ing.quantity)} {ing.unit} {ing.name}
          </li>
        ))}
      </ul>

      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
        {platingNote && childCount > 0 && <li>{platingNote}</li>}
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
