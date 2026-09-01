import type {
  DailyTargets,
  DayMealTracking,
  MealTrackingEntry,
  MealTrackingStatus,
  PlannedMeal,
} from "@/types";
import { sumPlannedMacros } from "@/utils/generateDayPlan";
import {
  effectiveCarbVariationId,
  effectiveVariationId,
  recipeFiberGrams,
  resolveRecipeMacros,
} from "@/utils/recipeDisplay";

export function mealsForDateKey(
  dateKey: string,
  dailyPlans: Record<string, PlannedMeal[]>,
  plannedMeals: PlannedMeal[],
  todayDateKey: string,
): PlannedMeal[] {
  return dailyPlans[dateKey] ?? (dateKey === todayDateKey ? plannedMeals : []);
}

export function trackingMultiplier(status: MealTrackingStatus): number {
  switch (status) {
    case "all":
    case "custom":
      return 1;
    case "half":
      return 0.5;
    case "skipped":
      return 0;
  }
}

export function macrosForMeal(meal: PlannedMeal): DailyTargets {
  const m = resolveRecipeMacros(
    meal.recipe,
    effectiveVariationId(meal),
    effectiveCarbVariationId(meal),
  );
  return {
    calories: m.calories * meal.scale,
    protein: m.protein * meal.scale,
    carbs: m.carbs * meal.scale,
    fat: m.fat * meal.scale,
    fiber: recipeFiberGrams(meal.recipe, effectiveVariationId(meal), effectiveCarbVariationId(meal)) * meal.scale,
  };
}

export function sumTrackedMacros(
  meals: PlannedMeal[],
  tracking: DayMealTracking | undefined,
): {
  eaten: DailyTargets;
  planned: DailyTargets;
  hasTracking: boolean;
  loggedCount: number;
} {
  const planned = sumPlannedMacros(meals);
  const loggedCount = tracking ? Object.keys(tracking).length : 0;
  const empty: DailyTargets = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  if (!tracking || loggedCount === 0) {
    return { eaten: empty, planned, hasTracking: false, loggedCount: 0 };
  }

  const eaten: DailyTargets = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  for (const meal of meals) {
    const entry = tracking[meal.slot];
    if (!entry) continue;
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
      return "Ate all";
    case "half":
      return "Ate half";
    case "skipped":
      return "Skipped";
    case "custom":
      return entry.note?.trim() ? entry.note.trim() : "Logged";
  }
}

export function trackingBadgeClass(status: MealTrackingStatus): string {
  switch (status) {
    case "all":
    case "custom":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "half":
      return "bg-amber-50 text-amber-900 ring-amber-200";
    case "skipped":
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}
