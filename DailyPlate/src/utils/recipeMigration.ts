import type { PlannedMeal, Recipe } from "@/types";
import { recipeLibrary } from "@/recipes/recipeLibrary";
import { resolveVariationId } from "@/utils/recipeDisplay";

function lookupRecipe(recipeId: string, userRecipes?: Recipe[] | null): Recipe | undefined {
  return userRecipes?.find((r) => r.id === recipeId) ?? recipeLibrary.find((r) => r.id === recipeId);
}

export interface RecipeMigrationTarget {
  recipeId: string;
  variationId: string;
}

/** Old standalone recipes folded into a surviving recipe + variation. */
export const RECIPE_MIGRATIONS: Record<string, RecipeMigrationTarget> = {
  "snack-cottage-pineapple": {
    recipeId: "snack-pkg-cottage-cup",
    variationId: "with-pineapple",
  },
  "snack-yogurt-berry-parfait": {
    recipeId: "greek-yogurt-parfait-51",
    variationId: "berry-parfait-lighter",
  },
  "snack-pkg-greek-yogurt-cup": {
    recipeId: "greek-yogurt-parfait-51",
    variationId: "plain-cup",
  },
  "greek-yogurt-berry-protein-bowl-with-oats-05": {
    recipeId: "greek-yogurt-parfait-51",
    variationId: "protein-bowl-berries",
  },
  "snack-pkg-skyr-cup": {
    recipeId: "greek-yogurt-parfait-51",
    variationId: "plain-cup",
  },
  "snack-pkg-rtd-protein-shake": {
    recipeId: "high-protein-smoothie-55",
    variationId: "rtd-packaged",
  },
  "snack-pkg-premier-shake": {
    recipeId: "high-protein-smoothie-55",
    variationId: "rtd-packaged",
  },
  "snack-pkg-protein-bar": {
    recipeId: "protein-bar",
    variationId: "typical-packaged",
  },
  "snack-pkg-rxbar": {
    recipeId: "protein-bar",
    variationId: "whole-food-packaged",
  },
};

export function resolveRecipeMigration(recipeId: string): RecipeMigrationTarget | undefined {
  return RECIPE_MIGRATIONS[recipeId];
}

export function migrateRecipeIdList(ids: string[]): string[] {
  const next: string[] = [];
  for (const id of ids) {
    const mapped = RECIPE_MIGRATIONS[id]?.recipeId ?? id;
    if (!next.includes(mapped)) next.push(mapped);
  }
  return next;
}

export function migratePlannedMeal(
  meal: PlannedMeal,
  userRecipes?: Recipe[] | null,
): PlannedMeal {
  const mapping = RECIPE_MIGRATIONS[meal.recipe.id];
  const recipeId = mapping?.recipeId ?? meal.recipe.id;
  const libraryRecipe = lookupRecipe(recipeId, userRecipes);
  const recipe = libraryRecipe ?? meal.recipe;
  const requestedVariation =
    mapping?.variationId ??
    (meal.selectedVariationId === "premier-packaged" ? "rtd-packaged" : meal.selectedVariationId);
  const selectedVariationId = resolveVariationId(recipe, requestedVariation);
  return { ...meal, recipe, selectedVariationId };
}

export function migratePlannedMeals(
  meals: PlannedMeal[],
  userRecipes?: Recipe[] | null,
): PlannedMeal[] {
  return meals.map((meal) => migratePlannedMeal(meal, userRecipes));
}
