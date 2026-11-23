/**
 * Goal-based portion report.
 * 1. Teriyaki Turkey Rice Bowls sized to ~450 and ~750 kcal meal targets.
 * 2. Recipes that cannot reach typical meal targets inside the role limits.
 *
 * Reference meal targets: protein 30% of kcal; the rest split Balanced (52% carbs / 48% fat).
 * Main meals are checked at 400 / 600 / 800 kcal; snack-only recipes at 150 / 250 kcal.
 *
 * Usage: npm run portions:report
 */
import { recipeLibrary } from "../src/recipes/recipeLibrary.ts";
import type { DailyTargets, PlannedMeal, Recipe } from "../src/types/index.ts";
import { isBeverageRecipe } from "../src/utils/beverages.ts";
import { formatPortionLine } from "../src/utils/goalPortions.ts";
import {
  isPackagedRecipe,
  mealFoodNutrition,
  mealPortionLines,
  servingSummary,
  sizeMealToTarget,
} from "../src/utils/mealPortions.ts";
import { createPlannedMeal, defaultVariationId } from "../src/utils/recipeDisplay.ts";
import { splitRemainingMacros } from "../src/utils/macroSplit.ts";

function referenceTarget(kcal: number): DailyTargets {
  const protein = Math.round((kcal * 0.3) / 4);
  const { carbKcal, fatKcal } = splitRemainingMacros(kcal - protein * 4, "balanced");
  return {
    calories: kcal,
    protein,
    carbs: Math.round(carbKcal / 4),
    fat: Math.round(fatKcal / 9),
    fiber: Math.round((kcal / 1000) * 14),
  };
}

function sized(recipe: Recipe, target: DailyTargets): PlannedMeal {
  const slot = recipe.mealSlots.includes("dinner")
    ? "dinner"
    : recipe.mealSlots.includes("lunch")
      ? "lunch"
      : recipe.mealSlots[0] ?? "dinner";
  const meal = createPlannedMeal(slot, recipe, { selectedVariationId: defaultVariationId(recipe) });
  return sizeMealToTarget(meal, target);
}

function macroLine(n: { calories: number; protein: number; carbs: number; fat: number; fiber: number }): string {
  return `${Math.round(n.calories)} kcal · ${Math.round(n.protein)} g protein · ${Math.round(n.carbs)} g carbs · ${Math.round(n.fat)} g fat · ${Math.round(n.fiber)} g fiber`;
}

// 1. Teriyaki example
const teriyaki = recipeLibrary.find((r) => r.name === "Teriyaki Turkey Rice Bowls");
if (!teriyaki) throw new Error("Teriyaki Turkey Rice Bowls not found");
console.log("Teriyaki Turkey Rice Bowls — base recipe (1 serving):");
for (const line of mealPortionLines(createPlannedMeal("dinner", teriyaki), 1)) {
  console.log(`  ${formatPortionLine(line)}`);
}
console.log(`  ${macroLine(mealFoodNutrition(createPlannedMeal("dinner", teriyaki)))}`);
for (const kcal of [450, 750]) {
  const target = referenceTarget(kcal);
  const meal = sized(teriyaki, target);
  const n = mealFoodNutrition(meal);
  const m = meal.portion!.multipliers;
  console.log("");
  console.log(
    `Target ~${kcal} kcal (${target.protein} g protein, ${target.carbs} g carbs, ${target.fat} g fat):`,
  );
  console.log(
    `  role multipliers: protein ×${m.protein.toFixed(2)}, carb ×${m.carb.toFixed(2)}, fat ×${m.fat.toFixed(2)}, vegetable ×${m.vegetable.toFixed(2)}`,
  );
  for (const line of mealPortionLines(meal, 1)) console.log(`  ${formatPortionLine(line)}`);
  console.log(`  ${servingSummary(meal)?.text ?? "(no serving line)"}`);
  console.log(`  ${macroLine(n)}`);
  console.log(
    `  ${meal.portion!.fits ? "FITS" : "DOES NOT FIT"} (calories ${meal.portion!.kcalGap >= 0 ? "+" : ""}${meal.portion!.kcalGap} vs target, protein ${Math.round(n.protein)} vs ${target.protein} g)`,
  );
}

// 2. Recipes that miss
function report(title: string, recipes: Recipe[], levels: number[]) {
  console.log("");
  console.log(title);
  let misses = 0;
  for (const recipe of recipes) {
    const parts: string[] = [];
    for (const kcal of levels) {
      const target = referenceTarget(kcal);
      const meal = sized(recipe, target);
      const p = meal.portion!;
      if (p.fits) continue;
      const n = mealFoodNutrition(meal);
      const proteinShort = n.protein < target.protein - 2 ? `, protein ${Math.round(n.protein)}/${target.protein} g` : "";
      parts.push(`${kcal}: ${p.kcalGap >= 0 ? "+" : ""}${p.kcalGap} kcal${proteinShort}`);
    }
    if (parts.length > 0) {
      misses += 1;
      console.log(`  ${recipe.name} — ${parts.join(" | ")}`);
    }
  }
  console.log(`  ${misses} of ${recipes.length} recipes miss at least one level.`);
}

const eligible = recipeLibrary.filter((r) => !isBeverageRecipe(r) && !isPackagedRecipe(r));
const isSnackOnly = (r: Recipe) => r.mealSlots.every((s) => s === "snack");
report(
  "Main-meal recipes that cannot reach 400 / 600 / 800 kcal within the role limits (gap after rounding):",
  eligible.filter((r) => !isSnackOnly(r)),
  [400, 600, 800],
);
report(
  "Snack-only recipes that cannot reach 150 / 250 kcal:",
  eligible.filter(isSnackOnly),
  [150, 250],
);
