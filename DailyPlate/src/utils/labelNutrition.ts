import type { Recipe } from "@/types";

/** Built-in items that keep label nutrition: packaged snacks and the ready-to-drink shake. */
export const LABEL_NUTRITION_VARIATIONS = new Set(["rtd-packaged"]);

export function hasLabelNutrition(recipe: Pick<Recipe, "tags">, variationId?: string): boolean {
  return recipe.tags.includes("packaged") || LABEL_NUTRITION_VARIATIONS.has(variationId ?? "");
}
