import type { DailyTargets, KitchenEquipmentId, PlannedMeal, Recipe, MealSlotId } from "@/types";
import type {
  IngredientVariety,
  MealTimingPreference,
  MealsPerDay,
  SnackStyle,
  UserProfile,
} from "@/types/profile";
import { recipeExcludedByDislikeChips, recipeFavoriteBoost } from "@/utils/chipMatching";
import type { PersonalizationSignals } from "@/utils/personalizationEngine";
import { recipePersonalizationBoost } from "@/utils/personalizationEngine";
import { proteinDensity, recipeFitForTarget } from "@/utils/macroRedistribution";
import {
  isSnackPlanSlot,
  recipeFitsSlot,
  recipeMatchesEquipment,
  recipeMatchesSnackStyle,
  recipeAvoidedByProteinSources,
  slotsForLegacyMealsPerDay,
  slotsForProfile,
} from "@/utils/planningPrefs";
import { getProteinSource } from "@/utils/recipeProteinSource";
import { createPlannedMeal } from "@/utils/recipeDisplay";
import { pickPreferredVariationId } from "@/utils/variationPrefs";
import {
  budgetWeight,
  cheapestCost,
  isEasyMealRecipe,
  isNoCookRecipe,
  median,
  MIN_OPTIONS_PER_SLOT,
  passesEffortLimits,
  passesEquipmentLimits,
} from "@/utils/recipeFit";
import type { BudgetPreference, CookingLimit } from "@/types/profile";
import { isBeverageRecipe, mealMacrosWithBeverage } from "@/utils/beverages";

export { isBeverageRecipe } from "@/utils/beverages";
export { recipeFitsSlot } from "@/utils/planningPrefs";

export function slotsForMealsPerDay(
  m: MealsPerDay | UserProfile | undefined | null,
): MealSlotId[] {
  if (m && typeof m === "object") return slotsForProfile(m);
  return slotsForLegacyMealsPerDay(m ?? "three");
}

function timingBoost(
  recipe: Recipe,
  slot: MealSlotId,
  timing: MealTimingPreference | null,
): number {
  if (!timing) return 0;
  if (timing === "light_breakfast" && slot === "breakfast") {
    return recipe.calories < 360 ? 22 : -8;
  }
  if (timing === "bigger_dinner" && slot === "dinner") {
    return recipe.calories > 500 ? 22 : 4;
  }
  if (timing === "balanced") return 4;
  return 0;
}

function recipeWeight(
  recipe: Recipe,
  slot: MealSlotId,
  options: GenerateOptions,
): number {
  let w = 12;
  if (options.favoriteIds.includes(recipe.id)) w += 38;
  if (preppedBreakfast(recipe, slot, options)) w += 40;
  w += recipeFavoriteBoost(recipe, options.favoriteChips, options.favoriteCustom);
  w += timingBoost(recipe, slot, options.mealTiming);
  if (options.prioritizeMinProtein) {
    w += proteinDensity(recipe) * 140;
    if (recipe.tags.includes("high_protein")) w += 24;
  }
  if (options.personalization) {
    w += recipePersonalizationBoost(
      recipe,
      slot,
      options.personalization.profile,
      options.personalization.signals,
      options.favoriteIds,
    );
  }
  if (options.lowComplexity) {
    if (recipe.tags.includes("whole_food")) w += 20;
    if (recipe.tags.includes("quick")) w += 18;
    if (recipe.tags.includes("meal_prep")) w += 16;
    if (recipe.tags.includes("batch_friendly")) w += 16;
    if (recipe.prepMinutes + recipe.cookMinutes <= 30) w += 8;
  }
  if (options.maxPrepMinutes != null) {
    const total = recipe.prepMinutes + recipe.cookMinutes;
    if (total <= options.maxPrepMinutes) w += 16;
    else w -= 20;
  }
  if (isSnackPlanSlot(slot) && options.snackStyle && options.snackStyle !== "both") {
    if (recipeMatchesSnackStyle(recipe, options.snackStyle)) w += 24;
    else w -= 30;
  }
  const preferred = options.preferredProteinSources ?? [];
  if (preferred.length > 0 && preferred.includes(getProteinSource(recipe))) {
    w += 28;
  }
  if (options.ingredientVariety === "minimal" && options.pickedIngredientNames?.size) {
    const names = recipe.ingredients.map((i) => i.name.toLowerCase());
    const overlap = names.filter((n) => options.pickedIngredientNames!.has(n)).length;
    w += overlap * 8;
  }
  if (options.ingredientVariety === "varied" && options.pickedIngredientNames?.size) {
    const names = recipe.ingredients.map((i) => i.name.toLowerCase());
    const overlap = names.filter((n) => options.pickedIngredientNames!.has(n)).length;
    w -= overlap * 4;
  }
  // Prefer recipes whose portions can reach this slot's target; misses stay possible for small pools.
  const slotTarget = options.slotTargets?.[slot];
  if (slotTarget && !recipeFitForTarget(recipe, slotTarget).fits) {
    return Math.max(1, w) * 0.08;
  }
  return Math.max(1, w);
}

function weightedPick(recipes: Recipe[], weight: (r: Recipe) => number): Recipe | undefined {
  if (recipes.length === 0) return undefined;
  const weights = recipes.map(weight);
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < recipes.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return recipes[i];
  }
  return recipes[recipes.length - 1];
}

function isRecipeAllowed(
  recipe: Recipe,
  dislikedIds: Set<string>,
  dislikedChips: string[],
  dislikedCustom: string,
  options?: GenerateOptions,
  slot?: MealSlotId,
): boolean {
  if (isBeverageRecipe(recipe)) return false;
  if (dislikedIds.has(recipe.id)) return false;
  if (recipeExcludedByDislikeChips(recipe, dislikedChips, dislikedCustom)) return false;
  if (options && recipeAvoidedByProteinSources(recipe, options.avoidedProteinSources)) return false;
  if (options && !recipeMatchesEquipment(recipe, options.kitchenEquipment)) return false;
  if (options && !passesEquipmentLimits(recipe, options.cookingLimits)) return false;
  if (
    options &&
    slot &&
    isSnackPlanSlot(slot) &&
    options.snackStyle &&
    options.snackStyle !== "both" &&
    !recipeMatchesSnackStyle(recipe, options.snackStyle)
  ) {
    return false;
  }
  if (options?.maxPrepMinutes != null) {
    const total = recipe.prepMinutes + recipe.cookMinutes;
    if (total > options.maxPrepMinutes && !recipe.tags.includes("packaged")) {
      return false;
    }
  }
  return true;
}

export interface GenerateOptions {
  dislikedIds: string[];
  dislikedChips: string[];
  dislikedCustom: string;
  favoriteIds: string[];
  favoriteChips: string[];
  favoriteCustom: string;
  slots: MealSlotId[];
  mealTiming: MealTimingPreference | null;
  prioritizeMinProtein: boolean;
  minimumProteinGrams: number | null;
  /** When true, prefer simpler recipes and plan leftovers across the week. */
  lowComplexity?: boolean;
  snackStyle?: SnackStyle;
  maxPrepMinutes?: number | null;
  preferredProteinSources?: string[];
  avoidedProteinSources?: string[];
  kitchenEquipment?: KitchenEquipmentId[];
  ingredientVariety?: IngredientVariety;
  pickedIngredientNames?: Set<string>;
  personalization?: {
    profile: import("@/types/profile").UserProfile;
    signals: PersonalizationSignals;
  };
  /** Per-slot meal targets; picks that can be portioned to fit are preferred. */
  slotTargets?: Partial<Record<MealSlotId, DailyTargets>>;
  /** "Anything that limits cooking?" Equipment limits are hard; time and chopping can soften. */
  cookingLimits?: CookingLimit[];
  /** Tight and Moderate rank by estimated cost per serving (cheapest variation). */
  budget?: BudgetPreference;
}

/** Goal portions are applied when the day is saved (see applyGoalPortions), so picks start at scale 1. */
function toPlannedMeals(
  raw: { slot: MealSlotId; recipe: Recipe; variationId?: string }[],
): PlannedMeal[] {
  return raw.map(({ slot, recipe, variationId }) => ({
    ...createPlannedMeal(slot, recipe, { scale: 1, selectedVariationId: variationId }),
    generated: true,
  }));
}

/**
 * Weighted picks per slot; excludes disliked ids and chip rules; boosts favorites.
 */
export function generateDayPlan(
  recipes: Recipe[],
  options: GenerateOptions,
): PlannedMeal[] {
  const used = new Set<string>();
  const raw: { slot: MealSlotId; recipe: Recipe; variationId?: string }[] = [];

  const live: GenerateOptions = {
    ...options,
    pickedIngredientNames: new Set(options.pickedIngredientNames),
  };

  for (const slot of live.slots) {
    const recipe = pickSlotRecipe(recipes, slot, live, used);
    if (!recipe) continue;
    used.add(recipe.id);
    rememberIngredients(live, recipe);
    raw.push({
      slot,
      recipe,
      variationId: pickPreferredVariationId(
        recipe,
        slot,
        live.dislikedChips,
        live.dislikedCustom,
        live.snackStyle,
        live.budget,
      ),
    });
  }

  return toPlannedMeals(raw);
}

function rememberIngredients(options: GenerateOptions, recipe: Recipe) {
  const names = options.pickedIngredientNames ?? new Set<string>();
  for (const ing of recipe.ingredients) names.add(ing.name.toLowerCase());
  options.pickedIngredientNames = names;
}

/**
 * Recent-repeat limit: a recipe planned on this many days (7 back to 7 ahead) is left out when
 * other options exist. Favorites get one more; a "meals felt repetitive" check-in lowers it to 1.
 */
export function repeatLimitFor(recipeId: string, options: GenerateOptions): number {
  const base = options.personalization?.signals.wantsMoreVariety ? 1 : 2;
  return options.favoriteIds.includes(recipeId) ? base + 1 : base;
}

function easyMeal(slot: MealSlotId, options: GenerateOptions): boolean {
  const easy = options.personalization?.profile.easyMeals ?? [];
  return (easy as string[]).includes(slot);
}

/** Breakfast set to "Meal prep": batch-friendly breakfasts are preferred and repeat across days. */
function preppedBreakfast(recipe: Recipe, slot: MealSlotId, options: GenerateOptions): boolean {
  return (
    slot === "breakfast" &&
    options.personalization?.profile.mealSources?.breakfast === "prep" &&
    recipe.tags.includes("batch_friendly")
  );
}

function underRepeatLimit(recipe: Recipe, options: GenerateOptions, slot?: MealSlotId): boolean {
  const count = options.personalization?.signals.recentCounts?.get(recipe.id) ?? 0;
  const extra = slot && preppedBreakfast(recipe, slot, options) ? 3 : 0;
  return count < repeatLimitFor(recipe.id, options) + extra;
}

function pickSlotRecipe(
  recipes: Recipe[],
  slot: MealSlotId,
  options: GenerateOptions,
  used: Set<string>,
): Recipe | undefined {
  const dislike = new Set(options.dislikedIds);
  let pool = recipes.filter(
    (r) =>
      recipeFitsSlot(r, slot) &&
      isRecipeAllowed(r, dislike, options.dislikedChips, options.dislikedCustom, options, slot) &&
      !used.has(r.id),
  );
  // A meal switched to its easier version: quick no-cook / microwave picks only (when any fit).
  const easy = easyMeal(slot, options);
  if (easy) {
    const quick = pool.filter((r) => isEasyMealRecipe(r));
    if (quick.length > 0) pool = quick;
  }
  // Time and chopping limits filter when enough options remain; otherwise they strongly prefer.
  const effortOk = pool.filter((r) => passesEffortLimits(r, options.cookingLimits));
  const softEffort = effortOk.length < MIN_OPTIONS_PER_SLOT;
  if (!softEffort) pool = effortOk;
  const fresh = pool.filter((r) => underRepeatLimit(r, options, slot));
  if (fresh.length > 0) pool = fresh;
  if (pool.length === 0) {
    pool = recipes.filter(
      (r) =>
        isRecipeAllowed(r, dislike, options.dislikedChips, options.dislikedCustom, options, slot) &&
        !used.has(r.id),
    );
  }
  if (pool.length === 0) {
    // Last resort still respects equipment limits (never an oven recipe for "No oven").
    pool = recipes.filter(
      (r) =>
        !dislike.has(r.id) &&
        !used.has(r.id) &&
        !isBeverageRecipe(r) &&
        passesEquipmentLimits(r, options.cookingLimits),
    );
  }
  const costs = new Map(options.budget && options.budget !== "flexible" ? pool.map((r) => [r.id, cheapestCost(r)]) : []);
  const mid = median([...costs.values()]);
  return weightedPick(pool, (r) => {
    let w = recipeWeight(r, slot, options);
    if (softEffort && !passesEffortLimits(r, options.cookingLimits)) w *= 0.15;
    if (easy && isNoCookRecipe(r)) w *= 3;
    const c = costs.get(r.id);
    if (c != null) w *= budgetWeight(c, mid, options.budget);
    return w;
  });
}

/**
 * Fill only the given slots; excludes recipe ids already used (e.g. locked meals).
 */
export function generateSlotsPlan(
  recipes: Recipe[],
  options: GenerateOptions,
  slots: MealSlotId[],
  usedRecipeIds: Set<string>,
): PlannedMeal[] {
  if (slots.length === 0) return [];

  const used = new Set(usedRecipeIds);
  const raw: { slot: MealSlotId; recipe: Recipe; variationId?: string }[] = [];
  const live: GenerateOptions = {
    ...options,
    pickedIngredientNames: new Set(options.pickedIngredientNames),
  };

  for (const slot of slots) {
    const recipe = pickSlotRecipe(recipes, slot, live, used);
    if (!recipe) continue;
    used.add(recipe.id);
    rememberIngredients(live, recipe);
    raw.push({
      slot,
      recipe,
      variationId: pickPreferredVariationId(
        recipe,
        slot,
        live.dislikedChips,
        live.dislikedCustom,
        live.snackStyle,
        live.budget,
      ),
    });
  }

  return toPlannedMeals(raw);
}

/** Pick one replacement recipe for a slot (used by Regenerate). */
export function pickRecipeForSlot(
  recipes: Recipe[],
  slot: MealSlotId,
  options: GenerateOptions,
  excludeIds: Set<string>,
): Recipe | undefined {
  return pickSlotRecipe(recipes, slot, options, excludeIds);
}

export function sumPlannedMacros(meals: PlannedMeal[]): DailyTargets {
  return meals.reduce(
    (acc, m) => {
      const macros = mealMacrosWithBeverage(m);
      return {
        calories: acc.calories + macros.calories,
        protein: acc.protein + macros.protein,
        carbs: acc.carbs + macros.carbs,
        fat: acc.fat + macros.fat,
        fiber: (acc.fiber ?? 0) + (macros.fiber ?? 0),
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  );
}
