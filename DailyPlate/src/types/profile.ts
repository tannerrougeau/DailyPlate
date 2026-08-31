import type { MealSlotId } from "@/types";
import type { HouseholdPreset } from "@/utils/household";

export type { HouseholdPreset };

export type WeeklyMealPrepRepeatCount = 2 | 3 | 4;

export type BiologicalSex = "male" | "female" | "unspecified";

/** Relative plate size. Children default smaller than adults. */
export type PersonSize = "small" | "medium" | "large";

export type HouseholdMemberKind = "adult" | "child";

/** Optional per-person details for household portioning. */
export interface HouseholdMember {
  kind: HouseholdMemberKind;
  size?: PersonSize | null;
  age?: number | null;
  sex?: BiologicalSex | null;
}

export type MainGoal = "lose" | "maintain" | "gain" | "health";

export type MealsPerDay = "two" | "three" | "three_snack" | "flexible";

/** Optional fine-tuning */
export type MealTimingPreference = "light_breakfast" | "balanced" | "bigger_dinner";

export type ActivityLevel = "sedentary" | "light" | "moderate" | "very";

/** Remaining daily macros after protein target is met. */
export type MacroSplitPreference = "balanced" | "higher_carb" | "lower_carb";

export interface UserProfile {
  age: number;
  sex: BiologicalSex;
  heightCm: number;
  weightKg: number;
  goal: MainGoal;
  mealsPerDay: MealsPerDay;
  mealTiming: MealTimingPreference | null;
  favoriteFoodChips: string[];
  dislikedFoodChips: string[];
  /** Comma-separated extra favorites matched against recipe text. */
  favoriteFoodCustom?: string;
  /** Comma-separated extra avoids matched against recipe text. */
  dislikedFoodCustom?: string;
  /** Batch one lunch/dinner across multiple days when generating week/month. */
  weeklyMealPrepEnabled?: boolean;
  weeklyMealPrepSlot?: MealSlotId | null;
  weeklyMealPrepRepeatCount?: WeeklyMealPrepRepeatCount;
  /** null = use default moderate for basic plan until optional is completed */
  activityLevel: ActivityLevel | null;
  /** Portions to scale grocery / prep amounts (macros stay per individual). Omitted in legacy saves → single. */
  householdPreset?: HouseholdPreset;
  /** Whole people count when preset is `other`; otherwise null. */
  householdCustomCount?: number | null;
  /** Adult count for grocery / serving scale (default 2). Prefer over legacy preset. */
  householdAdults?: number;
  /** Child count 0–6 for grocery / serving scale (children default smaller than adults). */
  householdChildren?: number;
  /** Optional per-person size/age/gender. Length should match adults + children. */
  householdMembers?: HouseholdMember[];
  /** How to allocate calories after protein (default balanced). */
  macroSplitPreference?: MacroSplitPreference | null;
  /** User-provided maintenance TDEE (kcal); overrides formula when set. */
  knownTdeeKcal?: number | null;
  /** Prefer high-protein meals and redistribute macros to hit a daily protein floor. */
  prioritizeMinProtein?: boolean;
  /** Daily protein floor (g) when prioritizeMinProtein is enabled. */
  minimumProteinGrams?: number | null;
  /** ISO timestamp of most recent check-in submission. */
  lastCheckInAt?: string | null;
  /** Latest free-text experience note from check-in. */
  lastExperienceNotes?: string | null;
  /** Favor quick / minimal-prep recipes in meal generation. */
  prioritizeMinimalPrep?: boolean;
  /** Fewer cook events; batch leftovers and prefer simpler whole-food recipes. */
  lowComplexityEnabled?: boolean;
  /** Preferred cuisines for recipe weighting (e.g. mediterranean, asian). */
  preferredCuisines?: string[];
}
