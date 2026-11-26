import type { DailyTargets, MealSlotId, PlannedMeal } from "@/types";
import type { MealSource, MealSourceSlot, UserProfile } from "@/types/profile";

/** One-day changes by date: "Buy today" or "Cook this instead". The usual setting stays. */
export type SlotSourceOverrides = Record<string, Partial<Record<MealSourceSlot, "buy" | "cook">>>;

const KEEP_DAYS = 14;
const SOURCE_SLOTS: MealSourceSlot[] = ["breakfast", "lunch", "dinner"];

export function isSourceSlot(slot: MealSlotId): slot is MealSourceSlot {
  return (SOURCE_SLOTS as string[]).includes(slot);
}

function daysBefore(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Set or clear one override; dates more than 14 days before today are dropped. */
export function withSlotSourceOverride(
  overrides: SlotSourceOverrides,
  dateKey: string,
  slot: MealSourceSlot,
  source: "buy" | "cook" | null,
  todayKey: string,
): SlotSourceOverrides {
  const cutoff = daysBefore(todayKey, KEEP_DAYS);
  const next: SlotSourceOverrides = {};
  for (const [key, day] of Object.entries(overrides)) if (key >= cutoff) next[key] = { ...day };
  const day = { ...(next[dateKey] ?? {}) };
  if (source) day[slot] = source;
  else delete day[slot];
  if (Object.keys(day).length > 0) next[dateKey] = day;
  else delete next[dateKey];
  return next;
}

/** How this meal is gotten on this date: the one-day override, else the usual answer, else cook. */
export function effectiveMealSource(
  profile: Pick<UserProfile, "mealSources"> | null | undefined,
  overrides: SlotSourceOverrides | null | undefined,
  dateKey: string,
  slot: MealSlotId,
): MealSource {
  if (!isSourceSlot(slot)) return "cook";
  return overrides?.[dateKey]?.[slot] ?? profile?.mealSources?.[slot] ?? "cook";
}

export function isBoughtMeal(
  profile: Pick<UserProfile, "mealSources"> | null | undefined,
  overrides: SlotSourceOverrides | null | undefined,
  dateKey: string,
  slot: MealSlotId,
): boolean {
  return effectiveMealSource(profile, overrides, dateKey, slot) === "buy";
}

/** Meals that are cooked (bought meals add nothing to groceries or cook events). */
export function cookedMeals(
  meals: PlannedMeal[],
  profile: Pick<UserProfile, "mealSources"> | null | undefined,
  overrides: SlotSourceOverrides | null | undefined,
  dateKey: string,
): PlannedMeal[] {
  return meals.filter((m) => !isBoughtMeal(profile, overrides, dateKey, m.slot));
}

const roundTo = (n: number, step: number) => Math.max(step, Math.round(n / step) * step);

/** "Buying lunch? Aim for about 600 kcal and 40 g protein." */
export function boughtMealTargetText(slot: MealSourceSlot, target: Pick<DailyTargets, "calories" | "protein">): string {
  return `Buying ${slot}? Aim for about ${roundTo(target.calories, 10)} kcal and ${roundTo(target.protein, 5)} g protein.`;
}

export const BOUGHT_MEAL_GUIDE =
  "Pick a protein (Greek yogurt, jerky, eggs, milk, deli turkey), a carb (fruit, bread, crackers), and a vegetable if there's one.";
