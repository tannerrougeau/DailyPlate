import type { MealSlotId, PlannedMeal, Recipe } from "@/types";
import type { UserProfile } from "@/types/profile";
import { recipeLibrary } from "@/recipes/recipeLibrary";
import {
  pickRecipeForSlot,
  slotsForMealsPerDay,
  type GenerateOptions,
} from "@/utils/generateDayPlan";
import { recipeExcludedByDislikeChips } from "@/utils/chipMatching";
import { isMealPrepFriendly } from "@/utils/mealPrep";
import { createPlannedMeal, resolveRecipeMacros } from "@/utils/recipeDisplay";

function spreadDayIndices(totalDays: number, count: number): number[] {
  if (count <= 0 || totalDays <= 0) return [];
  const n = Math.min(count, totalDays);
  if (n === 1) return [Math.floor(totalDays / 2)];
  const indices: number[] = [];
  for (let i = 0; i < n; i++) {
    indices.push(Math.round((i * (totalDays - 1)) / (n - 1)));
  }
  return [...new Set(indices)].sort((a, b) => a - b);
}

function mealPrepBoost(recipe: Recipe): number {
  return isMealPrepFriendly(recipe) ? 25 : 0;
}

export function pickWeeklyPrepRecipe(
  slot: MealSlotId,
  options: GenerateOptions,
  excludeIds: Set<string>,
  recipes: Recipe[] = recipeLibrary,
): Recipe | undefined {
  let pool = recipes.filter(
    (r) =>
      r.mealSlots.includes(slot) &&
      !excludeIds.has(r.id) &&
      !options.dislikedIds.includes(r.id) &&
      !recipeExcludedByDislikeChips(r, options.dislikedChips, options.dislikedCustom),
  );
  if (pool.length === 0) return pickRecipeForSlot(recipes, slot, options, excludeIds);

  const weights = pool.map((r) => {
    let w = 10 + mealPrepBoost(r);
    if (options.favoriteIds.includes(r.id)) w += 30;
    return w;
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * sum;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

export function applyWeeklyMealPrepToPlans(
  dateKeys: string[],
  dailyPlans: Record<string, PlannedMeal[]>,
  profile: UserProfile,
  options: GenerateOptions,
  lockedDays: string[],
  calorieTarget: number,
  recipes: Recipe[] = recipeLibrary,
): Record<string, PlannedMeal[]> {
  if (!profile.weeklyMealPrepEnabled || !profile.weeklyMealPrepSlot) {
    return dailyPlans;
  }

  const slot = profile.weeklyMealPrepSlot;
  const repeatCount = profile.weeklyMealPrepRepeatCount ?? 3;
  const eligible = dateKeys.filter((k) => !lockedDays.includes(k));
  if (eligible.length === 0) return dailyPlans;

  const prepIndices = spreadDayIndices(eligible.length, repeatCount);
  const prepKeys = prepIndices.map((i) => eligible[i]!);
  const usedIds = new Set<string>();
  for (const key of eligible) {
    for (const m of dailyPlans[key] ?? []) usedIds.add(m.recipe.id);
  }

  const recipe = pickWeeklyPrepRecipe(slot, options, usedIds, recipes);
  if (!recipe) return dailyPlans;

  const batchId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `batch-${Date.now()}`;
  const slotOrder = slotsForMealsPerDay(profile.mealsPerDay);
  const next = { ...dailyPlans };

  prepKeys.forEach((dateKey, index) => {
    const existing = next[dateKey] ?? [];
    const withoutSlot = existing.filter((m) => m.slot !== slot);
    const otherCals = withoutSlot.reduce((s, m) => s + m.recipe.calories * m.scale, 0);
    const slotBudget = Math.max(300, calorieTarget - otherCals);
    let scale = 1;
    const recipeCals = resolveRecipeMacros(recipe).calories;
    if (recipeCals > 0) {
      scale = slotBudget / recipeCals;
      scale = Math.min(1.5, Math.max(0.75, scale));
      scale = Math.round(scale * 10) / 10;
    }
    const meal = createPlannedMeal(slot, recipe, {
      scale,
      mealPrep: {
        batchId,
        portionsCooked: prepKeys.length,
        portionIndex: index + 1,
        source: "weekly_prep",
      },
    });
    next[dateKey] = [...withoutSlot, meal].sort(
      (a, b) => slotOrder.indexOf(a.slot) - slotOrder.indexOf(b.slot),
    );
  });

  return next;
}

/** Split date keys into Mon–Sun week buckets (partial weeks allowed). */
export function groupDateKeysByWeek(dateKeys: string[]): string[][] {
  const sorted = [...dateKeys].sort();
  if (sorted.length === 0) return [];
  const groups: string[][] = [];
  let current: string[] = [];
  for (const key of sorted) {
    const d = new Date(key + "T12:00:00");
    const dow = (d.getDay() + 6) % 7;
    if (current.length > 0 && dow === 0) {
      groups.push(current);
      current = [];
    }
    current.push(key);
  }
  if (current.length > 0) groups.push(current);
  return groups;
}
