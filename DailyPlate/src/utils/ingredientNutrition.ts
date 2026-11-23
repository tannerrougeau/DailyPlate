import catalogJson from "@/data/ingredients.json";
import type { RecipeIngredient } from "@/types";

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
};

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
