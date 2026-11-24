import { describe, expect, it } from "vitest";
import type { DayMealTracking, MealTrackingEntry, PlannedMeal } from "@/types";
import type { UserProfile } from "@/types/profile";
import { recipeLibrary } from "@/recipes/recipeLibrary";
import {
  boughtMealTargetText,
  BOUGHT_MEAL_GUIDE,
  cookedMeals,
  effectiveMealSource,
  withSlotSourceOverride,
} from "@/utils/boughtMeals";
import { applyFitAnswers } from "@/utils/fitYourLife";
import { groceriesFromMeals } from "@/utils/grocery";
import { boughtMealKeys } from "@/utils/lowComplexityPlan";
import { macrosForMeal } from "@/utils/mealTracking";
import { ADD_ON_NAMES, pickNextStep, withSlotAddOns, type DayLog } from "@/utils/nextBestStep";
import { withPlanningDefaults } from "@/utils/planningPrefs";
import {
  canAskOnOpen,
  isPaused,
  nextSkipStreak,
  nextStepQuestion,
  pauseLabel,
  pauseUntil,
  PAUSED_INDEFINITELY,
  questionsAllowed,
  spacingDays,
} from "@/utils/questionQueue";
import { createPlannedMeal } from "@/utils/recipeDisplay";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-23T12:00:00Z");
const daysFrom = (d: Date, n: number) => new Date(d.getTime() + n * DAY);

const profile = withPlanningDefaults({
  age: 35,
  sex: "male",
  heightCm: 178,
  weightKg: 80,
  activityLevel: "moderate",
  goal: "maintain",
  mealTiming: null,
  eatenMeals: ["breakfast", "lunch", "dinner"],
  snacksPerDay: 1,
  dislikedFoodChips: [],
  favoriteFoodChips: [],
} as unknown as UserProfile);

describe("Basic mode, pausing and pacing", () => {
  it("Basic mode turns questions and suggestions off", () => {
    expect(questionsAllowed({}, NOW)).toBe(true);
    expect(questionsAllowed({ basicMode: true }, NOW)).toBe(false);
  });

  it("a 1-week pause expires on day 8; 'until I resume' never expires", () => {
    const week = pauseUntil("week", NOW);
    expect(isPaused(week, daysFrom(NOW, 6))).toBe(true);
    expect(isPaused(week, daysFrom(NOW, 8))).toBe(false);
    expect(questionsAllowed({ questionsPausedUntil: week }, daysFrom(NOW, 8))).toBe(true);
    expect(isPaused(pauseUntil("indefinite", NOW), daysFrom(NOW, 400))).toBe(true);
    expect(pauseUntil("indefinite", NOW)).toBe(PAUSED_INDEFINITELY);
    expect(isPaused(pauseUntil("month", NOW), daysFrom(NOW, 27))).toBe(true);
    expect(pauseLabel(PAUSED_INDEFINITELY)).toBe("Paused");
    expect(pauseLabel(week)).toMatch(/^Paused until /);
  });

  it("3 skips in a row space questions to every 7 days; any answer goes back to 3", () => {
    let streak = 0;
    for (let i = 0; i < 3; i++) streak = nextSkipStreak(streak, "not_now");
    expect(streak).toBe(3);
    expect(spacingDays(streak)).toBe(7);
    const asked = NOW.toISOString();
    expect(canAskOnOpen(asked, daysFrom(NOW, 4), streak)).toBe(false);
    expect(canAskOnOpen(asked, daysFrom(NOW, 7), streak)).toBe(true);
    expect(nextSkipStreak(streak, "yes")).toBe(0);
    expect(nextSkipStreak(streak, "no")).toBe(0);
    expect(canAskOnOpen(asked, daysFrom(NOW, 3), 0)).toBe(true);
  });
});

describe("fit your life answers", () => {
  it("cooking amount sets cook events and the prep cap; unset changes nothing", () => {
    const little = applyFitAnswers(profile, { cookingAmount: "little" });
    expect(little.cookingEventsPerWeek).toBe(2);
    expect(little.maxPrepMinutes).toBe(20);
    expect(little.prioritizeMinimalPrep).toBe(true);
    const most = applyFitAnswers(profile, { cookingAmount: "most" });
    expect(most.cookingEventsPerWeek).toBe(6);
    expect(most.maxPrepMinutes).toBeNull();
    expect(most.prioritizeMinimalPrep).toBe(false);
    const none = applyFitAnswers(profile, {});
    expect(none.cookingEventsPerWeek).toBe(profile.cookingEventsPerWeek);
  });

  it("meal prep for lunch turns on the weekly lunch batch", () => {
    const p = applyFitAnswers(profile, { mealSources: { lunch: "prep" } });
    expect(p.weeklyMealPrepEnabled).toBe(true);
    expect(p.weeklyMealPrepSlot).toBe("lunch");
  });
});

describe("bought meals", () => {
  const lunch = createPlannedMeal("lunch", recipeLibrary.find((r) => r.id === "chicken-burrito-bowl-11")!, { scale: 1 });
  const dinner = createPlannedMeal("dinner", recipeLibrary.find((r) => r.id === "turkey-chili-18")!, { scale: 1 });
  const buyer = { ...profile, mealSources: { lunch: "buy" as const } };

  it("the card shows a target from the slot, plus the guided pick", () => {
    expect(boughtMealTargetText("lunch", { calories: 604, protein: 41 })).toBe(
      "Buying lunch? Aim for about 600 kcal and 40 g protein.",
    );
    expect(BOUGHT_MEAL_GUIDE).toBe(
      "Pick a protein (Greek yogurt, jerky, eggs, milk, deli turkey), a carb (fruit, bread, crackers), and a vegetable if there's one.",
    );
  });

  it("bought meals add nothing to the grocery list", () => {
    const meals = cookedMeals([lunch, dinner], buyer, {}, "2026-11-24");
    expect(meals.map((m) => m.slot)).toEqual(["dinner"]);
    const names = groceriesFromMeals(meals, 1).map((g) => g.name.toLowerCase());
    expect(names.some((n) => n.includes("black beans"))).toBe(false);
    expect(names.length).toBeGreaterThan(0);
  });

  it("'Buy today' changes one date only; 'Cook this instead' switches back for that date", () => {
    let o = withSlotSourceOverride({}, "2026-11-24", "dinner", "buy", "2026-11-23");
    expect(effectiveMealSource(profile, o, "2026-11-24", "dinner")).toBe("buy");
    expect(effectiveMealSource(profile, o, "2026-11-25", "dinner")).toBe("cook");
    expect(profile.mealSources).toBeUndefined();
    o = withSlotSourceOverride(o, "2026-11-24", "lunch", "cook", "2026-11-23");
    expect(effectiveMealSource(buyer, o, "2026-11-24", "lunch")).toBe("cook");
    expect(effectiveMealSource(buyer, o, "2026-11-25", "lunch")).toBe("buy");
    // Old dates are dropped after 14 days.
    const later = withSlotSourceOverride(o, "2026-12-20", "lunch", "buy", "2026-12-20");
    expect(Object.keys(later)).toEqual(["2026-12-20"]);
  });

  it("bought meals are left out of cook events and batches", () => {
    expect(boughtMealKeys(["2026-11-24", "2026-11-25"], buyer)).toEqual(["2026-11-24:lunch", "2026-11-25:lunch"]);
    expect(boughtMealKeys(["2026-11-24"], profile)).toEqual([]);
  });
});

describe("next best step", () => {
  const breakfast = createPlannedMeal("breakfast", recipeLibrary.find((r) => r.id === "greek-yogurt-parfait-51")!, { scale: 1 });
  const target = macrosForMeal(breakfast);
  const dayKey = (i: number) => new Date(Date.UTC(2026, 10, 22 - i)).toISOString().slice(0, 10);
  const shortEntry: MealTrackingEntry = {
    status: "custom",
    loggedAt: NOW.toISOString(),
    calories: target.calories,
    protein: target.protein - 15,
  };
  const days = (n: number, tracking: DayMealTracking = { breakfast: shortEntry }): DayLog[] =>
    Array.from({ length: n }, (_, i) => ({ dateKey: dayKey(i), meals: [breakfast], tracking }));
  const targets = { calories: target.calories, protein: target.protein };

  it("nothing before 7 logged days", () => {
    expect(pickNextStep({ days: days(6), todayKey: "2026-11-23", targets, profile })).toBeNull();
    expect(pickNextStep({ days: days(7), todayKey: "2026-11-23", targets, profile })).not.toBeNull();
  });

  it("a meal often short on protein: one sentence, one concrete add-on", () => {
    const step = pickNextStep({ days: days(7), todayKey: "2026-11-23", targets, profile })!;
    expect(step.kind).toBe("slotAddOn");
    expect(step.text).toBe(
      "Your breakfasts have been about 15 g short on protein most days. Adding a Greek yogurt would close the gap. Add it to your breakfasts?",
    );
    const q = nextStepQuestion(step, profile, NOW);
    expect(q.change).toMatchObject({ kind: "profile", set: { slotAddOns: { breakfast: [{ name: "Plain Greek yogurt cup (5.3 oz)" }] } } });
  });

  it("avoided foods are skipped when choosing the add-on", () => {
    const step = pickNextStep({
      days: days(7),
      todayKey: "2026-11-23",
      targets,
      profile: { ...profile, dislikedFoodCustom: "greek yogurt" },
    })!;
    expect(step.kind === "slotAddOn" && step.option.label).toBe("a cottage cheese cup");
  });

  it("a prep suggestion only when cooking is Some or Most", () => {
    const lunch = createPlannedMeal("lunch", recipeLibrary.find((r) => r.id === "chicken-burrito-bowl-11")!, { scale: 1 });
    const eatenBreakfast: MealTrackingEntry = { status: "all", loggedAt: NOW.toISOString() };
    const week: DayLog[] = Array.from({ length: 7 }, (_, i) => ({
      dateKey: dayKey(i),
      meals: [breakfast, lunch],
      tracking: { breakfast: eatenBreakfast },
    }));
    const args = { days: week, todayKey: "2026-11-23", targets, boughtLunch: () => true };
    expect(pickNextStep({ ...args, profile })).toBeNull();
    expect(pickNextStep({ ...args, profile: { ...profile, cookingAmount: "little" } })).toBeNull();
    expect(pickNextStep({ ...args, profile: { ...profile, cookingAmount: "some" } })?.kind).toBe("prepLunch");
  });

  it("add-ons replace earlier ones, so Undo takes them back out", () => {
    const side = { name: "Banana", quantity: 1, unit: "medium", category: "Produce" as const };
    const yogurt = { name: "Plain Greek yogurt cup (5.3 oz)", quantity: 1, unit: "each", category: "Dairy" as const };
    expect(withSlotAddOns([side], [yogurt])).toEqual([side, yogurt]);
    expect(withSlotAddOns([side, yogurt], undefined)).toEqual([side]);
    expect(ADD_ON_NAMES.has(yogurt.name)).toBe(true);
  });
});

describe("next best step: often-skipped meal", () => {
  const byId = (id: string) => recipeLibrary.find((r) => r.id === id)!;
  const lunch = createPlannedMeal("lunch", byId("chicken-burrito-bowl-11"), { scale: 1 });
  const dayKey = (i: number) => new Date(Date.UTC(2026, 10, 22 - i)).toISOString().slice(0, 10);
  const eaten: MealTrackingEntry = { status: "all", loggedAt: NOW.toISOString() };
  const skipped: MealTrackingEntry = { status: "skipped", loggedAt: NOW.toISOString() };
  const week = (breakfastId: string): DayLog[] =>
    Array.from({ length: 7 }, (_, i) => ({
      dateKey: dayKey(i),
      meals: [createPlannedMeal("breakfast", byId(breakfastId), { scale: 1 }), lunch],
      tracking: { breakfast: skipped, lunch: eaten },
    }));
  // Targets match what was eaten (lunch), so only the skipping stands out.
  const targets = { calories: macrosForMeal(lunch).calories, protein: macrosForMeal(lunch).protein };
  const base = { todayKey: "2026-11-23", targets, profile };

  it("first offers an easier, no-cook version", () => {
    const step = pickNextStep({ ...base, days: week("omelette-ham-tomato-56") })!;
    expect(step.kind).toBe("easierMeal");
    expect(step.text).toBe("You've skipped breakfast most days. Want quicker, no-cook breakfasts?");
    const q = nextStepQuestion(step, profile, NOW);
    expect(q.change).toMatchObject({ kind: "profile", set: { easyMeals: ["breakfast"] } });
  });

  it("offers dropping the meal only after a No to the easier version", () => {
    const step = pickNextStep({ ...base, days: week("omelette-ham-tomato-56"), declinedEasier: (s) => s === "breakfast" })!;
    expect(step.kind).toBe("dropMeal");
    expect(step.text).toBe("You've skipped breakfast on most days lately. Want plans without breakfast?");
  });

  it("offers dropping right away when the skipped meals were already no-cook", () => {
    expect(pickNextStep({ ...base, days: week("high-protein-overnight-oats-54") })?.kind).toBe("dropMeal");
    const easy = { ...profile, easyMeals: ["breakfast" as const] };
    expect(pickNextStep({ ...base, profile: easy, days: week("omelette-ham-tomato-56") })?.kind).toBe("dropMeal");
  });
});

describe("easier meals in plans", () => {
  it("an easy breakfast picks only quick no-cook or microwave recipes", async () => {
    const { generateDayPlan } = await import("@/utils/generateDayPlan");
    const { isEasyMealRecipe } = await import("@/utils/recipeFit");
    const easy = { ...profile, easyMeals: ["breakfast" as const] };
    for (let i = 0; i < 40; i++) {
      const r = generateDayPlan(recipeLibrary, {
        dislikedIds: [],
        dislikedChips: [],
        dislikedCustom: "",
        favoriteIds: [],
        favoriteChips: [],
        favoriteCustom: "",
        slots: ["breakfast"],
        mealTiming: null,
        prioritizeMinProtein: false,
        minimumProteinGrams: null,
        personalization: {
          profile: easy,
          signals: {
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
          },
        },
      })[0]!.recipe;
      expect(isEasyMealRecipe(r), r.name).toBe(true);
    }
  });
});

describe("dropping a meal moves its calories and protein to the rest", () => {
  it("the daily target stays; the remaining meals share all of it", async () => {
    const { splitMealTargets } = await import("@/utils/mealTargets");
    const { computeDailyTargets, targetInputsChanged } = await import("@/utils/tdee");
    const daily = computeDailyTargets(profile);
    const split = (slots: ("breakfast" | "lunch" | "dinner")[]) =>
      splitMealTargets({ daily, slots: slots.map((slot) => ({ slot, kind: "cooked" as const })) });
    const before = split(["breakfast", "lunch", "dinner"]);
    const after = split(["lunch", "dinner"]);
    const sum = (t: typeof before, k: "calories" | "protein") => Object.values(t).reduce((a, x) => a + (x?.[k] ?? 0), 0);
    for (const k of ["calories", "protein"] as const) {
      expect(sum(after, k)).toBe(sum(before, k));
      expect(sum(after, k)).toBe(Math.round(daily[k]));
      expect(after.lunch![k]).toBeGreaterThan(before.lunch![k]);
      expect(after.dinner![k]).toBeGreaterThan(before.dinner![k]);
    }
    // Removing breakfast isn't a target input, so the daily targets don't change.
    const step = nextStepQuestion({ kind: "dropMeal", slot: "breakfast", text: "" }, profile, NOW);
    const set = step.change.kind === "profile" ? step.change.set : {};
    expect(set.eatenMeals).toEqual(["lunch", "dinner"]);
    expect(targetInputsChanged(profile, { ...profile, ...set })).toBe(false);
  });
});

export type { PlannedMeal };
