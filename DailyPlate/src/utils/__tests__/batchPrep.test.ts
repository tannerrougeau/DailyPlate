import { describe, expect, it } from "vitest";
import type { PlannedMeal } from "@/types";
import type { UserProfile } from "@/types/profile";
import { recipeLibrary } from "@/recipes/recipeLibrary";
import { batchPrepFor, type BatchPrepInput } from "@/utils/batchPrep";
import { formatPortionLine, multiplierForRole, roundPortionLine } from "@/utils/goalPortions";
import { groceriesFromMeals } from "@/utils/grocery";
import { householdPersonPortions } from "@/utils/household";
import { ingredientRole } from "@/utils/ingredientNutrition";
import { mealIngredients, mealMultipliers, mealPortionLines, servingSummary } from "@/utils/mealPortions";
import { withPlanningDefaults } from "@/utils/planningPrefs";
import { createPlannedMeal } from "@/utils/recipeDisplay";

const TODAY = "2026-11-23";
const TOMORROW = "2026-11-24";

const profile = withPlanningDefaults({
  age: 35,
  sex: "male",
  heightCm: 178,
  weightKg: 80,
  activityLevel: "moderate",
  goal: "maintain",
  mealTiming: null,
  eatenMeals: ["breakfast", "lunch", "dinner"],
  snacksPerDay: 0,
  dislikedFoodChips: [],
  favoriteFoodChips: [],
  householdAdults: 2,
  householdChildren: 0,
} as unknown as UserProfile);

const teriyaki = recipeLibrary.find((r) => r.id === "teriyaki-turkey-rice-bowls-39")!;
const batch = { batchId: "b1", portionsCooked: 2, source: "low_complexity" as const };
const dinnerTonight: PlannedMeal = createPlannedMeal("dinner", teriyaki, {
  scale: 1,
  mealPrep: { ...batch, portionIndex: 1, cookDateKey: TODAY },
});
const lunchTomorrow: PlannedMeal = createPlannedMeal("lunch", teriyaki, {
  scale: 1,
  mealPrep: { ...batch, portionIndex: 2, cookDateKey: TODAY },
});
const dailyPlans = { [TODAY]: [dinnerTonight], [TOMORROW]: [lunchTomorrow] };
const input = (meal: PlannedMeal, dateKey: string): BatchPrepInput => ({
  meal,
  dateKey,
  todayKey: TODAY,
  dailyPlans,
  profile,
});

describe("servings in the prep area", () => {
  const prep = batchPrepFor(input(dinnerTonight, TODAY))!;

  it("Teriyaki Turkey Rice Bowls for 2 adults over 2 days: Making 4 servings", () => {
    expect(prep.title).toBe("Making 4 servings");
    expect(prep.breakdown).toBe("You + 1 adult · 2 days (dinner tonight, lunch tomorrow)");
    expect(prep.isLeftoverDay).toBe(false);
  });

  it("batch amounts are the sum of each person's portions, rounded once", () => {
    const people = householdPersonPortions(profile);
    expect(people).toHaveLength(2);
    for (const line of prep.lines) {
      let raw = 0;
      for (const meal of [dinnerTonight, lunchTomorrow]) {
        const ing = mealIngredients(meal).find((i) => i.name === line.ingredient.name)!;
        for (const p of people) raw += ing.quantity * multiplierForRole(mealMultipliers(meal), ingredientRole(ing)) * p.multiplier;
      }
      const expected = roundPortionLine(line.ingredient, raw, ingredientRole(line.ingredient));
      expect(line.grams, line.ingredient.name).toBe(expected.grams);
      // And close to adding up each person's rounded portion.
      const portions = [dinnerTonight, lunchTomorrow].flatMap((meal) =>
        people.map((p) => mealPortionLines(meal, p.multiplier).find((l) => l.ingredient.name === line.ingredient.name)!.grams ?? 0),
      );
      const sum = portions.reduce((a, b) => a + b, 0);
      if (line.grams != null && sum > 20) expect(Math.abs(line.grams - sum) / sum, line.ingredient.name).toBeLessThan(0.1);
    }
  });

  it("amounts read as grams plus a household measure, labeled raw or dry", () => {
    const text = prep.lines.map(formatPortionLine);
    expect(text.some((t) => /^Lean ground turkey: \d+ g raw \(about [\d¼½¾ ]+ lb\)$/.test(t))).toBe(true);
    expect(text.some((t) => /^Rice: \d+ g dry \(about [\d¼⅓½⅔¾ ]+ cups?\)$/.test(t))).toBe(true);
  });

  it("the split lists every container for each person", () => {
    expect(prep.split).toMatch(/^Pack 4 containers: 2 (at|for) /);
    expect(prep.split).toMatch(/\(you\)|for you:/);
    expect(prep.split).toMatch(/other adult/);
  });

  it("the leftover day says no cooking, with that day's serving", () => {
    const left = batchPrepFor(input(lunchTomorrow, TOMORROW))!;
    expect(left.isLeftoverDay).toBe(true);
    expect(left.leftoverText).toBe("Leftovers from today's batch. No cooking today.");
    expect(left.leftoverServing).toMatch(/^Your portion: .+ · Other adult: /);
    // The original batch is the same one.
    expect(left.title).toBe("Making 4 servings");
  });

  it("the grocery list matches the batch amounts", () => {
    const resolver = (meal: PlannedMeal) =>
      batchPrepFor(input(meal, meal.slot === "dinner" ? TODAY : TOMORROW))?.lines ?? null;
    const items = groceriesFromMeals([dinnerTonight, lunchTomorrow], 2, resolver);
    const turkey = prep.lines.find((l) => /turkey/i.test(l.ingredient.name))!;
    const grocery = items.find((i) => i.name === turkey.ingredient.name)!;
    expect(grocery.quantity).toBeCloseTo(turkey.ingredient.quantity, 1);
  });

  it("one person, one day: Making 1 serving; the card's serving line is unchanged", () => {
    const solo = { ...profile, householdAdults: 1 };
    const single = createPlannedMeal("dinner", teriyaki, { scale: 1 });
    const p = batchPrepFor({ meal: single, dateKey: TODAY, todayKey: TODAY, dailyPlans: { [TODAY]: [single] }, profile: solo })!;
    expect(p.title).toBe("Making 1 serving");
    expect(p.breakdown).toBe("You · dinner tonight");
    expect(servingSummary(single)?.text).toMatch(/^Your serving: /);
  });

  it("a one-day 'cooking for' override changes today's count only", () => {
    const p = batchPrepFor({ ...input(dinnerTonight, TODAY), todayOverride: { dateKey: TODAY, adults: 3, children: 0 } })!;
    expect(p.title).toBe("Making 5 servings");
    expect(p.breakdown).toBe("You + 2 adults · 2 days (dinner tonight, lunch tomorrow)");
  });
});
