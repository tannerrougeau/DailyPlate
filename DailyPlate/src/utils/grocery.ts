import type { GroceryItem, PlannedMeal, RecipeIngredient } from "@/types";
import {
  formatPracticalQty,
  roundIngredientQuantity,
} from "@/utils/practicalScaling";
import { effectiveCarbVariationId, effectiveFatVariationId, effectiveVariationId, scaledIngredientsForMeal } from "@/utils/recipeDisplay";

const TINY_SEASONING =
  /salt|pepper|paprika|cumin|oregano|chili|herb|zest|garlic powder|onion powder|pinch|seasoning|spice/i;

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
      effectiveFatVariationId(meal),
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

  return roundAndSortGrocery([...map.values()]);
}

export function mergeGroceryLists(lists: GroceryItem[][]): GroceryItem[] {
  const map = new Map<string, GroceryItem>();
  for (const list of lists) {
    for (const item of list) {
      const existing = map.get(item.key);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        map.set(item.key, { ...item });
      }
    }
  }
  return roundAndSortGrocery([...map.values()]);
}

function roundAndSortGrocery(items: GroceryItem[]): GroceryItem[] {
  return items
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
    .filter((item) => item.quantity > 0)
    .sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.name.localeCompare(b.name);
    });
}

function normalizeGroceryName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isTinyFragment(item: GroceryItem): boolean {
  const unit = item.unit.toLowerCase();
  if (item.category === "Spices") return true;
  if (unit === "pinch") return true;
  if ((unit === "tsp" || unit === "teaspoon" || unit === "teaspoons") && item.quantity < 3) {
    return TINY_SEASONING.test(item.name);
  }
  return false;
}

/**
 * Collapse spices/tiny fragments and merge duplicate names so the list is
 * item + approximate volume, not a checklist of pinches.
 */
export function simplifyGroceryList(items: GroceryItem[]): GroceryItem[] {
  const kept: GroceryItem[] = [];
  let foldedSpices = false;

  for (const item of items) {
    if (isTinyFragment(item)) {
      foldedSpices = true;
      continue;
    }
    const nameKey = normalizeGroceryName(item.name);
    const unitKey = item.unit.toLowerCase();
    const existing = kept.find(
      (row) => normalizeGroceryName(row.name) === nameKey && row.unit.toLowerCase() === unitKey,
    );
    if (existing) {
      existing.quantity += item.quantity;
      continue;
    }
    kept.push({
      ...item,
      name: item.name.replace(/\s+/g, " ").trim(),
    });
  }

  const rounded = roundAndSortGrocery(kept);
  if (foldedSpices) {
    rounded.push({
      key: "Spices::spices & seasonings::to taste",
      name: "Spices & seasonings",
      quantity: 1,
      unit: "to taste",
      category: "Spices",
    });
  }
  return rounded;
}

export function formatQty(v: number): string {
  return formatPracticalQty(v);
}

/** Grocery line volume, e.g. "~1.5 lb" or "to taste". */
export function groceryVolumeLabel(item: GroceryItem): string {
  const unit = item.unit.trim();
  if (unit.toLowerCase() === "to taste") return "to taste";
  return `~${formatQty(item.quantity)} ${unit}`.trim();
}

export function ingredientList(recipeIngredients: RecipeIngredient[], scale = 1): string[] {
  return recipeIngredients.map(
    (i) => `${formatQty(i.quantity * scale)} ${i.unit} ${i.name}`,
  );
}
