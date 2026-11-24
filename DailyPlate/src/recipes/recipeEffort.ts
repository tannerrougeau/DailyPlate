import type { CookMethod, RecipeEffort } from "@/types";

const N: CookMethod[][] = [["no_cook"]];
const M: CookMethod[][] = [["microwave"]];
const S: CookMethod[][] = [["stovetop"]];
const O: CookMethod[][] = [["oven"]];
const SO: CookMethod[][] = [["stovetop", "oven"]];

const e = (methods: CookMethod[][], chopping: RecipeEffort["chopping"], activeMinutes: number): RecipeEffort => ({
  methods,
  chopping,
  activeMinutes,
});

/**
 * Equipment and effort per built-in recipe (approved list B). `methods` lists the ways a recipe can
 * be made; each way names everything it needs. Active minutes are hands-on time (oven and simmer
 * time are hands-off). "Cooked chicken breast" and hard-boiled eggs count as store-bought.
 */
export const RECIPE_EFFORT: Record<string, RecipeEffort> = {
  "blended-cottage-cheese-pudding-49": e(N, "little", 8),
  // Stovetop, or the microwave method in its steps (10 active minutes).
  "cottage-cheese-egg-scramble-bowl-01": e([["stovetop"], ["microwave"]], "little", 10),
  "egg-turkey-muffins-14": e(O, "moderate", 12),
  "greek-yogurt-parfait-51": e(N, "little", 6),
  "high-protein-egg-bites-53": e(O, "moderate", 12),
  "high-protein-overnight-oats-54": e(N, "little", 10),
  "high-protein-smoothie-55": e(N, "little", 2),
  "omelette-ham-tomato-56": e(S, "little", 13),
  "cottage-cheese-frittata-57": e(SO, "moderate", 15),
  "sirloin-breakfast-platter-58": e(S, "little", 32),
  "breakfast-taco-59": e(S, "little", 17),
  "breakfast-sandwich-60": e(S, "little", 17),
  "b-egg-ham-toast": e(S, "little", 11),
  "baked-chicken-meatballs-rice-veg-21": e(O, "little", 15),
  "beef-broccoli-stir-fry-bowl-with-white-rice-07": e(S, "little", 24),
  "beef-veggie-stir-fry-17": e(S, "little", 20),
  "broccoli-chicken-casserole-pasta-42": e(SO, "little", 25),
  "chicken-burrito-bowl-11": e(M, "little", 12),
  "chicken-caesar-salad-extra-chicken-light-dressing-13": e(N, "little", 12),
  "garlic-butter-chicken-bites-with-rice-37": e(S, "moderate", 24),
  "greek-chicken-bowls-41": e(M, "little", 15),
  "ground-turkey-sweet-potato-skillet-04": e(S, "moderate", 20),
  "orange-chicken-rice-bowl-38": e(S, "moderate", 26),
  "protein-packed-sushi-bowl-33": e(M, "little", 12),
  "rotisserie-chicken-sweet-potato-meal-prep-16": e(O, "moderate", 15),
  "seared-chicken-thighs-roasted-veg-22": e(SO, "moderate", 25),
  // Greek Orzo also boils orzo on the stove; the recipe as a whole needs the oven.
  "sheet-pan-honey-garlic-chicken-broccoli-with-white-rice-06": e(O, "moderate", 12),
  "teriyaki-turkey-rice-bowls-39": e(S, "little", 25),
  "turkey-black-bean-chili-08": e(S, "moderate", 22),
  "turkey-hummus-wrap-12": e(N, "little", 10),
  "turkey-burger-patty-salad-kit-19": e(S, "moderate", 20),
  "turkey-chili-18": e(S, "moderate", 22),
  "baked-salmon-with-asparagus-sweet-potato-03": e(O, "little", 12),
  "snack-apple-peanut-butter": e(N, "little", 5),
  "snack-hard-boiled-eggs-fruit": e(N, "little", 2),
  "snack-carrots-hummus": e(N, "little", 5),
  "snack-banana-almond-butter": e(N, "little", 2),
  "snack-turkey-cheese-rollups": e(N, "little", 5),
  "snack-salted-edamame": e(M, "little", 7),
  "snack-tuna-cucumber-boats": e(N, "little", 8),
  "snack-berries-almonds": e(N, "little", 2),
  "snack-chia-pudding-cup": e(N, "little", 5),
  "snack-celery-peanut-butter": e(N, "little", 5),
  "snack-caprese-bites": e(N, "little", 5),
  "snack-roasted-chickpeas": e(O, "little", 5),
  "protein-bar": e(N, "little", 0),
  "snack-pkg-string-cheese": e(N, "little", 0),
  "snack-pkg-beef-jerky": e(N, "little", 0),
  "snack-pkg-babybel": e(N, "little", 0),
  "snack-pkg-meat-stick": e(N, "little", 0),
  "snack-pkg-protein-chips": e(N, "little", 0),
  "snack-pkg-cottage-cup": e(N, "little", 0),
};

/** Packaged snacks are priced per unit as sold (approved list B), not from ingredients. */
export const PACKAGED_COST_TIER: Record<string, "low" | "medium" | "high"> = {
  "protein-bar": "medium",
  "snack-pkg-string-cheese": "low",
  "snack-pkg-beef-jerky": "high",
  "snack-pkg-babybel": "medium",
  "snack-pkg-meat-stick": "medium",
  "snack-pkg-protein-chips": "medium",
  "snack-pkg-cottage-cup": "medium",
};
