import { describe, expect, it } from "vitest";
import type { DailyTargets, MealSlotId } from "@/types";
import { splitInteger, splitMealTargets, type MealTargetSlot } from "@/utils/mealTargets";

const KEYS = ["calories", "protein", "carbs", "fat", "fiber"] as const;

function total(parts: Partial<Record<MealSlotId, DailyTargets>>, extra: Partial<DailyTargets>[] = []) {
  const sum = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  for (const t of [...Object.values(parts), ...extra]) {
    for (const k of KEYS) sum[k] += Math.round(t?.[k] ?? 0);
  }
  return sum;
}

const daily: DailyTargets = { calories: 2143, protein: 163, carbs: 205, fat: 77, fiber: 30 };

describe("splitInteger", () => {
  it("parts are integers that add up exactly", () => {
    for (const totalValue of [0, 1, 7, 163, 2143]) {
      const parts = splitInteger(totalValue, [0.25, 0.325, 0.325, 0.1]);
      expect(parts.every(Number.isInteger)).toBe(true);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(totalValue);
    }
  });
});

describe("splitMealTargets", () => {
  it("meal targets add up to the daily target", () => {
    const slots: MealTargetSlot[] = (["breakfast", "lunch", "dinner", "snack"] as const).map((slot) => ({
      slot,
      kind: "cooked",
    }));
    const parts = splitMealTargets({ daily, slots });
    expect(total(parts)).toEqual(daily);
  });

  it("uses the default shares (25 / 32.5 / 32.5 / 10)", () => {
    const parts = splitMealTargets({
      daily: { calories: 2000, protein: 160, carbs: 200, fat: 70, fiber: 28 },
      slots: (["breakfast", "lunch", "dinner", "snack"] as const).map((slot) => ({ slot, kind: "cooked" })),
    });
    expect(parts.breakfast?.calories).toBe(500);
    expect(parts.lunch?.calories).toBe(650);
    expect(parts.dinner?.calories).toBe(650);
    expect(parts.snack?.calories).toBe(200);
  });

  it("drinks and packaged snacks count first, and everything still adds up", () => {
    const drinks = { calories: 122, protein: 8, carbs: 12, fat: 5, fiber: 0 };
    const packaged = { calories: 200, protein: 20, carbs: 22, fat: 7, fiber: 1 };
    const slots: MealTargetSlot[] = [
      { slot: "breakfast", kind: "cooked" },
      { slot: "lunch", kind: "cooked" },
      { slot: "dinner", kind: "cooked" },
      { slot: "snack", kind: "fixed", nutrition: packaged },
    ];
    const parts = splitMealTargets({ daily, slots, drinks });
    expect(parts.snack).toBeUndefined();
    expect(total(parts, [drinks, packaged])).toEqual(daily);
  });

  it("timing preferences shift shares and still add up", () => {
    const slots: MealTargetSlot[] = (["breakfast", "lunch", "dinner"] as const).map((slot) => ({
      slot,
      kind: "cooked",
    }));
    const bigger = splitMealTargets({ daily, slots, timing: "bigger_dinner" });
    const light = splitMealTargets({ daily, slots, timing: "light_breakfast" });
    expect(bigger.dinner!.calories).toBeGreaterThan(bigger.lunch!.calories);
    expect(light.breakfast!.calories).toBeLessThan(light.lunch!.calories);
    expect(total(bigger)).toEqual(daily);
    expect(total(light)).toEqual(daily);
  });
});
