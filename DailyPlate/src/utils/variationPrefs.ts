import type { MealSlotId, Recipe, RecipeMealSlotId, RecipeVariationDetail } from "@/types";
import { customTokens, DISLIKE_MATCHERS, mergeFoodAvoidLists } from "@/utils/chipMatching";
import { isSnackPlanSlot, recipeSlotForPlanSlot } from "@/utils/planningPrefs";
import type { BudgetPreference, UserProfile } from "@/types/profile";
import { resolveRecipeMacros } from "@/utils/recipeDisplay";
import { buildCost } from "@/utils/recipeFit";

function defaultVariationId(recipe: Recipe): string | undefined {
  return recipe.variationDetails?.[0]?.id;
}

function variationCalories(recipe: Recipe, variation: RecipeVariationDetail): number {
  return resolveRecipeMacros(recipe, variation.id).calories;
}

/** With a Tight or Moderate budget, keep builds within this multiple of the cheapest one. */
const BUDGET_SPREAD: Record<BudgetPreference, number> = { tight: 1.5, moderate: 2.5, flexible: Infinity };

const PEANUT_RE = /\bpeanuts?\b|peanut butter/i;
const TREE_NUT_RE =
  /\balmonds?\b|\bcashews?\b|\bwalnuts?\b|\bpecans?\b|\bpistachios?\b|\bhazelnuts?\b|tree\s*nuts?|mixed nuts/i;

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

function variationIngredientText(recipe: Recipe, variation: RecipeVariationDetail): string {
  const ingredients = variation.replaceBase
    ? variation.ingredients
    : [...recipe.ingredients, ...variation.ingredients];
  const steps = variation.replaceBase
    ? variation.instructions
    : [...recipe.instructions, ...variation.instructions];
  return [
    recipe.name,
    recipe.cuisine,
    ...recipe.tags,
    variation.label,
    ...ingredients.map((i) => i.name),
    ...steps,
  ]
    .join(" ")
    .toLowerCase();
}

export function profileAvoidLists(profile: UserProfile | null | undefined): {
  chips: string[];
  custom: string;
} {
  if (!profile) return { chips: [], custom: "" };
  return mergeFoodAvoidLists(
    profile.dislikedFoodChips,
    profile.dislikedFoodCustom,
    profile.householdFoodAvoidChips,
    profile.householdFoodAvoidCustom,
  );
}

export function avoidsPeanuts(chips: string[], custom: string): boolean {
  if (chips.includes("nuts")) return true;
  return customTokens(custom).some((t) => PEANUT_RE.test(t)) || PEANUT_RE.test(custom);
}

export function avoidsTreeNuts(chips: string[], custom: string): boolean {
  if (chips.includes("nuts")) return true;
  return customTokens(custom).some((t) => TREE_NUT_RE.test(t)) || TREE_NUT_RE.test(custom);
}

export function variationExcludedByAvoids(
  recipe: Recipe,
  variation: RecipeVariationDetail,
  chips: string[],
  custom = "",
): boolean {
  if (chips.includes("none")) return false;
  const text = variationIngredientText(recipe, variation);
  for (const chip of chips) {
    const patterns = DISLIKE_MATCHERS[chip];
    if (patterns && matchesAny(text, patterns)) return true;
  }
  const tokens = customTokens(custom);
  if (
    tokens.some((t) => {
      if (text.includes(t)) return true;
      const stem = t.endsWith("s") && t.length > 3 ? t.slice(0, -1) : t;
      return stem.length >= 3 && text.includes(stem);
    })
  ) {
    return true;
  }
  return false;
}

export function allowedVariationDetails(
  recipe: Recipe,
  chips: string[],
  custom = "",
): RecipeVariationDetail[] {
  const details = recipe.variationDetails ?? [];
  if (details.length === 0) return [];
  return details.filter((v) => !variationExcludedByAvoids(recipe, v, chips, custom));
}

export function variationFitsSlot(
  recipe: Recipe,
  variation: RecipeVariationDetail | null | undefined,
  slot: MealSlotId,
): boolean {
  const key = recipeSlotForPlanSlot(slot);
  if (variation?.mealSlots?.length) return variation.mealSlots.includes(key);
  return recipe.mealSlots.includes(key);
}

function isPackagedVariation(variation: RecipeVariationDetail): boolean {
  return /\(packaged\)/i.test(variation.label);
}

function autoSwapVariationId(
  recipe: Recipe,
  chips: string[],
  custom: string,
): string | undefined {
  const tree = avoidsTreeNuts(chips, custom);
  const peanut = avoidsPeanuts(chips, custom);
  if (tree && !peanut) {
    if (recipe.id === "snack-banana-almond-butter") return "peanut-butter";
    if (recipe.id === "snack-berries-almonds") return "peanuts";
  }
  return undefined;
}

export function pickPreferredVariationId(
  recipe: Recipe,
  slot: MealSlotId,
  chips: string[],
  custom = "",
  snackStyle?: "packaged" | "whole_food" | "both" | null,
  budget?: BudgetPreference | null,
): string | undefined {
  const details = recipe.variationDetails ?? [];
  if (details.length === 0) return undefined;
  const allowed = allowedVariationDetails(recipe, chips, custom);
  if (allowed.length === 0) return defaultVariationId(recipe);

  const autoId = autoSwapVariationId(recipe, chips, custom);
  if (autoId && allowed.some((v) => v.id === autoId)) return autoId;

  const forSlot = allowed.filter((v) => variationFitsSlot(recipe, v, slot));
  let pool = forSlot.length > 0 ? forSlot : allowed;

  if (snackStyle === "packaged") {
    const packaged = pool.filter(isPackagedVariation);
    if (packaged.length) pool = packaged;
  } else if (snackStyle === "whole_food") {
    const homemade = pool.filter((v) => !isPackagedVariation(v));
    if (homemade.length) pool = homemade;
  }

  // Each variation is scored by its own cost: a budget keeps the cheaper builds.
  if (budget && budget !== "flexible" && pool.length > 1) {
    const cheapest = Math.min(...pool.map((v) => buildCost(recipe, v.id)));
    const affordable = pool.filter((v) => buildCost(recipe, v.id) <= cheapest * BUDGET_SPREAD[budget]);
    if (affordable.length) pool = affordable;
  }

  if (isSnackPlanSlot(slot) && pool.length > 1) {
    return [...pool].sort((a, b) => variationCalories(recipe, a) - variationCalories(recipe, b))[0]
      ?.id;
  }

  const preferred = defaultVariationId(recipe);
  if (preferred && pool.some((v) => v.id === preferred)) return preferred;
  return pool[0]?.id;
}

export function visibleVariationLabels(
  recipe: Recipe,
  chips: string[],
  custom = "",
): { id: string; label: string }[] {
  const allowed = new Set(allowedVariationDetails(recipe, chips, custom).map((v) => v.id));
  const details = recipe.variationDetails ?? [];
  if (details.length === 0) {
    return (recipe.variations ?? []).map((label) => ({
      id: label.toLowerCase().replace(/\s+/g, "-"),
      label,
    }));
  }
  return details.filter((v) => allowed.has(v.id)).map((v) => ({ id: v.id, label: v.label }));
}

export function resolveAllowedVariationId(
  recipe: Recipe,
  selectedId: string | undefined,
  chips: string[],
  custom = "",
): string | undefined {
  const allowed = allowedVariationDetails(recipe, chips, custom);
  if (selectedId && allowed.some((v) => v.id === selectedId)) return selectedId;
  if (allowed[0]) return allowed[0].id;
  return defaultVariationId(recipe);
}

export type { RecipeMealSlotId };
