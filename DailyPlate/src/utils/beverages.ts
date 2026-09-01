import type { Recipe } from "@/types";

export function isBeverageRecipe(recipe: Pick<Recipe, "id" | "tags">): boolean {
  return recipe.tags.includes("beverage") || recipe.id.startsWith("bev-");
}
