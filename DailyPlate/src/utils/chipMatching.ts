import type { Recipe } from "@/types";

export type FoodChip = { id: string; label: string };

function recipeText(recipe: Recipe): string {
  const parts = [
    recipe.name,
    recipe.cuisine,
    ...recipe.tags,
    ...recipe.ingredients.map((i) => i.name),
  ];
  return parts.join(" ").toLowerCase();
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

const FAVORITE_MATCHERS: Record<string, RegExp[]> = {
  chicken: [/chicken/i],
  beef: [/beef|steak/i],
  seafood: [/salmon|fish|tuna|shrimp|seafood|cod|tilapia/i],
  eggs: [/egg/i],
  dairy: [/yogurt|cheese|cottage|milk|cream/i],
  beans: [/bean|lentil|chickpea|hummus/i],
  rice: [/rice|quinoa|farro|grain/i],
  pasta: [/pasta|noodle|spaghetti/i],
  potato: [/potato|sweet potato/i],
  greens: [/spinach|kale|lettuce|greens|arugula/i],
  broccoli: [/broccoli|cauliflower|brussels/i],
  berries: [/berry|berries|raspberry|blueberry|strawberry/i],
  avocado: [/avocado/i],
  nuts: [/almond|walnut|peanut|cashew|nut|seed|chia|flax/i],
  garlic_onion: [/garlic|onion|shallot|olive oil/i],
};

const DISLIKE_MATCHERS: Record<string, RegExp[]> = {
  cilantro: [/cilantro|coriander leaf/i],
  spicy: [/spicy|chili|jalape|sriracha|hot sauce|cayenne/i],
  shellfish: [/shrimp|shellfish|crab|lobster|scallop/i],
  red_meat: [/beef|steak|lamb|pork(?! chop)/i],
  dairy: [/cheese|cream|milk|butter|yogurt|cottage/i],
  eggs: [/egg/i],
  gluten: [/wheat|bread|pasta|flour|tortilla|wrap|noodle|gluten/i],
  soy: [/soy|tofu|tempeh|edamame/i],
  nuts: [/almond|peanut|walnut|cashew|nut butter|pecan/i],
  mushrooms: [/mushroom/i],
  fish: [/fish|salmon|tuna|cod|tilapia|sardine/i],
  pork: [/pork|bacon|ham|sausage/i],
  added_sugar: [/sugar|syrup|honey|sweetener|chocolate chip/i],
  sweeteners: [/aspartame|sucralose|stevia|artificial sweet/i],
  msg_processed: [/msg|monosodium|processed cheese|hot dog|deli meat/i],
};

function customTokens(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length >= 2);
}

function recipeMatchesCustomTokens(recipe: Recipe, tokens: string[]): boolean {
  if (tokens.length === 0) return false;
  const text = recipeText(recipe);
  return tokens.some((t) => text.includes(t));
}

export function recipeFavoriteBoost(
  recipe: Recipe,
  favoriteChips: string[],
  favoriteCustom = "",
): number {
  if (favoriteChips.includes("none")) return 0;
  let score = 0;
  for (const chip of favoriteChips) {
    const patterns = FAVORITE_MATCHERS[chip];
    if (patterns && matchesAny(recipeText(recipe), patterns)) score += 40;
  }
  if (recipeMatchesCustomTokens(recipe, customTokens(favoriteCustom))) score += 35;
  return score;
}

export function matchingFavoriteChips(recipe: Recipe): string[] {
  const text = recipeText(recipe);
  return Object.entries(FAVORITE_MATCHERS)
    .filter(([chip]) => chip !== "none")
    .filter(([, patterns]) => matchesAny(text, patterns))
    .map(([chip]) => chip);
}

export function matchingDislikeChips(recipe: Recipe): string[] {
  const text = recipeText(recipe);
  return Object.entries(DISLIKE_MATCHERS)
    .filter(([chip]) => chip !== "none")
    .filter(([, patterns]) => matchesAny(text, patterns))
    .map(([chip]) => chip);
}

export function recipeExcludedByDislikeChips(
  recipe: Recipe,
  dislikedChips: string[],
  dislikedCustom = "",
): boolean {
  if (dislikedChips.includes("none")) return false;
  const text = recipeText(recipe);
  for (const chip of dislikedChips) {
    const patterns = DISLIKE_MATCHERS[chip];
    if (patterns && matchesAny(text, patterns)) return true;
  }
  if (recipeMatchesCustomTokens(recipe, customTokens(dislikedCustom))) return true;
  return false;
}

/** Whole foods + common recipe building blocks */
export const FAVORITE_FOOD_CHIPS: FoodChip[] = [
  { id: "chicken", label: "Chicken" },
  { id: "beef", label: "Beef" },
  { id: "seafood", label: "Fish & seafood" },
  { id: "eggs", label: "Eggs" },
  { id: "dairy", label: "Yogurt & cheese" },
  { id: "beans", label: "Beans & lentils" },
  { id: "rice", label: "Rice & grains" },
  { id: "pasta", label: "Pasta" },
  { id: "potato", label: "Potatoes" },
  { id: "greens", label: "Leafy greens" },
  { id: "broccoli", label: "Broccoli & cauliflower" },
  { id: "berries", label: "Berries" },
  { id: "avocado", label: "Avocado" },
  { id: "nuts", label: "Nuts & seeds" },
  { id: "garlic_onion", label: "Garlic, onion & olive oil" },
  { id: "none", label: "No strong favorites" },
];

export const DISLIKED_FOOD_CHIPS: FoodChip[] = [
  { id: "cilantro", label: "Cilantro" },
  { id: "spicy", label: "Spicy heat" },
  { id: "shellfish", label: "Shellfish" },
  { id: "red_meat", label: "Red meat" },
  { id: "dairy", label: "Dairy" },
  { id: "eggs", label: "Eggs" },
  { id: "gluten", label: "Gluten / wheat" },
  { id: "soy", label: "Soy" },
  { id: "nuts", label: "Tree nuts & peanuts" },
  { id: "mushrooms", label: "Mushrooms" },
  { id: "fish", label: "Fish" },
  { id: "pork", label: "Pork" },
  { id: "added_sugar", label: "Added sugars" },
  { id: "sweeteners", label: "Artificial sweeteners" },
  { id: "msg_processed", label: "MSG & highly processed meats" },
  { id: "none", label: "Nothing to avoid" },
];
