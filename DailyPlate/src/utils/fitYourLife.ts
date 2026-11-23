import type {
  BudgetPreference,
  CookingAmount,
  CookingLimit,
  MealSource,
  MealSourceSlot,
  UserProfile,
} from "@/types/profile";
import { deriveCookingFlags } from "@/utils/planningPrefs";

/** The four optional "fit your life" answers. Unset = today's behavior. */
export type FitAnswers = Pick<UserProfile, "mealSources" | "cookingAmount" | "budget" | "cookingLimits">;

export const MEAL_SOURCE_OPTIONS: { id: MealSource; label: string }[] = [
  { id: "cook", label: "Cook" },
  { id: "prep", label: "Meal prep" },
  { id: "buy", label: "Buy (store, cafeteria or restaurant)" },
];
export const MEAL_SOURCE_SLOTS: MealSourceSlot[] = ["breakfast", "lunch", "dinner"];

export const COOKING_AMOUNT_OPTIONS: { id: CookingAmount; label: string }[] = [
  { id: "little", label: "Very little" },
  { id: "some", label: "Some" },
  { id: "most", label: "Most meals" },
];

export const BUDGET_OPTIONS: { id: BudgetPreference; label: string }[] = [
  { id: "tight", label: "Tight" },
  { id: "moderate", label: "Moderate" },
  { id: "flexible", label: "Flexible" },
];

export const COOKING_LIMIT_OPTIONS: { id: CookingLimit; label: string }[] = [
  { id: "microwave_only", label: "Microwave only" },
  { id: "no_oven", label: "No oven" },
  { id: "short_time", label: "Short on time" },
  { id: "little_chopping", label: "Prefer little chopping or standing" },
];

/** Cooking amount sets cook events and the prep-time cap (not the display or complexity tiers). */
export const COOKING_AMOUNT_DEFAULTS: Record<CookingAmount, { cookingEventsPerWeek: number; maxPrepMinutes: number | null }> = {
  little: { cookingEventsPerWeek: 2, maxPrepMinutes: 20 },
  some: { cookingEventsPerWeek: 4, maxPrepMinutes: 40 },
  most: { cookingEventsPerWeek: 6, maxPrepMinutes: null },
};

/**
 * "Meal prep" for lunch or dinner turns on the weekly batch for that slot (lunch first when both);
 * with both, dinner leftovers run at least 3 days.
 */
export function withMealSourcePlan(profile: UserProfile): UserProfile {
  const sources = profile.mealSources ?? {};
  const lunch = sources.lunch === "prep";
  const dinner = sources.dinner === "prep";
  if (!lunch && !dinner) return profile;
  return {
    ...profile,
    weeklyMealPrepEnabled: true,
    weeklyMealPrepSlot: lunch ? "lunch" : "dinner",
    maxLeftoverStreakDays: lunch && dinner ? Math.max(3, profile.maxLeftoverStreakDays ?? 3) : profile.maxLeftoverStreakDays,
  };
}

/** Apply answers: store them, set cooking fields from the cooking amount, then meal-prep slots. */
export function applyFitAnswers(profile: UserProfile, answers: FitAnswers): UserProfile {
  let next: UserProfile = { ...profile, ...answers };
  const amount = answers.cookingAmount;
  if (amount && amount !== profile.cookingAmount) {
    const d = COOKING_AMOUNT_DEFAULTS[amount];
    next = { ...next, ...d };
    next = {
      ...next,
      ...deriveCookingFlags({
        cookingEventsPerWeek: d.cookingEventsPerWeek,
        maxLeftoverStreakDays: next.maxLeftoverStreakDays ?? 3,
        maxPrepMinutes: d.maxPrepMinutes,
        weeklyMealPrepSlot: next.weeklyMealPrepSlot ?? null,
      }),
    };
  }
  return withMealSourcePlan(next);
}
