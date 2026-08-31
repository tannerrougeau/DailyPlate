import { recipeLibrary } from "@/recipes/recipeLibrary";
import type { Recipe } from "@/types";

export function allRecipes(userRecipes: Recipe[] | null | undefined): Recipe[] {
  if (!userRecipes?.length) return recipeLibrary;
  return [...recipeLibrary, ...userRecipes];
}

export function findRecipe(
  recipeId: string,
  userRecipes: Recipe[] | null | undefined,
): Recipe | undefined {
  return userRecipes?.find((r) => r.id === recipeId) ?? recipeLibrary.find((r) => r.id === recipeId);
}
