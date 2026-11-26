import { describe, expect, it } from "vitest";
import type { DayMealTracking, PlannedMeal } from "@/types";
import { recipeLibrary } from "@/recipes/recipeLibrary";
import { cookedMeals } from "@/utils/boughtMeals";
import { batchAlreadyCooked, groceriesFromMeals, groceryMealsForDay } from "@/utils/grocery";
import { createPlannedMeal } from "@/utils/recipeDisplay";

const TODAY = "2026-11-26";
const pick = (slot: "breakfast" | "lunch" | "dinner") => recipeLibrary.find((r) => r.mealSlots.includes(slot))!;
const day: PlannedMeal[] = [
  createPlannedMeal("breakfast", pick("breakfast"), { scale: 1 }),
  createPlannedMeal("lunch", pick("lunch"), { scale: 1 }),
  createPlannedMeal("dinner", pick("dinner"), { scale: 1 }),
];
const eaten = (status: "all" | "half" | "skipped" | "custom"): DayMealTracking[keyof DayMealTracking] => ({
  status,
  loggedAt: `${TODAY}T08:00:00Z`,
});

describe("Item 42: grocery list days", () => {
  it("never includes past days", () => {
    expect(groceryMealsForDay("2026-11-25", TODAY, day, undefined)).toEqual([]);
  });

  it("today only counts meals not yet marked eaten (or skipped / logged as something else)", () => {
    const tracking: DayMealTracking = { breakfast: eaten("all"), lunch: eaten("skipped") };
    const left = groceryMealsForDay(TODAY, TODAY, day, tracking);
    expect(left.map((m) => m.slot)).toEqual(["dinner"]);
    expect(groceryMealsForDay(TODAY, TODAY, day, { dinner: eaten("custom") }).map((m) => m.slot)).toEqual([
      "breakfast",
      "lunch",
    ]);
    expect(groceryMealsForDay(TODAY, TODAY, day, undefined)).toHaveLength(3);
  });

  it("future days are unchanged, even with tracking", () => {
    expect(groceryMealsForDay("2026-11-27", TODAY, day, { breakfast: eaten("all") })).toBe(day);
  });

  it("bought meals still add nothing", () => {
    const left = cookedMeals(groceryMealsForDay(TODAY, TODAY, day, { breakfast: eaten("all") }), { mealSources: { lunch: "buy" } }, null, TODAY);
    expect(left.map((m) => m.slot)).toEqual(["dinner"]);
  });

  it("an eaten meal's ingredients drop off today's list", () => {
    const all = groceriesFromMeals(groceryMealsForDay(TODAY, TODAY, day, undefined));
    const afterBreakfast = groceriesFromMeals(groceryMealsForDay(TODAY, TODAY, day, { breakfast: eaten("all") }));
    const breakfastOnly = groceriesFromMeals([day[0]!]).map((g) => g.key);
    const othersKeys = new Set(groceriesFromMeals([day[1]!, day[2]!]).map((g) => g.key));
    const onlyInBreakfast = breakfastOnly.filter((k) => !othersKeys.has(k));
    expect(afterBreakfast.length).toBeLessThanOrEqual(all.length);
    expect(onlyInBreakfast.length).toBeGreaterThan(0);
    for (const key of onlyInBreakfast) expect(afterBreakfast.some((g) => g.key === key)).toBe(false);
  });

  it("a batch cooked on a past day, or today and already eaten, needs nothing more", () => {
    expect(batchAlreadyCooked({ dateKey: "2026-11-24", slot: "dinner" }, TODAY, undefined)).toBe(true);
    expect(batchAlreadyCooked({ dateKey: TODAY, slot: "dinner" }, TODAY, { dinner: eaten("all") })).toBe(true);
    expect(batchAlreadyCooked({ dateKey: TODAY, slot: "dinner" }, TODAY, undefined)).toBe(false);
    expect(batchAlreadyCooked({ dateKey: "2026-11-27", slot: "dinner" }, TODAY, undefined)).toBe(false);
  });

  it("a batch spanning several selected days is bought once", () => {
    const batch = { batchId: "b1", portionsCooked: 2, portionIndex: 0 };
    const tonight = { ...day[2]!, mealPrep: batch };
    const tomorrow = { ...day[2]!, slot: "lunch" as const, mealPrep: { ...batch, portionIndex: 1 } };
    const shared = new Set<string>();
    const a = groceriesFromMeals([tonight], 1, undefined, shared);
    const b = groceriesFromMeals([tomorrow], 1, undefined, shared);
    expect(a.length).toBeGreaterThan(0);
    expect(b).toEqual([]);
  });
});
