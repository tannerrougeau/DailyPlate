import { describe, expect, it } from "vitest";
import type { DailyTargets, MealTrackingEntry, PlannedMeal } from "@/types";
import { recipeLibrary } from "@/recipes/recipeLibrary";
import { resolveBeverage } from "@/utils/beverages";
import { mealFoodNutrition, servingSummary, sizeMealToTarget } from "@/utils/mealPortions";
import {
  foodLogForServings,
  macrosForServings,
  servingsFromGrams,
  statusForServings,
  sumTrackedMacros,
  trackingLabel,
} from "@/utils/mealTracking";
import { commonSnackItems, recentSnacks, remainingToday, snackLogEntry } from "@/utils/snackItems";
import { createPlannedMeal } from "@/utils/recipeDisplay";

const target: DailyTargets = { calories: 650, protein: 45, carbs: 70, fat: 22, fiber: 9 };
const byName = (name: string) => recipeLibrary.find((r) => r.name === name)!;
const sized = (name: string, slot: PlannedMeal["slot"] = "dinner", beverageId: PlannedMeal["beverageId"] = "water") =>
  sizeMealToTarget({ ...createPlannedMeal(slot, byName(name)), beverageId }, target);

describe("servings math", () => {
  it("logs food × servings plus the drink once", () => {
    const meal = sized("Turkey & Black Bean Chili", "dinner", "milk");
    const food = mealFoodNutrition(meal);
    const milk = resolveBeverage("milk");
    for (const s of [0.5, 1, 1.5, 2]) {
      const m = macrosForServings(meal, s);
      expect(m.calories).toBe(Math.round(food.calories * s + milk.calories));
      expect(m.protein).toBe(Math.round(food.protein * s + milk.protein));
    }
  });

  it("skipping logs nothing, drink included", () => {
    const meal = sized("Turkey & Black Bean Chili", "dinner", "milk");
    expect(macrosForServings(meal, 0).calories).toBe(0);
  });

  it("status and label follow servings", () => {
    expect(statusForServings(0)).toBe("skipped");
    expect(statusForServings(0.5)).toBe("half");
    expect(statusForServings(1)).toBe("all");
    expect(statusForServings(1.5)).toBe("extra");
    expect(statusForServings(2)).toBe("custom");
    const entry = foodLogForServings("2026-11-23", sized("Turkey & Black Bean Chili"), 2);
    expect(entry.portionMultiplier).toBe(2);
    expect(trackingLabel(entry)).toBe("Ate 2 servings");
  });
});

describe("grams eaten", () => {
  it("grams ÷ serving weight = servings, rounded to 0.05", () => {
    expect(servingsFromGrams(450, 300)).toBe(1.5);
    expect(servingsFromGrams(400, 300)).toBe(1.35);
    expect(servingsFromGrams(150, 300)).toBe(0.5);
  });

  it("no conversion without a serving weight", () => {
    expect(servingsFromGrams(200, null)).toBeNull();
    expect(servingsFromGrams(0, 300)).toBeNull();
  });

  it("dishes cooked together offer grams; separately cooked parts do not", () => {
    expect(servingSummary(sized("Turkey & Black Bean Chili"))!.grams).toBeGreaterThan(0);
    expect(servingSummary(sized("Teriyaki Turkey Rice Bowls"))!.grams).toBeNull();
  });
});

describe("snack totals", () => {
  const banana = commonSnackItems().find((i) => i.key === "common:banana")!;
  const bar = commonSnackItems().find((i) => i.key === "common:protein-bar")!;

  it("common items are valued from ingredients.json", () => {
    expect(banana.reason).toBeUndefined();
    expect(banana.nutrition.calories).toBeGreaterThan(90);
    expect(banana.servingGrams).toBe(118);
  });

  it("snacks count toward today's totals with no planned meals logged", () => {
    const logs = [snackLogEntry("d", banana, 1), snackLogEntry("d", bar, 2)];
    const { eaten } = sumTrackedMacros([], undefined, logs);
    expect(eaten.calories).toBe(logs[0]!.calories! + logs[1]!.calories!);
    expect(logs[1]!.calories).toBe(Math.round(bar.nutrition.calories * 2));
  });

  it("snacks add to logged meals", () => {
    const meal = sized("Turkey & Black Bean Chili");
    const tracking = { dinner: foodLogForServings("d", meal, 1) };
    const snack = snackLogEntry("d", banana, 1);
    const { eaten } = sumTrackedMacros([meal], tracking, [snack]);
    expect(eaten.calories).toBe(tracking.dinner.calories! + snack.calories!);
  });

  it("remaining calories and protein never go below zero", () => {
    const t: DailyTargets = { calories: 2000, protein: 120, carbs: 0, fat: 0 };
    expect(remainingToday(t, { calories: 1500, protein: 100, carbs: 0, fat: 0 })).toEqual({ calories: 500, protein: 20 });
    expect(remainingToday(t, { calories: 2500, protein: 150, carbs: 0, fat: 0 })).toEqual({ calories: 0, protein: 0 });
  });

  it("recent snacks are distinct and newest first", () => {
    const at = (iso: string, e: MealTrackingEntry) => ({ ...e, loggedAt: iso });
    const logs = {
      a: [at("2026-11-20T10:00:00Z", snackLogEntry("a", banana, 1))],
      b: [
        at("2026-11-22T10:00:00Z", snackLogEntry("b", bar, 1)),
        at("2026-11-21T10:00:00Z", snackLogEntry("b", banana, 2)),
      ],
    };
    const recent = recentSnacks(logs);
    expect(recent.map((r) => r.name)).toEqual(["Protein bar", "Banana"]);
    // One serving even if it was logged as 2.
    expect(Math.round(recent[1]!.nutrition.calories)).toBe(Math.round(banana.nutrition.calories));
  });
});
