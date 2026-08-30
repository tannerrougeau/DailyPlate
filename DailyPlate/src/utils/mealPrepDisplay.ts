import type { PlannedMeal } from "@/types";

/** Leftover portion from low-complexity batch cooking (not the original cook day). */
export function isLowComplexityLeftover(meal: PlannedMeal): boolean {
  return (
    meal.mealPrep?.source === "low_complexity" &&
    (meal.mealPrep.portionIndex ?? 1) > 1 &&
    meal.slot !== "breakfast"
  );
}

export function isMealPrepBatchBadge(meal: PlannedMeal): boolean {
  if (!meal.mealPrep) return false;
  if (meal.mealPrep.source === "low_complexity") return false;
  return true;
}
