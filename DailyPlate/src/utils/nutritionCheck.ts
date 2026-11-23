import type { Recipe } from "@/types";
import { CARB_VARIATION_OPTIONS } from "@/recipes/riceAlternatives";
import { FAT_VARIATION_OPTIONS } from "@/recipes/fatAlternatives";
import { unmatchedIngredients } from "@/utils/ingredientNutrition";
import { hasLabelNutrition } from "@/utils/labelNutrition";
import {
  recipeSupportsCarbSwap,
  recipeSupportsFatSwap,
  resolveRecipeIngredients,
} from "@/utils/recipeDisplay";

export type UnmatchedBuild = { recipe: string; build: string; lines: string[] };



/**
 * Every built-in build (variation × carb swap × fat swap) whose ingredients don't all match
 * ingredients.json. Those would have no ingredient-based nutrition, so this must stay empty.
 */
export function unmatchedBuiltInBuilds(recipes: Recipe[]): UnmatchedBuild[] {
  const out: UnmatchedBuild[] = [];
  for (const recipe of recipes) {
    if (recipe.isUserRecipe) continue;
    const variations: (string | undefined)[] = recipe.variationDetails?.length
      ? recipe.variationDetails.map((v) => v.id)
      : [undefined];
    for (const v of variations) {
      if (hasLabelNutrition(recipe, v)) continue;
      const carbs = recipeSupportsCarbSwap(recipe, v) ? CARB_VARIATION_OPTIONS.map((c) => c.id) : [undefined];
      const fats = recipeSupportsFatSwap(recipe, v) ? FAT_VARIATION_OPTIONS.map((f) => f.id) : [undefined];
      for (const c of carbs) {
        for (const f of fats) {
          const lines = unmatchedIngredients(resolveRecipeIngredients(recipe, v, c, f));
          if (lines.length > 0) out.push({ recipe: recipe.name, build: [v, c, f].filter(Boolean).join(" / ") || "base", lines });
        }
      }
    }
  }
  return out;
}
