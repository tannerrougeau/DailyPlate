/**
 * Recompute every recipe from ingredients and list stored values that differ by more than 10%.
 * Does not delete stored calories, protein, carbs, fat, or fiber.
 *
 * Usage: npm run nutrition:compare
 */
import { recipeLibrary } from "../src/recipes/recipeLibrary.ts";
import type { Recipe, RecipeIngredient, RecipeVariationDetail } from "../src/types/index.ts";
import {
  nutritionFromIngredients,
  unmatchedIngredients,
} from "../src/utils/ingredientNutrition.ts";
import { resolveRecipeIngredients } from "../src/utils/recipeDisplay.ts";

type Stored = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
};

function pct(oldValue: number, next: number): number {
  const denom = Math.max(Math.abs(oldValue), 1);
  return (Math.abs(Math.round(next) - Math.round(oldValue)) / denom) * 100;
}

function differs(oldValue: number | undefined, next: number): boolean {
  if (oldValue == null || !Number.isFinite(oldValue)) return false;
  return pct(oldValue, next) > 10;
}

function storedFor(recipe: Recipe, variation: RecipeVariationDetail | null): Stored {
  return {
    calories: variation?.calories ?? recipe.calories,
    protein: variation?.protein ?? recipe.protein,
    carbs: variation?.carbs ?? recipe.carbs,
    fat: variation?.fat ?? recipe.fat,
    fiber: variation?.fiber ?? recipe.fiber,
  };
}

function reportRow(
  label: string,
  note: string,
  ingredients: RecipeIngredient[],
  stored: Stored,
): boolean {
  const missing = unmatchedIngredients(ingredients);
  if (missing.length > 0) {
    console.log(`UNMATCHED  ${label}`);
    for (const line of missing) console.log(`    ${line}`);
    return true;
  }
  const computed = nutritionFromIngredients(ingredients, 1);
  if (!computed) return false;
  const fields = [
    ["calories", stored.calories, computed.calories],
    ["protein", stored.protein, computed.protein],
    ["carbs", stored.carbs, computed.carbs],
    ["fat", stored.fat, computed.fat],
    ["fiber", stored.fiber, computed.fiber],
  ] as const;
  const bad = fields.filter(([, oldValue, next]) => differs(oldValue, next));
  if (bad.length === 0) return false;
  console.log(`${label}${note ? ` (${note})` : ""}`);
  for (const [name, oldValue, next] of bad) {
    if (oldValue == null) continue;
    console.log(
      `  ${name}: stored ${Math.round(oldValue)} → computed ${Math.round(next)} (${Math.round(pct(oldValue, next))}%)`,
    );
  }
  return true;
}

const teriyaki: RecipeIngredient[] = [
  { name: "Lean ground turkey", quantity: 14, unit: "oz", category: "Protein" },
  { name: "Cooked white rice", quantity: 2.5, unit: "cup", category: "Grains" },
  { name: "Teriyaki sauce", quantity: 5, unit: "tbsp", category: "Pantry" },
  { name: "Broccoli, cooked", quantity: 3.5, unit: "cups", category: "Produce" },
  { name: "Sesame seeds", quantity: 2.5, unit: "tsp", category: "Pantry" },
];

const test = nutritionFromIngredients(teriyaki, 2);
console.log("Teriyaki Turkey Rice Bowls test (2 servings, per serving)");
if (!test) {
  console.log("  FAILED: an ingredient did not match");
  console.log(unmatchedIngredients(teriyaki).join("\n"));
  process.exit(1);
}
console.log(
  `  computed ${Math.round(test.calories)} kcal, ${Math.round(test.protein)} g protein, ${Math.round(test.carbs)} g carbs, ${Math.round(test.fat)} g fat, ${Math.round(test.fiber)} g fiber`,
);
console.log("  target   ~710 kcal, 52 g protein, 83 g carbs, 20 g fat");
const testOk =
  test.calories >= 680 &&
  test.calories <= 740 &&
  test.protein >= 48 &&
  test.protein <= 56 &&
  test.carbs >= 75 &&
  test.carbs <= 90 &&
  test.fat >= 17 &&
  test.fat <= 24;
console.log(testOk ? "  PASS" : "  FAIL");
console.log("");
console.log("Stored vs computed, more than 10% (stored values kept):");

let flagged = 0;
for (const recipe of recipeLibrary) {
  const variations = recipe.variationDetails ?? [];
  if (variations.length === 0) {
    if (reportRow(recipe.name, "", recipe.ingredients, storedFor(recipe, null))) flagged += 1;
    continue;
  }
  for (const variation of variations) {
    const ingredients = resolveRecipeIngredients(recipe, variation.id);
    const note = variation.calories == null ? "variation has no stored macros; compared with the base recipe" : "";
    if (reportRow(`${recipe.name} — ${variation.label}`, note, ingredients, storedFor(recipe, variation))) {
      flagged += 1;
    }
  }
}

console.log("");
console.log(`${flagged} recipe builds differ by more than 10% or have an unmatched ingredient.`);
if (!testOk) process.exit(1);
