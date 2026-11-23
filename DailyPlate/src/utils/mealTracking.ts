import type {
  DailyTargets,
  DayMealTracking,
  FoodLogSource,
  MealSlotId,
  MealTrackingEntry,
  MealTrackingStatus,
  PlannedMeal,
  Recipe,
} from "@/types";
import { mealMacrosWithBeverage, resolveBeverage } from "@/utils/beverages";
import { mealFoodNutrition } from "@/utils/mealPortions";
import { sumPlannedMacros } from "@/utils/generateDayPlan";
import {
  effectiveVariationId,
  recipeFiberGrams,
  resolveRecipeMacros,
  resolveVariationId,
} from "@/utils/recipeDisplay";

export function mealsForDateKey(
  dateKey: string,
  dailyPlans: Record<string, PlannedMeal[]>,
  plannedMeals: PlannedMeal[],
  todayDateKey: string,
): PlannedMeal[] {
  const raw = dailyPlans[dateKey] ?? (dateKey === todayDateKey ? plannedMeals : []);
  return raw.filter((m) => !m.recipe.tags.includes("beverage") && !m.recipe.id.startsWith("bev-"));
}

export function trackingMultiplier(status: MealTrackingStatus): number {
  switch (status) {
    case "all":
    case "custom":
      return 1;
    case "half":
      return 0.5;
    case "extra":
      return 1.5;
    case "skipped":
      return 0;
  }
}

export function macrosForMeal(meal: PlannedMeal): DailyTargets {
  return mealMacrosWithBeverage(meal);
}

/** Status for a number of servings: 0 skipped, ½ half, 1 eaten, 1½ extra, anything else custom. */
export function statusForServings(servings: number): MealTrackingStatus {
  if (servings <= 0) return "skipped";
  if (servings === 0.5) return "half";
  if (servings === 1) return "all";
  if (servings === 1.5) return "extra";
  return "custom";
}

/** Servings eaten from a gram weight, rounded to 0.05. Null when the weight is unknown. */
export function servingsFromGrams(grams: number, servingGrams: number | null | undefined): number | null {
  if (!(servingGrams != null && servingGrams > 0) || !(grams > 0)) return null;
  return Math.max(0.05, Math.round((grams / servingGrams) * 20) / 20);
}

export function formatServings(servings: number): string {
  const s = Math.round(servings * 100) / 100;
  if (s === 0.5) return "½ serving";
  if (s === 1) return "1 serving";
  if (s === 1.5) return "1½ servings";
  return `${s} servings`;
}

function scaledMacros(macros: DailyTargets, portionMultiplier: number): DailyTargets {
  return {
    calories: Math.round(macros.calories * portionMultiplier),
    protein: Math.round(macros.protein * portionMultiplier),
    carbs: Math.round(macros.carbs * portionMultiplier),
    fat: Math.round(macros.fat * portionMultiplier),
    fiber: Math.round((macros.fiber ?? 0) * portionMultiplier),
  };
}

/** Meal food × servings, plus the drink once (a drink is not a serving of the meal; skipped = 0). */
export function macrosForServings(meal: PlannedMeal, servings: number): DailyTargets {
  if (servings <= 0) return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  const food = mealFoodNutrition(meal);
  const drink = resolveBeverage(meal.beverageId);
  return {
    calories: Math.round(food.calories * servings + drink.calories),
    protein: Math.round(food.protein * servings + drink.protein),
    carbs: Math.round(food.carbs * servings + drink.carbs),
    fat: Math.round(food.fat * servings + drink.fat),
    fiber: Math.round(food.fiber * servings + drink.fiber),
  };
}

/** Log a planned meal eaten at `servings` (1 = the planned portion). */
export function foodLogForServings(date: string, meal: PlannedMeal, servings: number): MealTrackingEntry {
  return {
    status: statusForServings(servings),
    note: statusForServings(servings) === "custom" ? `Ate ${formatServings(servings)}` : undefined,
    loggedAt: new Date().toISOString(),
    date,
    slot: meal.slot,
    source: "recipe",
    recipeId: meal.recipe.id,
    variationId: effectiveVariationId(meal),
    portionMultiplier: servings,
    ...macrosForServings(meal, servings),
  };
}

/** Logged amounts for the planned meal (including its drink), already scaled. */
export function foodLogFromPlannedMeal(
  date: string,
  meal: PlannedMeal,
  portionMultiplier: number,
): MealTrackingEntry {
  return foodLogForServings(date, meal, portionMultiplier);
}

/** Ate a different recipe than the one planned for this slot. */
export function foodLogFromRecipe(
  date: string,
  slot: MealSlotId,
  recipe: Recipe,
): MealTrackingEntry {
  const variationId = resolveVariationId(recipe, undefined);
  const macros = resolveRecipeMacros(recipe, variationId);
  return {
    status: "custom",
    note: recipe.name,
    loggedAt: new Date().toISOString(),
    date,
    slot,
    source: "recipe",
    recipeId: recipe.id,
    variationId,
    portionMultiplier: 1,
    calories: Math.round(macros.calories),
    protein: Math.round(macros.protein),
    carbs: Math.round(macros.carbs),
    fat: Math.round(macros.fat),
    fiber: Math.round(recipeFiberGrams(recipe, variationId)),
  };
}

/** Approximate calories and protein typed in by hand. Carbs, fat, and fiber stay 0. */
export function foodLogManual(
  date: string,
  slot: MealSlotId,
  calories: number,
  protein: number,
): MealTrackingEntry {
  return {
    status: "custom",
    note: `${calories} kcal · ${protein}g protein`,
    loggedAt: new Date().toISOString(),
    date,
    slot,
    source: "manual",
    portionMultiplier: 1,
    calories,
    protein,
    carbs: 0,
    fat: 0,
    fiber: 0,
  };
}

function entryHasFoodLog(entry: MealTrackingEntry): boolean {
  return (
    (entry.source === "recipe" || entry.source === "manual" || entry.source === "scan") &&
    typeof entry.portionMultiplier === "number" &&
    typeof entry.calories === "number"
  );
}

/**
 * Fill date, slot, source, recipe, portion, and macros on older eaten/skipped
 * rows that only stored a status. Snapshot macros from the meal that was planned
 * that day. Rows that already have the food-log fields are left as logged.
 */
export function migrateMealTracking(
  tracking: Record<string, DayMealTracking>,
  dailyPlans: Record<string, PlannedMeal[]>,
  plannedMeals: PlannedMeal[],
  todayDateKey: string,
): Record<string, DayMealTracking> {
  let changed = false;
  const next: Record<string, DayMealTracking> = {};
  for (const [date, day] of Object.entries(tracking)) {
    const meals =
      dailyPlans[date] ?? (date === todayDateKey ? plannedMeals : []);
    const nextDay: DayMealTracking = {};
    for (const [slot, entry] of Object.entries(day) as [MealSlotId, MealTrackingEntry][]) {
      if (!entry) continue;
      if (entryHasFoodLog(entry) && entry.date && entry.slot) {
        nextDay[slot] = entry;
        continue;
      }
      changed = true;
      const meal = meals.find((item) => item.slot === slot);
      if (entry.status === "custom" && typeof entry.calories === "number") {
        const source: FoodLogSource = entry.recipeId ? "recipe" : "manual";
        nextDay[slot] = {
          ...entry,
          date,
          slot,
          source: entry.source ?? source,
          portionMultiplier: entry.portionMultiplier ?? 1,
          protein: entry.protein ?? 0,
          carbs: entry.carbs ?? 0,
          fat: entry.fat ?? 0,
          fiber: entry.fiber ?? 0,
        };
        continue;
      }
      const portionMultiplier = entry.portionMultiplier ?? trackingMultiplier(entry.status);
      if (!meal) {
        nextDay[slot] = {
          ...entry,
          date,
          slot,
          source: entry.source ?? "recipe",
          portionMultiplier,
          calories: entry.calories ?? 0,
          protein: entry.protein ?? 0,
          carbs: entry.carbs ?? 0,
          fat: entry.fat ?? 0,
          fiber: entry.fiber ?? 0,
        };
        continue;
      }
      const macros = scaledMacros(macrosForMeal(meal), portionMultiplier);
      nextDay[slot] = {
        ...entry,
        date,
        slot,
        source: "recipe",
        recipeId: entry.recipeId ?? meal.recipe.id,
        variationId: entry.variationId ?? effectiveVariationId(meal),
        portionMultiplier,
        ...macros,
      };
    }
    next[date] = nextDay;
  }
  return changed ? next : tracking;
}

export function sumTrackedMacros(
  meals: PlannedMeal[],
  tracking: DayMealTracking | undefined,
  snackLogs: MealTrackingEntry[] = [],
): {
  eaten: DailyTargets;
  planned: DailyTargets;
  hasTracking: boolean;
  loggedCount: number;
} {
  const planned = sumPlannedMacros(meals);
  const loggedCount = tracking ? Object.keys(tracking).length : 0;
  // Ad-hoc snacks logged on Today count toward the day's totals.
  const eaten: DailyTargets = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  for (const entry of snackLogs) {
    eaten.calories += entry.calories ?? 0;
    eaten.protein += entry.protein ?? 0;
    eaten.carbs += entry.carbs ?? 0;
    eaten.fat += entry.fat ?? 0;
    eaten.fiber = (eaten.fiber ?? 0) + (entry.fiber ?? 0);
  }
  if (!tracking || loggedCount === 0) {
    return { eaten, planned, hasTracking: snackLogs.length > 0, loggedCount: 0 };
  }

  for (const meal of meals) {
    const entry = tracking[meal.slot];
    if (!entry) continue;
    if (entryHasFoodLog(entry) || (entry.status === "custom" && entry.calories != null)) {
      eaten.calories += entry.calories ?? 0;
      eaten.protein += entry.protein ?? 0;
      eaten.carbs += entry.carbs ?? 0;
      eaten.fat += entry.fat ?? 0;
      eaten.fiber = (eaten.fiber ?? 0) + (entry.fiber ?? 0);
      continue;
    }
    const mult = trackingMultiplier(entry.status);
    const m = macrosForMeal(meal);
    eaten.calories += m.calories * mult;
    eaten.protein += m.protein * mult;
    eaten.carbs += m.carbs * mult;
    eaten.fat += m.fat * mult;
    eaten.fiber = (eaten.fiber ?? 0) + (m.fiber ?? 0) * mult;
  }
  return { eaten, planned, hasTracking: true, loggedCount };
}

export function trackingLabel(entry: MealTrackingEntry): string {
  switch (entry.status) {
    case "all":
      return "Eaten";
    case "half":
      return "Ate half";
    case "extra":
      return "Ate 1.5×";
    case "skipped":
      return "Skipped";
    case "custom":
      return entry.note?.trim() ? entry.note.trim() : "Something else";
  }
}

export function trackingBadgeClass(status: MealTrackingStatus): string {
  switch (status) {
    case "all":
    case "custom":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "half":
    case "extra":
      return "bg-amber-50 text-amber-900 ring-amber-200";
    case "skipped":
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}
