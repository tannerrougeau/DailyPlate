import type { DailyTargets, PlannedMeal, Recipe, MealSlotId } from "@/types";
import type { MealTimingPreference } from "@/types/profile";
import { recipeExcludedByDislikeChips, recipeFavoriteBoost } from "@/utils/chipMatching";
import type { PersonalizationSignals } from "@/utils/personalizationEngine";
import { recipePersonalizationBoost } from "@/utils/personalizationEngine";
import {
  clampRecipeScale,
  proteinDensity,
  RECIPE_SCALE_MAX,
  RECIPE_SCALE_MIN,
} from "@/utils/macroRedistribution";
import {
  createPlannedMeal,
  defaultVariationId,
  effectiveCarbVariationId,
  resolveRecipeMacros,
} from "@/utils/recipeDisplay";

export function slotsForMealsPerDay(
  m: "two" | "three" | "three_snack" | "flexible",
): MealSlotId[] {
  switch (m) {
    case "two":
      return ["lunch", "dinner"];
    case "three":
      return ["breakfast", "lunch", "dinner"];
    case "three_snack":
    case "flexible":
    default:
      return ["breakfast", "lunch", "dinner", "snack"];
  }
}

function timingBoost(
  recipe: Recipe,
  slot: MealSlotId,
  timing: MealTimingPreference | null,
): number {
  if (!timing) return 0;
  if (timing === "light_breakfast" && slot === "breakfast") {
    return recipe.calories < 360 ? 22 : -8;
  }
  if (timing === "bigger_dinner" && slot === "dinner") {
    return recipe.calories > 500 ? 22 : 4;
  }
  if (timing === "balanced") return 4;
  return 0;
}

function recipeWeight(
  recipe: Recipe,
  slot: MealSlotId,
  options: GenerateOptions,
): number {
  let w = 12;
  if (options.favoriteIds.includes(recipe.id)) w += 38;
  w += recipeFavoriteBoost(recipe, options.favoriteChips, options.favoriteCustom);
  w += timingBoost(recipe, slot, options.mealTiming);
  if (options.prioritizeMinProtein) {
    w += proteinDensity(recipe) * 140;
    if (recipe.tags.includes("high_protein")) w += 24;
  }
  if (options.personalization) {
    w += recipePersonalizationBoost(
      recipe,
      slot,
      options.personalization.profile,
      options.personalization.signals,
      options.favoriteIds,
    );
  }
  if (options.lowComplexity) {
    if (recipe.tags.includes("whole_food")) w += 20;
    if (recipe.tags.includes("quick")) w += 18;
    if (recipe.tags.includes("meal_prep")) w += 16;
    if (recipe.tags.includes("batch_friendly")) w += 16;
    if (recipe.prepMinutes + recipe.cookMinutes <= 30) w += 8;
  }
  return Math.max(1, w);
}

function weightedPick(recipes: Recipe[], weight: (r: Recipe) => number): Recipe | undefined {
  if (recipes.length === 0) return undefined;
  const weights = recipes.map(weight);
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < recipes.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return recipes[i];
  }
  return recipes[recipes.length - 1];
}

function isRecipeAllowed(
  recipe: Recipe,
  dislikedIds: Set<string>,
  dislikedChips: string[],
  dislikedCustom: string,
): boolean {
  if (dislikedIds.has(recipe.id)) return false;
  if (recipeExcludedByDislikeChips(recipe, dislikedChips, dislikedCustom)) return false;
  return true;
}

export interface GenerateOptions {
  dislikedIds: string[];
  dislikedChips: string[];
  dislikedCustom: string;
  favoriteIds: string[];
  favoriteChips: string[];
  favoriteCustom: string;
  slots: MealSlotId[];
  mealTiming: MealTimingPreference | null;
  prioritizeMinProtein: boolean;
  minimumProteinGrams: number | null;
  /** When true, prefer simpler recipes and plan leftovers across the week. */
  lowComplexity?: boolean;
  personalization?: {
    profile: import("@/types/profile").UserProfile;
    signals: PersonalizationSignals;
  };
}

function calorieScaleLimits(prioritizeMinProtein: boolean): { min: number; max: number } {
  if (prioritizeMinProtein) {
    return { min: RECIPE_SCALE_MIN, max: RECIPE_SCALE_MAX };
  }
  return { min: 0.75, max: 1.5 };
}

function recipeCaloriesAtDefault(recipe: Recipe): number {
  return resolveRecipeMacros(recipe, defaultVariationId(recipe)).calories;
}

function scaleMealsForCalories(
  raw: { slot: MealSlotId; recipe: Recipe }[],
  calorieTarget: number,
  prioritizeMinProtein: boolean,
): PlannedMeal[] {
  const baseTotal = raw.reduce((s, x) => s + recipeCaloriesAtDefault(x.recipe), 0);
  const { min, max } = calorieScaleLimits(prioritizeMinProtein);
  let scale = 1;
  if (baseTotal > 0) {
    scale = calorieTarget / baseTotal;
    scale = Math.min(max, Math.max(min, scale));
    scale = Math.round(scale * 10) / 10;
  }
  if (prioritizeMinProtein) {
    scale = clampRecipeScale(scale);
  }
  return raw.map(({ slot, recipe }) =>
    createPlannedMeal(slot, recipe, { scale }),
  );
}

/**
 * Weighted picks per slot; excludes disliked ids and chip rules; boosts favorites.
 */
export function generateDayPlan(
  recipes: Recipe[],
  targets: DailyTargets,
  options: GenerateOptions,
): PlannedMeal[] {
  const dislike = new Set(options.dislikedIds);
  const used = new Set<string>();
  const raw: { slot: MealSlotId; recipe: Recipe }[] = [];

  for (const slot of options.slots) {
    let pool = recipes.filter(
      (r) =>
        r.mealSlots.includes(slot) &&
        isRecipeAllowed(r, dislike, options.dislikedChips, options.dislikedCustom) &&
        !used.has(r.id),
    );
    if (pool.length === 0) {
      pool = recipes.filter(
        (r) =>
          isRecipeAllowed(r, dislike, options.dislikedChips, options.dislikedCustom) &&
          !used.has(r.id),
      );
    }
    if (pool.length === 0) {
      pool = recipes.filter((r) => !dislike.has(r.id) && !used.has(r.id));
    }
    const recipe = weightedPick(pool, (r) => recipeWeight(r, slot, options));
    if (!recipe) continue;
    used.add(recipe.id);
    raw.push({ slot, recipe });
  }

  return scaleMealsForCalories(raw, targets.calories, options.prioritizeMinProtein);
}

/**
 * Fill only the given slots; excludes recipe ids already used (e.g. locked meals).
 * Scales picks to fit calorieBudget.
 */
export function generateSlotsPlan(
  recipes: Recipe[],
  calorieBudget: number,
  options: GenerateOptions,
  slots: MealSlotId[],
  usedRecipeIds: Set<string>,
): PlannedMeal[] {
  if (slots.length === 0) return [];

  const dislike = new Set(options.dislikedIds);
  const used = new Set(usedRecipeIds);
  const raw: { slot: MealSlotId; recipe: Recipe }[] = [];

  for (const slot of slots) {
    let pool = recipes.filter(
      (r) =>
        r.mealSlots.includes(slot) &&
        isRecipeAllowed(r, dislike, options.dislikedChips, options.dislikedCustom) &&
        !used.has(r.id),
    );
    if (pool.length === 0) {
      pool = recipes.filter(
        (r) =>
          isRecipeAllowed(r, dislike, options.dislikedChips, options.dislikedCustom) &&
          !used.has(r.id),
      );
    }
    if (pool.length === 0) {
      pool = recipes.filter((r) => !dislike.has(r.id) && !used.has(r.id));
    }
    const recipe = weightedPick(pool, (r) => recipeWeight(r, slot, options));
    if (!recipe) continue;
    used.add(recipe.id);
    raw.push({ slot, recipe });
  }

  return scaleMealsForCalories(raw, calorieBudget, options.prioritizeMinProtein);
}

/** Pick one replacement recipe for a slot (used by Regenerate). */
export function pickRecipeForSlot(
  recipes: Recipe[],
  slot: MealSlotId,
  options: GenerateOptions,
  excludeIds: Set<string>,
): Recipe | undefined {
  let pool = recipes.filter(
    (r) =>
      r.mealSlots.includes(slot) &&
      isRecipeAllowed(
        r,
        new Set(options.dislikedIds),
        options.dislikedChips,
        options.dislikedCustom,
      ) && !excludeIds.has(r.id),
  );
  if (pool.length === 0) {
    pool = recipes.filter(
      (r) =>
        isRecipeAllowed(
          r,
          new Set(options.dislikedIds),
          options.dislikedChips,
          options.dislikedCustom,
        ) && !excludeIds.has(r.id),
    );
  }
  if (pool.length === 0) {
    pool = recipes.filter((r) => !options.dislikedIds.includes(r.id) && !excludeIds.has(r.id));
  }
  return weightedPick(pool, (r) => recipeWeight(r, slot, options));
}

export function sumPlannedMacros(meals: PlannedMeal[]): DailyTargets {
  return meals.reduce(
    (acc, m) => {
      const macros = resolveRecipeMacros(
        m.recipe,
        m.selectedVariationId,
        effectiveCarbVariationId(m),
      );
      return {
        calories: acc.calories + macros.calories * m.scale,
        protein: acc.protein + macros.protein * m.scale,
        carbs: acc.carbs + macros.carbs * m.scale,
        fat: acc.fat + macros.fat * m.scale,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}
