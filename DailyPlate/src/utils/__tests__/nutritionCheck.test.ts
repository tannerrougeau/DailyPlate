import { describe, expect, it } from "vitest";
import type { Recipe } from "@/types";
import { recipeLibrary, recipeSources, withComputedNutrition } from "@/recipes/recipeLibrary";
import { nutritionFromIngredients } from "@/utils/ingredientNutrition";
import { hasLabelNutrition } from "@/utils/labelNutrition";
import { unmatchedBuiltInBuilds } from "@/utils/nutritionCheck";
import { defaultVariationId, resolveRecipeIngredients, resolveRecipeMacros } from "@/utils/recipeDisplay";

const MACROS = ["calories", "protein", "carbs", "fat", "fiber"] as const;

describe("nutrition check", () => {
  it("every built-in build (variations, carb and fat swaps) matches ingredients.json", () => {
    expect(unmatchedBuiltInBuilds(recipeLibrary)).toEqual([]);
  });

  it("finds a build with an ingredient that isn't in the table", () => {
    const bad = { ...recipeLibrary[0]!, ingredients: [{ name: "Dragonfruit jerky", quantity: 1, unit: "cup", category: "Pantry" }] } as Recipe;
    expect(unmatchedBuiltInBuilds([bad])[0]?.lines[0]).toMatch(/Dragonfruit jerky/);
  });

  it("built-in recipes carry no stored nutrition, except packaged items and the ready-to-drink shake", () => {
    for (const r of recipeSources) {
      if (hasLabelNutrition(r)) continue;
      for (const k of MACROS) expect(r[k], `${r.name}.${k}`).toBeUndefined();
      for (const v of r.variationDetails ?? []) {
        if (hasLabelNutrition(r, v.id)) continue;
        for (const k of MACROS) expect(v[k], `${r.name} / ${v.label}.${k}`).toBeUndefined();
      }
    }
  });

  it("library values are computed from ingredients; packaged items keep their label", () => {
    const sirloin = recipeLibrary.find((r) => r.id === "sirloin-breakfast-platter-58")!;
    const n = nutritionFromIngredients(resolveRecipeIngredients(sirloin, defaultVariationId(sirloin)), 1)!;
    expect(sirloin.calories).toBe(Math.round(n.calories));
    const bar = recipeLibrary.find((r) => r.id === "protein-bar")!;
    const typical = bar.variationDetails!.find((v) => v.id === "typical-packaged")!;
    expect(resolveRecipeMacros(bar, "typical-packaged").protein).toBe(typical.protein);
  });

  it("user recipes keep their own nutrition when an ingredient isn't in the table", () => {
    const mine = {
      ...recipeLibrary[0]!,
      id: "user-1",
      isUserRecipe: true,
      variationDetails: undefined,
      ingredients: [{ name: "Grandma's sauce", quantity: 1, unit: "cup", category: "Pantry" }],
      calories: 321,
      protein: 12,
      carbs: 30,
      fat: 9,
    } as Recipe;
    expect(resolveRecipeMacros(mine).calories).toBe(321);
  });

  it("loading a built-in recipe with an unknown ingredient fails loudly", () => {
    const src = { ...recipeSources[0]!, variationDetails: undefined, ingredients: [{ name: "Moon cheese", quantity: 1, unit: "cup", category: "Dairy" as const }] };
    expect(() => withComputedNutrition(src)).toThrow(/ingredients.json/);
  });
});
