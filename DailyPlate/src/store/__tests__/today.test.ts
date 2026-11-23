import { beforeAll, describe, expect, it, vi } from "vitest";
import type { PlannedMeal } from "@/types";
import { toDateKey } from "@/utils/date";
import { foodLogForServings } from "@/utils/mealTracking";

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
const tomorrow = day(1);

type Store = typeof import("@/store/useAppStore").useAppStore;
let useAppStore: Store;

const profile = {
  age: 35,
  sex: "male",
  heightCm: 178,
  weightKg: 80,
  activityLevel: "moderate",
  goal: "maintain",
  proteinPreference: "recommended",
  macroSplitPreference: "balanced",
  mealTiming: "balanced",
  householdAdults: 1,
  householdChildren: 0,
  eatenMeals: ["breakfast", "lunch", "dinner"],
  snacksPerDay: 1,
  dislikedFoodChips: [],
  favoriteFoodChips: [],
};

beforeAll(async () => {
  const storage = memoryStorage();
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", { localStorage: storage });
  ({ useAppStore } = await import("@/store/useAppStore"));
  const { withPlanningDefaults } = await import("@/utils/planningPrefs");
  const { computeDailyTargets } = await import("@/utils/tdee");
  const p = withPlanningDefaults(profile as never);
  useAppStore.setState({ userProfile: p, targets: computeDailyTargets(p), onboardingComplete: true, todayDateKey: today });
});

const mealsOn = (key: string): PlannedMeal[] => useAppStore.getState().dailyPlans[key] ?? [];
const slotOn = (key: string, slot: string) => mealsOn(key).find((m) => m.slot === slot)!;
const sig = (m: PlannedMeal) => JSON.stringify({ id: m.recipe.id, v: m.selectedVariationId, p: m.portion, s: m.sides });

describe("Regenerate today", () => {
  it("skips kept, locked and eaten meals and keeps their logs", () => {
    const s = useAppStore.getState();
    expect(s.generateDay(today).ok).toBe(true);
    expect(s.generateDay(tomorrow).ok).toBe(true);
    // breakfast eaten, lunch kept, dinner locked, snack skipped
    s.setMealTracking(today, "breakfast", foodLogForServings(today, slotOn(today, "breakfast"), 1));
    s.keepMeal(today, "lunch");
    s.toggleMealLock(today, "dinner");
    s.setMealTracking(today, "snack", foodLogForServings(today, slotOn(today, "snack"), 0));

    const before = {
      breakfast: sig(slotOn(today, "breakfast")),
      lunch: sig(slotOn(today, "lunch")),
      dinner: sig(slotOn(today, "dinner")),
      tomorrow: JSON.stringify(mealsOn(tomorrow)),
      eatenLog: JSON.stringify(useAppStore.getState().mealTracking[today]!.breakfast),
    };

    const result = useAppStore.getState().regenerateToday();
    expect(result.ok).toBe(true);
    const after = useAppStore.getState();
    expect(sig(slotOn(today, "breakfast"))).toBe(before.breakfast);
    expect(sig(slotOn(today, "lunch"))).toBe(before.lunch);
    expect(sig(slotOn(today, "dinner"))).toBe(before.dinner);
    expect(JSON.stringify(after.mealTracking[today]!.breakfast)).toBe(before.eatenLog);
    // The skipped snack was replaced, so its skip entry is cleared.
    expect(after.mealTracking[today]!.snack).toBeUndefined();
    expect(slotOn(today, "snack")).toBeDefined();
    // Other days are untouched.
    expect(JSON.stringify(mealsOn(tomorrow))).toBe(before.tomorrow);
  });

  it("Undo restores the previous meals and logs exactly", () => {
    const s = useAppStore.getState();
    const meals = JSON.stringify(mealsOn(today));
    const tracking = JSON.stringify(s.mealTracking[today]);
    const result = s.regenerateToday();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    useAppStore.getState().restoreDay(result.previous.dateKey, result.previous.meals, result.previous.tracking);
    expect(JSON.stringify(mealsOn(today))).toBe(meals);
    expect(JSON.stringify(useAppStore.getState().mealTracking[today])).toBe(tracking);
  });

  it("a fully kept, locked or eaten day is left as it is", () => {
    const s = useAppStore.getState();
    for (const m of mealsOn(today)) {
      if (!useAppStore.getState().mealTracking[today]?.[m.slot]) {
        s.setMealTracking(today, m.slot, foodLogForServings(today, m, 1));
      }
    }
    const meals = JSON.stringify(mealsOn(today).map(sig));
    expect(useAppStore.getState().regenerateToday().ok).toBe(true);
    expect(JSON.stringify(mealsOn(today).map(sig))).toBe(meals);
  });
});

describe("snack logs", () => {
  it("add and remove, without re-sizing today's meals", () => {
    const s = useAppStore.getState();
    const meals = JSON.stringify(mealsOn(today).map(sig));
    const entry = { status: "custom" as const, note: "Banana", loggedAt: "2026-11-23T10:00:00.000Z", slot: "snack" as const, source: "manual" as const, portionMultiplier: 1, calories: 105, protein: 1, carbs: 27, fat: 0, fiber: 3 };
    s.addSnackLog(today, entry);
    expect(useAppStore.getState().snackLogs[today]).toHaveLength(1);
    expect(JSON.stringify(mealsOn(today).map(sig))).toBe(meals);
    useAppStore.getState().removeSnackLog(today, entry.loggedAt);
    expect(useAppStore.getState().snackLogs[today]).toBeUndefined();
  });

  it("saved snacks replace an older one with the same name", () => {
    const s = useAppStore.getState();
    s.saveSnack({ name: "Trail mix", calories: 200, protein: 6 });
    s.saveSnack({ name: "Trail mix", calories: 180, protein: 6 });
    const saved = useAppStore.getState().savedSnacks.filter((x) => x.name === "Trail mix");
    expect(saved).toHaveLength(1);
    expect(saved[0]!.calories).toBe(180);
  });
});
