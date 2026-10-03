import type {
  DailyTargets,
  DayMealTracking,
  MealTrackingEntry,
  MealTrackingStatus,
  PlannedMeal,
} from "@/types";
import { mealMacrosWithBeverage } from "@/utils/beverages";
import { sumPlannedMacros } from "@/utils/generateDayPlan";

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
    case "skipped":
      return 0;
  }
}

export function macrosForMeal(meal: PlannedMeal): DailyTargets {
  return mealMacrosWithBeverage(meal);
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
