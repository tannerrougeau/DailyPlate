import type { DailyTargets, MealSlotId, PlannedMeal, Recipe, RecipeIngredient, RoleMultipliers } from "@/types";
import type { MealTimingPreference } from "@/types/profile";
import { resolveBeverage } from "@/utils/beverages";
import {
  cookedGramsOfLine,
  fitKcalTolerance,
  cookedWeightOfLines,
  nutritionOfLines,
  portionLines,
  scaleNutrients,
  sizePortion,
  UNIFORM_MULTIPLIERS,
  type PortionLine,
} from "@/utils/goalPortions";
import { addNutrients, gramsForIngredient, type NutrientVector } from "@/utils/ingredientNutrition";
import { hasLabelNutrition } from "@/utils/labelNutrition";
import { ADD_ON_NAMES, withSlotAddOns } from "@/utils/slotAddOns";
import { sidesNutrition, suggestSides, type SideSuggestion } from "@/utils/mealSides";
import { isSnackPlanSlot } from "@/utils/planningPrefs";
import { splitMealTargets, type MealTargetSlot } from "@/utils/mealTargets";
import {
  effectiveCarbVariationId,
  effectiveFatVariationId,
  effectiveVariationId,
  recipeFiberGrams,
  recipeIsMixedBatch,
  resolveRecipeIngredients,
  resolveRecipeMacros,
  shortIngredientName,
} from "@/utils/recipeDisplay";

export function isPackagedRecipe(recipe: Pick<Recipe, "tags">): boolean {
  return recipe.tags.includes("packaged");
}

export function mealIngredients(meal: PlannedMeal): RecipeIngredient[] {
  return resolveRecipeIngredients(
    meal.recipe,
    effectiveVariationId(meal),
    effectiveCarbVariationId(meal),
    effectiveFatVariationId(meal),
  );
}

/** Role multipliers for the user's serving; older saves without a portion use their uniform scale. */
export function mealMultipliers(meal: Pick<PlannedMeal, "portion" | "scale">): RoleMultipliers {
  if (meal.portion) return meal.portion.multipliers;
  const s = meal.scale > 0 ? meal.scale : 1;
  return { protein: s, carb: s, fat: s, vegetable: s };
}

function storedNutrition(meal: PlannedMeal): NutrientVector {
  const variationId = effectiveVariationId(meal);
  const carbId = effectiveCarbVariationId(meal);
  const macros = resolveRecipeMacros(meal.recipe, variationId, carbId, effectiveFatVariationId(meal));
  return {
    calories: macros.calories,
    protein: macros.protein,
    carbs: macros.carbs,
    fat: macros.fat,
    fiber: recipeFiberGrams(meal.recipe, variationId, carbId, effectiveFatVariationId(meal)),
  };
}

const nutritionCache = new WeakMap<Recipe, Map<string, NutrientVector>>();

/**
 * Food nutrition for the user's serving (recipe + sides), from the rounded amounts and ingredients.json.
 * Packaged items use their label; user recipes with an ingredient not in the table use their own values.
 */
export function mealFoodNutrition(meal: PlannedMeal): NutrientVector {
  const m = mealMultipliers(meal);
  const key = [
    effectiveVariationId(meal) ?? "",
    effectiveCarbVariationId(meal),
    effectiveFatVariationId(meal),
    m.protein, m.carb, m.fat, m.vegetable,
    JSON.stringify(meal.sides ?? []),
  ].join("|");
  let byRecipe = nutritionCache.get(meal.recipe);
  if (!byRecipe) {
    byRecipe = new Map();
    nutritionCache.set(meal.recipe, byRecipe);
  }
  const hit = byRecipe.get(key);
  if (hit) return hit;
  const ingredients = mealIngredients(meal);
  const label = hasLabelNutrition(meal.recipe, effectiveVariationId(meal));
  const matched = !label && ingredients.every((ing) => gramsForIngredient(ing) != null);
  const food = matched
    ? (nutritionOfLines(portionLines(ingredients, m)) ?? storedNutrition(meal))
    : scaleNutrients(storedNutrition(meal), (m.protein + m.carb + m.fat) / 3);
  const value = addNutrients(food, sidesNutrition(meal.sides));
  byRecipe.set(key, value);
  return value;
}

/** Rounded lines for `servings` portions (1 = the user's serving). */
export function mealPortionLines(meal: PlannedMeal, servings = 1): PortionLine[] {
  return portionLines(mealIngredients(meal), mealMultipliers(meal), servings);
}

/** Servings the batch covers: household × planned leftover/batch portions. */
export function batchServings(meal: Pick<PlannedMeal, "mealPrep">, householdMult: number): number {
  return Math.max(1, householdMult) * Math.max(1, meal.mealPrep?.portionsCooked ?? 1);
}

/**
 * Size one meal to its target. Packaged items keep their label amounts; snacks are judged on
 * calories only. With `autoSide`, a meal that cannot fit gets one or two sides when that makes it fit.
 */
export function sizeMealToTarget(
  meal: PlannedMeal,
  target: DailyTargets,
  opts: { autoSide?: boolean } = {},
): PlannedMeal {
  const { generated: _generated, ...rest } = meal;
  if (isPackagedRecipe(meal.recipe)) {
    const n = mealFoodNutrition({ ...rest, portion: undefined, scale: 1 });
    return {
      ...rest,
      scale: 1,
      portion: { multipliers: { ...UNIFORM_MULTIPLIERS }, target: toTargets(n), kcalGap: 0, fits: true },
    };
  }
  const ingredients = mealIngredients(meal);
  const stored = storedNutrition(meal);
  const caloriesOnly = isSnackPlanSlot(meal.slot);
  const r = sizePortion(ingredients, target, stored, {
    extra: sidesNutrition(meal.sides),
    caloriesOnly,
  });
  const sized: PlannedMeal = {
    ...rest,
    scale: 1,
    portion: { multipliers: r.multipliers, target, kcalGap: r.kcalGap, fits: r.fits },
  };
  if (!opts.autoSide || r.fits || meal.sides?.length) return sized;
  const side = suggestSides(r.nutrition, target, meal.slot);
  if (!side?.fits) return sized;
  const withSide = sizePortion(ingredients, target, stored, { extra: side.nutrition, caloriesOnly });
  if (!withSide.fits) return sized;
  return {
    ...sized,
    sides: side.sides,
    portion: { multipliers: withSide.multipliers, target, kcalGap: withSide.kcalGap, fits: true },
  };
}

function toTargets(n: NutrientVector): DailyTargets {
  return {
    calories: Math.round(n.calories),
    protein: Math.round(n.protein),
    carbs: Math.round(n.carbs),
    fat: Math.round(n.fat),
    fiber: Math.round(n.fiber),
  };
}

function drinkTotals(meals: PlannedMeal[]): DailyTargets {
  return meals.reduce<DailyTargets>(
    (acc, m) => {
      const d = resolveBeverage(m.beverageId);
      return {
        calories: acc.calories + d.calories,
        protein: acc.protein + d.protein,
        carbs: acc.carbs + d.carbs,
        fat: acc.fat + d.fat,
        fiber: (acc.fiber ?? 0) + d.fiber,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  );
}

/**
 * Size every meal of a day to its share of the daily targets. Drinks, packaged snacks, and fixed
 * meals count first. Fixed meals are never changed: locked meals, meals already logged as eaten
 * (`fixedSlots`), and kept meals. Meals fresh from plan generation get an automatic side when
 * that makes them fit.
 */
export function applyGoalPortions(
  meals: PlannedMeal[],
  daily: DailyTargets,
  opts: {
    timing?: MealTimingPreference | null;
    lockedSlots?: Set<MealSlotId>;
    fixedSlots?: Set<MealSlotId>;
    /** Fixed add-ons per meal from a "next best step" Yes, sized in like sides. */
    addOns?: Partial<Record<MealSlotId, RecipeIngredient[]>>;
  } = {},
): PlannedMeal[] {
  if (meals.length === 0 || !(daily.calories > 0)) return meals;
  if (opts.addOns !== undefined || meals.some((m) => m.sides?.some((s) => ADD_ON_NAMES.has(s.name)))) {
    meals = meals.map((m) => {
      if (opts.lockedSlots?.has(m.slot) || opts.fixedSlots?.has(m.slot)) return m;
      const sides = withSlotAddOns(m.sides, opts.addOns?.[m.slot]);
      return JSON.stringify(sides ?? null) === JSON.stringify(m.sides ?? null) ? m : { ...m, sides };
    });
  }
  const isFixed = (m: PlannedMeal) =>
    opts.lockedSlots?.has(m.slot) ||
    opts.fixedSlots?.has(m.slot) ||
    (m.kept === true && m.portion != null);
  const drinks = drinkTotals(meals);
  const packaged = new Map<MealSlotId, PlannedMeal>();
  for (const m of meals) {
    if (isPackagedRecipe(m.recipe) && !isFixed(m)) packaged.set(m.slot, sizeMealToTarget(m, daily));
  }
  const slots = meals.map((m): MealTargetSlot => {
    if (isFixed(m) || packaged.has(m.slot)) {
      return { slot: m.slot, kind: "fixed", nutrition: toTargets(mealFoodNutrition(packaged.get(m.slot) ?? m)) };
    }
    return { slot: m.slot, kind: "cooked" };
  });
  const targets = splitMealTargets({ daily, slots, drinks, timing: opts.timing });
  return meals.map((m) => {
    if (isFixed(m)) return m;
    const pkg = packaged.get(m.slot);
    if (pkg) return pkg;
    const t = targets[m.slot];
    return t ? sizeMealToTarget(m, t, { autoSide: m.generated === true }) : m;
  });
}

/** True when the portion signature differs (used to avoid store update loops). */
export function samePortions(a: PlannedMeal[], b: PlannedMeal[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((m, i) => {
    const o = b[i]!;
    if (m.slot !== o.slot || m.recipe.id !== o.recipe.id || m.scale !== o.scale) return false;
    return (
      m.generated === o.generated &&
      JSON.stringify(m.portion ?? null) === JSON.stringify(o.portion ?? null) &&
      JSON.stringify(m.sides ?? null) === JSON.stringify(o.sides ?? null)
    );
  });
}

// ---------- Serving guidance ----------

const COUNT_DISH = /burrito|taco|wrap|quesadilla|sandwich/i;
const DISH_NOUN: [RegExp, string, string][] = [
  [/burrito/i, "burrito", "burritos"],
  [/taco/i, "taco", "tacos"],
  [/quesadilla/i, "quesadilla", "quesadillas"],
  [/wrap/i, "wrap", "wraps"],
  [/sandwich/i, "sandwich", "sandwiches"],
];

/** Parts cooked separately (bowls over rice, plated breakfasts) get per-component amounts. */
export function servedAsComponents(recipe: Recipe, lines: PortionLine[]): boolean {
  if (!recipeIsMixedBatch(recipe)) return true;
  const separateStarch = lines.some(
    (l) => l.role === "carb" && /rice|pasta|quinoa/i.test(l.ingredient.name),
  );
  if (!separateStarch) return false;
  if (/casserole|soup|stew|chili|skillet|bake|fried rice/i.test(recipe.name)) return false;
  const steps = recipe.instructions.join(" ").toLowerCase();
  return !/stir in (the )?(cooked )?(rice|pasta)|toss .*pasta|add (the )?(cooked )?(rice|pasta)|fold in (the )?(rice|pasta)/.test(
    steps,
  );
}

function dishCount(recipe: Recipe, lines: PortionLine[]): string | null {
  if (!COUNT_DISH.test(recipe.name)) return null;
  const noun = DISH_NOUN.find(([re]) => re.test(recipe.name));
  if (!noun) return null;
  const base = lines.find((l) => l.count != null && /tortilla|bagel|biscuit|croissant|bread|bun|english muffin/i.test(l.ingredient.name));
  if (!base || base.count == null) return null;
  const isBread = /bread/i.test(base.ingredient.name);
  const n = isBread ? Math.max(1, Math.round(base.count / 2)) : base.count;
  return `${n} ${n === 1 ? noun[1] : noun[2]}`;
}

function componentPart(line: PortionLine, cookedTogether: boolean): string {
  const short = shortIngredientName(line.ingredient.name);
  const label = short.charAt(0).toUpperCase() + short.slice(1);
  if (line.count != null) {
    const unit = line.ingredient.unit.toLowerCase();
    const n = line.count;
    if (/egg/i.test(line.ingredient.name)) return `${n} ${n === 1 ? "egg" : "eggs"}`;
    if (unit.startsWith("slice")) return `${n} ${n === 1 ? "slice" : "slices"} ${short}`;
    return `${n} ${short}`;
  }
  const cooked = cookedGramsOfLine(line, cookedTogether);
  const g = Math.round(cooked / 5) * 5;
  const cookedLabel = line.state === "raw" || line.state === "dry" || line.state === "cooked" ? " cooked" : "";
  return `${label} ${g} g${cookedLabel}`;
}

const PART_ORDER: PortionLine["role"][] = ["protein", "carb", "vegetable"];

/** Main parts of a serving cooked separately, e.g. ["Turkey 120 g cooked", "Rice 150 g cooked"]. */
export function servingParts(meal: PlannedMeal, servings = 1): string[] {
  return mealPortionLines(meal, servings)
    .filter((l) => PART_ORDER.includes(l.role) && (l.nutritionGrams ?? 0) > 0)
    .sort((a, b) => PART_ORDER.indexOf(a.role) - PART_ORDER.indexOf(b.role) || (b.nutritionGrams ?? 0) - (a.nutritionGrams ?? 0))
    .slice(0, 4)
    .map((l) => componentPart(l, false));
}

/** Cooked weight of one serving when the dish is cooked together; null when served as parts or counted. */
export function mixedServingGrams(meal: PlannedMeal): number | null {
  if (isPackagedRecipe(meal.recipe)) return null;
  const lines = mealPortionLines(meal, 1);
  if (lines.length === 0 || dishCount(meal.recipe, lines) || servedAsComponents(meal.recipe, lines)) return null;
  const g = cookedWeightOfLines(lines, true);
  return g > 0 ? g : null;
}

export type ServingSummary = {
  /** Short line for the meal card. */
  text: string;
  /** Combined cooked weight of the user's serving when the dish is cooked together. */
  grams: number | null;
};

/**
 * "Your serving: about 430 g", per-component amounts, or a count ("2 burritos").
 * A weighed batch replaces the estimate with the user's share of the real weight.
 */
export function servingSummary(meal: PlannedMeal, householdMult = 1): ServingSummary | null {
  if (isPackagedRecipe(meal.recipe)) return null;
  const lines = mealPortionLines(meal, 1);
  if (lines.length === 0) return null;
  const count = dishCount(meal.recipe, lines);
  if (count) return { text: `Your serving: ${count}`, grams: null };
  if (!servedAsComponents(meal.recipe, lines)) {
    const estimate = cookedWeightOfLines(lines, true);
    const grams = meal.weighedBatchGrams
      ? meal.weighedBatchGrams / batchServings(meal, householdMult)
      : estimate;
    if (!(grams > 0)) return null;
    return { text: `Your serving: about ${Math.round(grams / 10) * 10} g`, grams };
  }
  const parts = lines
    .filter((l) => (l.role === "protein" || l.role === "carb") && (l.nutritionGrams ?? 0) > 0)
    .sort((a, b) => (b.nutritionGrams ?? 0) - (a.nutritionGrams ?? 0))
    .slice(0, 3)
    .map((l) => componentPart(l, false));
  if (parts.length === 0) return null;
  return { text: `Your serving: ${parts.join(" · ")}`, grams: null };
}

/** Estimated cooked weight of the whole batch (for the "Weigh your batch" hint). */
export function estimatedBatchCookedGrams(meal: PlannedMeal, householdMult = 1): number {
  const lines = mealPortionLines(meal, batchServings(meal, householdMult));
  return cookedWeightOfLines(lines, true);
}

/** Short notice when the meal is outside the fit range and the user has not kept it. */
export function fitNotice(meal: PlannedMeal): string | null {
  const p = meal.portion;
  if (!p || p.fits || meal.kept || isPackagedRecipe(meal.recipe)) return null;
  const gap = Math.round(Math.abs(p.kcalGap) / 10) * 10;
  const tolerance = fitKcalTolerance(p.target);
  if (p.kcalGap < 0 && Math.abs(p.kcalGap) > tolerance) {
    return `This meal is about ${gap} kcal under your target.`;
  }
  if (p.kcalGap > 0 && p.kcalGap > tolerance) {
    return `This meal is about ${gap} kcal over your target.`;
  }
  return "This meal is a little under your protein target.";
}

/** Side to offer on the notice when the meal is under its calorie target by more than the fit tolerance. */
export function sideSuggestionFor(meal: PlannedMeal): SideSuggestion | null {
  const p = meal.portion;
  if (!p || p.fits || meal.kept || isPackagedRecipe(meal.recipe)) return null;
  return suggestSides(mealFoodNutrition(meal), p.target, meal.slot);
}
