import type { MealSlotId, Recipe } from "@/types";
import { addDays, fromDateKey, toDateKey } from "@/utils/date";

export const MEAL_PREP_PORTION_PRESETS = [2, 4, 6, 8] as const;

export const DEFAULT_MEAL_PREP_NOTES =
  "Cool completely before storing. Refrigerate up to 4 days in airtight containers. Reheat to 165°F / 74°C. Freeze up to 3 months; thaw overnight in the fridge before reheating.";

function recipeHasMealPrepTag(recipe: Recipe): boolean {
  return recipe.tags.some(
    (t) => t === "meal_prep" || t === "batch_friendly" || t === "meal_prep_friendly",
  );
}

export function variationIsMealPrep(recipe: Recipe, variationId?: string): boolean {
  const details = recipe.variationDetails ?? [];
  const id = variationId ?? details[0]?.id;
  const variation = details.find((v) => v.id === id);
  if (variation && typeof variation.mealPrep === "boolean") return variation.mealPrep;
  return recipeHasMealPrepTag(recipe);
}

/** True when this recipe can be batch-prepped as at least one variation. */
export function recipeHasMealPrepOption(recipe: Recipe): boolean {
  if (recipe.variationDetails?.some((v) => v.mealPrep === true)) return true;
  return recipeHasMealPrepTag(recipe);
}

export function isMealPrepFriendly(recipe: Recipe, variationId?: string): boolean {
  if (recipe.variationDetails?.some((v) => typeof v.mealPrep === "boolean")) {
    return variationIsMealPrep(recipe, variationId);
  }
  return recipeHasMealPrepTag(recipe);
}

/** Variation to persist when cooking leftovers. Prefers the selected meal-prep build. */
export function resolveMealPrepVariationId(
  recipe: Recipe,
  variationId?: string,
): string | undefined {
  if (variationIsMealPrep(recipe, variationId)) {
    const details = recipe.variationDetails ?? [];
    const id = variationId ?? details[0]?.id;
    if (id && details.some((v) => v.id === id)) return id;
  }
  return recipe.variationDetails?.find((v) => v.mealPrep === true)?.id;
}

export function resolveMealPrepNotes(recipe: Recipe): string | null {
  if (recipe.mealPrepNotes?.trim()) return recipe.mealPrepNotes.trim();
  const noteLine = recipe.instructions.find((s) => /^note:/i.test(s.trim()));
  if (noteLine) return noteLine.replace(/^note:\s*/i, "").trim();
  if (isMealPrepFriendly(recipe)) return DEFAULT_MEAL_PREP_NOTES;
  return null;
}

/** Ingredient multiplier for one batch cook (portions × plan scale × household). */
export function mealPrepIngredientMultiplier(
  portionsCooked: number,
  mealScale: number,
  householdMultiplier: number,
): number {
  return portionsCooked * mealScale * householdMultiplier;
}

export function suggestMealPrepDateKeys(
  startDate: Date,
  count: number,
  lockedDays: string[],
  maxDays = 14,
): string[] {
  const keys: string[] = [];
  let cursor = new Date(startDate);
  let guard = 0;
  while (keys.length < count && guard < maxDays) {
    const key = toDateKey(cursor);
    if (!lockedDays.includes(key)) keys.push(key);
    cursor = addDays(cursor, 1);
    guard++;
  }
  return keys;
}

/** Extra day rows in the picker beyond portion count. */
export function mealPrepDayPickerKeys(
  startDate: Date,
  portionsCooked: number,
  lockedDays: string[],
): string[] {
  return suggestMealPrepDateKeys(startDate, portionsCooked + 6, lockedDays, 21);
}

export function formatMealPrepDayLabel(dateKey: string): string {
  return fromDateKey(dateKey).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function defaultSlotForRecipe(recipe: Recipe): MealSlotId {
  return recipe.mealSlots[0] ?? "lunch";
}
