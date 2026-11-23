import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Recipe } from "@/types";
import type { UserProfile } from "@/types/profile";
import { recipeLibrary } from "@/recipes/recipeLibrary";
import { avoidConflictQuestions, likePatternQuestions } from "@/utils/questionQueue";
import { goalLinkedProteinGrams } from "@/utils/proteinMinimum";
import { targetInputsChanged } from "@/utils/tdee";

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
  dislikedFoodChips: ["mushrooms"],
  dislikedFoodCustom: "",
  favoriteFoodChips: [],
  favoriteFoodCustom: "",
  preferredCuisines: [],
} as unknown as UserProfile;

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
    favoriteIds: [],
    dislikedIds: [],
    questionQueue: [],
    questionLog: {},
    checkpoints: [],
    tdeeFeedbackHistory: [],
  });
});

const neutralCheckIn = {
  calorieTargetAtSubmit: 1800,
  weightChangeDirection: "same" as const,
  weightChangeAmount: null,
  weightChangeUnit: "lbs" as const,
  energyLevel: 3,
  calorieAdherence: 3,
  proteinAdherence: 3,
  activityChange: "none" as const,
  activityChangeNotes: "",
  sleepQuality: 3,
  strengthProgress: 3,
  strengthNotes: "",
  mealVarietySatisfaction: 3,
  planEaseOfUse: 3,
  recipeEnjoyment: 3,
  hungerManagement: 3,
  experienceNotes: "",
  timesShoppedThisWeek: 2,
  timesCookedThisWeek: 3,
  leftoversFeltRepetitive: "no" as const,
};

describe("check-in never overwrites targets", () => {
  it("an applied recommendation survives a check-in", () => {
    useAppStore.getState().applyCalorieRecommendation(1800);
    const applied = useAppStore.getState().targets;
    expect(applied.calories).toBe(1800);
    useAppStore.getState().submitCheckIn(neutralCheckIn as never, {});
    expect(useAppStore.getState().targets).toEqual(applied);
  });

  it("a check-in that edits a target input (weight) does recalculate", () => {
    useAppStore.getState().applyCalorieRecommendation(1800);
    useAppStore.getState().submitCheckIn(neutralCheckIn as never, { weightKg: 76 });
    expect(useAppStore.getState().targets.calories).not.toBe(1800);
  });

  it("only target inputs count as a change", () => {
    const p = useAppStore.getState().userProfile!;
    expect(targetInputsChanged(p, { ...p, preferredCuisines: ["mexican"] })).toBe(false);
    expect(targetInputsChanged(p, { ...p, goal: "lose" })).toBe(true);
    expect(targetInputsChanged(p, { ...p, activityLevel: "very" })).toBe(true);
  });
});

describe("likes and dislikes are recipe-level", () => {
  const mexican = recipeLibrary.filter((r) => r.cuisine === "mexican");

  it("a like favorites the recipe without adding foods or cuisines to the profile", () => {
    const before = useAppStore.getState().userProfile!;
    useAppStore.getState().toggleFavorite(mexican[0]!.id);
    const after = useAppStore.getState().userProfile!;
    expect(useAppStore.getState().favoriteIds).toContain(mexican[0]!.id);
    expect(after.favoriteFoodChips).toEqual(before.favoriteFoodChips);
    expect(after.preferredCuisines).toEqual(before.preferredCuisines);
    expect(after.favoriteFoodCustom).toBe(before.favoriteFoodCustom);
  });

  it("a dislike avoids the recipe without adding its foods to the avoid list", () => {
    const before = useAppStore.getState().userProfile!;
    useAppStore.getState().toggleDislike(mexican[0]!.id);
    const after = useAppStore.getState().userProfile!;
    expect(useAppStore.getState().dislikedIds).toContain(mexican[0]!.id);
    expect(after.dislikedFoodChips).toEqual(before.dislikedFoodChips);
    expect(after.dislikedFoodCustom).toBe(before.dislikedFoodCustom);
  });

  it("3 liked recipes sharing a cuisine → a question; Yes adds it with a checkpoint", () => {
    expect(mexican.length).toBeGreaterThanOrEqual(3);
    for (const r of mexican.slice(0, 3)) useAppStore.getState().toggleFavorite(r.id);
    useAppStore.getState().refreshQuestions();
    const q = useAppStore.getState().questionQueue.find((x) => x.id === "like:cuisine:mexican")!;
    expect(q.text).toBe("You've liked several Mexican-style meals. Want more like these?");
    expect(useAppStore.getState().userProfile!.preferredCuisines).toEqual([]);
    const cp = useAppStore.getState().answerQuestion(q.id, "yes")!;
    expect(useAppStore.getState().userProfile!.preferredCuisines).toEqual(["mexican"]);
    useAppStore.getState().restoreCheckpoint(cp.id);
    expect(useAppStore.getState().userProfile!.preferredCuisines).toEqual([]);
  });

  it("liking a recipe with an avoided food asks; it's never removed automatically", () => {
    const withMushrooms = recipeLibrary.find((r) => r.ingredients.some((i) => /mushroom/i.test(i.name)))!;
    useAppStore.getState().toggleFavorite(withMushrooms.id);
    expect(useAppStore.getState().userProfile!.dislikedFoodChips).toEqual(["mushrooms"]);
    const q = useAppStore.getState().questionQueue.find((x) => x.id === "unavoid:mushrooms")!;
    expect(q.text).toBe(`You liked ${withMushrooms.name}, which has mushrooms. Take mushrooms off your avoid list?`);
    const cp = useAppStore.getState().answerQuestion(q.id, "yes")!;
    expect(useAppStore.getState().userProfile!.dislikedFoodChips).toEqual([]);
    useAppStore.getState().restoreCheckpoint(cp.id);
    expect(useAppStore.getState().userProfile!.dislikedFoodChips).toEqual(["mushrooms"]);
  });
});

describe("pure question rules for likes", () => {
  const p = { ...baseProfile, dislikedFoodChips: [], dislikedFoodCustom: "olives" } as UserProfile;

  it("fewer than 3 shared → no question; already preferred → no question", () => {
    const two = recipeLibrary.filter((r) => r.cuisine === "mexican").slice(0, 2);
    expect(likePatternQuestions(two, p, new Date()).some((q) => q.id === "like:cuisine:mexican")).toBe(false);
    const three = recipeLibrary.filter((r) => r.cuisine === "mexican").slice(0, 3);
    expect(likePatternQuestions(three, { ...p, preferredCuisines: ["mexican"] }, new Date()).some((q) => q.id === "like:cuisine:mexican")).toBe(false);
  });

  it("a shared main ingredient → more meals with it", () => {
    const salmon = recipeLibrary.filter((r) => r.ingredients.some((i) => /salmon/i.test(i.name)));
    const liked: Pick<Recipe, "cuisine" | "ingredients">[] = [salmon[0]!, salmon[1] ?? salmon[0]!, salmon[0]!];
    const q = likePatternQuestions(liked, p, new Date()).find((x) => x.id === "like:food:salmon")!;
    expect(q.text).toBe("You've liked several meals with salmon. Want more like these?");
  });

  it("custom avoid words are checked too", () => {
    const withOlives = {
      name: "Olive plate",
      ingredients: [{ name: "Kalamata olives (pitted)", quantity: 2, unit: "tbsp", category: "Pantry" as const }],
    };
    expect(avoidConflictQuestions(withOlives, p, new Date()).map((q) => q.id)).toContain("unavoid:olives");
  });
});

describe("protein minimum: never overwrite a hand-set value", () => {
  it("a typed value equal to the formula stays when weight changes", () => {
    const auto = goalLinkedProteinGrams({ goal: "maintain", preference: "recommended", weightKg: 80, heightCm: 178 });
    const typed = withPlanningDefaults({ ...baseProfile, minimumProteinGrams: auto, minimumProteinCustom: true });
    const lighter = withPlanningDefaults({ ...typed, weightKg: 70 });
    expect(lighter.minimumProteinGrams).toBe(auto);
    expect(lighter.minimumProteinCustom).toBe(true);
  });

  it("an automatic value follows a weight change (it no longer freezes)", () => {
    const auto = withPlanningDefaults(baseProfile);
    expect(auto.minimumProteinCustom).toBe(false);
    const lighter = withPlanningDefaults({ ...auto, weightKg: 70 });
    expect(lighter.minimumProteinGrams).toBe(
      goalLinkedProteinGrams({ goal: "maintain", preference: "recommended", weightKg: 70, heightCm: 178 }),
    );
  });

  it("older saves without the flag are inferred once from the stored value", () => {
    const old = withPlanningDefaults({ ...baseProfile, minimumProteinGrams: 175 });
    expect(old.minimumProteinCustom).toBe(true);
    expect(old.minimumProteinGrams).toBe(175);
  });
});
