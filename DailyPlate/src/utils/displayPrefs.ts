import type { IngredientVariety, WeeklyMealPrepRepeatCount } from "@/types/profile";

/** Optional display elements, each with its own switch. Core actions are always shown. */
export type DisplayElement =
  | "cardMacros"
  | "cardFiber"
  | "progressMacros"
  | "nutritionDetails"
  | "micronutrients"
  | "servingLine"
  | "adjustGrams"
  | "weighBatch"
  | "prepTips"
  | "mealPrepNotes"
  | "drinkPicker"
  | "recipeChoices"
  | "macroSplitSetting"
  | "insightBanners";

export type DisplayPrefs = Record<DisplayElement, boolean>;

export const DISPLAY_ELEMENTS: { id: DisplayElement; label: string }[] = [
  { id: "cardMacros", label: "Carbs and fat on meal cards" },
  { id: "cardFiber", label: "Fiber on meal cards" },
  { id: "progressMacros", label: "Carbs, fat and fiber bars on Today" },
  { id: "nutritionDetails", label: "Full nutrition breakdown in recipe details" },
  { id: "micronutrients", label: "Micronutrients in recipe details" },
  { id: "servingLine", label: "\"Your serving\" line on meal cards" },
  { id: "adjustGrams", label: "Grams option when adjusting servings" },
  { id: "weighBatch", label: "Weigh your batch" },
  { id: "prepTips", label: "Prep tips (measure oil, drain fat…)" },
  { id: "mealPrepNotes", label: "Meal-prep storage notes" },
  { id: "drinkPicker", label: "Drink picker on meal cards" },
  { id: "recipeChoices", label: "Variation, carb-base and cooking-fat choices" },
  { id: "macroSplitSetting", label: "Carb/fat split setting" },
  { id: "insightBanners", label: "Smart-adjustment and insight banners" },
];

const ALL_ON: DisplayPrefs = Object.fromEntries(DISPLAY_ELEMENTS.map((e) => [e.id, true])) as DisplayPrefs;

/**
 * Starting point:
 * - basic: went straight through onboarding;
 * - detailed: changed any refine card on the summary step;
 * - existing: profiles from before display settings existed keep everything they saw.
 */
export function startingDisplayPrefs(kind: "basic" | "detailed" | "existing"): DisplayPrefs {
  if (kind === "existing") return { ...ALL_ON };
  if (kind === "detailed") return { ...ALL_ON, micronutrients: false };
  return {
    ...ALL_ON,
    cardMacros: false,
    cardFiber: false,
    progressMacros: false,
    micronutrients: false,
    adjustGrams: false,
    weighBatch: false,
    prepTips: false,
    macroSplitSetting: false,
  };
}

/** Saved prefs, filling any missing switch from the "existing user" start (nothing disappears). */
export function resolveDisplayPrefs(stored: Partial<DisplayPrefs> | null | undefined): DisplayPrefs {
  return { ...startingDisplayPrefs("existing"), ...(stored ?? {}) };
}

/** Every optional element off. Core actions stay. */
export function simplestView(): DisplayPrefs {
  return Object.fromEntries(DISPLAY_ELEMENTS.map((e) => [e.id, false])) as DisplayPrefs;
}

/** What a checkpoint can change and restore. */
export type CheckpointState = {
  displayPrefs?: DisplayPrefs;
  dislikedFoodCustom?: string;
  ingredientVariety?: IngredientVariety;
  /** Weekly meal-prep batch length (days). */
  weeklyMealPrepRepeatCount?: WeeklyMealPrepRepeatCount;
  /** Longest run of planned leftovers (days). */
  maxLeftoverStreakDays?: number;
  /** Plan settings changed from a check-in question. */
  planSettings?: PlanSettings;
  /** Food preferences changed from a like-pattern or avoid-conflict question. */
  preferredCuisines?: string[];
  favoriteFoodCustom?: string;
  dislikedFoodChips?: string[];
  /** Plan fields changed by a "next best step" Yes (add-ons, meals, snacks, meal sources). */
  profile?: NextStepProfileFields;
};

/** Profile fields a "next best step" can change (and a checkpoint can restore). */
export type NextStepProfileFields = Partial<
  Pick<
    import("@/types/profile").UserProfile,
    | "slotAddOns"
    | "easyMeals"
    | "eatenMeals"
    | "snacksPerDay"
    | "mealsPerDay"
    | "mealSources"
    | "weeklyMealPrepEnabled"
    | "weeklyMealPrepSlot"
  >
>;

/** Plan settings a check-in question can turn on (and a checkpoint can restore). */
export type PlanSettings = {
  prioritizeMinProtein?: boolean;
  weeklyMealPrepEnabled?: boolean;
  weeklyMealPrepSlot?: import("@/types").MealSlotId | null;
  weeklyMealPrepRepeatCount?: WeeklyMealPrepRepeatCount;
  prioritizeMinimalPrep?: boolean;
};

export type Checkpoint = {
  id: string;
  at: string;
  /** Short description of what changed. */
  what: string;
  /** Why it changed (question answered, Settings, Restore…). */
  why: string;
  before: CheckpointState;
  after: CheckpointState;
};
