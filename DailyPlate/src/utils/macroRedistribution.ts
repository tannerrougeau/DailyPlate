import type { DailyTargets, MealSlotId, Recipe } from "@/types";
import { sizePortion } from "@/utils/goalPortions";
import { isBeverageRecipe } from "@/utils/beverages";
import { recipeFitsSlot } from "@/utils/planningPrefs";
import {
  defaultVariationId,
  recipeFiberGrams,
  resolveRecipeIngredients,
  resolveRecipeMacros,
} from "@/utils/recipeDisplay";

/** Mild scale limits for saving a user's own recipe (goal portions use ROLE_LIMITS instead). */
export const RECIPE_SCALE_MIN = 0.75;
export const RECIPE_SCALE_MAX = 1.25;

export function proteinDensity(recipe: Recipe): number {
  return recipe.calories > 0 ? recipe.protein / recipe.calories : 0;
}

export type RecipeFit = { fits: boolean; kcalGap: number };

const fitCache = new WeakMap<Recipe, Map<string, RecipeFit>>();

/** Whether the recipe's default build can be portioned to the target inside the role limits. */
export function recipeFitForTarget(recipe: Recipe, target: DailyTargets, variationId?: string): RecipeFit {
  const vid = variationId ?? defaultVariationId(recipe);
  const key = `${vid ?? ""}|${target.calories}|${target.protein}|${target.carbs}|${target.fat}`;
  let byRecipe = fitCache.get(recipe);
  if (!byRecipe) {
    byRecipe = new Map();
    fitCache.set(recipe, byRecipe);
  }
  const hit = byRecipe.get(key);
  if (hit) return hit;
  if (recipe.tags.includes("packaged")) {
    const result = { fits: true, kcalGap: 0 };
    byRecipe.set(key, result);
    return result;
  }
  const macros = resolveRecipeMacros(recipe, vid);
  const r = sizePortion(resolveRecipeIngredients(recipe, vid), target, {
    ...macros,
    fiber: recipeFiberGrams(recipe, vid),
  });
  const result = { fits: r.fits, kcalGap: r.kcalGap };
  byRecipe.set(key, result);
  return result;
}

/** Closest-fitting alternatives for a slot (Swap meal), best first. */
export function closestFitRecipes(
  recipes: Recipe[],
  slot: MealSlotId,
  target: DailyTargets,
  excludeIds: Set<string>,
  limit = 5,
): { recipe: Recipe; fit: RecipeFit }[] {
  return recipes
    .filter((r) => !excludeIds.has(r.id) && !isBeverageRecipe(r) && recipeFitsSlot(r, slot))
    .map((recipe) => ({ recipe, fit: recipeFitForTarget(recipe, target) }))
    .sort(
      (a, b) =>
        Number(b.fit.fits) - Number(a.fit.fits) || Math.abs(a.fit.kcalGap) - Math.abs(b.fit.kcalGap),
    )
    .slice(0, limit);
}
