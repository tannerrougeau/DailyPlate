import type { DailyTargets, PlannedMeal, Recipe, MealSlotId } from "@/types";
import type { GenerateOptions } from "@/utils/generateDayPlan";
import { pickRecipeForSlot, sumPlannedMacros } from "@/utils/generateDayPlan";
import { defaultVariationId, effectiveCarbVariationId, resolveRecipeMacros } from "@/utils/recipeDisplay";

export const RECIPE_SCALE_MIN = 0.75;
export const RECIPE_SCALE_MAX = 1.25;

export function clampRecipeScale(scale: number): number {
  return Math.round(Math.min(RECIPE_SCALE_MAX, Math.max(RECIPE_SCALE_MIN, scale)) * 10) / 10;
}

export function proteinDensity(recipe: Recipe): number {
  return recipe.calories > 0 ? recipe.protein / recipe.calories : 0;
}

function mealCalories(m: PlannedMeal): number {
  return resolveRecipeMacros(m.recipe, m.selectedVariationId, effectiveCarbVariationId(m)).calories * m.scale;
}

function scaleMealsToCalorieTarget(meals: PlannedMeal[], calorieTarget: number): PlannedMeal[] {
  const baseCals = meals.reduce(
    (s, m) => s + resolveRecipeMacros(m.recipe, m.selectedVariationId, effectiveCarbVariationId(m)).calories,
    0,
  );
  if (baseCals <= 0) return meals;
  const uniform = clampRecipeScale(calorieTarget / baseCals);
  return meals.map((m) => ({ ...m, scale: uniform }));
}

function trySwapForMoreProtein(
  meals: PlannedMeal[],
  options: GenerateOptions,
  recipes: Recipe[],
  slot: MealSlotId,
  lockedSlots: Set<MealSlotId>,
): PlannedMeal[] | null {
  if (lockedSlots.has(slot)) return null;
  const idx = meals.findIndex((m) => m.slot === slot);
  if (idx < 0) return null;
  const current = meals[idx]!;
  const used = new Set(meals.map((m) => m.recipe.id));
  used.delete(current.recipe.id);

  const candidates = recipes
    .filter(
      (r) =>
        r.mealSlots.includes(slot) &&
        r.id !== current.recipe.id &&
        !used.has(r.id) &&
        proteinDensity(r) > proteinDensity(current.recipe) + 0.0005,
    )
    .sort((a, b) => proteinDensity(b) - proteinDensity(a));

  for (const recipe of candidates.slice(0, 8)) {
    const trial = meals.map((m, i) =>
      i === idx
        ? { ...m, recipe, scale: 1, selectedVariationId: defaultVariationId(recipe) }
        : m,
    );
    const scaled = scaleMealsToCalorieTarget(trial, meals.reduce((s, m) => s + mealCalories(m), 0));
    if (sumPlannedMacros(scaled).protein > sumPlannedMacros(meals).protein) {
      return scaled;
    }
  }

  const picked = pickRecipeForSlot(recipes, slot, options, used);
  if (!picked || proteinDensity(picked) <= proteinDensity(current.recipe)) return null;
  const trial = meals.map((m, i) =>
    i === idx
      ? { ...m, recipe: picked, scale: 1, selectedVariationId: defaultVariationId(picked) }
      : m,
  );
  const calorieTarget = meals.reduce((s, m) => s + mealCalories(m), 0);
  return scaleMealsToCalorieTarget(trial, calorieTarget);
}

function tunePerMealScales(
  meals: PlannedMeal[],
  calorieTarget: number,
  minimumProtein: number,
  lockedSlots: Set<MealSlotId>,
): { meals: PlannedMeal[]; changed: boolean } | null {
  let current = meals.map((m) => ({ ...m, scale: clampRecipeScale(m.scale) }));
  let changed = false;
  const tolerance = 55;

  for (let pass = 0; pass < 48; pass++) {
    const totals = sumPlannedMacros(current);
    if (totals.protein >= minimumProtein) break;

    const byDensity = [...current].sort(
      (a, b) => proteinDensity(b.recipe) - proteinDensity(a.recipe),
    );
    const booster = byDensity.find(
      (m) => !lockedSlots.has(m.slot) && m.scale < RECIPE_SCALE_MAX - 0.04,
    );
    const reducer = [...byDensity]
      .reverse()
      .find((m) => !lockedSlots.has(m.slot) && m.scale > RECIPE_SCALE_MIN + 0.04);
    if (!booster) break;

    const next = current.map((m) => {
      if (m.slot === booster.slot) {
        changed = true;
        return { ...m, scale: clampRecipeScale(m.scale + 0.05) };
      }
      if (
        reducer &&
        m.slot === reducer.slot &&
        reducer.slot !== booster.slot &&
        !lockedSlots.has(m.slot)
      ) {
        changed = true;
        return { ...m, scale: clampRecipeScale(m.scale - 0.05) };
      }
      return m;
    });
    current = next;

    const cals = sumPlannedMacros(current).calories;
    if (Math.abs(cals - calorieTarget) > tolerance) {
      current = scaleMealsToCalorieTarget(current, calorieTarget);
      changed = true;
    }
  }

  if (!changed) return null;
  return { meals: current, changed };
}

/**
 * After calorie-first generation, meet minimum protein via swaps and bounded scaling.
 */
export function applyMacroRedistribution(
  meals: PlannedMeal[],
  targets: DailyTargets,
  options: GenerateOptions,
  recipes: Recipe[],
  lockedSlots: Set<MealSlotId> = new Set(),
): { meals: PlannedMeal[]; redistributed: boolean } {
  const minimumProtein = options.minimumProteinGrams;
  if (!options.prioritizeMinProtein || !minimumProtein || minimumProtein <= 0) {
    return { meals, redistributed: false };
  }

  if (meals.length === 0) return { meals, redistributed: false };

  const baselineProtein = sumPlannedMacros(meals).protein;
  if (baselineProtein >= minimumProtein) {
    return { meals, redistributed: false };
  }

  let current = scaleMealsToCalorieTarget(meals, targets.calories);
  let redistributed = false;

  const slotsByDensity = [...current]
    .sort((a, b) => proteinDensity(a.recipe) - proteinDensity(b.recipe))
    .map((m) => m.slot);

  for (const slot of slotsByDensity) {
    if (sumPlannedMacros(current).protein >= minimumProtein) break;
    const swapped = trySwapForMoreProtein(current, options, recipes, slot, lockedSlots);
    if (swapped) {
      current = scaleMealsToCalorieTarget(swapped, targets.calories);
      redistributed = true;
    }
  }

  const tuned = tunePerMealScales(current, targets.calories, minimumProtein, lockedSlots);
  if (tuned) {
    current = tuned.meals;
    redistributed = true;
  }

  if (sumPlannedMacros(current).protein < minimumProtein) {
    for (const slot of slotsByDensity) {
      const swapped = trySwapForMoreProtein(current, options, recipes, slot, lockedSlots);
      if (swapped) {
        current = swapped;
        redistributed = true;
      }
      if (sumPlannedMacros(current).protein >= minimumProtein) break;
    }
    const tunedAgain = tunePerMealScales(current, targets.calories, minimumProtein, lockedSlots);
    if (tunedAgain) {
      current = tunedAgain.meals;
      redistributed = true;
    }
  }

  current = current.map((m) => ({ ...m, scale: clampRecipeScale(m.scale) }));

  const finalProtein = sumPlannedMacros(current).protein;
  const didWork =
    redistributed ||
    finalProtein > baselineProtein + 0.5 ||
    current.some((m, i) => Math.abs(m.scale - meals[i]!.scale) > 0.01);

  return {
    meals: current,
    redistributed: didWork && finalProtein > baselineProtein,
  };
}
