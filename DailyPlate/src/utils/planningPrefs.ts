import type { KitchenEquipmentId, MealSlotId, Recipe, RecipeMealSlotId } from "@/types";
import type {
  IngredientVariety,
  MealsPerDay,
  MealTimingPreference,
  ProteinPreference,
  SnackStyle,
  UserProfile,
  WeeklyMealPrepRepeatCount,
} from "@/types/profile";
import {
  DEFAULT_PROTEIN_PREFERENCE,
  migrateProteinPreference,
  resolvedProteinGrams,
} from "@/utils/proteinMinimum";
import { getProteinSource, type ProteinSourceFilter } from "@/utils/recipeProteinSource";
import {
  resolveHouseholdCounts,
  syncHouseholdMembers,
} from "@/utils/household";

export { DEFAULT_PROTEIN_PREFERENCE };

export const MAIN_MEAL_SLOTS: RecipeMealSlotId[] = ["breakfast", "lunch", "dinner"];

export const SLOT_LABELS: Record<MealSlotId, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
  snack_2: "Snack 2",
  snack_3: "Snack 3",
};

export const PROTEIN_PREFERENCE_OPTIONS: { id: ProteinPreference; label: string }[] = [
  { id: "less", label: "Less" },
  { id: "recommended", label: "Recommended" },
  { id: "more", label: "More" },
];

export const KITCHEN_EQUIPMENT_OPTIONS: { id: KitchenEquipmentId; label: string }[] = [
  { id: "oven", label: "Oven" },
  { id: "stovetop", label: "Stovetop" },
  { id: "microwave", label: "Microwave" },
  { id: "air_fryer", label: "Air fryer" },
  { id: "slow_cooker", label: "Slow cooker" },
  { id: "instant_pot", label: "Instant Pot" },
  { id: "grill", label: "Grill" },
  { id: "blender", label: "Blender" },
  { id: "toaster_oven", label: "Toaster oven" },
];

export const PROTEIN_SOURCE_PREF_OPTIONS: { id: Exclude<ProteinSourceFilter, "all">; label: string }[] = [
  { id: "chicken", label: "Chicken" },
  { id: "turkey", label: "Turkey" },
  { id: "beef", label: "Beef" },
  { id: "seafood", label: "Seafood" },
  { id: "egg", label: "Eggs" },
  { id: "vegetarian", label: "Plant-based" },
];

export const DEFAULT_EATEN_MEALS: RecipeMealSlotId[] = ["breakfast", "lunch", "dinner"];
export const DEFAULT_SNACKS_PER_DAY = 1;
export const DEFAULT_SHOPPING_TRIPS = 1;
export const DEFAULT_COOKING_EVENTS = 4;
export const DEFAULT_LEFTOVER_STREAK = 3;
export const DEFAULT_INGREDIENT_VARIETY: IngredientVariety = "minimal";
export const DEFAULT_MAX_PREP_MINUTES = 30;
export const DEFAULT_SNACK_STYLE: SnackStyle = "both";
export const DEFAULT_KITCHEN_EQUIPMENT: KitchenEquipmentId[] = ["oven", "stovetop", "microwave"];
export const DEFAULT_WEEKLY_PREP_SLOT: MealSlotId = "dinner";

/** Cook events that still count as Low Complexity. */
const LOW_COMPLEXITY_MAX_COOKS = 5;
/** Cook events at or below this means one batch covers most of the week. */
const BATCH_COOK_THRESHOLD = 2;
/** Prep cap (min) at or below which we favor quick recipes. */
const MINIMAL_PREP_MINUTES = 30;

export function defaultEatenMeals(mealsPerDay: MealsPerDay | undefined): RecipeMealSlotId[] {
  if (mealsPerDay === "two") return ["lunch", "dinner"];
  return [...DEFAULT_EATEN_MEALS];
}

export function defaultSnacksPerDay(mealsPerDay: MealsPerDay | undefined): number {
  if (mealsPerDay === "three_snack" || mealsPerDay === "flexible") return 1;
  if (mealsPerDay === "two" || mealsPerDay === "three") return 0;
  return DEFAULT_SNACKS_PER_DAY;
}

export function mealsPerDayFromSelections(
  eatenMeals: RecipeMealSlotId[],
  snacksPerDay: number,
): MealsPerDay {
  const mains = eatenMeals.filter((s) => MAIN_MEAL_SLOTS.includes(s)).length;
  const snacks = Math.min(3, Math.max(0, snacksPerDay));
  if (mains <= 2 && snacks === 0) return "two";
  if (mains === 3 && snacks === 0) return "three";
  if (mains === 3 && snacks === 1) return "three_snack";
  return "flexible";
}

export function resolveEatenMeals(profile: UserProfile): RecipeMealSlotId[] {
  const raw = profile.eatenMeals?.filter((s) => MAIN_MEAL_SLOTS.includes(s));
  if (raw && raw.length > 0) return raw;
  return defaultEatenMeals(profile.mealsPerDay);
}

export function resolveSnacksPerDay(profile: UserProfile): number {
  if (profile.snacksPerDay != null && Number.isFinite(profile.snacksPerDay)) {
    return Math.min(3, Math.max(0, Math.round(profile.snacksPerDay)));
  }
  return defaultSnacksPerDay(profile.mealsPerDay);
}

export function slotsForLegacyMealsPerDay(m: MealsPerDay | undefined): MealSlotId[] {
  switch (m) {
    case "two":
      return ["lunch", "dinner"];
    case "three":
      return ["breakfast", "lunch", "dinner"];
    case "three_snack":
    case "flexible":
    default:
      return ["breakfast", "lunch", "dinner", "snack"];
  }
}

export function slotsForProfile(profile: UserProfile): MealSlotId[] {
  const mains = resolveEatenMeals(profile);
  const snackCount = resolveSnacksPerDay(profile);
  const snacks: MealSlotId[] = [];
  if (snackCount >= 1) snacks.push("snack");
  if (snackCount >= 2) snacks.push("snack_2");
  if (snackCount >= 3) snacks.push("snack_3");
  const wanted = new Set<MealSlotId>([...mains, ...snacks]);
  const order: MealSlotId[] = ["breakfast", "lunch", "dinner", "snack", "snack_2", "snack_3"];
  return order.filter((s) => wanted.has(s));
}

export function recipeSlotForPlanSlot(slot: MealSlotId): RecipeMealSlotId {
  if (slot === "snack_2" || slot === "snack_3") return "snack";
  return slot;
}

export function recipeFitsSlot(recipe: Recipe, slot: MealSlotId): boolean {
  return recipe.mealSlots.includes(recipeSlotForPlanSlot(slot));
}

export function isSnackPlanSlot(slot: MealSlotId): boolean {
  return slot === "snack" || slot === "snack_2" || slot === "snack_3";
}

export function cookingEventsPerWeek(profile: UserProfile): number {
  const n = profile.cookingEventsPerWeek;
  if (n == null || !Number.isFinite(n)) return DEFAULT_COOKING_EVENTS;
  return Math.min(7, Math.max(2, Math.round(n)));
}

export function leftoverStreakDays(profile: UserProfile): number {
  const n = profile.maxLeftoverStreakDays;
  if (n == null || !Number.isFinite(n)) return DEFAULT_LEFTOVER_STREAK;
  return Math.min(5, Math.max(1, Math.round(n)));
}

export function recipeMatchesSnackStyle(recipe: Recipe, style: SnackStyle | undefined): boolean {
  if (!style || style === "both") return true;
  const packaged = recipe.tags.includes("packaged");
  const whole = recipe.tags.includes("whole_food");
  if (style === "packaged") return packaged || !whole;
  return whole || !packaged;
}

export function recipeMatchesEquipment(
  recipe: Recipe,
  equipment: KitchenEquipmentId[] | undefined,
): boolean {
  if (!recipe.equipment?.length) return true;
  if (!equipment?.length) return true;
  const have = new Set(equipment);
  return recipe.equipment.some((item) => have.has(item));
}

export function recipeAvoidedByProteinSources(
  recipe: Recipe,
  avoided: string[] | undefined,
): boolean {
  if (!avoided?.length) return false;
  const source = getProteinSource(recipe);
  return avoided.includes(source);
}

export function planningDefaultsForNewProfile(): Pick<
  UserProfile,
  | "proteinPreference"
  | "shoppingTripsPerWeek"
  | "cookingEventsPerWeek"
  | "maxLeftoverStreakDays"
  | "ingredientVariety"
  | "maxPrepMinutes"
  | "snackStyle"
  | "kitchenEquipment"
  | "preferredProteinSources"
  | "avoidedProteinSources"
  | "prioritizeMinProtein"
  | "lowComplexityEnabled"
  | "prioritizeMinimalPrep"
  | "weeklyMealPrepEnabled"
  | "weeklyMealPrepSlot"
  | "weeklyMealPrepRepeatCount"
> {
  const cooking = deriveCookingFlags({
    cookingEventsPerWeek: DEFAULT_COOKING_EVENTS,
    maxLeftoverStreakDays: DEFAULT_LEFTOVER_STREAK,
    maxPrepMinutes: DEFAULT_MAX_PREP_MINUTES,
    weeklyMealPrepSlot: DEFAULT_WEEKLY_PREP_SLOT,
  });
  return {
    proteinPreference: DEFAULT_PROTEIN_PREFERENCE,
    shoppingTripsPerWeek: DEFAULT_SHOPPING_TRIPS,
    cookingEventsPerWeek: DEFAULT_COOKING_EVENTS,
    maxLeftoverStreakDays: DEFAULT_LEFTOVER_STREAK,
    ingredientVariety: DEFAULT_INGREDIENT_VARIETY,
    maxPrepMinutes: DEFAULT_MAX_PREP_MINUTES,
    snackStyle: DEFAULT_SNACK_STYLE,
    kitchenEquipment: [...DEFAULT_KITCHEN_EQUIPMENT],
    preferredProteinSources: [],
    avoidedProteinSources: [],
    prioritizeMinProtein: true,
    ...cooking,
  };
}

export type CookingPrefsInput = {
  cookingEventsPerWeek: number;
  maxLeftoverStreakDays: number;
  maxPrepMinutes: number | null;
  weeklyMealPrepSlot?: MealSlotId | null;
};

export type DerivedCookingFlags = Pick<
  UserProfile,
  | "lowComplexityEnabled"
  | "prioritizeMinimalPrep"
  | "weeklyMealPrepEnabled"
  | "weeklyMealPrepSlot"
  | "weeklyMealPrepRepeatCount"
>;

/**
 * Cook events / leftover streak / prep cap are the source of truth; the older
 * boolean flags are derived from them so the generator keeps working unchanged.
 */
export function deriveCookingFlags(input: CookingPrefsInput): DerivedCookingFlags {
  const cooks = Math.min(7, Math.max(2, Math.round(input.cookingEventsPerWeek)));
  const streak = Math.min(5, Math.max(1, Math.round(input.maxLeftoverStreakDays)));
  const batchCooking = cooks <= BATCH_COOK_THRESHOLD;
  return {
    lowComplexityEnabled: cooks <= LOW_COMPLEXITY_MAX_COOKS && streak >= 2,
    prioritizeMinimalPrep:
      input.maxPrepMinutes != null && input.maxPrepMinutes <= MINIMAL_PREP_MINUTES,
    weeklyMealPrepEnabled: batchCooking,
    weeklyMealPrepSlot: batchCooking
      ? (input.weeklyMealPrepSlot ?? DEFAULT_WEEKLY_PREP_SLOT)
      : null,
    weeklyMealPrepRepeatCount: Math.min(4, Math.max(2, streak)) as WeeklyMealPrepRepeatCount,
  };
}

/**
 * Fills fields missing from older or skipped-onboarding saves so every profile
 * behaves like a freshly onboarded one. Existing values always win.
 */
export function withPlanningDefaults(profile: UserProfile): UserProfile {
  const defaults = planningDefaultsForNewProfile();
  const proteinPreference = migrateProteinPreference(profile.proteinPreference);
  const cookingEventsPerWeek = profile.cookingEventsPerWeek ?? DEFAULT_COOKING_EVENTS;
  const maxLeftoverStreakDays = profile.maxLeftoverStreakDays ?? DEFAULT_LEFTOVER_STREAK;
  const maxPrepMinutes =
    profile.maxPrepMinutes === undefined ? DEFAULT_MAX_PREP_MINUTES : profile.maxPrepMinutes;
  const filled: UserProfile = {
    ...profile,
    eatenMeals: resolveEatenMeals(profile),
    snacksPerDay: resolveSnacksPerDay(profile),
    proteinPreference,
    shoppingTripsPerWeek: profile.shoppingTripsPerWeek ?? defaults.shoppingTripsPerWeek,
    cookingEventsPerWeek,
    maxLeftoverStreakDays,
    ingredientVariety: profile.ingredientVariety ?? defaults.ingredientVariety,
    maxPrepMinutes,
    snackStyle: profile.snackStyle ?? defaults.snackStyle,
    kitchenEquipment: profile.kitchenEquipment ?? defaults.kitchenEquipment,
    preferredProteinSources: profile.preferredProteinSources ?? [],
    avoidedProteinSources: profile.avoidedProteinSources ?? [],
    prioritizeMinProtein: profile.prioritizeMinProtein ?? defaults.prioritizeMinProtein,
    weeklyMealPrepSlot: profile.weeklyMealPrepSlot ?? defaults.weeklyMealPrepSlot,
    minimumProteinGrams: resolvedProteinGrams({
      ...profile,
      proteinPreference,
    }),
    householdMembers: (() => {
      const { adults, children } = resolveHouseholdCounts(profile);
      return syncHouseholdMembers(adults, children, profile.householdMembers);
    })(),
    householdFoodAvoidChips: profile.householdFoodAvoidChips ?? [],
    householdFoodAvoidCustom: profile.householdFoodAvoidCustom ?? "",
  };
  return {
    ...filled,
    ...deriveCookingFlags({
      cookingEventsPerWeek,
      maxLeftoverStreakDays,
      maxPrepMinutes,
      weeklyMealPrepSlot: filled.weeklyMealPrepSlot,
    }),
  };
}

/** Timing presets only make sense for meals the user actually eats. */
export function isMealTimingAllowed(
  timing: MealTimingPreference | null | undefined,
  eatenMeals: RecipeMealSlotId[],
): boolean {
  if (timing == null) return true;
  if (timing === "light_breakfast") return eatenMeals.includes("breakfast");
  if (timing === "bigger_dinner") return eatenMeals.includes("dinner");
  return true;
}
