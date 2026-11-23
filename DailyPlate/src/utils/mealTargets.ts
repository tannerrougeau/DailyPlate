import type { DailyTargets, MealSlotId } from "@/types";
import type { MealTimingPreference } from "@/types/profile";

/** Default share of the cooked-meal budget per slot, before normalizing to the slots eaten. */
const BASE_SHARES: Record<MealSlotId, number> = {
  breakfast: 0.25,
  lunch: 0.325,
  dinner: 0.325,
  snack: 0.1,
  snack_2: 0.1,
  snack_3: 0.1,
};

const TIMING_SHARES: Partial<Record<MealTimingPreference, Partial<Record<MealSlotId, number>>>> = {
  light_breakfast: { breakfast: 0.2, lunch: 0.35, dinner: 0.35 },
  bigger_dinner: { breakfast: 0.22, lunch: 0.28, dinner: 0.4 },
};

export type MacroKey = "calories" | "protein" | "carbs" | "fat" | "fiber";
const KEYS: MacroKey[] = ["calories", "protein", "carbs", "fat", "fiber"];

export type MealTargetSlot =
  | { slot: MealSlotId; kind: "cooked" }
  /** Packaged snack, locked or kept meal: counted at its own nutrition before splitting. */
  | { slot: MealSlotId; kind: "fixed"; nutrition: DailyTargets };

export function slotShare(slot: MealSlotId, timing: MealTimingPreference | null | undefined): number {
  const override = timing ? TIMING_SHARES[timing]?.[slot] : undefined;
  return override ?? BASE_SHARES[slot] ?? 0.1;
}

function whole(t: Partial<DailyTargets> | null | undefined, key: MacroKey): number {
  const v = t?.[key];
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 0;
}

/** Split an integer total by weights so the parts are integers that add up exactly (largest remainder). */
export function splitInteger(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (weights.length === 0) return [];
  if (!(sum > 0)) return weights.map((_, i) => (i === 0 ? total : 0));
  const exact = weights.map((w) => (total * w) / sum);
  const floors = exact.map(Math.floor);
  let left = total - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i]! += 1;
    left -= 1;
  }
  return floors;
}

/**
 * Per-slot targets for cooked meals. Drinks and fixed slots (packaged snacks, locked or kept meals)
 * come off the day first; the rest is split by slot share. Cooked targets + fixed + drinks add up to
 * the daily target exactly (in whole kcal and grams) unless fixed items already exceed it.
 */
export function splitMealTargets(input: {
  daily: DailyTargets;
  slots: MealTargetSlot[];
  drinks?: Partial<DailyTargets> | null;
  timing?: MealTimingPreference | null;
}): Partial<Record<MealSlotId, DailyTargets>> {
  const cooked = input.slots.filter((s) => s.kind === "cooked");
  const out: Partial<Record<MealSlotId, DailyTargets>> = {};
  if (cooked.length === 0) return out;
  const weights = cooked.map((s) => slotShare(s.slot, input.timing));
  const parts: Record<MacroKey, number[]> = {} as Record<MacroKey, number[]>;
  for (const key of KEYS) {
    const fixed = input.slots.reduce(
      (sum, s) => sum + (s.kind === "fixed" ? whole(s.nutrition, key) : 0),
      0,
    );
    const remaining = Math.max(0, whole(input.daily, key) - fixed - whole(input.drinks, key));
    parts[key] = splitInteger(remaining, weights);
  }
  cooked.forEach((s, i) => {
    out[s.slot] = {
      calories: parts.calories[i]!,
      protein: parts.protein[i]!,
      carbs: parts.carbs[i]!,
      fat: parts.fat[i]!,
      fiber: parts.fiber[i]!,
    };
  });
  return out;
}
