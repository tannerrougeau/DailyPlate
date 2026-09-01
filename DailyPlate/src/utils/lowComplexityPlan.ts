import type { MealPrepInfo, MealSlotId, PlannedMeal, Recipe } from "@/types";
import type { UserProfile } from "@/types/profile";
import { recipeLibrary } from "@/recipes/recipeLibrary";
import {
  pickRecipeForSlot,
  slotsForMealsPerDay,
  type GenerateOptions,
} from "@/utils/generateDayPlan";
import { recipeExcludedByDislikeChips } from "@/utils/chipMatching";
import { isMealLocked } from "@/utils/mealLocks";
import { createPlannedMeal, resolveRecipeMacros } from "@/utils/recipeDisplay";

const MAIN_SLOTS: MealSlotId[] = ["lunch", "dinner"];
const MIN_COOK_EVENTS = 3;
const MAX_COOK_EVENTS = 5;
const MAX_LEFTOVERS_PER_COOK = 3;

type SlotPosition = { dateKey: string; slot: MealSlotId };

function spreadIndices(total: number, count: number): number[] {
  if (count <= 0 || total <= 0) return [];
  const n = Math.min(count, total);
  if (n === 1) return [Math.floor(total / 2)];
  const indices: number[] = [];
  for (let i = 0; i < n; i++) {
    indices.push(Math.round((i * (total - 1)) / (n - 1)));
  }
  return [...new Set(indices)].sort((a, b) => a - b);
}

function newBatchId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `lc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function scaleForSlotBudget(
  recipe: Recipe,
  otherCalories: number,
  calorieTarget: number,
): number {
  const slotBudget = Math.max(300, calorieTarget - otherCalories);
  const recipeCals = resolveRecipeMacros(recipe).calories;
  if (recipeCals <= 0) return 1;
  let scale = slotBudget / recipeCals;
  scale = Math.min(1.5, Math.max(0.75, scale));
  return Math.round(scale * 10) / 10;
}

function setMealAtSlot(
  dailyPlans: Record<string, PlannedMeal[]>,
  dateKey: string,
  slot: MealSlotId,
  recipe: Recipe,
  profile: UserProfile,
  calorieTarget: number,
  mealPrep: MealPrepInfo,
  existingScale?: number,
): Record<string, PlannedMeal[]> {
  const existing = dailyPlans[dateKey] ?? [];
  const withoutSlot = existing.filter((m) => m.slot !== slot);
  const otherCals = withoutSlot.reduce(
    (s, m) => s + resolveRecipeMacros(m.recipe).calories * m.scale,
    0,
  );
  const scale =
    existingScale ?? scaleForSlotBudget(recipe, otherCals, calorieTarget);
  const meal = createPlannedMeal(slot, recipe, { scale, mealPrep });
  const slotOrder = slotsForMealsPerDay(profile.mealsPerDay);
  return {
    ...dailyPlans,
    [dateKey]: [...withoutSlot, meal].sort(
      (a, b) => slotOrder.indexOf(a.slot) - slotOrder.indexOf(b.slot),
    ),
  };
}

function isWeeklyPrepSlot(meal: PlannedMeal | undefined): boolean {
  return meal?.mealPrep?.source === "weekly_prep";
}

export function pickLowComplexityRecipe(
  slot: MealSlotId,
  options: GenerateOptions,
  excludeIds: Set<string>,
  recipes: Recipe[] = recipeLibrary,
): Recipe | undefined {
  const pool = recipes.filter(
    (r) =>
      r.mealSlots.includes(slot) &&
      !excludeIds.has(r.id) &&
      !options.dislikedIds.includes(r.id) &&
      !r.tags.includes("beverage") &&
      !recipeExcludedByDislikeChips(r, options.dislikedChips, options.dislikedCustom),
  );
  if (pool.length === 0) {
    return pickRecipeForSlot(recipes, slot, options, excludeIds);
  }

  const weights = pool.map((r) => {
    let w = 10;
    if (options.favoriteIds.includes(r.id)) w += 30;
    if (r.tags.includes("whole_food")) w += 20;
    if (r.tags.includes("quick")) w += 18;
    if (r.tags.includes("meal_prep")) w += 16;
    if (r.tags.includes("batch_friendly")) w += 16;
    if (r.prepMinutes + r.cookMinutes <= 30) w += 8;
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

function simplifyBreakfasts(
  eligibleDays: string[],
  dailyPlans: Record<string, PlannedMeal[]>,
  profile: UserProfile,
  options: GenerateOptions,
  lockedMeals: string[],
  calorieTarget: number,
  recipes: Recipe[] = recipeLibrary,
): Record<string, PlannedMeal[]> {
  const slotOrder = slotsForMealsPerDay(profile.mealsPerDay);
  if (!slotOrder.includes("breakfast")) return dailyPlans;

  const usedIds = new Set<string>();
  for (const key of eligibleDays) {
    for (const m of dailyPlans[key] ?? []) usedIds.add(m.recipe.id);
  }

  const recipe = pickLowComplexityRecipe("breakfast", options, usedIds, recipes);
  if (!recipe) return dailyPlans;

  let next = { ...dailyPlans };
  const batchId = newBatchId();
  const cookDateKey = eligibleDays[0]!;
  eligibleDays.forEach((dateKey, index) => {
    if (isMealLocked(lockedMeals, dateKey, "breakfast")) return;
    const existing = (next[dateKey] ?? []).find((m) => m.slot === "breakfast");
    if (isWeeklyPrepSlot(existing)) return;
    next = setMealAtSlot(next, dateKey, "breakfast", recipe, profile, calorieTarget, {
      batchId,
      portionsCooked: eligibleDays.length,
      portionIndex: index + 1,
      source: "low_complexity",
      cookDateKey,
    });
  });
  return next;
}

function collectMainSlotPositions(
  eligibleDays: string[],
  dailyPlans: Record<string, PlannedMeal[]>,
  lockedMeals: string[],
): SlotPosition[] {
  const positions: SlotPosition[] = [];
  for (const dateKey of eligibleDays) {
    for (const slot of MAIN_SLOTS) {
      if (isMealLocked(lockedMeals, dateKey, slot)) continue;
      const existing = (dailyPlans[dateKey] ?? []).find((m) => m.slot === slot);
      if (isWeeklyPrepSlot(existing)) continue;
      positions.push({ dateKey, slot });
    }
  }
  return positions;
}

function assignCookGroups(
  dailyPlans: Record<string, PlannedMeal[]>,
  positions: SlotPosition[],
  profile: UserProfile,
  options: GenerateOptions,
  calorieTarget: number,
  recipes: Recipe[] = recipeLibrary,
): Record<string, PlannedMeal[]> {
  if (positions.length === 0) return dailyPlans;

  let next = { ...dailyPlans };
  const cookCount = Math.min(
    MAX_COOK_EVENTS,
    Math.max(MIN_COOK_EVENTS, Math.ceil(positions.length / 3)),
  );
  const cookIndices = spreadIndices(positions.length, cookCount);
  const assigned = new Set<number>();

  for (const cookIdx of cookIndices) {
    if (assigned.has(cookIdx)) continue;
    const cookPos = positions[cookIdx]!;
    const usedIds = new Set<string>();
    for (const meals of Object.values(next)) {
      for (const m of meals) usedIds.add(m.recipe.id);
    }

    const recipe = pickLowComplexityRecipe(cookPos.slot, options, usedIds, recipes);
    if (!recipe) continue;

    const batchId = newBatchId();
    const groupIndices = [cookIdx];
    assigned.add(cookIdx);

    let leftoverCount = 0;
    for (let i = cookIdx + 1; i < positions.length && leftoverCount < MAX_LEFTOVERS_PER_COOK; i++) {
      if (assigned.has(i)) continue;
      if (positions[i]!.slot !== cookPos.slot) continue;
      groupIndices.push(i);
      assigned.add(i);
      leftoverCount++;
    }
    if (leftoverCount === 0) {
      for (let i = cookIdx + 1; i < positions.length && leftoverCount < 2; i++) {
        if (assigned.has(i)) continue;
        groupIndices.push(i);
        assigned.add(i);
        leftoverCount++;
      }
    }

    const portionsCooked = groupIndices.length;
    for (let batchIndex = 0; batchIndex < groupIndices.length; batchIndex++) {
      const pos = positions[groupIndices[batchIndex]!]!;
      next = setMealAtSlot(
        next,
        pos.dateKey,
        pos.slot,
        recipe,
        profile,
        calorieTarget,
        {
          batchId,
          portionsCooked,
          portionIndex: batchIndex + 1,
          source: "low_complexity",
          cookDateKey: cookPos.dateKey,
        },
      );
    }
  }

  return next;
}

/** Post-process week plans: fewer cooks, leftover chains, simpler breakfasts. */
export function applyLowComplexityToPlans(
  dateKeys: string[],
  dailyPlans: Record<string, PlannedMeal[]>,
  profile: UserProfile,
  options: GenerateOptions,
  lockedDays: string[],
  lockedMeals: string[],
  calorieTarget: number,
  recipes: Recipe[] = recipeLibrary,
): Record<string, PlannedMeal[]> {
  if (!options.lowComplexity) return dailyPlans;

  const eligibleDays = [...dateKeys].sort().filter((k) => !lockedDays.includes(k));
  if (eligibleDays.length === 0) return dailyPlans;

  let next = { ...dailyPlans };
  next = simplifyBreakfasts(
    eligibleDays,
    next,
    profile,
    options,
    lockedMeals,
    calorieTarget,
    recipes,
  );
  const positions = collectMainSlotPositions(eligibleDays, next, lockedMeals);
  next = assignCookGroups(next, positions, profile, options, calorieTarget, recipes);
  return next;
}

/** After single-day generation, extend leftovers into later days in the same week. */
export function applyLowComplexityFromDay(
  cookDateKey: string,
  dailyPlans: Record<string, PlannedMeal[]>,
  weekKeys: string[],
  profile: UserProfile,
  options: GenerateOptions,
  lockedDays: string[],
  lockedMeals: string[],
  calorieTarget: number,
): Record<string, PlannedMeal[]> {
  if (!options.lowComplexity) return dailyPlans;

  const eligibleWeekKeys = weekKeys.filter((k) => !lockedDays.includes(k)).sort();
  const cookDayIdx = eligibleWeekKeys.indexOf(cookDateKey);
  if (cookDayIdx < 0) return dailyPlans;

  let next = { ...dailyPlans };

  for (const slot of MAIN_SLOTS) {
    if (isMealLocked(lockedMeals, cookDateKey, slot)) continue;
    const cookMeal = (next[cookDateKey] ?? []).find((m) => m.slot === slot);
    if (!cookMeal || isWeeklyPrepSlot(cookMeal)) continue;

    const recipe = cookMeal.recipe;
    const batchId = newBatchId();
    const leftoverKeys = eligibleWeekKeys.slice(
      cookDayIdx + 1,
      cookDayIdx + 1 + MAX_LEFTOVERS_PER_COOK,
    );
    const portionsCooked = 1 + leftoverKeys.length;

    next = setMealAtSlot(
      next,
      cookDateKey,
      slot,
      recipe,
      profile,
      calorieTarget,
      {
        batchId,
        portionsCooked,
        portionIndex: 1,
        source: "low_complexity",
        cookDateKey,
      },
      cookMeal.scale,
    );

    leftoverKeys.forEach((dateKey, index) => {
      if (isMealLocked(lockedMeals, dateKey, slot)) return;
      const existing = (next[dateKey] ?? []).find((m) => m.slot === slot);
      if (isWeeklyPrepSlot(existing)) return;
      next = setMealAtSlot(
        next,
        dateKey,
        slot,
        recipe,
        profile,
        calorieTarget,
        {
          batchId,
          portionsCooked,
          portionIndex: index + 2,
          source: "low_complexity",
          cookDateKey,
        },
        cookMeal.scale,
      );
    });
  }

  return next;
}
