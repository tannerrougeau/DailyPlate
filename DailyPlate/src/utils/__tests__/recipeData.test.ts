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

describe("amount state matches its values", () => {
  it.each([
    ["Broccoli florets", "broccoli-raw", "raw"],
    ["Broccoli", "broccoli-raw", "raw"],
    ["Steamed broccoli", "broccoli-cooked", "cooked"],
    ["Turkey bacon", "turkey-bacon", "as-sold"],
    ["Turkey burger patty", "turkey-patty-raw", "raw"],
    ["Cooked salmon or tuna", "salmon-cooked", "cooked"],
    ["Sliced turkey breast", "turkey-deli", "as-sold"],
    ["Roasted red peppers, diced", "peppers-roasted-jarred", "as-sold"],
    ["Dried oregano", "oregano", "as-sold"],
  ])("%s uses %s (%s)", (name, id, state) => {
    const food = matchIngredient(name)!;
    expect(food.id).toBe(id);
    expect(food.state).toBe(state);
  });

  it("raw broccoli weighs about 91 g per cup", () => {
    expect(matchIngredient("Broccoli florets")!.grams.cup).toBe(91);
  });

  it("turkey bacon uses as-packaged values", () => {
    expect(matchIngredient("Turkey bacon")!.per100g.calories).toBe(218);
  });
});

describe("recipe fixes", () => {
  const scoops = (recipeName: string, variationId: string) =>
    resolveRecipeIngredients(recipeLibrary.find((r) => r.name === recipeName)!, variationId)
      .filter((i) => /protein powder/i.test(i.name))
      .reduce((sum, i) => sum + i.quantity, 0);

  it("flavored overnight oats keep 1 scoop of protein powder in total", () => {
    expect(scoops("High Protein Overnight Oats", "chocolate-banana-nut")).toBeCloseTo(1, 6);
    expect(scoops("High Protein Overnight Oats", "strawberry")).toBeCloseTo(1, 6);
  });

  it("Breakfast Taco and Breakfast Sandwich are meals, not snacks", () => {
    for (const name of ["Breakfast Taco", "Breakfast Sandwich"]) {
      expect(recipeLibrary.find((r) => r.name === name)!.mealSlots).toEqual(["breakfast"]);
    }
  });

  it("flour Breakfast Tacos use two small tortillas", () => {
    const taco = recipeLibrary.find((r) => r.name === "Breakfast Taco")!;
    const tortilla = resolveRecipeIngredients(taco, "pork-bacon-flour").find((i) => /tortilla/i.test(i.name))!;
    expect(tortilla).toMatchObject({ quantity: 2, unit: "small" });
    expect(matchIngredient(tortilla.name)!.grams.small).toBe(32);
  });
});
