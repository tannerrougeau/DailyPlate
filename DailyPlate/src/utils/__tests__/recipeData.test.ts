import { describe, expect, it } from "vitest";
import { recipeLibrary } from "@/recipes/recipeLibrary";
import { matchIngredient, nutritionForGrams } from "@/utils/ingredientNutrition";
import { resolveRecipeIngredients } from "@/utils/recipeDisplay";

describe("recipe servings", () => {
  it("treats the ingredient list ÷ servings as one serving", () => {
    const eggBites = recipeLibrary.find((r) => r.name === "High Protein Egg Bites")!;
    expect(eggBites.servings).toBe(3);
    const eggs = resolveRecipeIngredients(eggBites).find((i) => i.name === "Eggs")!;
    expect(eggs.quantity).toBeCloseTo(4 / 3, 6);
  });

  it("recipes without servings keep their list as one serving", () => {
    const teriyaki = recipeLibrary.find((r) => r.name === "Teriyaki Turkey Rice Bowls")!;
    expect(teriyaki.servings).toBeUndefined();
    expect(resolveRecipeIngredients(teriyaki)[0]!.quantity).toBe(teriyaki.ingredients[0]!.quantity);
  });
});

describe("ingredient entries", () => {
  it("bone-in thighs count only the edible part for nutrition", () => {
    const food = matchIngredient("Chicken thighs (bone-in, skin-on)")!;
    const fraction = food.edible!.fraction;
    expect(fraction).toBeGreaterThan(0.6);
    expect(fraction).toBeLessThan(1);
    const n = nutritionForGrams("Chicken thighs (bone-in, skin-on)", 100)!;
    expect(n.calories).toBeCloseTo(food.per100g.calories * fraction, 6);
  });

  it("cheeses and chives have their own entries", () => {
    expect(matchIngredient("Pepper Jack cheese, shredded")!.id).toBe("pepper-jack");
    expect(matchIngredient("Gruyère cheese, shredded")!.id).toBe("gruyere");
    expect(matchIngredient("Swiss cheese, shredded")!.id).toBe("swiss");
    expect(matchIngredient("Fresh chives, chopped")!.id).toBe("chives");
  });

  it("light cream cheese is low fat, not fat free", () => {
    expect(matchIngredient("Light cream cheese")!.per100g.fat).toBeGreaterThan(5);
  });

  it("hash browns carry no added fat (the recipe measures its own oil)", () => {
    expect(matchIngredient("Shredded hash browns (cooked)")!.per100g.fat).toBeLessThan(1);
  });
});
