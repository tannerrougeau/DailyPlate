import { describe, expect, it, vi } from "vitest";
import type { PlannedMeal } from "@/types";
import type { UserProfile } from "@/types/profile";
import type { CheckInEntry } from "@/types/tdeeFeedback";
import { recipeLibrary } from "@/recipes/recipeLibrary";
import { normalizePortions, normalizeUsda } from "@/server/foodSources";
import { buildExperienceRecommendations } from "@/utils/checkInExperience";
import { startingDisplayPrefs } from "@/utils/displayPrefs";
import { applyPortion, fetchPortions } from "@/utils/foodSearch";
import { analyzePersonalizationSignals, deriveAdaptiveProfileUpdates } from "@/utils/personalizationEngine";
import { applyChange, checkInQuestions, usesLongBatches } from "@/utils/questionQueue";
import { createPlannedMeal } from "@/utils/recipeDisplay";

const today = "2026-11-23";
const day = (offset: number) => {
  const d = new Date(`${today}T12:00:00`);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const chili = recipeLibrary.find((r) => r.name === "Turkey & Black Bean Chili")!;
const batchMeal = (index: number): PlannedMeal => ({
  ...createPlannedMeal("dinner", chili),
  mealPrep: { batchId: "batch-1", portionsCooked: 4, portionIndex: index, source: "weekly_prep" },
});

/** Every score neutral (3 of 5) unless overridden. */
const entry = (over: Partial<Record<string, number>> = {}) =>
  ({
    scaleMax: 5,
    energyLevel: 3,
    calorieAdherence: 3,
    proteinAdherence: 3,
    sleepQuality: 3,
    strengthProgress: 3,
    mealVarietySatisfaction: 3,
    planEaseOfUse: 3,
    recipeEnjoyment: 3,
    hungerManagement: 3,
    experienceNotes: "",
    activityChange: "none",
    weightChangeDirection: "same",
    ...over,
  }) as unknown as CheckInEntry;

const profile = {
  goal: "maintain",
  weeklyMealPrepEnabled: true,
  weeklyMealPrepRepeatCount: 4,
  maxLeftoverStreakDays: 2,
} as unknown as UserProfile;

describe("repeats vs batch cooking", () => {
  it("a 4-day batch counts as one cook event", () => {
    const dailyPlans = { [day(0)]: [batchMeal(1)], [day(1)]: [batchMeal(2)], [day(2)]: [batchMeal(3)], [day(3)]: [batchMeal(4)] };
    const s = analyzePersonalizationSignals({ mealTracking: {}, dailyPlans, plannedMeals: [], todayDateKey: today });
    expect(s.recentCounts.get(chili.id)).toBe(1);
  });

  it("the same recipe cooked on separate days still counts each day", () => {
    const plain = createPlannedMeal("dinner", chili);
    const dailyPlans = { [day(0)]: [plain], [day(2)]: [plain] };
    const s = analyzePersonalizationSignals({ mealTracking: {}, dailyPlans, plannedMeals: [], todayDateKey: today });
    expect(s.recentCounts.get(chili.id)).toBe(2);
  });

  it("'meals felt repetitive' with batches queues a question and never shortens batches by itself", () => {
    const qs = checkInQuestions(entry({ mealVarietySatisfaction: 2 }), startingDisplayPrefs("existing"), profile, new Date());
    expect(qs.map((q) => q.id)).toContain("shorter-batches");
    expect(qs.find((q) => q.id === "shorter-batches")!.text).toBe("Want shorter batches? (e.g., 2 days instead of 4)");
    const auto = deriveAdaptiveProfileUpdates(profile, analyzePersonalizationSignals({ mealTracking: {}, dailyPlans: {}, plannedMeals: [], todayDateKey: today }), entry({ mealVarietySatisfaction: 1 }));
    expect(auto.weeklyMealPrepRepeatCount).toBeUndefined();
    expect(auto.maxLeftoverStreakDays).toBeUndefined();
  });

  it("no batch question without batches longer than 2 days", () => {
    const noBatch = { ...profile, weeklyMealPrepEnabled: false } as UserProfile;
    expect(usesLongBatches(noBatch)).toBe(false);
    const qs = checkInQuestions(entry({ mealVarietySatisfaction: 2 }), startingDisplayPrefs("existing"), noBatch, new Date());
    expect(qs.map((q) => q.id)).not.toContain("shorter-batches");
  });

  it("a Yes sets 2-day batches and the checkpoint keeps the previous lengths", () => {
    const res = applyChange(
      { displayPrefs: startingDisplayPrefs("existing"), dislikedFoodCustom: "", weeklyMealPrepRepeatCount: 4, maxLeftoverStreakDays: 3 },
      { kind: "shorterBatches", days: 2 },
    );
    expect(res.before).toEqual({ weeklyMealPrepRepeatCount: 4, maxLeftoverStreakDays: 3 });
    expect(res.after).toEqual({ weeklyMealPrepRepeatCount: 2, maxLeftoverStreakDays: 2 });
  });
});

describe("neutral check-in answers (3 of 5)", () => {
  const signals = analyzePersonalizationSignals({ mealTracking: {}, dailyPlans: {}, plannedMeals: [], todayDateKey: today });
  const plain = { goal: "maintain" } as unknown as UserProfile;

  it("change no plan settings", () => {
    expect(deriveAdaptiveProfileUpdates(plain, signals, entry())).toEqual({});
  });

  it("queue no questions", () => {
    expect(checkInQuestions(entry(), startingDisplayPrefs("existing"), profile, new Date())).toEqual([]);
  });

  it("add no suggestions beyond the default 'looks solid' line", () => {
    const { suggestions } = buildExperienceRecommendations(entry(), plain, signals);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatch(/^Your experience scores look solid/);
  });

  it("1–2 still count as low", () => {
    expect(deriveAdaptiveProfileUpdates(plain, signals, entry({ proteinAdherence: 2 })).prioritizeMinProtein).toBe(true);
    expect(deriveAdaptiveProfileUpdates(plain, signals, entry({ planEaseOfUse: 2 })).weeklyMealPrepEnabled).toBe(true);
  });
});

describe("household portions for generic USDA foods", () => {
  it("search marks generic foods; branded foods are not", () => {
    const base = { fdcId: 1, description: "Turkey sandwich", foodNutrients: [{ nutrientId: 1008, value: 220 }, { nutrientId: 1003, value: 14 }] };
    expect(normalizeUsda({ ...base, dataType: "Survey (FNDDS)" })!.generic).toBe(true);
    expect(normalizeUsda({ ...base, dataType: "Branded", servingSize: 200, servingSizeUnit: "g" })!.generic).toBe(false);
  });

  it("portions skip 'Quantity not specified' and keep sensible labels in order", () => {
    const portions = normalizePortions([
      { portionDescription: "Quantity not specified", gramWeight: 200 },
      { portionDescription: "1 sandwich", gramWeight: 230 },
      { amount: 1, modifier: "cup, chopped", gramWeight: 91 },
      { amount: 1, measureUnit: { name: "undetermined" }, modifier: "medium", gramWeight: 118 },
      { portionDescription: "1 g", gramWeight: 1 },
    ]);
    expect(portions).toEqual([
      { label: "1 sandwich", grams: 230 },
      { label: "1 cup, chopped", grams: 91 },
      { label: "1 medium", grams: 118 },
    ]);
  });

  it("choosing a portion rescales the per-100 g values", () => {
    const food = normalizeUsda({ fdcId: 7, description: "Turkey sandwich", dataType: "Survey (FNDDS)", foodNutrients: [{ nutrientId: 1008, value: 220 }, { nutrientId: 1003, value: 14 }] })!;
    const sized = applyPortion(food, { label: "1 sandwich", grams: 230 });
    expect(sized.calories).toBe(506);
    expect(sized.protein).toBe(32.2);
    expect(sized.servingLabel).toBe("1 sandwich (230 g)");
  });

  it("details are fetched once per day; no portions means per 100 g", async () => {
    const food = normalizeUsda({ fdcId: 9, description: "Rice, white", dataType: "SR Legacy", foodNutrients: [{ nutrientId: 1008, value: 130 }, { nutrientId: 1003, value: 2.7 }] })!;
    const store = new Map<string, string>();
    const cache = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ portions: [{ label: "1 cup", grams: 158 }] }), { status: 200 })) as unknown as typeof fetch;
    expect(await fetchPortions(food, { fetchImpl, cache, now: 0 })).toEqual([{ label: "1 cup", grams: 158 }]);
    await fetchPortions(food, { fetchImpl, cache, now: 3600_000 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const none = vi.fn(async () => new Response(JSON.stringify({ portions: [] }), { status: 200 })) as unknown as typeof fetch;
    expect(await fetchPortions({ ...food, sourceId: "10" }, { fetchImpl: none, cache: null })).toEqual([]);
    expect(food.servingLabel).toBe("100 g");
  });
});
