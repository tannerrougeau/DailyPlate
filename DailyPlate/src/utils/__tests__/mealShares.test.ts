import { describe, expect, it } from "vitest";
import type { DailyTargets, MealSlotId, PlannedMeal } from "@/types";
import { allRecipes } from "@/recipes/recipePool";
import { applyGoalPortions, mealFoodNutrition, mealPortionLines } from "@/utils/mealPortions";
import {
  effectiveMealSizes,
  mealShareNote,
  splitMealTargets,
  type MealTargetSlot,
} from "@/utils/mealTargets";
import { createPlannedMeal } from "@/utils/recipeDisplay";

const daily: DailyTargets = { calories: 2100, protein: 160, carbs: 200, fat: 75, fiber: 30 };
const cooked = (...slots: MealSlotId[]): MealTargetSlot[] => slots.map((slot) => ({ slot, kind: "cooked" }));
const kcalSum = (parts: Partial<Record<MealSlotId, DailyTargets>>) =>
  Object.values(parts).reduce((a, t) => a + (t?.calories ?? 0), 0);

const library = allRecipes([]);
const recipe = (id: string) => {
  const r = library.find((x) => x.id === id);
  if (!r) throw new Error(`missing ${id}`);
  return r;
};

describe("Item 44: light meals and skipped meals", () => {
  it("my setup (light breakfast, no lunch, one snack): small breakfast, 400 kcal snack, dinner the rest", () => {
    const old = splitMealTargets({ daily, slots: cooked("breakfast", "dinner", "snack"), timing: "light_breakfast" });
    // Before this change: breakfast was about 650 kcal here.
    expect(old.breakfast!.calories).toBeLessThan(500);
    const parts = splitMealTargets({
      daily,
      slots: cooked("breakfast", "dinner", "snack"),
      sizes: { breakfast: "light" },
    });
    const b = parts.breakfast!.calories;
    expect(b).toBeLessThan(650 - 100);
    expect(b / daily.calories).toBeGreaterThan(0.15);
    expect(b / daily.calories).toBeLessThanOrEqual(0.27);
    expect(parts.snack!.calories).toBeGreaterThanOrEqual(200);
    expect(parts.snack!.calories).toBeLessThanOrEqual(400);
    expect(parts.snack!.calories).toBe(400);
    expect(parts.dinner!.calories).toBe(daily.calories - b - parts.snack!.calories);
    expect(kcalSum(parts)).toBe(daily.calories);
  });

  it("older saves with the light-breakfast setting get the same split", () => {
    expect(effectiveMealSizes({ mealTiming: "light_breakfast" })).toEqual({ breakfast: "light" });
    expect(effectiveMealSizes({ mealTiming: "bigger_dinner", mealSizes: { dinner: "normal" } })).toEqual({ dinner: "normal" });
    const viaTiming = splitMealTargets({ daily, slots: cooked("breakfast", "dinner", "snack"), timing: "light_breakfast" });
    const viaSizes = splitMealTargets({ daily, slots: cooked("breakfast", "dinner", "snack"), sizes: { breakfast: "light" } });
    expect(viaTiming).toEqual(viaSizes);
  });

  it("the default setup is unchanged (25 / 32.5 / 32.5 / 10)", () => {
    const parts = splitMealTargets({ daily: { ...daily, calories: 2000 }, slots: cooked("breakfast", "lunch", "dinner", "snack") });
    expect(parts.breakfast!.calories).toBe(500);
    expect(parts.lunch!.calories).toBe(650);
    expect(parts.dinner!.calories).toBe(650);
    expect(parts.snack!.calories).toBe(200);
  });

  it("Light is smaller and Large is bigger than Normal, and the day still adds up", () => {
    const all = cooked("breakfast", "lunch", "dinner", "snack");
    const normal = splitMealTargets({ daily, slots: all });
    const light = splitMealTargets({ daily, slots: all, sizes: { lunch: "light" } });
    const large = splitMealTargets({ daily, slots: all, sizes: { lunch: "large" } });
    expect(light.lunch!.calories).toBeLessThan(normal.lunch!.calories * 0.75);
    expect(large.lunch!.calories).toBeGreaterThan(normal.lunch!.calories * 1.2);
    expect(kcalSum(light)).toBe(daily.calories);
    expect(kcalSum(large)).toBe(daily.calories);
    // Light lunch: the freed share goes mostly to the meals not marked Light.
    expect(light.dinner!.calories - normal.dinner!.calories).toBeGreaterThan(light.breakfast!.calories - normal.breakfast!.calories);
  });

  it("snacks are capped at 400 kcal each when a main meal is skipped", () => {
    const parts = splitMealTargets({ daily: { ...daily, calories: 3200 }, slots: cooked("breakfast", "dinner", "snack", "snack_2") });
    expect(parts.snack!.calories).toBeLessThanOrEqual(400);
    expect(parts.snack_2!.calories).toBeLessThanOrEqual(400);
  });

  it("each main meal keeps at least 20 g protein when the day allows it", () => {
    const lowProtein: DailyTargets = { calories: 2100, protein: 70, carbs: 260, fat: 80, fiber: 30 };
    const parts = splitMealTargets({
      daily: lowProtein,
      slots: cooked("breakfast", "lunch", "dinner", "snack"),
      sizes: { breakfast: "light" },
    });
    expect(parts.breakfast!.protein).toBeGreaterThanOrEqual(20);
    expect(parts.lunch!.protein).toBeGreaterThanOrEqual(20);
    expect(parts.dinner!.protein).toBeGreaterThanOrEqual(20);
    const proteinSum = Object.values(parts).reduce((a, t) => a + t!.protein, 0);
    expect(proteinSum).toBe(lowProtein.protein);
  });

  it("shows one line on Today when it applies", () => {
    expect(mealShareNote(["breakfast", "dinner", "snack"], { breakfast: "light" })).toBe(
      "Light breakfast and no lunch: more of today goes to your snack and dinner.",
    );
    expect(mealShareNote(["breakfast", "lunch", "dinner", "snack"], {})).toBeNull();
    expect(mealShareNote(["breakfast", "lunch", "dinner"], { dinner: "large" })).toBe(
      "Large dinner: more of today goes to your dinner.",
    );
  });

  it("a packaged snack reaches its target with at most 2 units, then a pairing (string cheese + apple)", () => {
    const meals: PlannedMeal[] = [
      createPlannedMeal("breakfast", recipe("snack-hard-boiled-eggs-fruit"), { scale: 1 }),
      createPlannedMeal("dinner", library.find((r) => r.mealSlots.includes("dinner") && !r.tags.includes("packaged"))!, { scale: 1 }),
      createPlannedMeal("snack", recipe("snack-pkg-string-cheese"), { scale: 1 }),
    ];
    const out = applyGoalPortions(meals, daily, { sizes: { breakfast: "light" } });
    const snack = out.find((m) => m.slot === "snack")!;
    expect(snack.portion!.multipliers.protein).toBe(2);
    expect(snack.sides?.length).toBe(1);
    const kcal = mealFoodNutrition(snack).calories;
    expect(kcal).toBeGreaterThanOrEqual(snack.portion!.target.calories * 0.75);
    expect(kcal).toBeLessThanOrEqual(400 + 20);
    const cheese = mealPortionLines(snack).find((l) => /string cheese/i.test(l.ingredient.name))!;
    expect(cheese.ingredient.quantity).toBe(2);
    // Re-running gives the same result (no pairing piled on pairing).
    const again = applyGoalPortions(out, daily, { sizes: { breakfast: "light" } });
    expect(again.find((m) => m.slot === "snack")!.sides).toEqual(snack.sides);
  });

  it("a small snack target uses one unit and no pairing", () => {
    const mains = library.filter((r) => !r.tags.includes("packaged"));
    const meals: PlannedMeal[] = [
      createPlannedMeal("breakfast", recipe("snack-hard-boiled-eggs-fruit"), { scale: 1 }),
      createPlannedMeal("lunch", mains.find((r) => r.mealSlots.includes("lunch"))!, { scale: 1 }),
      createPlannedMeal("dinner", mains.find((r) => r.mealSlots.includes("dinner"))!, { scale: 1 }),
      createPlannedMeal("snack", recipe("snack-pkg-string-cheese"), { scale: 1 }),
    ];
    // No meal skipped: the snack keeps its 10% share (90 kcal) -> one stick.
    const out = applyGoalPortions(meals, { calories: 900, protein: 60, carbs: 90, fat: 30, fiber: 10 });
    const snack = out.find((m) => m.slot === "snack")!;
    expect(snack.portion!.multipliers.protein).toBe(1);
  });
});

describe("Item 45: size today", () => {
  const all = (daySize?: Partial<Record<MealSlotId, number>>): MealTargetSlot[] =>
    (["breakfast", "lunch", "dinner", "snack"] as const).map((slot) => ({ slot, kind: "cooked", daySize: daySize?.[slot] }));

  it("1/2 moves the removed calories to the day's remaining open meals", () => {
    const normal = splitMealTargets({ daily, slots: all() });
    const half = splitMealTargets({ daily, slots: all({ lunch: 0.5 }) });
    expect(half.lunch!.calories).toBe(Math.round(normal.lunch!.calories * 0.5));
    expect(half.dinner!.calories).toBeGreaterThan(normal.dinner!.calories);
    expect(half.breakfast!.calories).toBeGreaterThan(normal.breakfast!.calories);
    expect(kcalSum(half)).toBe(daily.calories);
  });

  it("eaten, kept or locked meals (fixed) don't receive any", () => {
    const fixedBreakfast = { calories: 500, protein: 35, carbs: 50, fat: 15, fiber: 5 };
    const slots: MealTargetSlot[] = [
      { slot: "breakfast", kind: "fixed", nutrition: fixedBreakfast },
      { slot: "lunch", kind: "cooked", daySize: 0.75 },
      { slot: "dinner", kind: "cooked" },
    ];
    const normal = splitMealTargets({ daily, slots: slots.map((s) => (s.kind === "cooked" ? { slot: s.slot, kind: "cooked" } : s)) });
    const sized = splitMealTargets({ daily, slots });
    expect(sized.breakfast).toBeUndefined();
    expect(sized.lunch!.calories).toBe(Math.round(normal.lunch!.calories * 0.75));
    expect(sized.dinner!.calories).toBe(normal.dinner!.calories + (normal.lunch!.calories - sized.lunch!.calories));
  });

  it("with no open meals left, the day just ends lower", () => {
    const fixed = { calories: 1400, protein: 100, carbs: 130, fat: 50, fiber: 20 };
    const slots: MealTargetSlot[] = [
      { slot: "breakfast", kind: "fixed", nutrition: { ...fixed, calories: 600 } },
      { slot: "lunch", kind: "fixed", nutrition: { ...fixed, calories: 800 } },
      { slot: "dinner", kind: "cooked", daySize: 0.5 },
    ];
    const sized = splitMealTargets({ daily, slots });
    expect(sized.dinner!.calories).toBe(Math.round((daily.calories - 1400) * 0.5));
  });

  it("applyGoalPortions sizes only that meal smaller and leaves the recipe unchanged", () => {
    const dinnerRecipe = library.find((r) => r.mealSlots.includes("dinner") && !r.tags.includes("packaged"))!;
    const lunchRecipe = library.find((r) => r.mealSlots.includes("lunch") && r.id !== dinnerRecipe.id && !r.tags.includes("packaged"))!;
    const base: PlannedMeal[] = [
      createPlannedMeal("lunch", lunchRecipe, { scale: 1 }),
      createPlannedMeal("dinner", dinnerRecipe, { scale: 1 }),
    ];
    const normal = applyGoalPortions(base, daily);
    const sized = applyGoalPortions(base.map((m) => (m.slot === "lunch" ? { ...m, daySize: 0.5 as const } : m)), daily);
    const nLunch = normal.find((m) => m.slot === "lunch")!;
    const sLunch = sized.find((m) => m.slot === "lunch")!;
    expect(sLunch.portion!.target.calories).toBe(Math.round(nLunch.portion!.target.calories * 0.5));
    expect(sized.find((m) => m.slot === "dinner")!.portion!.target.calories).toBeGreaterThan(
      normal.find((m) => m.slot === "dinner")!.portion!.target.calories,
    );
    expect(sLunch.recipe).toBe(lunchRecipe);
  });
});
