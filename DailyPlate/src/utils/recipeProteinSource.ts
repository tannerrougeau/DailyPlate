import type { MealSlotId, Recipe } from "@/types";
import { isBeverageRecipe } from "@/utils/beverages";

export type RecipeCategory = MealSlotId | "drink";
export type ProteinSourceFilter =
  | "all"
  | "chicken"
  | "turkey"
  | "beef"
  | "seafood"
  | "egg"
  | "vegetarian"
  | "mixed_other";

export const RECIPE_CATEGORY_TABS: { id: RecipeCategory; label: string }[] = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
  { id: "snack", label: "Snacks" },
  { id: "drink", label: "Drinks" },
];

export const PROTEIN_SOURCE_FILTERS: { id: ProteinSourceFilter; label: string; shortLabel: string }[] = [
  { id: "all", label: "All proteins", shortLabel: "All" },
  { id: "chicken", label: "Chicken", shortLabel: "Chicken" },
  { id: "turkey", label: "Turkey", shortLabel: "Turkey" },
  { id: "beef", label: "Beef", shortLabel: "Beef" },
  { id: "seafood", label: "Seafood", shortLabel: "Seafood" },
  { id: "egg", label: "Egg-based", shortLabel: "Egg" },
  { id: "vegetarian", label: "Vegetarian / Plant-based", shortLabel: "Veg" },
  { id: "mixed_other", label: "Mixed / Other", shortLabel: "Other" },
];

function recipeSearchText(recipe: Recipe): string {
  return `${recipe.name} ${recipe.ingredients.map((i) => i.name).join(" ")}`.toLowerCase();
}

function recipeNameSearchText(recipe: Recipe): string {
  const variationLabels = [
    ...(recipe.variations ?? []),
    ...(recipe.variationDetails?.map((v) => v.label) ?? []),
  ];
  return [recipe.name, ...variationLabels].join(" ");
}

function wordsIn(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/** Match any word in the recipe name/variation labels, not only the first word. */
export function recipeMatchesSearch(recipe: Recipe, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const nameText = recipeNameSearchText(recipe);
  const nameLower = nameText.toLowerCase();
  if (nameLower.includes(q)) return true;
  if (wordsIn(nameText).some((word) => word.startsWith(q) || word.includes(q))) return true;

  return (
    recipe.tags.some((t) => t.toLowerCase().includes(q)) ||
    recipe.cuisine.toLowerCase().includes(q) ||
    proteinSourceLabel(getProteinSource(recipe)).toLowerCase().includes(q)
  );
}

/** Classify primary protein source from recipe name and ingredients. */
export function getProteinSource(recipe: Recipe): Exclude<ProteinSourceFilter, "all"> {
  const text = recipeSearchText(recipe);

  if (text.includes("chicken")) return "chicken";
  if (text.includes("turkey")) return "turkey";
  if (text.includes("beef") || text.includes("steak") || text.includes("ground sirloin")) {
    return "beef";
  }
  if (
    text.includes("shrimp") ||
    text.includes("salmon") ||
    text.includes("tuna") ||
    text.includes("cod") ||
    text.includes("fish") ||
    text.includes("seafood") ||
    text.includes("crab")
  ) {
    return "seafood";
  }
  if (text.includes("egg")) return "egg";
  if (
    text.includes("bean") ||
    text.includes("lentil") ||
    text.includes("chickpea") ||
    text.includes("tofu") ||
    text.includes("edamame") ||
    text.includes("tempeh") ||
    text.includes("quinoa bowl") ||
    text.includes("vegetarian")
  ) {
    return "vegetarian";
  }
  return "mixed_other";
}

export function proteinSourceLabel(source: Exclude<ProteinSourceFilter, "all">): string {
  return PROTEIN_SOURCE_FILTERS.find((o) => o.id === source)?.label ?? source;
}

export function filterRecipesForLibrary(
  recipes: Recipe[],
  category: RecipeCategory,
  proteinSource: ProteinSourceFilter,
  query: string,
): Recipe[] {
  const q = query.trim().toLowerCase();

  let list =
    category === "drink"
      ? recipes.filter(isBeverageRecipe)
      : recipes.filter((r) => r.mealSlots.includes(category));

  if (proteinSource !== "all") {
    list = list.filter((r) => getProteinSource(r) === proteinSource);
  }

  if (q) {
    list = list.filter((r) => recipeMatchesSearch(r, q));
  }

  return [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export function countRecipesByProtein(
  recipes: Recipe[],
  category: RecipeCategory,
): Record<ProteinSourceFilter, number> {
  const inCategory =
    category === "drink"
      ? recipes.filter(isBeverageRecipe)
      : recipes.filter((r) => r.mealSlots.includes(category));
  const counts: Record<ProteinSourceFilter, number> = {
    all: inCategory.length,
    chicken: 0,
    turkey: 0,
    beef: 0,
    seafood: 0,
    egg: 0,
    vegetarian: 0,
    mixed_other: 0,
  };
  for (const recipe of inCategory) {
    counts[getProteinSource(recipe)]++;
  }
  return counts;
}
