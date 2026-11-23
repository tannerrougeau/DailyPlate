import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MealSlotId, Recipe } from "@/types";
import type { UserProfile } from "@/types/profile";
import type { CheckInEntry } from "@/types/tdeeFeedback";
import { recipeLibrary } from "@/recipes/recipeLibrary";
import { generateDayPlan, type GenerateOptions } from "@/utils/generateDayPlan";
import {
  analyzePersonalizationSignals,
  recipePersonalizationBoost,
  type PersonalizationSignals,
} from "@/utils/personalizationEngine";
import { withPlanningDefaults } from "@/utils/planningPrefs";

/** Small seeded generator so pick counts are repeatable. */
function seeded(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

beforeEach(() => {
  vi.spyOn(Math, "random").mockImplementation(seeded(42));
});
afterEach(() => vi.restoreAllMocks());

const profile = withPlanningDefaults({
  age: 35,
  sex: "male",
  heightCm: 178,
  weightKg: 80,
  activityLevel: "moderate",
  goal: "maintain",
  mealTiming: "balanced",
  eatenMeals: ["breakfast", "lunch", "dinner"],
  snacksPerDay: 0,
  dislikedFoodChips: [],
  favoriteFoodChips: [],
  maxPrepMinutes: null,
} as unknown as UserProfile);

const emptySignals = (): PersonalizationSignals => ({
  skippedRecipeIds: new Set(),
  enjoyedRecipeIds: new Set(),
  recentRecipeIds: new Set(),
  swappedRecipeIds: new Set(),
  recentCounts: new Map(),
  wantsMoreVariety: false,
  skippedLongPrepCount: 0,
  enjoyedBatchCount: 0,
  loggedMealCount: 0,
  skipRate: 0,
});

function options(over: Partial<GenerateOptions> = {}, signals = emptySignals()): GenerateOptions {
  return {
    dislikedIds: [],
    dislikedChips: [],
    dislikedCustom: "",
    favoriteIds: [],
    favoriteChips: [],
    favoriteCustom: "",
    slots: ["dinner"] as MealSlotId[],
    mealTiming: null,
    prioritizeMinProtein: false,
    minimumProteinGrams: null,
    personalization: { profile, signals },
    ...over,
  };
}

const dinners = recipeLibrary.filter((r) => r.mealSlots.includes("dinner") && !r.tags.includes("packaged"));
const pickCounts = (opts: GenerateOptions, runs: number) => {
  const counts = new Map<string, number>();
  for (let i = 0; i < runs; i++) {
    const id = generateDayPlan(dinners, opts)[0]!.recipe.id;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
};

describe("signal wiring in recipe picking", () => {
  const target: Recipe = dinners.find((r) => r.name === "Teriyaki Turkey Rice Bowls")!;

  it("disliked recipes are never picked", () => {
    const counts = pickCounts(options({ dislikedIds: [target.id] }), 300);
    expect(counts.get(target.id) ?? 0).toBe(0);
  });

  it("favorites are picked noticeably more often", () => {
    const base = pickCounts(options(), 600).get(target.id) ?? 0;
    vi.spyOn(Math, "random").mockImplementation(seeded(42));
    const fav = pickCounts(options({ favoriteIds: [target.id] }), 600).get(target.id) ?? 0;
    expect(fav).toBeGreaterThan(base * 1.5);
  });

  it("a recipe planned on 2 recent days is left out while others are available", () => {
    const s = emptySignals();
    s.recentCounts.set(target.id, 2);
    expect(pickCounts(options({}, s), 300).get(target.id) ?? 0).toBe(0);
  });

  it("favorites may repeat once more", () => {
    const s = emptySignals();
    s.recentCounts.set(target.id, 2);
    expect(pickCounts(options({ favoriteIds: [target.id] }, s), 300).get(target.id) ?? 0).toBeGreaterThan(0);
  });

  it("a 'meals felt repetitive' check-in tightens the limit to 1", () => {
    const s = emptySignals();
    s.recentCounts.set(target.id, 1);
    expect(pickCounts(options({}, s), 300).get(target.id) ?? 0).toBeGreaterThan(0);
    s.wantsMoreVariety = true;
    expect(pickCounts(options({}, s), 300).get(target.id) ?? 0).toBe(0);
  });

  it("swapped-away recipes are weighted down", () => {
    const s = emptySignals();
    const before = recipePersonalizationBoost(target, "dinner", profile, s, []);
    s.swappedRecipeIds.add(target.id);
    expect(recipePersonalizationBoost(target, "dinner", profile, s, [])).toBe(before - 30);
  });
});

describe("analyzePersonalizationSignals", () => {
  const today = "2026-11-23";

  it("swaps count for 30 days", () => {
    const s = analyzePersonalizationSignals({
      mealTracking: {},
      dailyPlans: {},
      plannedMeals: [],
      todayDateKey: today,
      swapLog: [
        { recipeId: "a", dateKey: "2026-11-10", at: "2026-11-10T10:00:00Z" },
        { recipeId: "old", dateKey: "2026-10-01", at: "2026-10-01T10:00:00Z" },
      ],
    });
    expect(s.swappedRecipeIds.has("a")).toBe(true);
    expect(s.swappedRecipeIds.has("old")).toBe(false);
  });

  it("only a low variety score (1–2) counts as wanting more variety", () => {
    const entry = (v: number) => ({ mealVarietySatisfaction: v, scaleMax: 5 }) as unknown as CheckInEntry;
    const run = (v: number) =>
      analyzePersonalizationSignals({ mealTracking: {}, dailyPlans: {}, plannedMeals: [], todayDateKey: today, latestCheckIn: entry(v) })
        .wantsMoreVariety;
    expect(run(2)).toBe(true);
    expect(run(3)).toBe(false);
  });
});
