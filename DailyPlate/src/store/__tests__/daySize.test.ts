import { beforeAll, describe, expect, it, vi } from "vitest";
import type { PlannedMeal } from "@/types";
import { toDateKey } from "@/utils/date";
import { groceriesFromMeals } from "@/utils/grocery";
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
  goal: "lose",
  proteinPreference: "recommended",
  macroSplitPreference: "balanced",
  mealTiming: null,
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
const kcalTarget = (key: string, slot: string) => slotOn(key, slot).portion!.target.calories;
const groceryQty = (meals: PlannedMeal[]) =>
  groceriesFromMeals(meals).reduce((a, g) => a + g.quantity, 0);

describe("Item 45: Size today (store)", () => {
  it("½ shrinks that meal for the day, moves the rest to open meals, and Undo restores it", () => {
    const s = useAppStore.getState();
    expect(s.generateDay(today).ok).toBe(true);
    expect(s.generateDay(tomorrow).ok).toBe(true);
    // Breakfast eaten: it keeps its amounts and receives nothing.
    s.setMealTracking(today, "breakfast", foodLogForServings(today, slotOn(today, "breakfast"), 1));
    const before = {
      breakfast: JSON.stringify(slotOn(today, "breakfast").portion),
      lunch: kcalTarget(today, "lunch"),
      dinner: kcalTarget(today, "dinner"),
      tomorrow: JSON.stringify(mealsOn(tomorrow)),
      recipe: JSON.stringify(slotOn(today, "lunch").recipe),
      lunchGrocery: groceryQty([slotOn(today, "lunch")]),
    };

    const previous = useAppStore.getState().setMealDaySize(today, "lunch", 0.5);
    expect(previous).toBeNull();
    expect(slotOn(today, "lunch").daySize).toBe(0.5);
    expect(kcalTarget(today, "lunch")).toBeLessThan(before.lunch * 0.6);
    expect(kcalTarget(today, "dinner")).toBeGreaterThan(before.dinner);
    expect(JSON.stringify(slotOn(today, "breakfast").portion)).toBe(before.breakfast);
    // Other days and the recipe itself don't change; the grocery amount for this meal drops.
    expect(JSON.stringify(mealsOn(tomorrow))).toBe(before.tomorrow);
    expect(JSON.stringify(slotOn(today, "lunch").recipe)).toBe(before.recipe);
    expect(groceryQty([slotOn(today, "lunch")])).toBeLessThan(before.lunchGrocery);
    // Today's view (plannedMeals) follows the day plan.
    expect(useAppStore.getState().plannedMeals.find((m) => m.slot === "lunch")?.daySize).toBe(0.5);

    // Undo puts the previous size back.
    useAppStore.getState().setMealDaySize(today, "lunch", previous ?? null);
    expect(slotOn(today, "lunch").daySize).toBeUndefined();
    expect(kcalTarget(today, "lunch")).toBe(before.lunch);
    expect(kcalTarget(today, "dinner")).toBe(before.dinner);
  });

  it("returns undefined when there is no such meal", () => {
    expect(useAppStore.getState().setMealDaySize(day(40), "lunch", 0.5)).toBeUndefined();
  });
});

describe("Item 46: Recipes page likes, dislikes and Favorites lists", () => {
  it("disliking a planned recipe offers to replace it on upcoming days; Replace swaps it out", async () => {
    const { upcomingRecipeMeals } = await import("@/store/useAppStore");
    const s = useAppStore.getState();
    s.generateDay(tomorrow);
    const dinner = slotOn(tomorrow, "dinner");
    const target = dinner.recipe.id;
    // Put the same dinner on today too (not eaten), so it's planned on 2 days.
    useAppStore.setState((st) => ({
      dailyPlans: {
        ...st.dailyPlans,
        [today]: mealsOn(today).map((m) => (m.slot === "dinner" ? { ...m, recipe: dinner.recipe } : m)),
      },
    }));
    useAppStore.getState().toggleDislike(target);
    const upcoming = upcomingRecipeMeals(useAppStore.getState(), target);
    const days = new Set(upcoming.map((m) => m.dateKey)).size;
    // Today and tomorrow at least (a batch may repeat it on more days).
    expect(days).toBeGreaterThanOrEqual(2);
    const changed = useAppStore.getState().replaceRecipeUpcoming(target);
    expect(changed).toBe(days);
    expect(upcomingRecipeMeals(useAppStore.getState(), target)).toEqual([]);
    expect(slotOn(today, "dinner").recipe.id).not.toBe(target);
    expect(slotOn(tomorrow, "dinner").recipe.id).not.toBe(target);
    useAppStore.getState().toggleDislike(target);
  });

  it("eaten, kept or locked meals are left alone", async () => {
    const { upcomingRecipeMeals } = await import("@/store/useAppStore");
    const lunch = slotOn(tomorrow, "lunch");
    useAppStore.getState().keepMeal(tomorrow, "lunch");
    expect(upcomingRecipeMeals(useAppStore.getState(), lunch.recipe.id).some((m) => m.dateKey === tomorrow && m.slot === "lunch")).toBe(false);
  });

  it("removing a name from the Favorites lists updates the profile right away", () => {
    const p = useAppStore.getState().userProfile!;
    useAppStore.setState({
      userProfile: {
        ...p,
        favoriteFoodChips: ["chicken", "beef"],
        favoriteFoodCustom: "basil, Balsamic",
        dislikedFoodChips: ["cilantro"],
        dislikedFoodCustom: "olives, mushrooms",
        avoidedProteinSources: ["pork"],
        preferredCuisines: ["italian", "asian"],
      } as never,
    });
    const s = useAppStore.getState();
    s.removePreference("favoriteChip", "beef");
    s.removePreference("favoriteCustom", "balsamic");
    s.removePreference("avoidChip", "cilantro");
    s.removePreference("avoidCustom", "olives");
    s.removePreference("avoidProtein", "pork");
    s.removePreference("cuisine", "asian");
    const after = useAppStore.getState().userProfile!;
    expect(after.favoriteFoodChips).toEqual(["chicken"]);
    expect(after.favoriteFoodCustom).toBe("basil");
    expect(after.dislikedFoodChips).toEqual([]);
    expect(after.dislikedFoodCustom).toBe("mushrooms");
    expect(after.avoidedProteinSources).toEqual([]);
    expect(after.preferredCuisines).toEqual(["italian"]);
  });
});
