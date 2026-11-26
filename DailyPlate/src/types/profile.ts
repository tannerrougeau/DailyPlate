import type { KitchenEquipmentId, MealSlotId, RecipeMealSlotId } from "@/types";
import type { HouseholdPreset } from "@/utils/household";

export type { HouseholdPreset };

export type WeeklyMealPrepRepeatCount = 2 | 3 | 4;

export type BiologicalSex = "male" | "female" | "unspecified";

/** @deprecated Use OtherAdultSize / ChildAgeBand. Kept to migrate older saves. */
export type PersonSize = "small" | "medium" | "large";

export type HouseholdMemberKind = "adult" | "child";

/** Other adults vs the user. Default similar (1.0 × maintenance base). */
export type OtherAdultSize = "smaller" | "similar" | "larger";

/** Child age band. Default 4–8 (0.6 × maintenance base). */
export type ChildAgeBand = "1_3" | "4_8" | "9_13" | "14_18";

/** Optional per-person details for household portioning. */
export interface HouseholdMember {
  kind: HouseholdMemberKind;
  /** Other adults only. Owner (first adult) ignores this. */
  adultSize?: OtherAdultSize | null;
  /** Children only. Null means not set — use 4–8. */
  childAgeBand?: ChildAgeBand | null;
  /** @deprecated Migrated onto adultSize. */
  size?: PersonSize | null;
  /** @deprecated Migrated onto childAgeBand. */
  age?: number | null;
  /** @deprecated No longer used. */
  sex?: BiologicalSex | null;
}

export type MainGoal = "lose" | "maintain" | "gain" | "health";

export type MealsPerDay = "two" | "three" | "three_snack" | "flexible";

/** Optional fine-tuning */
export type MealTimingPreference = "light_breakfast" | "balanced" | "bigger_dinner";

export type ActivityLevel = "sedentary" | "light" | "moderate" | "very";

/** Remaining daily macros after protein target is met. */
export type MacroSplitPreference = "balanced" | "higher_carb" | "lower_carb";

export type ProteinPreference = "less" | "recommended" | "more";

export type IngredientVariety = "minimal" | "varied";

export type SnackStyle = "whole_food" | "packaged" | "both";

export type { KitchenEquipmentId };

/** How a meal is usually gotten ("fit your life" question 1). */
export type MealSource = "cook" | "prep" | "buy";
export type MealSourceSlot = "breakfast" | "lunch" | "dinner";
export type CookingAmount = "little" | "some" | "most";
export type BudgetPreference = "tight" | "moderate" | "flexible";
export type CookingLimit = "microwave_only" | "no_oven" | "short_time" | "little_chopping";
/** Per-meal size: Light is about 0.6x the default share, Large about 1.4x. */
export type MealSize = "light" | "normal" | "large";
export type MealSizes = Partial<Record<MealSourceSlot, MealSize>>;

export interface UserProfile {
  age: number;
  sex: BiologicalSex;
  heightCm: number;
  weightKg: number;
  goal: MainGoal;
  mealsPerDay: MealsPerDay;
  /** Which of breakfast / lunch / dinner they eat. */
  eatenMeals?: RecipeMealSlotId[];
  /** Extra snacks per day (0–3). */
  snacksPerDay?: number;
  /** Protein target style. Default recommended (goal-linked g/kg). */
  proteinPreference?: ProteinPreference | null;
  /** Grocery trips per week. Default 1. */
  shoppingTripsPerWeek?: number;
  /** Distinct cook events per week. Default 4 (the 3–5 band). */
  cookingEventsPerWeek?: number;
  /** Days in a row they will eat the same leftovers. Default 3. */
  maxLeftoverStreakDays?: number;
  /** Overlapping ingredients vs more variety. Default minimal. */
  ingredientVariety?: IngredientVariety;
  /** Cap on prep+cook minutes per cook event. */
  maxPrepMinutes?: number | null;
  snackStyle?: SnackStyle;
  preferredProteinSources?: string[];
  avoidedProteinSources?: string[];
  kitchenEquipment?: KitchenEquipmentId[];
  mealTiming: MealTimingPreference | null;
  /** Light / Normal / Large per meal. Older saves use mealTiming (see effectiveMealSizes). */
  mealSizes?: MealSizes;
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
  /** Optional per-person adult size / child age band. Length should match adults + children. */
  householdMembers?: HouseholdMember[];
  /** Household-wide allergies or dislikes, merged into generator exclusions. */
  householdFoodAvoidChips?: string[];
  householdFoodAvoidCustom?: string;
  /** How to allocate calories after protein (default balanced). */
  macroSplitPreference?: MacroSplitPreference | null;
  /** User-provided maintenance TDEE (kcal); overrides formula when set. */
  knownTdeeKcal?: number | null;
  /** Prefer high-protein meals and redistribute macros to hit a daily protein floor. */
  prioritizeMinProtein?: boolean;
  /** Daily protein floor (g) when prioritizeMinProtein is enabled. */
  minimumProteinGrams?: number | null;
  /** True when the user typed a protein minimum; otherwise it follows goal, weight and preference. */
  minimumProteinCustom?: boolean;
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
  /** "Fit your life" answers. Each is optional; unset keeps the default behavior. */
  mealSources?: Partial<Record<MealSourceSlot, MealSource>>;
  cookingAmount?: CookingAmount;
  budget?: BudgetPreference;
  cookingLimits?: CookingLimit[];
  /** Basic mode: no questions or suggestions; likes, dislikes and swaps still count. */
  basicMode?: boolean;
  /** Questions paused until this ISO date, or "indefinite" (until I resume). */
  questionsPausedUntil?: string | null;
  /** Meals switched to quicker, no-cook versions by a "next best step" Yes. */
  easyMeals?: MealSourceSlot[];
  /** Fixed add-ons per meal from a "next best step" Yes (e.g. a Greek yogurt at breakfast). */
  slotAddOns?: Partial<Record<RecipeMealSlotId, import("@/types").RecipeIngredient[]>>;
}
