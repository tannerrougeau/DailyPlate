import { beforeAll, describe, expect, it, vi } from "vitest";
import type { PlannedMeal } from "@/types";
import { recipeLibrary } from "@/recipes/recipeLibrary";
import { toDateKey } from "@/utils/date";

/** In-memory localStorage so zustand's persist middleware can load saved data in Node. */
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return toDateKey(d);
};
const today = day(0);
const yesterday = day(-1);
const tomorrow = day(1);

const byName = (name: string) => JSON.parse(JSON.stringify(recipeLibrary.find((r) => r.name === name)!));

/** A planned meal as saved before item 23: one uniform scale, no portion, no sides. */
const legacyMeal = (slot: PlannedMeal["slot"], name: string, scale = 1.1) => ({
  slot,
  recipe: byName(name),
  scale,
  beverageId: "water",
});

const legacyProfile = {
  age: 38,
  sex: "male",
  heightCm: 178,
  weightKg: 86,
  activityLevel: "moderate",
  goal: "maintain",
  proteinPreference: "moderate",
  macroSplitPreference: "balanced",
  mealTiming: "balanced",
  householdAdults: 1,
  householdChildren: 0,
  eatenMeals: ["breakfast", "lunch", "dinner"],
  snacksPerDay: 1,
  dislikedFoodChips: [],
  favoriteFoodChips: [],
  minimumProteinGrams: 155,
};

const legacyState = {
  state: {
    onboardingComplete: true,
    userProfile: legacyProfile,
    targets: { calories: 2600, protein: 155, carbs: 290, fat: 92, fiber: 36 },
    todayDateKey: today,
    plannedMeals: [],
    dailyPlans: {
      [yesterday]: [legacyMeal("breakfast", "Omelette", 1.2), legacyMeal("dinner", "Teriyaki Turkey Rice Bowls", 1.2)],
      [today]: [
        legacyMeal("breakfast", "Omelette"),
        legacyMeal("lunch", "Chicken Burrito Bowl"),
        legacyMeal("dinner", "Teriyaki Turkey Rice Bowls"),
        legacyMeal("snack", "Apple with peanut butter"),
      ],
      [tomorrow]: [
        { ...legacyMeal("lunch", "Teriyaki Turkey Rice Bowls"), mealPrep: { batchId: "b1", portionsCooked: 2, portionIndex: 1 } },
        { ...legacyMeal("dinner", "Turkey & Black Bean Chili"), mealPrep: { batchId: "b2", portionsCooked: 2, portionIndex: 1 } },
      ],
      [day(2)]: [
        { ...legacyMeal("lunch", "Teriyaki Turkey Rice Bowls"), mealPrep: { batchId: "b1", portionsCooked: 2, portionIndex: 2 } },
      ],
    },
    lockedDays: [],
    lockedMeals: [],
    mealTracking: {
      [today]: {
        breakfast: { status: "all", loggedAt: new Date().toISOString(), calories: 600, protein: 40, carbs: 20, fat: 38 },
      },
    },
    favoriteIds: [],
    dislikedIds: [],
    userRecipes: [],
    tdeeFeedbackHistory: [],
  },
  version: 0,
};

type Store = typeof import("@/store/useAppStore").useAppStore;
let useAppStore: Store;

beforeAll(async () => {
  const storage = memoryStorage();
  storage.setItem("dailyplate-storage", JSON.stringify(legacyState));
  // zustand's persist middleware reads window.localStorage.
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", { localStorage: storage });
  ({ useAppStore } = await import("@/store/useAppStore"));
  await useAppStore.persist.rehydrate();
});

const mealsOn = (key: string) => useAppStore.getState().dailyPlans[key] ?? [];
const slotOn = (key: string, slot: string) => mealsOn(key).find((m) => m.slot === slot)!;

describe("loading saved data from before item 23", () => {
  it("loads without errors and re-sizes today's and future meals", () => {
    expect(useAppStore.getState().onboardingComplete).toBe(true);
    for (const slot of ["lunch", "dinner", "snack"]) {
      expect(slotOn(today, slot).portion).toBeDefined();
      expect(slotOn(today, slot).scale).toBe(1);
    }
    expect(slotOn(tomorrow, "lunch").portion).toBeDefined();
  });

  it("re-split the stored targets with the corrected carb/fat split", () => {
    const t = useAppStore.getState().targets;
    expect((t.fat * 9) / t.calories).toBeLessThan(0.4);
  });

  it("does not touch past days", () => {
    const past = mealsOn(yesterday);
    expect(past.every((m) => m.portion === undefined && m.scale === 1.2)).toBe(true);
  });

  it("does not touch a meal already logged as eaten", () => {
    const breakfast = slotOn(today, "breakfast");
    expect(breakfast.portion).toBeUndefined();
    expect(breakfast.scale).toBe(1.1); // the saved scale, unchanged
  });

  it("re-sized meals land near their share of the day", () => {
    const lunch = slotOn(today, "lunch");
    expect(lunch.portion!.target.calories).toBeGreaterThan(400);
  });
});

describe("automatic re-sizing never changes kept meals", () => {
  it("a kept meal keeps its amounts when targets change", () => {
    const { keepMeal } = useAppStore.getState();
    keepMeal(today, "dinner");
    const before = JSON.stringify(slotOn(today, "dinner").portion);
    const lunchBefore = JSON.stringify(slotOn(today, "lunch").portion);
    const t = useAppStore.getState().targets;
    useAppStore.setState({ targets: { ...t, calories: t.calories - 400 } });
    expect(JSON.stringify(slotOn(today, "dinner").portion)).toBe(before);
    expect(JSON.stringify(slotOn(today, "lunch").portion)).not.toBe(lunchBefore);
  });
});

describe("Weigh your batch", () => {
  it("applies the weight to every day of the same batch", () => {
    useAppStore.getState().setWeighedBatch(tomorrow, "lunch", 1200);
    expect(slotOn(tomorrow, "lunch").weighedBatchGrams).toBe(1200);
    expect(slotOn(day(2), "lunch").weighedBatchGrams).toBe(1200);
    expect(slotOn(tomorrow, "dinner").weighedBatchGrams).toBeUndefined();
  });
});

describe("sides", () => {
  it("can be added and removed", () => {
    const { addMealSides, removeMealSide } = useAppStore.getState();
    addMealSides(today, "lunch", [{ name: "Banana", quantity: 1, unit: "medium", category: "Produce" }]);
    expect(slotOn(today, "lunch").sides).toHaveLength(1);
    removeMealSide(today, "lunch", 0);
    expect(slotOn(today, "lunch").sides).toBeUndefined();
  });
});
