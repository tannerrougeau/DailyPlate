import type { DailyTargets, DayMealTracking, MealTrackingEntry, PlannedMeal, Recipe } from "@/types";
import type { MealSourceSlot, UserProfile } from "@/types/profile";
import { recipeExcludedByDislikeChips } from "@/utils/chipMatching";
import { macrosForMeal, trackingMultiplier } from "@/utils/mealTracking";
import { ADD_ON_OPTIONS, type AddOnOption } from "@/utils/slotAddOns";
import { isNoCookRecipe } from "@/utils/recipeFit";

export { ADD_ON_NAMES, ADD_ON_OPTIONS, withSlotAddOns, type AddOnOption } from "@/utils/slotAddOns";

/** At least this many logged days before any suggestion. */
export const MIN_LOGGED_DAYS = 7;
/** At most one suggestion this often. */
export const NEXT_STEP_SPACING_DAYS = 7;
const LOOKBACK_DAYS = 21;
const DAY_MS = 24 * 60 * 60 * 1000;

export type DayLog = {
  dateKey: string;
  meals: PlannedMeal[];
  tracking?: DayMealTracking;
  snacks?: MealTrackingEntry[];
};

export type NextStep =
  | { kind: "slotAddOn"; slot: MealSourceSlot; gap: number; option: AddOnOption; text: string }
  | { kind: "easierMeal"; slot: MealSourceSlot; text: string }
  | { kind: "dropMeal"; slot: MealSourceSlot; text: string }
  | { kind: "addSnack"; kcal: number; text: string }
  | { kind: "openCheckIn"; kcal: number; text: string }
  | { kind: "prepLunch"; text: string };

const SLOTS: MealSourceSlot[] = ["breakfast", "lunch", "dinner"];
const PLURAL: Record<MealSourceSlot, string> = { breakfast: "breakfasts", lunch: "lunches", dinner: "dinners" };
const round = (n: number, step: number) => Math.round(n / step) * step;

function eatenAtSlot(meal: PlannedMeal, entry: MealTrackingEntry): { calories: number; protein: number } {
  if (entry.calories != null) return { calories: entry.calories, protein: entry.protein ?? 0 };
  const m = macrosForMeal(meal);
  const mult = trackingMultiplier(entry.status);
  return { calories: m.calories * mult, protein: m.protein * mult };
}

/** A day with at least one meal marked eaten or food logged. */
export function isLoggedDay(day: DayLog): boolean {
  const meals = Object.values(day.tracking ?? {}).some((e) => e && e.status !== "skipped");
  return meals || (day.snacks?.length ?? 0) > 0;
}

/** Logged days in the last 21 days before today, newest first. */
export function loggedDays(days: DayLog[], todayKey: string): DayLog[] {
  const start = new Date(`${todayKey}T12:00:00`).getTime() - LOOKBACK_DAYS * DAY_MS;
  return days
    .filter((d) => d.dateKey < todayKey && new Date(`${d.dateKey}T12:00:00`).getTime() >= start && isLoggedDay(d))
    .sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));
}

function firstAllowedAddOn(profile: UserProfile): AddOnOption | null {
  for (const o of ADD_ON_OPTIONS) {
    const probe = { name: o.item.name, cuisine: "", tags: [], ingredients: [o.item], instructions: [] } as unknown as Recipe;
    if (!recipeExcludedByDislikeChips(probe, profile.dislikedFoodChips ?? [], profile.dislikedFoodCustom ?? "")) return o;
  }
  return null;
}

type Scored = { step: NextStep; benefit: number; effort: number };

/**
 * The change with the most benefit for the least effort, from the last 7 logged days vs. targets.
 * Null before 7 logged days, or when nothing stands out. Wording is neutral.
 */
export function pickNextStep(input: {
  days: DayLog[];
  todayKey: string;
  targets: Pick<DailyTargets, "calories" | "protein">;
  profile: UserProfile;
  /** Lunch was bought on that date (usual setting or "Buy today"). */
  boughtLunch?: (dateKey: string) => boolean;
  /** The user said No to the easier version of this meal. */
  declinedEasier?: (slot: MealSourceSlot) => boolean;
}): NextStep | null {
  const { profile, targets } = input;
  const logged = loggedDays(input.days, input.todayKey);
  if (logged.length < MIN_LOGGED_DAYS) return null;
  const week = logged.slice(0, 7);
  const options: Scored[] = [];
  const eatenMeals = profile.eatenMeals ?? SLOTS;

  for (const slot of SLOTS) {
    const days = week.map((d) => ({ d, meal: d.meals.find((m) => m.slot === slot), entry: d.tracking?.[slot] }));

    // Often short on protein at this meal.
    if (!profile.slotAddOns?.[slot]?.length) {
      const gaps = days
        .filter((x) => x.meal && x.entry && x.entry.status !== "skipped")
        .map((x) => (x.meal!.portion?.target.protein ?? macrosForMeal(x.meal!).protein) - eatenAtSlot(x.meal!, x.entry!).protein);
      const short = gaps.filter((g) => g >= 10);
      const option = firstAllowedAddOn(profile);
      if (short.length >= 4 && option) {
        const gap = Math.round(short.reduce((a, b) => a + b, 0) / short.length);
        const closes = option.protein >= gap ? "would close the gap" : "would close most of the gap";
        options.push({
          step: {
            kind: "slotAddOn",
            slot,
            gap,
            option,
            text: `Your ${PLURAL[slot]} have been about ${round(gap, 5)} g short on protein most days. Adding ${option.label} ${closes}. Add it to your ${PLURAL[slot]}?`,
          },
          benefit: gap / Math.max(1, targets.protein),
          effort: 1,
        });
      }
    }

    // Often skipped: first offer an easier version; dropping the meal only after a No to that, or
    // when the skipped meals were already no-cook (keep at least one main meal).
    const skippedDays = days.filter((x) => x.meal && x.entry?.status === "skipped");
    const skipped = skippedDays.length;
    if (skipped >= 4 && eatenMeals.includes(slot)) {
      const alreadyNoCook =
        profile.easyMeals?.includes(slot) || skippedDays.every((x) => isNoCookRecipe(x.meal!.recipe));
      if (!alreadyNoCook && !input.declinedEasier?.(slot)) {
        options.push({
          step: {
            kind: "easierMeal",
            slot,
            text: `You've skipped ${slot} most days. Want quicker, no-cook ${PLURAL[slot]}?`,
          },
          benefit: skipped / 7,
          effort: 1,
        });
      } else if (eatenMeals.length > 1) {
        options.push({
          step: { kind: "dropMeal", slot, text: `You've skipped ${slot} on most days lately. Want plans without ${slot}?` },
          benefit: skipped / 7,
          effort: 1,
        });
      }
    }
  }

  // Daily calories consistently under or over.
  const totals = week.map((d) => {
    let kcal = (d.snacks ?? []).reduce((a, e) => a + (e.calories ?? 0), 0);
    for (const meal of d.meals) {
      const entry = d.tracking?.[meal.slot];
      if (entry && entry.status !== "skipped") kcal += eatenAtSlot(meal, entry).calories;
    }
    return kcal;
  });
  const under = totals.filter((k) => k < targets.calories * 0.9);
  const over = totals.filter((k) => k > targets.calories * 1.1);
  if (under.length >= 5 && (profile.snacksPerDay ?? 0) < 3) {
    const kcal = Math.max(100, round(under.reduce((a, k) => a + (targets.calories - k), 0) / under.length, 50));
    options.push({
      step: { kind: "addSnack", kcal, text: `Your days have been about ${kcal} kcal under your target most days. Want a planned snack of about ${kcal} kcal?` },
      benefit: kcal / targets.calories,
      effort: 1,
    });
  }
  if (over.length >= 5) {
    const kcal = round(over.reduce((a, k) => a + (k - targets.calories), 0) / over.length, 50);
    options.push({
      step: { kind: "openCheckIn", kcal, text: `Your days have been about ${kcal} kcal over your target most days. A check-in can update your target to match. Open a check-in?` },
      benefit: kcal / targets.calories,
      effort: 2,
    });
  }

  // Bigger shift, only for people who answered Some or Most for cooking.
  const cooks = profile.cookingAmount === "some" || profile.cookingAmount === "most";
  if (cooks && profile.mealSources?.lunch !== "prep") {
    const hard = week.filter((d) => d.tracking?.lunch?.status === "skipped" || input.boughtLunch?.(d.dateKey)).length;
    if (hard >= 4) {
      options.push({
        step: { kind: "prepLunch", text: "Lunch has been hard to plan for lately. Want to prep lunches for the week?" },
        benefit: hard / 7,
        effort: 3,
      });
    }
  }

  const best = options
    .filter((o) => o.benefit >= 0.08)
    .sort((a, b) => b.benefit / b.effort - a.benefit / a.effort)[0];
  return best?.step ?? null;
}

/** At most one suggestion a week. */
export function nextStepDue(lastAt: string | null | undefined, now: Date): boolean {
  return !lastAt || (now.getTime() - new Date(lastAt).getTime()) / DAY_MS >= NEXT_STEP_SPACING_DAYS;
}
