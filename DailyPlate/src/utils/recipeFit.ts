import type { CookMethod, Recipe, RecipeEffort } from "@/types";
import type { BudgetPreference, CookingLimit } from "@/types/profile";
import { PACKAGED_COST_TIER, RECIPE_EFFORT } from "@/recipes/recipeEffort";
import { gramsForIngredient, matchIngredient } from "@/utils/ingredientNutrition";
import { hasLabelNutrition } from "@/utils/labelNutrition";
import { resolveRecipeIngredients } from "@/utils/recipeDisplay";

export type CostTier = "low" | "medium" | "high";

/** Rough US grocery price per 100 g as bought, by ingredient tier. Used only to rank; never shown. */
export const PRICE_PER_100G: Record<CostTier, number> = { low: 0.35, medium: 1.1, high: 2.4 };
/** Estimated cost of one packaged snack, by tier. */
const PACKAGED_PRICE: Record<CostTier, number> = { low: 0.5, medium: 1.4, high: 2.5 };
/** Cost-per-serving thresholds for the tiers: [low under, high over]. */
const MEAL_THRESHOLDS: [number, number] = [2.5, 4.0];
const SNACK_THRESHOLDS: [number, number] = [1.0, 1.8];

const UNTAGGED_EFFORT: RecipeEffort = { methods: [["stovetop"], ["oven"]], chopping: "moderate", activeMinutes: 30 };

/** Equipment and effort; user recipes without tags count as needing a full kitchen. */
export function recipeEffort(recipe: Pick<Recipe, "id" | "effort">): RecipeEffort {
  return recipe.effort ?? RECIPE_EFFORT[recipe.id] ?? UNTAGGED_EFFORT;
}

function isMealRecipe(recipe: Pick<Recipe, "mealSlots">): boolean {
  return recipe.mealSlots.some((s) => s !== "snack");
}

const costCache = new WeakMap<Recipe, Map<string, number>>();

/** Estimated cost per serving of one build (variation), from ingredient tiers. */
export function buildCost(recipe: Recipe, variationId?: string): number {
  let byRecipe = costCache.get(recipe);
  if (!byRecipe) {
    byRecipe = new Map();
    costCache.set(recipe, byRecipe);
  }
  const key = variationId ?? "";
  const hit = byRecipe.get(key);
  if (hit != null) return hit;
  const packaged = PACKAGED_COST_TIER[recipe.id];
  let cost: number;
  if (packaged) {
    cost = PACKAGED_PRICE[packaged];
  } else {
    cost = 0;
    for (const ing of resolveRecipeIngredients(recipe, variationId)) {
      const rec = matchIngredient(ing.name);
      if (!rec || rec.role === "flavor") continue;
      cost += ((gramsForIngredient(ing) ?? 0) / 100) * PRICE_PER_100G[rec.cost ?? "low"];
    }
    // A ready-to-drink shake is bought as one bottle.
    if (hasLabelNutrition(recipe, variationId) && cost === 0) cost = PACKAGED_PRICE.medium;
  }
  byRecipe.set(key, cost);
  return cost;
}

/** Each variation's cost (or the base build's when there are none). */
export function variationCosts(recipe: Recipe): { id: string | undefined; cost: number }[] {
  const ids: (string | undefined)[] = recipe.variationDetails?.length
    ? recipe.variationDetails.map((v) => v.id)
    : [undefined];
  return ids.map((id) => ({ id, cost: buildCost(recipe, id) }));
}

export function cheapestCost(recipe: Recipe): number {
  return Math.min(...variationCosts(recipe).map((v) => v.cost));
}

export function costTierFor(recipe: Recipe, cost: number): CostTier {
  const packaged = PACKAGED_COST_TIER[recipe.id];
  if (packaged) return packaged;
  const [low, high] = isMealRecipe(recipe) ? MEAL_THRESHOLDS : SNACK_THRESHOLDS;
  return cost < low ? "low" : cost > high ? "high" : "medium";
}

/**
 * "Budget-friendly": the planned variation when given, otherwise the cheapest variation (so a
 * recipe with a low-cost build shows the tag in the Recipes list).
 */
export function isBudgetFriendly(recipe: Recipe, variationId?: string): boolean {
  if (recipe.id.startsWith("bev-")) return false;
  const cost = variationId != null ? buildCost(recipe, variationId) : cheapestCost(recipe);
  return costTierFor(recipe, cost) === "low";
}

const BUDGET_EXPONENT: Record<BudgetPreference, number> = { tight: 1.5, moderate: 0.5, flexible: 0 };

/** Pick weight from cost per serving relative to the slot's median: (cost ÷ median)^−k, clamped. */
export function budgetWeight(cost: number, median: number, budget: BudgetPreference | null | undefined): number {
  const k = budget ? BUDGET_EXPONENT[budget] : 0;
  if (k === 0 || median <= 0 || cost <= 0) return 1;
  return Math.min(2.5, Math.max(0.25, (cost / median) ** -k));
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

// ---------- Cooking limits ----------

const allowedMethods = (limits: CookingLimit[]): Set<CookMethod> => {
  if (limits.includes("microwave_only")) return new Set(["no_cook", "microwave"]);
  const all = new Set<CookMethod>(["no_cook", "microwave", "stovetop", "oven"]);
  if (limits.includes("no_oven")) all.delete("oven");
  return all;
};

/** Equipment limits (Microwave only, No oven): always hard filters. */
export function passesEquipmentLimits(recipe: Pick<Recipe, "id" | "effort">, limits: CookingLimit[] | undefined): boolean {
  if (!limits?.length) return true;
  const ok = allowedMethods(limits);
  return recipeEffort(recipe).methods.some((way) => way.every((m) => ok.has(m)));
}

/** Time and chopping limits: softened to a preference when a slot would have fewer than 5 options. */
export function passesEffortLimits(recipe: Pick<Recipe, "id" | "effort">, limits: CookingLimit[] | undefined): boolean {
  if (!limits?.length) return true;
  const e = recipeEffort(recipe);
  if (limits.includes("short_time") && e.activeMinutes > 15) return false;
  if (limits.includes("little_chopping") && (e.chopping !== "little" || e.activeMinutes > 20)) return false;
  return true;
}

export function passesCookingLimits(recipe: Pick<Recipe, "id" | "effort">, limits: CookingLimit[] | undefined): boolean {
  return passesEquipmentLimits(recipe, limits) && passesEffortLimits(recipe, limits);
}

/**
 * "Quicker, no-cook" version of a meal: no-cook or microwave, 15 active minutes or less.
 * True no-cook recipes are preferred when picking.
 */
export function isEasyMealRecipe(recipe: Pick<Recipe, "id" | "effort">): boolean {
  return passesCookingLimits(recipe, ["microwave_only", "short_time"]);
}

export function isNoCookRecipe(recipe: Pick<Recipe, "id" | "effort">): boolean {
  return recipeEffort(recipe).methods.some((way) => way.every((m) => m === "no_cook"));
}

/** Below this many options in a slot, time and chopping limits become a preference. */
export const MIN_OPTIONS_PER_SLOT = 5;
