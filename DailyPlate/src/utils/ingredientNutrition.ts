import catalogJson from "@/data/ingredients.json";
import type { IngredientCategory, IngredientRole, RecipeIngredient } from "@/types";

export type NutrientVector = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

export type IngredientRecord = {
  id: string;
  name: string;
  fdcId: number | null;
  query: string;
  per100g: NutrientVector;
  grams: Record<string, number | null>;
  aliases: string[];
  role?: IngredientRole;
  /** How recipe amounts are measured: raw, dry, cooked, or as sold. */
  state?: IngredientState;
  /** cookedPerRaw = cooked weight ÷ measured weight, with its source. */
  yield?: { cookedPerRaw: number; source: string; dryCupGrams?: number } | null;
};

export type IngredientState = "raw" | "dry" | "cooked" | "as-sold";

const catalog = catalogJson as unknown as IngredientRecord[];

const byAlias = new Map<string, IngredientRecord>();
for (const food of catalog) {
  for (const alias of food.aliases) {
    byAlias.set(normalizeName(alias), food);
  }
}

export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

/** First option of an "or" choice, ignoring "or" inside parentheses. */
export function firstIngredientOption(name: string): string {
  let depth = 0;
  const lower = name.toLowerCase();
  for (let i = 0; i < name.length; i++) {
    const ch = name[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0 && lower.startsWith(" or ", i)) {
      return name.slice(0, i).trim();
    }
  }
  return name.trim();
}

export function matchIngredient(name: string): IngredientRecord | null {
  const full = normalizeName(name);
  const direct = byAlias.get(full);
  if (direct) return direct;
  const first = normalizeName(firstIngredientOption(name).replace(/\([^)]*\)/g, " "));
  return byAlias.get(first) ?? byAlias.get(normalizeName(name.replace(/\([^)]*\)/g, " "))) ?? null;
}

export function normalizeUnit(unit: string): string {
  const u = unit.toLowerCase().trim().replace(/\.$/, "");
  if (u === "cups") return "cup";
  if (u === "tablespoon" || u === "tablespoons") return "tbsp";
  if (u === "teaspoon" || u === "teaspoons") return "tsp";
  if (u === "slices") return "slice";
  if (u === "cloves") return "clove";
  if (u === "grams" || u === "gram") return "g";
  if (u === "ounce" || u === "ounces") return "oz";
  if (u === "floz" || u === "fluid ounce" || u === "fluid ounces") return "fl oz";
  return u;
}

export function gramsForIngredient(
  ing: Pick<RecipeIngredient, "name" | "quantity" | "unit">,
): number | null {
  const food = matchIngredient(ing.name);
  if (!food) return null;
  const unit = normalizeUnit(ing.unit);
  const per = food.grams[unit];
  if (per == null || !Number.isFinite(per)) return null;
  if (!Number.isFinite(ing.quantity) || ing.quantity < 0) return null;
  return ing.quantity * per;
}

export function unmatchedIngredients(ingredients: RecipeIngredient[]): string[] {
  const missing: string[] = [];
  for (const ing of ingredients) {
    const food = matchIngredient(ing.name);
    const grams = gramsForIngredient(ing);
    if (!food || grams == null) {
      missing.push(`${ing.quantity} ${ing.unit} ${ing.name}`);
    }
  }
  return missing;
}

/** Sum of ingredient grams × per-100 g USDA values, divided by servings. */
export function nutritionFromIngredients(
  ingredients: RecipeIngredient[],
  servings = 1,
): NutrientVector | null {
  if (!(servings > 0)) return null;
  const totals: NutrientVector = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  for (const ing of ingredients) {
    const food = matchIngredient(ing.name);
    const grams = gramsForIngredient(ing);
    if (!food || grams == null) return null;
    const factor = grams / 100;
    totals.calories += food.per100g.calories * factor;
    totals.protein += food.per100g.protein * factor;
    totals.carbs += food.per100g.carbs * factor;
    totals.fat += food.per100g.fat * factor;
    totals.fiber += food.per100g.fiber * factor;
  }
  return {
    calories: totals.calories / servings,
    protein: totals.protein / servings,
    carbs: totals.carbs / servings,
    fat: totals.fat / servings,
    fiber: totals.fiber / servings,
  };
}

export function ingredientCatalog(): IngredientRecord[] {
  return catalog;
}

const CATEGORY_ROLE: Partial<Record<IngredientCategory, IngredientRole>> = {
  Protein: "protein",
  Grains: "carb",
  Spices: "flavor",
  Produce: "vegetable",
};

/** Recipe override, then ingredients.json default, then category, then flavor. */
export function ingredientRole(ing: Pick<RecipeIngredient, "name" | "category" | "role">): IngredientRole {
  if (ing.role) return ing.role;
  const food = matchIngredient(ing.name);
  if (food?.role) return food.role;
  return CATEGORY_ROLE[ing.category] ?? "flavor";
}

export function ingredientState(name: string): IngredientState {
  return matchIngredient(name)?.state ?? "as-sold";
}

/** Cooked weight ÷ measured weight; 1 when the food does not change weight. */
export function cookedPerMeasured(name: string): number {
  const y = matchIngredient(name)?.yield?.cookedPerRaw;
  return y != null && Number.isFinite(y) && y > 0 ? y : 1;
}

/** Grams of the food in the state ingredients.json measures it, from a cooked weight. */
export function measuredGramsFromCooked(name: string, cookedGrams: number): number {
  return cookedGrams / cookedPerMeasured(name);
}

/** Cooked weight from grams in the measured (raw or dry) state. */
export function cookedGramsFromMeasured(name: string, measuredGrams: number): number {
  return measuredGrams * cookedPerMeasured(name);
}

/** Nutrients for a gram amount of a matched food. */
export function nutritionForGrams(name: string, grams: number): NutrientVector | null {
  const food = matchIngredient(name);
  if (!food || !Number.isFinite(grams)) return null;
  const f = grams / 100;
  return {
    calories: food.per100g.calories * f,
    protein: food.per100g.protein * f,
    carbs: food.per100g.carbs * f,
    fat: food.per100g.fat * f,
    fiber: food.per100g.fiber * f,
  };
}

/** Grams per one of the given unit for a food, or null when unknown. */
export function gramsPerUnit(name: string, unit: string): number | null {
  const food = matchIngredient(name);
  if (!food) return null;
  const per = food.grams[normalizeUnit(unit)];
  return per != null && Number.isFinite(per) && per > 0 ? per : null;
}

export function addNutrients(a: NutrientVector, b: NutrientVector, times = 1): NutrientVector {
  return {
    calories: a.calories + b.calories * times,
    protein: a.protein + b.protein * times,
    carbs: a.carbs + b.carbs * times,
    fat: a.fat + b.fat * times,
    fiber: a.fiber + b.fiber * times,
  };
}

export const ZERO_NUTRIENTS: NutrientVector = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
