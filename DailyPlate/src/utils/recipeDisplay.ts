import type {
  CarbVariationId,
  FatVariationId,
  MealSlotId,
  PlannedMeal,
  Recipe,
  RecipeIngredient,
  RecipeVariationDetail,
} from "@/types";
import type { DailyTargets } from "@/types";
import type { UserProfile } from "@/types/profile";
import {
  collapsedPersonPortions,
  formatHouseholdServingSplit,
  resolveHouseholdCounts,
  type HouseholdDayCounts,
} from "@/utils/household";
import { estimateFiberFromIngredients } from "@/utils/fiberEstimate";
import {
  applyCarbSwapToIngredients,
  applyCarbSwapToInstructions,
  applyCarbSwapToMacros,
  CARB_VARIATION_OPTIONS,
  carbVariationLabel,
  recipeIngredientsIncludeRice,
  resolveCarbVariationId,
} from "@/recipes/riceAlternatives";
import {
  applyFatSwapToIngredients,
  applyFatSwapToInstructions,
  FAT_VARIATION_OPTIONS,
  recipeHasCookingFatSwap,
  resolveFatVariationId,
} from "@/recipes/fatAlternatives";
import { RECIPE_SCALE_MAX, RECIPE_SCALE_MIN } from "@/utils/macroRedistribution";
import { applyPracticalIngredientScaling, formatPracticalQty } from "@/utils/practicalScaling";

const PROTEIN_INGREDIENT_HINT =
  /protein powder|whey|casein|egg white|cottage cheese|greek yogurt|skyr|collagen/i;
const CARB_FAT_ADJUST_HINT =
  /oats|honey|maple|banana|granola|peanut butter|almond butter|oil|butter|sugar|chocolate chips/i;

/** First variation in variationDetails — the default/base build. */
export function defaultVariationId(recipe: Recipe): string | undefined {
  return recipe.variationDetails?.[0]?.id;
}

/**
 * Effective variation for a recipe: explicit selection, else base variation when
 * the recipe has variations, else undefined.
 */
export function resolveVariationId(
  recipe: Recipe,
  selectedVariationId?: string,
): string | undefined {
  const baseId = defaultVariationId(recipe);
  if (!baseId) return selectedVariationId;
  if (
    selectedVariationId &&
    recipe.variationDetails?.some((v) => v.id === selectedVariationId)
  ) {
    return selectedVariationId;
  }
  return baseId;
}

export function effectiveVariationId(meal: PlannedMeal): string | undefined {
  return resolveVariationId(meal.recipe, meal.selectedVariationId);
}

export function effectiveCarbVariationId(meal: PlannedMeal): CarbVariationId {
  const variationId = effectiveVariationId(meal);
  if (!recipeSupportsCarbSwap(meal.recipe, variationId)) return "white-rice";
  return resolveCarbVariationId(meal.selectedCarbVariationId);
}

export function effectiveFatVariationId(meal: PlannedMeal): FatVariationId {
  const variationId = effectiveVariationId(meal);
  if (!recipeSupportsFatSwap(meal.recipe, variationId)) return "olive-oil";
  return resolveFatVariationId(meal.selectedFatVariationId);
}

export function recipeSupportsCarbSwap(recipe: Recipe, variationId?: string): boolean {
  return recipeIngredientsIncludeRice(rawRecipeIngredients(recipe, variationId));
}

export function recipeSupportsFatSwap(recipe: Recipe, variationId?: string): boolean {
  return recipeHasCookingFatSwap(rawRecipeIngredients(recipe, variationId));
}

export function carbVariationLabels(
  recipe: Recipe,
  variationId?: string,
): { id: CarbVariationId; label: string }[] {
  if (!recipeSupportsCarbSwap(recipe, variationId)) return [];
  return CARB_VARIATION_OPTIONS;
}

export function fatVariationLabels(
  recipe: Recipe,
  variationId?: string,
): { id: FatVariationId; label: string }[] {
  if (!recipeSupportsFatSwap(recipe, variationId)) return [];
  return FAT_VARIATION_OPTIONS;
}

function rawRecipeIngredients(recipe: Recipe, variationId?: string): RecipeIngredient[] {
  const v = getVariationDetail(recipe, variationId);
  if (v) return [...recipe.ingredients, ...v.ingredients];
  return recipe.ingredients;
}

export function createPlannedMeal(
  slot: MealSlotId,
  recipe: Recipe,
  partial?: Partial<Omit<PlannedMeal, "slot" | "recipe">>,
): PlannedMeal {
  return {
    slot,
    recipe,
    scale: partial?.scale ?? 1,
    mealPrep: partial?.mealPrep,
    selectedVariationId: partial?.selectedVariationId ?? defaultVariationId(recipe),
  };
}

export function getVariationDetail(
  recipe: Recipe,
  variationId?: string,
): RecipeVariationDetail | null {
  const id = resolveVariationId(recipe, variationId);
  if (!id || !recipe.variationDetails?.length) return null;
  return recipe.variationDetails.find((v) => v.id === id) ?? null;
}

export function variationLabels(recipe: Recipe): { id: string; label: string }[] {
  if (recipe.variationDetails?.length) {
    return recipe.variationDetails.map((v) => ({ id: v.id, label: v.label }));
  }
  return (recipe.variations ?? []).map((label) => ({
    id: label.toLowerCase().replace(/\s+/g, "-"),
    label,
  }));
}

/** Fiber per recipe serving, from ingredients after carb/fat swaps so sides are counted and meat-and-oil plates stay near 0. */
export function recipeFiberGrams(
  recipe: Recipe,
  variationId?: string,
  carbVariationId?: CarbVariationId,
  fatVariationId?: FatVariationId,
): number {
  const ingredients = resolveRecipeIngredients(recipe, variationId, carbVariationId, fatVariationId);
  const fromIngredients = estimateFiberFromIngredients(ingredients);
  if (fromIngredients > 0) return fromIngredients;
  if (typeof recipe.fiber === "number" && Number.isFinite(recipe.fiber)) {
    return Math.max(0, Math.round(recipe.fiber));
  }
  return 0;
}

export function resolveRecipeMacros(
  recipe: Recipe,
  variationId?: string,
  carbVariationId?: CarbVariationId,
): Pick<Recipe, "calories" | "protein" | "carbs" | "fat"> {
  const v = getVariationDetail(recipe, variationId);
  const base = {
    calories: v?.calories ?? recipe.calories,
    protein: v?.protein ?? recipe.protein,
    carbs: v?.carbs ?? recipe.carbs,
    fat: v?.fat ?? recipe.fat,
  };
  const raw = rawRecipeIngredients(recipe, variationId);
  const carb = resolveCarbVariationId(carbVariationId);
  return applyCarbSwapToMacros(base, raw, carb);
}

export function resolveRecipeIngredients(
  recipe: Recipe,
  variationId?: string,
  carbVariationId?: CarbVariationId,
  fatVariationId?: FatVariationId,
): RecipeIngredient[] {
  const raw = rawRecipeIngredients(recipe, variationId);
  const carb = resolveCarbVariationId(carbVariationId);
  const afterCarb = applyCarbSwapToIngredients(raw, carb);
  return applyFatSwapToIngredients(afterCarb, resolveFatVariationId(fatVariationId));
}

export function resolveRecipeInstructions(
  recipe: Recipe,
  variationId?: string,
  carbVariationId?: CarbVariationId,
  fatVariationId?: FatVariationId,
): string[] {
  const v = getVariationDetail(recipe, variationId);
  const base = v ? [...recipe.instructions, ...v.instructions] : recipe.instructions;
  const raw = rawRecipeIngredients(recipe, variationId);
  const carb = resolveCarbVariationId(carbVariationId);
  const afterCarb = recipeIngredientsIncludeRice(raw)
    ? applyCarbSwapToInstructions(base, carb)
    : base;
  return applyFatSwapToInstructions(
    afterCarb,
    resolveFatVariationId(fatVariationId),
    raw,
  );
}

/** Per-ingredient multiplier when boosting protein without over-scaling carbs/fats. */
export function proteinAwareIngredientMultiplier(
  ing: RecipeIngredient,
  totalMult: number,
  prioritizeProtein: boolean,
): number {
  if (!prioritizeProtein || totalMult <= 1.05) return totalMult;
  if (PROTEIN_INGREDIENT_HINT.test(ing.name)) {
    return Math.min(totalMult * 1.08, RECIPE_SCALE_MAX);
  }
  if (CARB_FAT_ADJUST_HINT.test(ing.name)) {
    return Math.max(totalMult * 0.94, RECIPE_SCALE_MIN);
  }
  return totalMult;
}

export function scaledIngredientsForMeal(
  recipe: Recipe,
  variationId: string | undefined,
  mealScale: number,
  householdMult: number,
  prioritizeProtein: boolean,
  carbVariationId?: CarbVariationId,
  fatVariationId?: FatVariationId,
): RecipeIngredient[] {
  const effectiveId = resolveVariationId(recipe, variationId);
  const base = resolveRecipeIngredients(recipe, effectiveId, carbVariationId, fatVariationId);
  const total = mealScale * householdMult;
  const scaled = base.map((ing) => ({
    ...ing,
    quantity: ing.quantity * proteinAwareIngredientMultiplier(ing, total, prioritizeProtein),
  }));
  return applyPracticalIngredientScaling(scaled);
}

export function estimateServingWeightGrams(
  protein: number,
  carbs: number,
  fat: number,
  explicit?: number,
  scale = 1,
): number {
  if (explicit != null) return Math.round(explicit * scale);
  const kcal = (protein * 4 + carbs * 4 + fat * 9) * scale;
  return Math.round(kcal / 1.05);
}

export function servingWeightForMeal(
  meal: PlannedMeal,
  householdMult: number,
  targets?: DailyTargets | null,
): number | null {
  const { recipe, scale, mealPrep } = meal;
  const variationId = effectiveVariationId(meal);
  const carbId = effectiveCarbVariationId(meal);
  const macros = resolveRecipeMacros(recipe, variationId, carbId);
  const effectiveScale = scale * householdMult;
  const variation = getVariationDetail(recipe, variationId);

  let base =
    variation?.servingWeightGrams ??
    recipe.servingWeightGrams ??
    estimateServingWeightGrams(
      macros.protein,
      macros.carbs,
      macros.fat,
      undefined,
      1,
    );

  if (recipe.id === "blended-cottage-cheese-pudding-49" && targets) {
    const slotTargetProtein = targets.protein / 4;
    const atScale = macros.protein * scale;
    if (atScale < slotTargetProtein * 0.9) {
      const bump = Math.min(RECIPE_SCALE_MAX, slotTargetProtein / Math.max(atScale, 1));
      base = Math.round(base * Math.min(bump, 1.15));
    }
  }

  const grams = Math.round(base * effectiveScale);

  if (mealPrep && recipe.batchWeightGrams && recipe.mealPrepBatchServings) {
    return grams;
  }
  return grams;
}

export function mixedPersonServingWeights(
  recipe: Recipe,
  opts: {
    meal?: PlannedMeal | null;
    variationId?: string;
    carbVariationId?: CarbVariationId;
    mealScale?: number;
    profile?: UserProfile | null;
    countsOverride?: HouseholdDayCounts | null;
    targets?: DailyTargets | null;
  } = {},
): { label: string; grams: number; kind: "adult" | "child" }[] | null {
  if (!recipeIsMixedBatch(recipe)) return null;
  const mealScale = opts.mealScale ?? opts.meal?.scale ?? 1;
  const people = collapsedPersonPortions(opts.profile, opts.countsOverride);
  if (people.length === 0) return null;
  const variationId =
    opts.variationId ?? (opts.meal ? effectiveVariationId(opts.meal) : undefined);
  const carbVariationId =
    opts.carbVariationId ?? (opts.meal ? effectiveCarbVariationId(opts.meal) : undefined);
  const variation = getVariationDetail(recipe, variationId);
  const macros = resolveRecipeMacros(recipe, variationId, carbVariationId);
  const mealGrams =
    opts.meal != null ? servingWeightForMeal(opts.meal, 1, opts.targets) : null;
  const perRecipe =
    mealGrams != null && opts.meal
      ? mealGrams / Math.max(opts.meal.scale, 0.01)
      : (variation?.servingWeightGrams ??
          recipe.servingWeightGrams ??
          estimateServingWeightGrams(macros.protein, macros.carbs, macros.fat, undefined, 1));
  if (!(perRecipe > 0)) return null;
  return people.map((p) => {
    const title =
      p.label === "Adult" ? "Adult serving" : p.label === "Child" ? "Child serving" : p.label;
    return {
      label: title,
      grams: Math.round(perRecipe * mealScale * p.multiplier),
      kind: p.kind,
    };
  });
}

export function formatPersonServingWeights(
  weights: { label: string; grams: number }[] | null | undefined,
  compact = false,
): string | null {
  if (!weights?.length) return null;
  const parts = weights
    .filter((w) => w.grams > 0)
    .map((w) => `${w.label}: ~${w.grams} g`);
  if (parts.length === 0) return null;
  return compact ? parts.join(" · ") : parts.join("\n");
}

export function batchWeightLabel(
  meal: PlannedMeal,
  householdMult: number,
): string | null {
  const { recipe, scale, mealPrep } = meal;
  if (!mealPrep || !recipe.batchWeightGrams || !recipe.mealPrepBatchServings) {
    return null;
  }
  const portions = mealPrep.portionsCooked;
  const perServing = recipe.servingWeightGrams ?? recipe.batchWeightGrams / recipe.mealPrepBatchServings;
  const batch = Math.round(perServing * portions * scale * householdMult);
  const serving = Math.round(perServing * scale * householdMult);
  return `Jar meal prep: ~${serving} g per serving · ~${batch} g total batch (${portions} jars)`;
}

export function clampMealScaleForRecipe(scale: number): number {
  return Math.min(RECIPE_SCALE_MAX, Math.max(RECIPE_SCALE_MIN, scale));
}

export function mealDisplayName(meal: PlannedMeal): string {
  const baseId = defaultVariationId(meal.recipe);
  const variationId = effectiveVariationId(meal);
  const carbId = effectiveCarbVariationId(meal);
  const parts: string[] = [meal.recipe.name];

  if (baseId && variationId && variationId !== baseId) {
    const v = getVariationDetail(meal.recipe, variationId);
    if (v) parts.push(v.label);
  }

  if (carbId !== "white-rice" && recipeSupportsCarbSwap(meal.recipe, variationId)) {
    parts.push(carbVariationLabel(carbId));
  }

  return parts.length === 1 ? parts[0]! : parts.join(" — ");
}

export function shouldShowProteinAdjustNote(
  profile: UserProfile | null,
  meal: PlannedMeal,
): boolean {
  if (!profile?.prioritizeMinProtein) return false;
  return clampMealScaleForRecipe(meal.scale) > 1.05;
}

export function recipeIsMixedBatch(recipe: Recipe): boolean {
  if (recipe.cookStyle === "mixed") return true;
  if (recipe.cookStyle === "assembled") return false;
  const name = recipe.name.toLowerCase();
  if (
    /sandwich|taco|toast|platter|wrap|quesadilla|burrito|bagel/.test(name) &&
    !/skillet|soup|stew|chili|casserole/.test(name)
  ) {
    return false;
  }
  const steps = [
    ...recipe.instructions,
    ...(recipe.variationDetails ?? []).flatMap((v) => v.instructions),
  ]
    .join(" ")
    .toLowerCase();
  if (
    /close the sandwich|stack fried eggs|stack eggs|build the sandwich|serve open-faced|warm deli ham|toast the bread|layer bacon/.test(
      steps,
    )
  ) {
    return false;
  }
  return true;
}

function isServingGuidancePart(ing: RecipeIngredient): boolean {
  const name = ing.name.toLowerCase();
  if (ing.category === "Spices") return false;
  if (/salt|pepper|oil|butter|seasoning/.test(name) && ing.category !== "Protein") return false;
  if (ing.category === "Protein" || ing.category === "Grains") return true;
  if (/milk|sweetened drink|soda|juice/.test(name)) return true;
  return /avocado/.test(name);
}

function servingPartRank(ing: RecipeIngredient): number {
  const name = ing.name.toLowerCase();
  if (/egg/.test(name)) return 0;
  if (/ham|bacon|turkey bacon|sausage|steak|chicken/.test(name)) return 1;
  if (/toast|bread|bagel|biscuit|tortilla/.test(name)) return 2;
  if (/avocado|tomato/.test(name)) return 3;
  if (/cheese/.test(name)) return 4;
  return 5;
}

function servingNoun(ing: RecipeIngredient, qty: number): string {
  const name = ing.name
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const plural = qty >= 1.5;
  if (/egg/.test(name)) return plural ? "eggs" : "egg";
  if (/ham/.test(name)) return plural ? "slices ham" : "slice ham";
  if (/turkey bacon/.test(name)) return plural ? "slices turkey bacon" : "slice turkey bacon";
  if (/bacon/.test(name)) return plural ? "slices bacon" : "slice bacon";
  if (
    /sliced bread|toast|^bread$/.test(name) ||
    /for toast/i.test(ing.name)
  ) {
    if (qty >= 1.5) return "slices toast";
    return "toast";
  }
  if (/bagel/.test(name)) return plural ? "bagels" : "bagel";
  if (/biscuit/.test(name)) return plural ? "biscuits" : "biscuit";
  if (/tortilla/.test(name)) return plural ? "tortillas" : "tortilla";
  if (/avocado/.test(name)) return "avocado";
  const unit = ing.unit.toLowerCase();
  if (unit === "slice" || unit === "slices") {
    const noun = name.replace(/^sliced /, "");
    return plural ? `slices ${noun}` : `slice ${noun}`;
  }
  return name;
}

function formatServingQty(ing: RecipeIngredient, qty: number): string {
  const toastLike = /toast|sliced bread|for toast|^bread$/i.test(ing.name);
  if (toastLike && qty > 0.3 && qty < 0.85) return "½–1";
  const rounded =
    /egg|slice|ham|bacon|toast|bagel|biscuit|tortilla/i.test(ing.name)
      ? Math.max(0.5, Math.round(qty * 2) / 2)
      : qty;
  return formatPracticalQty(rounded);
}

function formatServingPart(ing: RecipeIngredient, qty: number): string {
  const amount = formatServingQty(ing, qty);
  const unit = ing.unit.toLowerCase();
  const noun = servingNoun(ing, qty);
  if (
    /egg|ham|bacon|toast|bagel|biscuit|tortilla|bread/.test(ing.name.toLowerCase()) ||
    unit === "slice" ||
    unit === "slices" ||
    unit === "large"
  ) {
    return `${amount} ${noun}`;
  }
  return `${amount} ${ing.unit} ${noun}`;
}

export function assembledServingGuidance(
  recipe: Recipe,
  opts: {
    variationId?: string;
    carbVariationId?: CarbVariationId;
    fatVariationId?: FatVariationId;
    mealScale?: number;
    profile?: UserProfile | null;
    countsOverride?: HouseholdDayCounts | null;
  } = {},
): string | null {
  if (recipeIsMixedBatch(recipe)) return null;
  const mealScale = opts.mealScale ?? 1;
  const ingredients = resolveRecipeIngredients(
    recipe,
    opts.variationId,
    opts.carbVariationId,
    opts.fatVariationId,
  );
  const parts = ingredients
    .filter(isServingGuidancePart)
    .sort((a, b) => servingPartRank(a) - servingPartRank(b))
    .slice(0, 4);
  if (parts.length === 0) return null;
  const people = collapsedPersonPortions(opts.profile, opts.countsOverride);
  if (people.length === 0) return null;
  return (
    people
      .map((p) => {
        const line = parts
          .map((ing) => formatServingPart(ing, ing.quantity * mealScale * p.multiplier))
          .join(" + ");
        return `${p.label}: ${line}`;
      })
      .join(". ") + "."
  );
}

export function platingNoteForHousehold(
  profile: UserProfile | null | undefined,
  countsOverride?: HouseholdDayCounts | null,
): string | null {
  const { children } = resolveHouseholdCounts(profile, countsOverride);
  if (children <= 0) return null;
  return `Cook the full batch, then plate larger adult portions and smaller child portions (${formatHouseholdServingSplit(profile, countsOverride)}).`;
}

export function perPersonIngredientQty(
  baseQuantity: number,
  mealScale: number,
  personMult: number,
  ing: RecipeIngredient,
  prioritizeProtein: boolean,
): number {
  return (
    baseQuantity * proteinAwareIngredientMultiplier(ing, mealScale * personMult, prioritizeProtein)
  );
}
