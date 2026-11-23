import { describe, expect, it } from "vitest";
import type { DailyTargets } from "@/types";
import { recipeLibrary } from "@/recipes/recipeLibrary";
import { mealFoodNutrition, sizeMealToTarget } from "@/utils/mealPortions";
import { sideOptionsForSlot, suggestSides } from "@/utils/mealSides";
import { createPlannedMeal } from "@/utils/recipeDisplay";

const BREAKFAST_NAMES = ["Bread (for toast)", "Banana", "Apple", "Berries", "Rolled oats", "Milk (2%)", "Plain Greek yogurt"];
const MAIN_NAMES = ["Cooked rice", "Potato (cubed)", "Bread (for toast)", "Banana", "Apple"];

const t = (calories: number, protein: number): DailyTargets => ({
  calories,
  protein,
  carbs: Math.round((calories * 0.45) / 4),
  fat: Math.round((calories * 0.3) / 9),
  fiber: 8,
});

describe("suggestSides", () => {
  it("offers breakfast sides at breakfast and starch/fruit sides at lunch and dinner", () => {
    const b = suggestSides({ calories: 400, protein: 35 }, t(600, 35), "breakfast")!;
    expect(b).not.toBeNull();
    expect(b.sides.every((s) => BREAKFAST_NAMES.includes(s.name))).toBe(true);
    const d = suggestSides({ calories: 500, protein: 50 }, t(750, 50), "dinner")!;
    expect(d.sides.every((s) => MAIN_NAMES.includes(s.name))).toBe(true);
    expect(d.sides.length).toBeLessThanOrEqual(2);
  });

  it("closes the calorie gap to within 10% when it says it fits", () => {
    const current = { calories: 420, protein: 36 };
    const target = t(600, 36);
    const s = suggestSides(current, target, "breakfast")!;
    expect(s.fits).toBe(true);
    expect(Math.abs(target.calories - (current.calories + s.nutrition.calories))).toBeLessThanOrEqual(60);
  });

  it("prefers a protein side when protein is short too", () => {
    const s = suggestSides({ calories: 380, protein: 20 }, t(560, 40), "breakfast")!;
    expect(s.sides.some((x) => /yogurt|milk/i.test(x.name))).toBe(true);
  });

  it("no side for snacks or for meals within 10%", () => {
    expect(sideOptionsForSlot("snack")).toEqual([]);
    expect(suggestSides({ calories: 100, protein: 5 }, t(250, 10), "snack")).toBeNull();
    expect(suggestSides({ calories: 545, protein: 40 }, t(600, 40), "lunch")).toBeNull();
  });
});

describe("automatic side on generated meals", () => {
  it("adds a side only when it makes the meal fit", () => {
    const frittata = recipeLibrary.find((r) => r.name === "Frittata")!;
    const target = t(600, 40);
    const plain = sizeMealToTarget(createPlannedMeal("breakfast", frittata), target);
    expect(plain.portion!.fits).toBe(false);
    const auto = sizeMealToTarget({ ...createPlannedMeal("breakfast", frittata), generated: true }, target, {
      autoSide: true,
    });
    expect(auto.generated).toBeUndefined();
    expect(auto.sides?.length).toBeGreaterThan(0);
    expect(auto.portion!.fits).toBe(true);
    const n = mealFoodNutrition(auto);
    expect(Math.abs(n.calories - target.calories)).toBeLessThanOrEqual(target.calories * 0.1);
    // Without the generated flag, no side is added automatically.
    expect(sizeMealToTarget(createPlannedMeal("breakfast", frittata), target).sides).toBeUndefined();
  });

  it("side nutrition counts toward the meal", () => {
    const frittata = recipeLibrary.find((r) => r.name === "Frittata")!;
    const meal = sizeMealToTarget(createPlannedMeal("breakfast", frittata), t(500, 35));
    const withBanana = { ...meal, sides: [{ name: "Banana", quantity: 1, unit: "medium", category: "Produce" as const }] };
    expect(mealFoodNutrition(withBanana).calories - mealFoodNutrition(meal).calories).toBeGreaterThan(90);
  });
});

describe("snack fit", () => {
  it("snacks are checked on calories only", () => {
    const apple = recipeLibrary.find((r) => r.name === "Apple with peanut butter")!;
    const sized = sizeMealToTarget(createPlannedMeal("snack", apple), { calories: 250, protein: 19, carbs: 25, fat: 12, fiber: 4 });
    const n = mealFoodNutrition(sized);
    expect(n.protein).toBeLessThan(17);
    expect(sized.portion!.fits).toBe(Math.abs(n.calories - 250) <= 25);
  });
});
