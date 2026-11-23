import type {
  CarbVariationId,
  FatVariationId,
  MealSlotId,
  PlannedMeal,
  Recipe,
  RecipeIngredient,
  RecipeVariationDetail,
} from "@/types";
import { estimateFiberFromIngredients } from "@/utils/fiberEstimate";
import { nutritionFromIngredients } from "@/utils/ingredientNutrition";
import {
  applyCarbSwapToIngredients,
  applyCarbSwapToInstructions,
  applyCarbSwapToMacros,
  CARB_VARIATION_OPTIONS,
  carbVariationLabel,
  recipeIngredientsIncludeRice,
  resolveCarbVariationId,
} from "@/recipes/riceAlternatives";
import {
  applyFatSwapToIngredients,
  applyFatSwapToInstructions,
  FAT_VARIATION_OPTIONS,
  recipeHasCookingFatSwap,
  resolveFatVariationId,
} from "@/recipes/fatAlternatives";
import { applyPracticalIngredientScaling } from "@/utils/practicalScaling";

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
  const mappedId =
    selectedVariationId === "premier-packaged" ? "rtd-packaged" : selectedVariationId;
  if (
    mappedId &&
    recipe.variationDetails?.some((v) => v.id === mappedId)
  ) {
    return mappedId;
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

export function effectiveFatVariationId(meal: PlannedMeal): FatVariationId {
  const variationId = effectiveVariationId(meal);
  if (!recipeSupportsFatSwap(meal.recipe, variationId)) return "olive-oil";
  return resolveFatVariationId(meal.selectedFatVariationId);
}

export function recipeSupportsCarbSwap(recipe: Recipe, variationId?: string): boolean {
  return recipeIngredientsIncludeRice(rawRecipeIngredients(recipe, variationId));
}

export function recipeSupportsFatSwap(recipe: Recipe, variationId?: string): boolean {
  return recipeHasCookingFatSwap(rawRecipeIngredients(recipe, variationId));
}

export function carbVariationLabels(
  recipe: Recipe,
  variationId?: string,
): { id: CarbVariationId; label: string }[] {
  if (!recipeSupportsCarbSwap(recipe, variationId)) return [];
  return CARB_VARIATION_OPTIONS;
}

export function fatVariationLabels(
  recipe: Recipe,
  variationId?: string,
): { id: FatVariationId; label: string }[] {
  if (!recipeSupportsFatSwap(recipe, variationId)) return [];
  return FAT_VARIATION_OPTIONS;
}

/** One serving of ingredients: the recipe's list (plus variation) ÷ recipe.servings. */
function rawRecipeIngredients(recipe: Recipe, variationId?: string): RecipeIngredient[] {
  const v = getVariationDetail(recipe, variationId);
  const baseList = v?.baseQuantities
    ? recipe.ingredients.map((ing) =>
        v.baseQuantities![ing.name] != null ? { ...ing, quantity: v.baseQuantities![ing.name]! } : ing,
      )
    : recipe.ingredients;
  const list = !v ? baseList : v.replaceBase ? v.ingredients : [...baseList, ...v.ingredients];
  const servings = recipe.servings != null && recipe.servings > 1 ? recipe.servings : 1;
  if (servings === 1) return list;
  return list.map((ing) => ({ ...ing, quantity: ing.quantity / servings }));
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
    selectedCarbVariationId: partial?.selectedCarbVariationId,
    selectedFatVariationId: partial?.selectedFatVariationId,
    beverageId: partial?.beverageId,
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

/** Fiber per recipe serving from USDA ingredient totals, then authored fiber, then the estimator. */
export function recipeFiberGrams(
  recipe: Recipe,
  variationId?: string,
  carbVariationId?: CarbVariationId,
  fatVariationId?: FatVariationId,
): number {
  const ingredients = resolveRecipeIngredients(recipe, variationId, carbVariationId, fatVariationId);
  const computed = nutritionFromIngredients(ingredients, 1);
  if (computed) return Math.max(0, computed.fiber);
  const v = getVariationDetail(recipe, variationId);
  if (typeof v?.fiber === "number" && Number.isFinite(v.fiber)) {
    return Math.max(0, v.fiber);
  }
  if (typeof recipe.fiber === "number" && Number.isFinite(recipe.fiber) && !v) {
    return Math.max(0, Math.round(recipe.fiber));
  }
  const fromIngredients = estimateFiberFromIngredients(ingredients);
  if (fromIngredients > 0) return fromIngredients;
  if (typeof recipe.fiber === "number" && Number.isFinite(recipe.fiber)) {
    return Math.max(0, Math.round(recipe.fiber));
  }
  return 0;
}

export function resolveRecipeMacros(
  recipe: Recipe,
  variationId?: string,
  carbVariationId?: CarbVariationId,
  fatVariationId?: FatVariationId,
): Pick<Recipe, "calories" | "protein" | "carbs" | "fat"> {
  const ingredients = resolveRecipeIngredients(recipe, variationId, carbVariationId, fatVariationId);
  const computed = nutritionFromIngredients(ingredients, 1);
  if (computed) {
    return {
      calories: computed.calories,
      protein: computed.protein,
      carbs: computed.carbs,
      fat: computed.fat,
    };
  }
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
  fatVariationId?: FatVariationId,
): RecipeIngredient[] {
  const raw = rawRecipeIngredients(recipe, variationId);
  const carb = resolveCarbVariationId(carbVariationId);
  const afterCarb = applyCarbSwapToIngredients(raw, carb);
  return applyFatSwapToIngredients(afterCarb, resolveFatVariationId(fatVariationId));
}

export function resolveRecipeInstructions(
  recipe: Recipe,
  variationId?: string,
  carbVariationId?: CarbVariationId,
  fatVariationId?: FatVariationId,
): string[] {
  const v = getVariationDetail(recipe, variationId);
  const base = v
    ? v.replaceBase
      ? v.instructions
      : [...recipe.instructions, ...v.instructions]
    : recipe.instructions;
  const raw = rawRecipeIngredients(recipe, variationId);
  const carb = resolveCarbVariationId(carbVariationId);
  const afterCarb = recipeIngredientsIncludeRice(raw)
    ? applyCarbSwapToInstructions(base, carb)
    : base;
  return applyFatSwapToInstructions(
    afterCarb,
    resolveFatVariationId(fatVariationId),
    raw,
  );
}

/** Base recipe × meal scale × household, rounded — for previews without a goal portion (e.g. meal prep). */
export function scaledIngredientsForMeal(
  recipe: Recipe,
  variationId: string | undefined,
  mealScale: number,
  householdMult: number,
  carbVariationId?: CarbVariationId,
  fatVariationId?: FatVariationId,
): RecipeIngredient[] {
  const effectiveId = resolveVariationId(recipe, variationId);
  const base = resolveRecipeIngredients(recipe, effectiveId, carbVariationId, fatVariationId);
  const total = mealScale * householdMult;
  return applyPracticalIngredientScaling(
    base.map((ing) => ({ ...ing, quantity: ing.quantity * total })),
  );
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

const PROTEIN_NAME_KEYWORDS = [
  "turkey",
  "chicken",
  "beef",
  "salmon",
  "tuna",
  "shrimp",
  "egg",
  "yogurt",
  "cottage",
  "oats",
  "rice",
  "pasta",
  "oil",
  "butter",
  "banana",
  "honey",
  "maple",
  "granola",
  "cheese",
  "beans",
  "broccoli",
  "protein",
];

const PROTEIN_NAME_STOP = new Set([
  "and",
  "with",
  "low",
  "fat",
  "plain",
  "cooked",
  "raw",
  "fresh",
  "sliced",
  "diced",
  "chopped",
  "unsweetened",
  "lean",
  "ground",
  "white",
  "boneless",
]);

export function shortIngredientName(name: string): string {
  const first = name
    .split(/\s+or\s+/i)[0]!
    .replace(/\([^)]*\)/g, " ")
    .toLowerCase();
  for (const keyword of PROTEIN_NAME_KEYWORDS) {
    if (first.includes(keyword)) return keyword;
  }
  const words = first.split(/[^a-z]+/).filter((word) => word.length > 2 && !PROTEIN_NAME_STOP.has(word));
  return words[words.length - 1] ?? first.trim();
}

export function recipeIsMixedBatch(recipe: Recipe): boolean {
  if (recipe.cookStyle === "mixed") return true;
  if (recipe.cookStyle === "assembled") return false;
  const name = recipe.name.toLowerCase();
  if (
    /sandwich|taco|toast|platter|wrap|quesadilla|burrito|bagel/.test(name) &&
    !/skillet|soup|stew|chili|casserole/.test(name)
  ) {
    return false;
  }
  const steps = [
    ...recipe.instructions,
    ...(recipe.variationDetails ?? []).flatMap((v) => v.instructions),
  ]
    .join(" ")
    .toLowerCase();
  if (
    /close the sandwich|stack fried eggs|stack eggs|build the sandwich|serve open-faced|warm deli ham|toast the bread|layer bacon/.test(
      steps,
    )
  ) {
    return false;
  }
  return true;
}
