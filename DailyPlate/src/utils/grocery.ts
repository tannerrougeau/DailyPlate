import type { GroceryItem, PlannedMeal, RecipeIngredient } from "@/types";
import {
  formatPracticalQty,
  roundIngredientQuantity,
} from "@/utils/practicalScaling";
import { effectiveCarbVariationId, effectiveVariationId, scaledIngredientsForMeal } from "@/utils/recipeDisplay";

export function groceriesFromMeals(
  meals: PlannedMeal[],
  householdMultiplier = 1,
  prioritizeMinProtein = false,
): GroceryItem[] {
  const map = new Map<string, GroceryItem>();
  const countedBatches = new Set<string>();

  for (const meal of meals) {
    if (meal.mealPrep) {
      if (countedBatches.has(meal.mealPrep.batchId)) continue;
      countedBatches.add(meal.mealPrep.batchId);
    }

    const portionMult = meal.mealPrep?.portionsCooked ?? 1;
    const ingredients = scaledIngredientsForMeal(
      meal.recipe,
      effectiveVariationId(meal),
      meal.scale * portionMult,
      householdMultiplier,
      prioritizeMinProtein,
      effectiveCarbVariationId(meal),
    );

    for (const ing of ingredients) {
      const key = `${ing.category}::${ing.name.toLowerCase()}::${ing.unit}`;
      const quantity = ing.quantity;
      const existing = map.get(key);
      if (existing) {
        existing.quantity += quantity;
      } else {
        map.set(key, {
          key,
          name: ing.name,
          quantity,
          unit: ing.unit,
          category: ing.category,
        });
      }
    }
  }

  return [...map.values()]
    .map((item) => ({
      ...item,
      quantity: roundIngredientQuantity(
        {
          name: item.name,
          unit: item.unit,
          quantity: item.quantity,
          category: item.category,
        },
        item.quantity,
      ),
    }))
    .sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.name.localeCompare(b.name);
  });
}

export function formatQty(v: number): string {
  return formatPracticalQty(v);
}

export function ingredientList(recipeIngredients: RecipeIngredient[], scale = 1): string[] {
  return recipeIngredients.map(
    (i) => `${formatQty(i.quantity * scale)} ${i.unit} ${i.name}`,
  );
}

