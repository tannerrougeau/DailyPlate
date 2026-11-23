import { beforeAll, describe, expect, it, vi } from "vitest";
import { resolveDisplayPrefs } from "@/utils/displayPrefs";

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

beforeAll(async () => {
  const storage = memoryStorage();
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", { localStorage: storage });
  ({ useAppStore } = await import("@/store/useAppStore"));
  const { withPlanningDefaults } = await import("@/utils/planningPrefs");
  useAppStore.setState({
    userProfile: withPlanningDefaults({
      age: 35,
      sex: "male",
      heightCm: 178,
      weightKg: 80,
      goal: "maintain",
      eatenMeals: ["breakfast", "lunch", "dinner"],
      snacksPerDay: 1,
      dislikedFoodCustom: "olives",
    } as never),
    onboardingComplete: true,
  });
  useAppStore.getState().setStartingDisplay("basic");
});

const prefs = () => resolveDisplayPrefs(useAppStore.getState().displayPrefs);

describe("checkpoints", () => {
  it("a Yes applies the change, saves a checkpoint, and Undo/Restore brings back the exact before", () => {
    const s = useAppStore.getState();
    const before = prefs();
    s.refreshQuestions([
      {
        id: "show-macros",
        text: "Want carbs, fat and fiber shown on your meal cards?",
        why: "test",
        source: "usage",
        change: { kind: "display", set: { cardMacros: true, cardFiber: true, progressMacros: true } },
        addedAt: new Date().toISOString(),
      },
    ]);
    const cp = useAppStore.getState().answerQuestion("show-macros", "yes")!;
    expect(cp).not.toBeNull();
    expect(prefs().cardMacros).toBe(true);
    expect(useAppStore.getState().checkpoints[0]!.id).toBe(cp.id);

    useAppStore.getState().restoreCheckpoint(cp.id);
    expect(prefs()).toEqual(before);
    // The restore itself is a checkpoint, so it can be undone too.
    expect(useAppStore.getState().checkpoints[0]!.what).toMatch(/^Restored:/);
  });

  it("Not now and No change nothing", () => {
    const s = useAppStore.getState();
    const before = prefs();
    const q = {
      id: "simpler-card",
      text: "Want a simpler meal card?",
      why: "test",
      source: "usage" as const,
      change: { kind: "display" as const, set: { servingLine: false } },
      addedAt: new Date().toISOString(),
    };
    s.refreshQuestions([q]);
    expect(useAppStore.getState().answerQuestion(q.id, "not_now")).toBeNull();
    expect(useAppStore.getState().answerQuestion(q.id, "no")).toBeNull();
    expect(prefs()).toEqual(before);
  });

  it("an avoid Yes adds to the avoid list generation uses, and Restore takes it back out", () => {
    const s = useAppStore.getState();
    s.refreshQuestions([
      {
        id: "avoid:mushroom",
        text: "Leave mushrooms out of your plans?",
        why: "test",
        source: "taste",
        change: { kind: "avoid", ingredient: "mushroom" },
        addedAt: new Date().toISOString(),
      },
    ]);
    const cp = useAppStore.getState().answerQuestion("avoid:mushroom", "yes")!;
    expect(useAppStore.getState().userProfile!.dislikedFoodCustom).toBe("olives, mushroom");
    useAppStore.getState().restoreCheckpoint(cp.id);
    expect(useAppStore.getState().userProfile!.dislikedFoodCustom).toBe("olives");
  });

  it("Simplest view turns everything optional off and can be restored", () => {
    const before = prefs();
    const cp = useAppStore.getState().applySimplestView();
    expect(Object.values(prefs()).every((v) => v === false)).toBe(true);
    useAppStore.getState().restoreCheckpoint(cp.id);
    expect(prefs()).toEqual(before);
  });

  it("Settings toggles are saved as checkpoints too", () => {
    const n = useAppStore.getState().checkpoints.length;
    useAppStore.getState().setDisplayPref("weighBatch", true);
    expect(useAppStore.getState().checkpoints.length).toBe(n + 1);
    expect(useAppStore.getState().checkpoints[0]!.what).toBe("Turned on: Weigh your batch");
  });
});

describe("check-in plan changes go through the queue", () => {
  const lowCheckIn = {
    calorieTargetAtSubmit: 2400,
    weightChangeDirection: "same" as const,
    weightChangeAmount: null,
    weightChangeUnit: "lbs" as const,
    energyLevel: 3,
    calorieAdherence: 3,
    proteinAdherence: 1,
    activityChange: "none" as const,
    activityChangeNotes: "",
    sleepQuality: 3,
    strengthProgress: 3,
    strengthNotes: "",
    mealVarietySatisfaction: 3,
    planEaseOfUse: 1,
    recipeEnjoyment: 1,
    hungerManagement: 3,
    experienceNotes: "",
    timesShoppedThisWeek: 2,
    timesCookedThisWeek: 3,
    leftoversFeltRepetitive: "no" as const,
  };

  it("low answers change nothing on their own", () => {
    const before = useAppStore.getState().userProfile!;
    useAppStore.getState().submitCheckIn(lowCheckIn as never, {});
    const after = useAppStore.getState().userProfile!;
    expect(after.prioritizeMinProtein).toBe(before.prioritizeMinProtein);
    expect(after.weeklyMealPrepEnabled).toBe(before.weeklyMealPrepEnabled);
    expect(after.prioritizeMinimalPrep).toBe(before.prioritizeMinimalPrep);
  });

  it("a Yes applies the plan change with a checkpoint, and Restore puts it back exactly", async () => {
    const { checkInPlanQuestions } = await import("@/utils/questionQueue");
    useAppStore.setState({
      userProfile: { ...useAppStore.getState().userProfile!, prioritizeMinProtein: false, weeklyMealPrepEnabled: false },
    });
    const qs = checkInPlanQuestions(
      { ...lowCheckIn, scaleMax: 5 } as never,
      useAppStore.getState().userProfile,
      new Date(),
    );
    useAppStore.getState().refreshQuestions(qs);
    const cp = useAppStore.getState().answerQuestion("plan:protein-first", "yes")!;
    expect(cp.what).toBe("Plans put protein first");
    expect(useAppStore.getState().userProfile!.prioritizeMinProtein).toBe(true);
    useAppStore.getState().restoreCheckpoint(cp.id);
    expect(useAppStore.getState().userProfile!.prioritizeMinProtein).toBe(false);

    const prep = useAppStore.getState().answerQuestion("plan:weekly-meal-prep", "yes")!;
    expect(useAppStore.getState().userProfile!.weeklyMealPrepEnabled).toBe(true);
    useAppStore.getState().restoreCheckpoint(prep.id);
    expect(useAppStore.getState().userProfile!.weeklyMealPrepEnabled).toBe(false);
  });

  it("No leaves the plan alone", () => {
    const before = useAppStore.getState().userProfile!.prioritizeMinimalPrep;
    expect(useAppStore.getState().answerQuestion("plan:minimal-prep", "no")).toBeNull();
    expect(useAppStore.getState().userProfile!.prioritizeMinimalPrep).toBe(before);
  });
});
