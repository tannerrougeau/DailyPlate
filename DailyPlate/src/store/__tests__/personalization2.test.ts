import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { DayMealTracking, PlannedMeal } from "@/types";
import type { UserProfile } from "@/types/profile";
import { recipeLibrary } from "@/recipes/recipeLibrary";
import { macrosForMeal } from "@/utils/mealTracking";
import type { Question } from "@/utils/questionQueue";
import { createPlannedMeal } from "@/utils/recipeDisplay";

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

type Store = typeof import("@/store/useAppStore").useAppStore;
let useAppStore: Store;
let withPlanningDefaults: (p: UserProfile) => UserProfile;

const baseProfile = {
  age: 35,
  sex: "male",
  heightCm: 178,
  weightKg: 80,
  activityLevel: "moderate",
  goal: "maintain",
  proteinPreference: "recommended",
  eatenMeals: ["breakfast", "lunch", "dinner"],
  snacksPerDay: 1,
  dislikedFoodChips: [],
  dislikedFoodCustom: "",
  favoriteFoodChips: [],
  favoriteFoodCustom: "",
  preferredCuisines: [],
  mealTiming: null,
} as unknown as UserProfile;

const TODAY = "2026-11-23";
const dayKey = (i: number) => new Date(Date.UTC(2026, 10, 22 - i)).toISOString().slice(0, 10);

beforeAll(async () => {
  const storage = memoryStorage();
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", { localStorage: storage });
  ({ useAppStore } = await import("@/store/useAppStore"));
  ({ withPlanningDefaults } = await import("@/utils/planningPrefs"));
});

beforeEach(async () => {
  const { computeDailyTargets } = await import("@/utils/tdee");
  const p = withPlanningDefaults(baseProfile);
  useAppStore.setState({
    userProfile: p,
    targets: computeDailyTargets(p),
    onboardingComplete: true,
    todayDateKey: TODAY,
    favoriteIds: [],
    dislikedIds: [],
    questionQueue: [],
    questionLog: {},
    lastQuestionAskedAt: null,
    questionSkipStreak: 0,
    lastNextStepAt: null,
    checkpoints: [],
    mealTracking: {},
    snackLogs: {},
    dailyPlans: {},
    plannedMeals: [],
    slotSourceOverrides: {},
    usageEvents: [],
    swapLog: [],
  });
});

const usageQuestion = (id: string): Question => ({
  id,
  text: "Want a simpler meal card?",
  why: "test",
  source: "usage",
  change: { kind: "variety" },
  addedAt: new Date().toISOString(),
});

/** Seven past days with breakfast logged about 15 g short on protein. */
function seedShortBreakfasts() {
  const breakfast: PlannedMeal = createPlannedMeal(
    "breakfast",
    recipeLibrary.find((r) => r.id === "greek-yogurt-parfait-51")!,
    { scale: 1 },
  );
  const m = macrosForMeal(breakfast);
  const dailyPlans: Record<string, PlannedMeal[]> = {};
  const mealTracking: Record<string, DayMealTracking> = {};
  for (let i = 0; i < 7; i++) {
    dailyPlans[dayKey(i)] = [breakfast];
    mealTracking[dayKey(i)] = {
      breakfast: { status: "custom", loggedAt: new Date().toISOString(), calories: m.calories, protein: m.protein - 15 },
    };
  }
  // Daily targets match what was eaten, so only the protein pattern stands out.
  useAppStore.setState({ dailyPlans, mealTracking, targets: { ...useAppStore.getState().targets, calories: m.calories } });
}

describe("Basic mode and pausing (store)", () => {
  it("Basic mode: nothing is queued, and the next best step is off too", () => {
    seedShortBreakfasts();
    useAppStore.getState().setBasicMode(true);
    useAppStore.getState().refreshQuestions([usageQuestion("u1")]);
    expect(useAppStore.getState().questionQueue).toEqual([]);
    expect(useAppStore.getState().questionsAllowedNow()).toBe(false);
    // Likes still count in Basic mode.
    useAppStore.getState().toggleFavorite(recipeLibrary[0]!.id);
    expect(useAppStore.getState().favoriteIds).toContain(recipeLibrary[0]!.id);
  });

  it("pausing stops questions; Resume brings them back; an expired pause is cleared", () => {
    useAppStore.getState().pauseQuestions("indefinite");
    useAppStore.getState().refreshQuestions([usageQuestion("u1")]);
    expect(useAppStore.getState().questionQueue).toEqual([]);
    useAppStore.getState().resumeQuestions();
    useAppStore.getState().refreshQuestions([usageQuestion("u1")]);
    expect(useAppStore.getState().questionQueue.map((q) => q.id)).toEqual(["u1"]);

    const p = useAppStore.getState().userProfile!;
    useAppStore.setState({ userProfile: { ...p, questionsPausedUntil: "2020-01-01T00:00:00.000Z" }, questionQueue: [] });
    useAppStore.getState().refreshQuestions([usageQuestion("u2")]);
    expect(useAppStore.getState().userProfile!.questionsPausedUntil).toBeNull();
    expect(useAppStore.getState().questionQueue.map((q) => q.id)).toEqual(["u2"]);
  });

  it("Not now builds the skip streak; Yes or No resets it", () => {
    useAppStore.getState().refreshQuestions([usageQuestion("a"), usageQuestion("b"), usageQuestion("c"), usageQuestion("d")]);
    for (const id of ["a", "b", "c"]) useAppStore.getState().answerQuestion(id, "not_now");
    expect(useAppStore.getState().questionSkipStreak).toBe(3);
    useAppStore.getState().answerQuestion("d", "no");
    expect(useAppStore.getState().questionSkipStreak).toBe(0);
  });
});

describe("next best step (store)", () => {
  it("queued after 7 logged days; Yes adds the item to future breakfasts with Undo", () => {
    seedShortBreakfasts();
    useAppStore.getState().refreshQuestions();
    const q = useAppStore.getState().questionQueue.find((x) => x.source === "next-step")!;
    expect(q.id).toBe("next:protein:breakfast");
    expect(q.text).toMatch(/^Your breakfasts have been about 15 g short on protein most days\./);
    expect(useAppStore.getState().lastNextStepAt).not.toBeNull();
    expect(useAppStore.getState().userProfile!.slotAddOns).toBeUndefined();

    const cp = useAppStore.getState().answerQuestion(q.id, "yes")!;
    expect(useAppStore.getState().userProfile!.slotAddOns?.breakfast?.[0]?.name).toBe("Plain Greek yogurt cup (5.3 oz)");
    useAppStore.getState().restoreCheckpoint(cp.id);
    expect(useAppStore.getState().userProfile!.slotAddOns ?? null).toBeNull();
  });

  it("at most one a week, and never while paused", () => {
    seedShortBreakfasts();
    useAppStore.setState({ lastNextStepAt: new Date().toISOString() });
    useAppStore.getState().refreshQuestions();
    expect(useAppStore.getState().questionQueue.some((x) => x.source === "next-step")).toBe(false);
    useAppStore.setState({ lastNextStepAt: null });
    useAppStore.getState().pauseQuestions("week");
    useAppStore.getState().refreshQuestions();
    expect(useAppStore.getState().questionQueue.some((x) => x.source === "next-step")).toBe(false);
  });
});

describe("Buy today (store)", () => {
  it("a one-day override, cleared again by Cook this instead", () => {
    useAppStore.getState().setSlotSourceOverride("2026-11-24", "dinner", "buy");
    expect(useAppStore.getState().slotSourceOverrides).toEqual({ "2026-11-24": { dinner: "buy" } });
    useAppStore.getState().setSlotSourceOverride("2026-11-24", "dinner", null);
    expect(useAppStore.getState().slotSourceOverrides).toEqual({});
    expect(useAppStore.getState().userProfile!.mealSources).toBeUndefined();
  });

  it("saved fit-your-life answers update the plan fields", () => {
    const next = useAppStore.getState().setFitAnswers({ cookingAmount: "little", budget: "tight", cookingLimits: ["no_oven"] })!;
    expect(next.cookingEventsPerWeek).toBe(2);
    expect(useAppStore.getState().userProfile!.budget).toBe("tight");
    expect(useAppStore.getState().userProfile!.cookingLimits).toEqual(["no_oven"]);
  });
});
