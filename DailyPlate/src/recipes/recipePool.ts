import { recipeLibrary } from "@/recipes/recipeLibrary";
import type { Recipe } from "@/types";
import { RECIPE_MIGRATIONS } from "@/utils/recipeMigration";

export function allRecipes(userRecipes: Recipe[] | null | undefined): Recipe[] {
  if (!userRecipes?.length) return recipeLibrary;
  return [...recipeLibrary, ...userRecipes];
}

export function findRecipe(
  recipeId: string,
  userRecipes: Recipe[] | null | undefined,
): Recipe | undefined {
  const targetId = RECIPE_MIGRATIONS[recipeId]?.recipeId ?? recipeId;
  return userRecipes?.find((r) => r.id === targetId) ?? recipeLibrary.find((r) => r.id === targetId);
}
