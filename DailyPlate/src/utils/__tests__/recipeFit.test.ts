import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MealSlotId, RecipeMealSlotId } from "@/types";
import type { BudgetPreference, CookingLimit } from "@/types/profile";
import { recipeLibrary } from "@/recipes/recipeLibrary";
import { RECIPE_EFFORT } from "@/recipes/recipeEffort";
import { generateDayPlan, type GenerateOptions } from "@/utils/generateDayPlan";
import { isBeverageRecipe } from "@/utils/beverages";
import { recipeMatchesEquipment } from "@/utils/planningPrefs";
import {
  budgetWeight,
  buildCost,
  cheapestCost,
  costTierFor,
  isBudgetFriendly,
  passesCookingLimits,
  passesEquipmentLimits,
} from "@/utils/recipeFit";
import { pickPreferredVariationId } from "@/utils/variationPrefs";

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
  vi.spyOn(Math, "random").mockImplementation(seeded(7));
});
afterEach(() => vi.restoreAllMocks());

const byId = (id: string) => recipeLibrary.find((r) => r.id === id)!;
const meals = recipeLibrary.filter((r) => !isBeverageRecipe(r));
const LIMITS: CookingLimit[] = ["microwave_only", "no_oven", "short_time", "little_chopping"];
const SLOTS: RecipeMealSlotId[] = ["breakfast", "lunch", "dinner", "snack"];

function options(over: Partial<GenerateOptions> = {}): GenerateOptions {
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
    ...over,
  };
}

describe("recipe tags", () => {
  it("every built-in recipe (except drinks) has equipment and effort tags", () => {
    expect(meals.filter((r) => !RECIPE_EFFORT[r.id]).map((r) => r.name)).toEqual([]);
  });

  it("at least 5 recipes per meal type for every combination of limits", () => {
    for (let mask = 1; mask < 16; mask++) {
      const limits = LIMITS.filter((_, i) => mask & (1 << i));
      for (const slot of SLOTS) {
        const n = meals.filter((r) => r.mealSlots.includes(slot) && passesCookingLimits(r, limits)).length;
        expect(n, `${limits.join("+")} ${slot}`).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it("the approved fixes: burrito bowl and wrap at dinner, scramble by microwave, store-bought eggs", () => {
    expect(byId("chicken-burrito-bowl-11").mealSlots).toContain("dinner");
    expect(byId("turkey-hummus-wrap-12").mealSlots).toContain("dinner");
    expect(passesEquipmentLimits(byId("cottage-cheese-egg-scramble-bowl-01"), ["microwave_only"])).toBe(true);
    expect(byId("cottage-cheese-egg-scramble-bowl-01").instructions.join(" ")).toMatch(/Microwave option/);
    expect(passesEquipmentLimits(byId("snack-hard-boiled-eggs-fruit"), ["microwave_only"])).toBe(true);
  });
});

describe("cooking limits filter picks", () => {
  for (const limit of LIMITS) {
    it(`${limit}: every pick passes`, () => {
      for (const slot of ["breakfast", "lunch", "dinner"] as MealSlotId[]) {
        for (let i = 0; i < 60; i++) {
          const r = generateDayPlan(recipeLibrary, options({ slots: [slot], cookingLimits: [limit] }))[0]!.recipe;
          expect(passesCookingLimits(r, [limit]), `${slot}: ${r.name}`).toBe(true);
        }
      }
    });
  }

  it("equipment is never relaxed, even when dislikes leave few options", () => {
    const dislikedIds = meals.filter((r) => r.mealSlots.includes("dinner")).slice(0, 14).map((r) => r.id);
    for (let i = 0; i < 80; i++) {
      const r = generateDayPlan(recipeLibrary, options({ cookingLimits: ["no_oven", "short_time"], dislikedIds }))[0]?.recipe;
      if (r) expect(passesEquipmentLimits(r, ["no_oven"]), r.name).toBe(true);
    }
  });

  it("time and chopping soften to a preference when fewer than 5 fit", () => {
    // Dislike every dinner that passes "short on time" except two: other dinners can appear, rarely.
    const fits = meals.filter((r) => r.mealSlots.includes("dinner") && passesCookingLimits(r, ["short_time"]));
    const dislikedIds = fits.slice(2).map((r) => r.id);
    let fitting = 0;
    for (let i = 0; i < 200; i++) {
      const r = generateDayPlan(recipeLibrary, options({ cookingLimits: ["short_time"], dislikedIds }))[0]!.recipe;
      if (passesCookingLimits(r, ["short_time"])) fitting += 1;
    }
    expect(fitting).toBeGreaterThan(60);
    expect(fitting).toBeLessThan(200);
  });

  it("kitchen equipment uses the ways a recipe can be made (edamame: microwave or stove)", () => {
    expect(recipeMatchesEquipment(byId("snack-salted-edamame"), ["microwave"])).toBe(true);
    expect(recipeMatchesEquipment(byId("cottage-cheese-frittata-57"), ["stovetop", "microwave"])).toBe(false);
    expect(recipeMatchesEquipment(byId("cottage-cheese-frittata-57"), ["stovetop", "oven"])).toBe(true);
  });
});

describe("budget", () => {
  it("each variation has its own cost: the plain whey shake is low, blended builds are not", () => {
    const drink = byId("high-protein-smoothie-55");
    expect(buildCost(drink, "whey-shake")).toBeLessThan(1.2);
    expect(costTierFor(drink, buildCost(drink, "whey-shake"))).toBe("low");
    expect(costTierFor(drink, buildCost(drink, "classic-banana"))).toBe("high");
    expect(isBudgetFriendly(drink)).toBe(true);
    expect(isBudgetFriendly(drink, "classic-banana")).toBe(false);
  });

  it("ranks by cost per serving: a chili just over $4 is penalized far less than sirloin or salmon", () => {
    const chili = cheapestCost(byId("turkey-black-bean-chili-08"));
    const salmon = cheapestCost(byId("baked-salmon-with-asparagus-sweet-potato-03"));
    const mid = 3;
    expect(budgetWeight(chili, mid, "tight")).toBeGreaterThan(budgetWeight(salmon, mid, "tight") * 1.5);
    expect(budgetWeight(salmon, mid, "flexible")).toBe(1);
    expect(budgetWeight(salmon, mid, "moderate")).toBeGreaterThan(budgetWeight(salmon, mid, "tight"));
  });

  const lowShare = (budget?: BudgetPreference) => {
    vi.spyOn(Math, "random").mockImplementation(seeded(11));
    let low = 0;
    const runs = 400;
    for (let i = 0; i < runs; i++) {
      const r = generateDayPlan(recipeLibrary, options({ budget }))[0]!.recipe;
      if (cheapestCost(r) < 3) low += 1;
    }
    return low / runs;
  };

  it("Tight picks cheaper dinners measurably more often; Flexible changes nothing", () => {
    const none = lowShare(undefined);
    expect(lowShare("tight")).toBeGreaterThan(none + 0.1);
    expect(lowShare("flexible")).toBe(none);
  });

  it("with a Tight budget the variation choice keeps the cheaper builds", () => {
    const drink = byId("high-protein-smoothie-55");
    const id = pickPreferredVariationId(drink, "snack", [], "", "whole_food", "tight")!;
    expect(buildCost(drink, id)).toBeLessThanOrEqual(cheapestCost(drink) * 1.5);
  });
});
