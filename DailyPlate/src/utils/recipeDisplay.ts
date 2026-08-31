import type {
  CarbVariationId,
  MealSlotId,
  PlannedMeal,
  Recipe,
  RecipeIngredient,
  RecipeVariationDetail,
} from "@/types";
import type { DailyTargets } from "@/types";
import type { UserProfile } from "@/types/profile";
import {
  formatHouseholdServingSplit,
  resolveHouseholdCounts,
} from "@/utils/household";
import {
  applyCarbSwapToIngredients,
  applyCarbSwapToInstructions,
  applyCarbSwapToMacros,
  CARB_VARIATION_OPTIONS,
  carbVariationLabel,
  recipeIngredientsIncludeRice,
  resolveCarbVariationId,
} from "@/recipes/riceAlternatives";
import { RECIPE_SCALE_MAX, RECIPE_SCALE_MIN } from "@/utils/macroRedistribution";
import { applyPracticalIngredientScaling } from "@/utils/practicalScaling";

const PROTEIN_INGREDIENT_HINT =
  /protein powder|whey|casein|egg white|cottage cheese|greek yogurt|skyr|collagen/i;
const CARB_FAT_ADJUST_HINT =
  /oats|honey|maple|banana|granola|peanut butter|almond butter|oil|butter|sugar|chocolate chips/i;

/** First variation in variationDetails — the default/base build. */
export function defaultVariationId(recipe: Recipe): string | undefined {
  return recipe.variationDetails?.[0]?.id;
}

/**
 * Effective variation for a recipe: explicit selection, else base variation when
 * the recipe has variations, else undefined.
 */
export function resolveVariationId(
  recipe: Recipe,
  selectedVariationId?: string,
): string | undefined {
  const baseId = defaultVariationId(recipe);
  if (!baseId) return selectedVariationId;
  if (
    selectedVariationId &&
    recipe.variationDetails?.some((v) => v.id === selectedVariationId)
  ) {
    return selectedVariationId;
  }
  return baseId;
}

export function effectiveVariationId(meal: PlannedMeal): string | undefined {
  return resolveVariationId(meal.recipe, meal.selectedVariationId);
}

export function effectiveCarbVariationId(meal: PlannedMeal): CarbVariationId {
  const variationId = effectiveVariationId(meal);
  if (!recipeSupportsCarbSwap(meal.recipe, variationId)) return "white-rice";
  return resolveCarbVariationId(meal.selectedCarbVariationId);
}

export function recipeSupportsCarbSwap(recipe: Recipe, variationId?: string): boolean {
  return recipeIngredientsIncludeRice(rawRecipeIngredients(recipe, variationId));
}

export function carbVariationLabels(
  recipe: Recipe,
  variationId?: string,
): { id: CarbVariationId; label: string }[] {
  if (!recipeSupportsCarbSwap(recipe, variationId)) return [];
  return CARB_VARIATION_OPTIONS;
}

function rawRecipeIngredients(recipe: Recipe, variationId?: string): RecipeIngredient[] {
  const v = getVariationDetail(recipe, variationId);
  if (v) return [...recipe.ingredients, ...v.ingredients];
  return recipe.ingredients;
}

export function createPlannedMeal(
  slot: MealSlotId,
  recipe: Recipe,
  partial?: Partial<Omit<PlannedMeal, "slot" | "recipe">>,
): PlannedMeal {
  return {
    slot,
    recipe,
    scale: partial?.scale ?? 1,
    mealPrep: partial?.mealPrep,
    selectedVariationId: partial?.selectedVariationId ?? defaultVariationId(recipe),
  };
}

export function getVariationDetail(
  recipe: Recipe,
  variationId?: string,
): RecipeVariationDetail | null {
  const id = resolveVariationId(recipe, variationId);
  if (!id || !recipe.variationDetails?.length) return null;
  return recipe.variationDetails.find((v) => v.id === id) ?? null;
}

export function variationLabels(recipe: Recipe): { id: string; label: string }[] {
  if (recipe.variationDetails?.length) {
    return recipe.variationDetails.map((v) => ({ id: v.id, label: v.label }));
  }
  return (recipe.variations ?? []).map((label) => ({
    id: label.toLowerCase().replace(/\s+/g, "-"),
    label,
  }));
}

/** Fiber per recipe serving. Uses authored grams when present; otherwise a light estimate from carbs so Fiber is never hidden. */
export function recipeFiberGrams(
  recipe: Recipe,
  variationId?: string,
  carbVariationId?: CarbVariationId,
): number {
  if (typeof recipe.fiber === "number" && Number.isFinite(recipe.fiber)) {
    return Math.max(0, Math.round(recipe.fiber));
  }
  const macros = resolveRecipeMacros(recipe, variationId, carbVariationId);
  const estimated = Math.round(macros.carbs * 0.12);
  return macros.carbs >= 6 ? Math.max(1, estimated) : estimated;
}

export function resolveRecipeMacros(
  recipe: Recipe,
  variationId?: string,
  carbVariationId?: CarbVariationId,
): Pick<Recipe, "calories" | "protein" | "carbs" | "fat"> {
  const v = getVariationDetail(recipe, variationId);
  const base = {
    calories: v?.calories ?? recipe.calories,
    protein: v?.protein ?? recipe.protein,
    carbs: v?.carbs ?? recipe.carbs,
    fat: v?.fat ?? recipe.fat,
  };
  const raw = rawRecipeIngredients(recipe, variationId);
  const carb = resolveCarbVariationId(carbVariationId);
  return applyCarbSwapToMacros(base, raw, carb);
}

export function resolveRecipeIngredients(
  recipe: Recipe,
  variationId?: string,
  carbVariationId?: CarbVariationId,
): RecipeIngredient[] {
  const raw = rawRecipeIngredients(recipe, variationId);
  const carb = resolveCarbVariationId(carbVariationId);
  return applyCarbSwapToIngredients(raw, carb);
}

export function resolveRecipeInstructions(
  recipe: Recipe,
  variationId?: string,
  carbVariationId?: CarbVariationId,
): string[] {
  const v = getVariationDetail(recipe, variationId);
  const base = v ? [...recipe.instructions, ...v.instructions] : recipe.instructions;
  const carb = resolveCarbVariationId(carbVariationId);
  if (!recipeIngredientsIncludeRice(rawRecipeIngredients(recipe, variationId))) {
    return base;
  }
  return applyCarbSwapToInstructions(base, carb);
}

/** Per-ingredient multiplier when boosting protein without over-scaling carbs/fats. */
export function proteinAwareIngredientMultiplier(
  ing: RecipeIngredient,
  totalMult: number,
  prioritizeProtein: boolean,
): number {
  if (!prioritizeProtein || totalMult <= 1.05) return totalMult;
  if (PROTEIN_INGREDIENT_HINT.test(ing.name)) {
    return Math.min(totalMult * 1.08, RECIPE_SCALE_MAX);
  }
  if (CARB_FAT_ADJUST_HINT.test(ing.name)) {
    return Math.max(totalMult * 0.94, RECIPE_SCALE_MIN);
  }
  return totalMult;
}

export function scaledIngredientsForMeal(
  recipe: Recipe,
  variationId: string | undefined,
  mealScale: number,
  householdMult: number,
  prioritizeProtein: boolean,
  carbVariationId?: CarbVariationId,
): RecipeIngredient[] {
  const effectiveId = resolveVariationId(recipe, variationId);
  const base = resolveRecipeIngredients(recipe, effectiveId, carbVariationId);
  const total = mealScale * householdMult;
  const scaled = base.map((ing) => ({
    ...ing,
    quantity: ing.quantity * proteinAwareIngredientMultiplier(ing, total, prioritizeProtein),
  }));
  return applyPracticalIngredientScaling(scaled);
}

export function estimateServingWeightGrams(
  protein: number,
  carbs: number,
  fat: number,
  explicit?: number,
  scale = 1,
): number {
  if (explicit != null) return Math.round(explicit * scale);
  const kcal = (protein * 4 + carbs * 4 + fat * 9) * scale;
  return Math.round(kcal / 1.05);
}

export function servingWeightForMeal(
  meal: PlannedMeal,
  householdMult: number,
  targets?: DailyTargets | null,
): number | null {
  const { recipe, scale, mealPrep } = meal;
  const variationId = effectiveVariationId(meal);
  const carbId = effectiveCarbVariationId(meal);
  const macros = resolveRecipeMacros(recipe, variationId, carbId);
  const effectiveScale = scale * householdMult;
  const variation = getVariationDetail(recipe, variationId);

  let base =
    variation?.servingWeightGrams ??
    recipe.servingWeightGrams ??
    estimateServingWeightGrams(
      macros.protein,
      macros.carbs,
      macros.fat,
      undefined,
      1,
    );

  if (recipe.id === "blended-cottage-cheese-pudding-49" && targets) {
    const slotTargetProtein = targets.protein / 4;
    const atScale = macros.protein * scale;
    if (atScale < slotTargetProtein * 0.9) {
      const bump = Math.min(RECIPE_SCALE_MAX, slotTargetProtein / Math.max(atScale, 1));
      base = Math.round(base * Math.min(bump, 1.15));
    }
  }

  const grams = Math.round(base * effectiveScale);

  if (mealPrep && recipe.batchWeightGrams && recipe.mealPrepBatchServings) {
    return grams;
  }
  return grams;
}

export function batchWeightLabel(
  meal: PlannedMeal,
  householdMult: number,
): string | null {
  const { recipe, scale, mealPrep } = meal;
  if (!mealPrep || !recipe.batchWeightGrams || !recipe.mealPrepBatchServings) {
    return null;
  }
  const portions = mealPrep.portionsCooked;
  const perServing = recipe.servingWeightGrams ?? recipe.batchWeightGrams / recipe.mealPrepBatchServings;
  const batch = Math.round(perServing * portions * scale * householdMult);
  const serving = Math.round(perServing * scale * householdMult);
  return `Jar meal prep: ~${serving} g per serving · ~${batch} g total batch (${portions} jars)`;
}

export function clampMealScaleForRecipe(scale: number): number {
  return Math.min(RECIPE_SCALE_MAX, Math.max(RECIPE_SCALE_MIN, scale));
}

export function mealDisplayName(meal: PlannedMeal): string {
  const baseId = defaultVariationId(meal.recipe);
  const variationId = effectiveVariationId(meal);
  const carbId = effectiveCarbVariationId(meal);
  const parts: string[] = [meal.recipe.name];

  if (baseId && variationId && variationId !== baseId) {
    const v = getVariationDetail(meal.recipe, variationId);
    if (v) parts.push(v.label);
  }

  if (carbId !== "white-rice" && recipeSupportsCarbSwap(meal.recipe, variationId)) {
    parts.push(carbVariationLabel(carbId));
  }

  return parts.length === 1 ? parts[0]! : parts.join(" — ");
}

export function shouldShowProteinAdjustNote(
  profile: UserProfile | null,
  meal: PlannedMeal,
): boolean {
  if (!profile?.prioritizeMinProtein) return false;
  return clampMealScaleForRecipe(meal.scale) > 1.05;
}

export function platingNoteForHousehold(profile: UserProfile | null | undefined): string | null {
  const { children } = resolveHouseholdCounts(profile);
  if (children <= 0) return null;
  return `Cook the full batch, then plate larger adult portions and smaller child portions (${formatHouseholdServingSplit(profile)}).`;
}

export function perPersonIngredientQty(
  baseQuantity: number,
  mealScale: number,
  personMult: number,
  ing: RecipeIngredient,
  prioritizeProtein: boolean,
): number {
  return (
    baseQuantity * proteinAwareIngredientMultiplier(ing, mealScale * personMult, prioritizeProtein)
  );
}
