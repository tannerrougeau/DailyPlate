import type { MealSlotId } from "@/types";

export function mealLockKey(dateKey: string, slot: MealSlotId): string {
  return `${dateKey}:${slot}`;
}

export function isMealLocked(
  lockedMeals: string[],
  dateKey: string,
  slot: MealSlotId,
): boolean {
  return lockedMeals.includes(mealLockKey(dateKey, slot));
}
