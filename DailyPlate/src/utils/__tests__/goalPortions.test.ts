import { describe, expect, it } from "vitest";
import type { DailyTargets, PlannedMeal, RecipeIngredient } from "@/types";
import { recipeLibrary } from "@/recipes/recipeLibrary";
import {
  fitsTarget,
  nutritionOfLines,
  portionLines,
  roundPortionLine,
  ROLE_LIMITS,
  solveRoleMultipliers,
} from "@/utils/goalPortions";
import {
  cookedGramsFromMeasured,
  measuredGramsFromCooked,
  nutritionForGrams,
} from "@/utils/ingredientNutrition";
import { fitNotice, sizeMealToTarget } from "@/utils/mealPortions";
import { stepsWithAmounts } from "@/utils/prepSteps";
import { createPlannedMeal, resolveRecipeIngredients, resolveRecipeInstructions } from "@/utils/recipeDisplay";

function target(kcal: number): DailyTargets {
  const protein = Math.round((kcal * 0.3) / 4);
  const rest = kcal - protein * 4;
  return { calories: kcal, protein, carbs: Math.round((rest * 0.52) / 4), fat: Math.round((rest * 0.48) / 9), fiber: 8 };
}

const teriyaki = recipeLibrary.find((r) => r.name === "Teriyaki Turkey Rice Bowls")!;
const teriyakiIngredients = resolveRecipeIngredients(teriyaki);

describe("role limits", () => {
  it("multipliers stay inside the limits for very small and very large targets", () => {
    for (const recipe of recipeLibrary.slice(0, 40)) {
      const ings = resolveRecipeIngredients(recipe);
      for (const kcal of [120, 3000]) {
        const m = solveRoleMultipliers(ings, target(kcal));
        for (const role of ["protein", "carb", "fat", "vegetable"] as const) {
          expect(m[role]).toBeGreaterThanOrEqual(ROLE_LIMITS[role].min - 1e-9);
          expect(m[role]).toBeLessThanOrEqual(ROLE_LIMITS[role].max + 1e-9);
        }
      }
    }
  });

  it("flavor ingredients do not scale with the meal target", () => {
    const small = portionLines(teriyakiIngredients, solveRoleMultipliers(teriyakiIngredients, target(450)));
    const large = portionLines(teriyakiIngredients, solveRoleMultipliers(teriyakiIngredients, target(750)));
    const sauce = (lines: typeof small) => lines.find((l) => /teriyaki/i.test(l.ingredient.name))!;
    expect(sauce(small).role).toBe("flavor");
    expect(sauce(small).ingredient.quantity).toBe(sauce(large).ingredient.quantity);
  });

  it("flavor ingredients still scale with the batch size", () => {
    const m = solveRoleMultipliers(teriyakiIngredients, target(600));
    const one = portionLines(teriyakiIngredients, m, 1).find((l) => /teriyaki/i.test(l.ingredient.name))!;
    const three = portionLines(teriyakiIngredients, m, 3).find((l) => /teriyaki/i.test(l.ingredient.name))!;
    expect(three.grams!).toBeGreaterThan(one.grams! * 2.5);
  });
});

describe("rounding, then recalculation", () => {
  it("nutrition is recalculated from the rounded amounts", () => {
    const lines = portionLines(teriyakiIngredients, solveRoleMultipliers(teriyakiIngredients, target(600)));
    const fromRounded = lines.reduce(
      (sum, l) => sum + nutritionForGrams(l.ingredient.name, l.nutritionGrams!)!.calories,
      0,
    );
    expect(nutritionOfLines(lines)!.calories).toBeCloseTo(fromRounded, 6);
  });

  it("weighed foods round to 5 g and eggs to whole eggs", () => {
    const turkey: RecipeIngredient = { name: "Lean ground turkey", quantity: 6, unit: "oz", category: "Protein" };
    const egg: RecipeIngredient = { name: "Eggs", quantity: 1, unit: "large", category: "Protein" };
    const t = roundPortionLine(turkey, 6.37, "protein");
    expect(t.grams! % 5).toBe(0);
    expect(t.stateLabel).toBe("raw");
    const e = roundPortionLine(egg, 2.6, "protein");
    expect(e.count).toBe(3);
    expect(Number.isInteger(e.ingredient.quantity)).toBe(true);
  });

  it("oil rounds to whole teaspoons", () => {
    const oil: RecipeIngredient = { name: "Olive oil", quantity: 1, unit: "tsp", category: "Pantry" };
    const line = roundPortionLine(oil, 1.6, "fat");
    expect(line.ingredient.unit).toBe("tsp");
    expect(line.ingredient.quantity).toBe(2);
  });
});

describe("yield factors", () => {
  it("converts raw meat to cooked weight and back", () => {
    expect(cookedGramsFromMeasured("Lean ground turkey", 200)).toBeCloseTo(150, 6);
    expect(measuredGramsFromCooked("Lean ground turkey", 150)).toBeCloseTo(200, 6);
  });

  it("shows cooked rice as a dry amount and counts cooked grams for nutrition", () => {
    const rice: RecipeIngredient = { name: "Cooked rice", quantity: 1, unit: "cup", category: "Grains" };
    const line = roundPortionLine(rice, 1, "carb");
    expect(line.stateLabel).toBe("dry");
    expect(line.grams).toBe(60); // 158 g cooked ÷ 2.6 ≈ 61 g → 60 g
    expect(line.nutritionGrams).toBeCloseTo(60 * 2.6, 6);
  });
});

describe("fit notice threshold", () => {
  const t: DailyTargets = { calories: 600, protein: 45, carbs: 60, fat: 20, fiber: 8 };
  it("fits at 9.9% off and does not fit at 10.1% off", () => {
    expect(fitsTarget({ calories: 600 * 0.901, protein: 45 }, t)).toBe(true);
    expect(fitsTarget({ calories: 600 * 0.899, protein: 45 }, t)).toBe(false);
    expect(fitsTarget({ calories: 600 * 1.099, protein: 45 }, t)).toBe(true);
    expect(fitsTarget({ calories: 600 * 1.101, protein: 45 }, t)).toBe(false);
  });

  it("small targets use a 50 kcal tolerance (larger than 10%)", () => {
    const small: DailyTargets = { calories: 300, protein: 10, carbs: 35, fat: 10, fiber: 3 };
    expect(fitsTarget({ calories: 300 - 49, protein: 10 }, small)).toBe(true);
    expect(fitsTarget({ calories: 300 - 51, protein: 10 }, small)).toBe(false);
    expect(fitsTarget({ calories: 300 + 50, protein: 10 }, small)).toBe(true);
    expect(fitsTarget({ calories: 300 + 51, protein: 10 }, small)).toBe(false);
  });

  it("the switch from 50 kcal to 10% happens at a 500 kcal target", () => {
    const at = (calories: number): DailyTargets => ({ calories, protein: 10, carbs: 50, fat: 15, fiber: 5 });
    expect(fitsTarget({ calories: 450, protein: 10 }, at(500))).toBe(true);
    expect(fitsTarget({ calories: 449, protein: 10 }, at(500))).toBe(false);
    expect(fitsTarget({ calories: 800 - 79, protein: 10 }, at(800))).toBe(true);
    expect(fitsTarget({ calories: 800 - 81, protein: 10 }, at(800))).toBe(false);
  });

  it("snacks ignore protein", () => {
    const snack: DailyTargets = { calories: 200, protein: 15, carbs: 20, fat: 8, fiber: 3 };
    expect(fitsTarget({ calories: 200, protein: 4 }, snack, { caloriesOnly: true })).toBe(true);
    expect(fitsTarget({ calories: 200, protein: 4 }, snack)).toBe(false);
  });

  it("protein must reach the target (2 g allowance)", () => {
    expect(fitsTarget({ calories: 600, protein: 43 }, t)).toBe(true);
    expect(fitsTarget({ calories: 600, protein: 42.9 }, t)).toBe(false);
  });

  it("notice shows for a meal that does not fit and hides after Keep", () => {
    const base: PlannedMeal = createPlannedMeal("dinner", teriyaki);
    const at = (kcalGap: number): PlannedMeal => ({
      ...base,
      portion: {
        multipliers: { protein: 1, carb: 1, fat: 1, vegetable: 1 },
        target: t,
        kcalGap,
        fits: fitsTarget({ calories: t.calories + kcalGap, protein: t.protein }, t),
      },
    });
    expect(fitNotice(at(-59))).toBeNull(); // 9.8% under
    expect(fitNotice(at(-61))).toBe("This meal is about 60 kcal under your target.");
    expect(fitNotice(at(61))).toBe("This meal is about 60 kcal over your target.");
    expect(fitNotice({ ...at(-61), kept: true })).toBeNull();
  });

  it("notice uses the 50 kcal floor on small meals", () => {
    const small: DailyTargets = { calories: 300, protein: 10, carbs: 35, fat: 10, fiber: 3 };
    const base: PlannedMeal = createPlannedMeal("snack", teriyaki);
    const at = (kcalGap: number): PlannedMeal => ({
      ...base,
      portion: {
        multipliers: { protein: 1, carb: 1, fat: 1, vegetable: 1 },
        target: small,
        kcalGap,
        fits: fitsTarget({ calories: small.calories + kcalGap, protein: small.protein }, small, { caloriesOnly: true }),
      },
    });
    expect(fitNotice(at(-49))).toBeNull(); // 16% under but within 50 kcal
    expect(fitNotice(at(-51))).toBe("This meal is about 50 kcal under your target.");
  });

  it("Teriyaki fits a 600 kcal target after sizing", () => {
    const sized = sizeMealToTarget(createPlannedMeal("dinner", teriyaki), target(600));
    expect(sized.portion!.fits).toBe(true);
  });
});

describe("prep steps", () => {
  it("puts the scaled amounts inline", () => {
    const lines = portionLines(teriyakiIngredients, solveRoleMultipliers(teriyakiIngredients, target(600)));
    const steps = stepsWithAmounts(resolveRecipeInstructions(teriyaki), lines).join(" ");
    expect(steps).toMatch(/Brown \d+ g turkey/);
    expect(steps).toMatch(/\d+ tbsp teriyaki sauce/);
  });
});
