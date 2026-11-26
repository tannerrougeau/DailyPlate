import type { DailyTargets, MealSlotId } from "@/types";
import type { MealSize, MealSizes, MealSourceSlot, MealTimingPreference, UserProfile } from "@/types/profile";

/** Default share of the day per slot when every meal is eaten (adds to 1 with one snack). */
const BASE_SHARES: Record<MealSlotId, number> = {
  breakfast: 0.25,
  lunch: 0.325,
  dinner: 0.325,
  snack: 0.1,
  snack_2: 0.1,
  snack_3: 0.1,
};

export const MAIN_MEALS: MealSourceSlot[] = ["breakfast", "lunch", "dinner"];
export const SIZE_MULTIPLIER: Record<MealSize, number> = { light: 0.6, normal: 1, large: 1.4 };
/** When a main meal is skipped, each snack is filled up to this before the main meals get the rest. */
export const SNACK_FILL_KCAL = 400;
/** Light meals take this weight when extra calories are shared out (Normal and Large take 1). */
const LIGHT_EXTRA_WEIGHT = 0.5;
/** Each main meal keeps at least this much protein when the day allows it. */
export const MAIN_MEAL_MIN_PROTEIN = 20;

export type MacroKey = "calories" | "protein" | "carbs" | "fat" | "fiber";
const KEYS: MacroKey[] = ["calories", "protein", "carbs", "fat", "fiber"];

export type MealTargetSlot =
  | { slot: MealSlotId; kind: "cooked"; /** "Size today" (0.5 or 0.75); omitted = normal. */ daySize?: number }
  /** Packaged snack, locked, kept or eaten meal: counted at its own nutrition before splitting. */
  | { slot: MealSlotId; kind: "fixed"; nutrition: DailyTargets };

const isMain = (slot: MealSlotId): slot is MealSourceSlot =>
  slot === "breakfast" || slot === "lunch" || slot === "dinner";
const isSnack = (slot: MealSlotId) => !isMain(slot);

/** Per-meal sizes, reading older saves' meal timing (light breakfast / bigger dinner). */
export function effectiveMealSizes(
  profile: Pick<UserProfile, "mealSizes" | "mealTiming"> | null | undefined,
): MealSizes {
  return { ...sizesFromTiming(profile?.mealTiming), ...(profile?.mealSizes ?? {}) };
}

export function sizesFromTiming(timing: MealTimingPreference | null | undefined): MealSizes {
  if (timing === "light_breakfast") return { breakfast: "light" };
  if (timing === "bigger_dinner") return { dinner: "large" };
  return {};
}

/**
 * Share of the day for each slot present (adds to 1).
 * 1. Base shares, with Light (0.6x) and Large (1.4x) on main meals.
 * 2. What's left over (skipped meals, Light meals) goes first to snacks when a main meal is skipped,
 *    filling each snack up to 400 kcal, then to the main meals eaten, weighted toward meals not
 *    marked Light. More than the whole day (extra snacks, Large) scales everything down evenly.
 */
export function slotShares(
  slots: MealSlotId[],
  opts: { sizes?: MealSizes; dailyKcal?: number } = {},
): Partial<Record<MealSlotId, number>> {
  const sizes = opts.sizes ?? {};
  const share: Partial<Record<MealSlotId, number>> = {};
  for (const slot of slots) {
    const mult = isMain(slot) ? SIZE_MULTIPLIER[sizes[slot] ?? "normal"] : 1;
    share[slot] = (BASE_SHARES[slot] ?? 0.1) * mult;
  }
  const sum = slots.reduce((a, s) => a + share[s]!, 0);
  if (!(sum > 0)) return share;
  let pool = 1 - sum;
  if (pool <= 1e-9) {
    for (const s of slots) share[s] = share[s]! / sum;
    return share;
  }
  const mains = slots.filter(isMain);
  const snacks = slots.filter(isSnack);
  const mainSkipped = MAIN_MEALS.some((m) => !slots.includes(m));
  const kcal = opts.dailyKcal && opts.dailyKcal > 0 ? opts.dailyKcal : null;
  if (mainSkipped && kcal && mains.length > 0) {
    const fill = SNACK_FILL_KCAL / kcal;
    for (const s of snacks) {
      const add = Math.min(pool, Math.max(0, fill - share[s]!));
      share[s] = share[s]! + add;
      pool -= add;
    }
  }
  const receivers = mains.length > 0 ? mains : snacks;
  const weights = receivers.map(
    (s) => share[s]! * (isMain(s) && sizes[s] === "light" ? LIGHT_EXTRA_WEIGHT : 1),
  );
  const wsum = weights.reduce((a, b) => a + b, 0);
  receivers.forEach((s, i) => {
    share[s] = share[s]! + (wsum > 0 ? (pool * weights[i]!) / wsum : pool / receivers.length);
  });
  return share;
}

/** @deprecated Kept for callers that only know the timing preset. */
export function slotShare(slot: MealSlotId, timing: MealTimingPreference | null | undefined): number {
  const mult = isMain(slot) ? SIZE_MULTIPLIER[sizesFromTiming(timing)[slot] ?? "normal"] : 1;
  return (BASE_SHARES[slot] ?? 0.1) * mult;
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
 * Per-slot targets for cooked meals. Drinks and fixed slots (packaged snacks, locked, kept or eaten
 * meals) come off the day first; the rest is split by each slot's share (see slotShares).
 *
 * "Size today": a meal with daySize gets that fraction of its target; the removed amount moves to
 * the day's other cooked meals that aren't sized, or is dropped (the day ends lower) when none are.
 *
 * Without daySize, cooked targets + fixed + drinks add up to the daily target exactly (whole kcal
 * and grams) unless fixed items already exceed it.
 */
export function splitMealTargets(input: {
  daily: DailyTargets;
  slots: MealTargetSlot[];
  drinks?: Partial<DailyTargets> | null;
  /** Older saves; use `sizes` instead. */
  timing?: MealTimingPreference | null;
  sizes?: MealSizes;
}): Partial<Record<MealSlotId, DailyTargets>> {
  const cooked = input.slots.filter((s) => s.kind === "cooked");
  const out: Partial<Record<MealSlotId, DailyTargets>> = {};
  if (cooked.length === 0) return out;
  const sizes = { ...sizesFromTiming(input.timing), ...(input.sizes ?? {}) };
  const shares = slotShares(
    input.slots.map((s) => s.slot),
    { sizes, dailyKcal: whole(input.daily, "calories") },
  );
  const weights = cooked.map((s) => shares[s.slot] ?? 0);
  const parts: Record<MacroKey, number[]> = {} as Record<MacroKey, number[]>;
  for (const key of KEYS) {
    const fixed = input.slots.reduce(
      (sum, s) => sum + (s.kind === "fixed" ? whole(s.nutrition, key) : 0),
      0,
    );
    const remaining = Math.max(0, whole(input.daily, key) - fixed - whole(input.drinks, key));
    parts[key] = splitInteger(remaining, weights);
  }

  // "Size today": move the removed part to open (unsized) cooked meals, or drop it.
  const sizeOf = (i: number) => {
    const d = (cooked[i] as { daySize?: number }).daySize;
    return typeof d === "number" && d > 0 && d < 1 ? d : 1;
  };
  const open = cooked.map((_, i) => i).filter((i) => sizeOf(i) === 1);
  for (const key of KEYS) {
    const arr = parts[key];
    let removed = 0;
    cooked.forEach((_, i) => {
      const f = sizeOf(i);
      if (f === 1) return;
      const keep = Math.round(arr[i]! * f);
      removed += arr[i]! - keep;
      arr[i] = keep;
    });
    if (removed > 0 && open.length > 0) {
      const add = splitInteger(removed, open.map((i) => weights[i]!));
      open.forEach((i, j) => (arr[i] = arr[i]! + add[j]!));
    }
  }

  // Protein floor: each main meal keeps ~20 g when another cooked meal can spare it.
  const prot = parts.protein;
  cooked.forEach((s, i) => {
    if (!isMain(s.slot) || prot[i]! >= MAIN_MEAL_MIN_PROTEIN) return;
    let need = MAIN_MEAL_MIN_PROTEIN - prot[i]!;
    const donors = cooked
      .map((_, j) => j)
      .filter((j) => j !== i && isMain(cooked[j]!.slot))
      .sort((a, b) => prot[b]! - prot[a]!);
    for (const j of donors) {
      const spare = Math.max(0, prot[j]! - MAIN_MEAL_MIN_PROTEIN);
      const take = Math.min(spare, need);
      prot[j] = prot[j]! - take;
      prot[i] = prot[i]! + take;
      need -= take;
      if (need <= 0) break;
    }
  });

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

const SLOT_WORD: Record<MealSourceSlot, string> = { breakfast: "breakfast", lunch: "lunch", dinner: "dinner" };

function joinWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/**
 * One line for Today when meal sizes or skipped meals change how the day is split, e.g.
 * "Light breakfast and no lunch: more of today goes to your snack and dinner." Null otherwise.
 */
export function mealShareNote(slots: MealSlotId[], sizes: MealSizes): string | null {
  const causes: string[] = [];
  const skipped = MAIN_MEALS.filter((m) => !slots.includes(m));
  const presentMains = MAIN_MEALS.filter((m) => slots.includes(m));
  for (const m of presentMains) {
    if (sizes[m] === "light") causes.push(`light ${SLOT_WORD[m]}`);
    if (sizes[m] === "large") causes.push(`large ${SLOT_WORD[m]}`);
  }
  for (const m of skipped) causes.push(`no ${SLOT_WORD[m]}`);
  if (causes.length === 0 || presentMains.length === 0) return null;
  // Only Large meals (nothing light or skipped): those meals simply get more.
  const onlyLarge = causes.every((c) => c.startsWith("large"));
  const gainers: string[] = [];
  if (onlyLarge) {
    gainers.push(...presentMains.filter((m) => sizes[m] === "large").map((m) => SLOT_WORD[m]));
  } else {
    const snackCount = slots.filter(isSnack).length;
    if (skipped.length > 0 && snackCount > 0) gainers.push(snackCount > 1 ? "snacks" : "snack");
    gainers.push(...presentMains.filter((m) => sizes[m] !== "light").map((m) => SLOT_WORD[m]));
  }
  if (gainers.length === 0) return null;
  const cause = joinWords(causes);
  return `${cause.charAt(0).toUpperCase()}${cause.slice(1)}: more of today goes to your ${joinWords(gainers)}.`;
}
