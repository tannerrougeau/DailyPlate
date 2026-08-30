import type { CarbVariationId, RecipeIngredient } from "@/types";

export type RiceCupAmount = 0.75 | 1;

type MacroSlice = { calories: number; protein: number; carbs: number; fat: number };

export const CARB_VARIATION_OPTIONS: { id: CarbVariationId; label: string }[] = [
  { id: "white-rice", label: "White Rice" },
  { id: "riced-cauliflower", label: "Riced Cauliflower" },
  { id: "riced-broccoli", label: "Riced Broccoli" },
];

export const RICE_MACROS: Record<RiceCupAmount, MacroSlice> = {
  0.75: { calories: 154, protein: 3, carbs: 34, fat: 0.3 },
  1: { calories: 205, protein: 4, carbs: 45, fat: 0.4 },
};

export const RICED_CAULIFLOWER_MACROS: Record<RiceCupAmount, MacroSlice> = {
  0.75: { calories: 38, protein: 3, carbs: 7, fat: 0.4 },
  1: { calories: 50, protein: 4, carbs: 10, fat: 0.5 },
};

export const RICED_BROCCOLI_MACROS: Record<RiceCupAmount, MacroSlice> = {
  0.75: { calories: 35, protein: 3, carbs: 6, fat: 0.3 },
  1: { calories: 47, protein: 4, carbs: 8, fat: 0.4 },
};

export const RICED_CAULIFLOWER_PREP_INSTRUCTIONS = [
  "Bagged: use store-bought riced cauliflower — microwave or sauté per package until tender and excess moisture evaporates (3–5 minutes).",
  "From whole: trim 1 small head of cauliflower, pulse florets in a food processor to rice-sized pieces (or grate with a box grater), then sauté in a dry skillet 5–7 minutes until tender.",
];

export const RICED_BROCCOLI_PREP_INSTRUCTIONS = [
  "Bagged: use store-bought riced broccoli — microwave or sauté per package until tender and moisture is cooked off (3–5 minutes).",
  "From whole: pulse raw broccoli florets (stems removed) in a food processor to rice-sized pieces, then sauté in a dry skillet 5–7 minutes until tender-crisp.",
];

const RICE_NAME_PATTERN = /rice/i;
const RICE_EXCLUDE_PATTERN = /vinegar|paper|wine|flour/i;

export function isRiceIngredient(ing: RecipeIngredient): boolean {
  return RICE_NAME_PATTERN.test(ing.name) && !RICE_EXCLUDE_PATTERN.test(ing.name);
}

export function resolveCarbVariationId(selected?: CarbVariationId): CarbVariationId {
  return selected ?? "white-rice";
}

export function carbVariationLabel(id: CarbVariationId): string {
  return CARB_VARIATION_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

export function findRiceIngredient(
  ingredients: RecipeIngredient[],
): RecipeIngredient | undefined {
  return ingredients.find(isRiceIngredient);
}

export function riceCupAmountFromIngredient(ing: RecipeIngredient): RiceCupAmount {
  return ing.quantity <= 0.75 ? 0.75 : 1;
}

export function recipeIngredientsIncludeRice(ingredients: RecipeIngredient[]): boolean {
  return ingredients.some(isRiceIngredient);
}

function applyMacroSwap(
  base: MacroSlice,
  riceCups: RiceCupAmount,
  swap: "cauliflower" | "broccoli",
): MacroSlice {
  const rice = RICE_MACROS[riceCups];
  const alt =
    swap === "cauliflower" ? RICED_CAULIFLOWER_MACROS[riceCups] : RICED_BROCCOLI_MACROS[riceCups];
  return {
    calories: Math.round(base.calories - rice.calories + alt.calories),
    protein: Math.round(base.protein - rice.protein + alt.protein),
    carbs: Math.round(base.carbs - rice.carbs + alt.carbs),
    fat: Math.round((base.fat - rice.fat + alt.fat) * 10) / 10,
  };
}

function swapIngredient(
  ing: RecipeIngredient,
  carbId: CarbVariationId,
): RecipeIngredient {
  if (!isRiceIngredient(ing)) return ing;
  const cups = riceCupAmountFromIngredient(ing);
  if (carbId === "riced-cauliflower") {
    return { name: "Riced cauliflower", quantity: cups, unit: "cup", category: "Produce" };
  }
  if (carbId === "riced-broccoli") {
    return { name: "Riced broccoli", quantity: cups, unit: "cup", category: "Produce" };
  }
  return ing;
}

export function applyCarbSwapToIngredients(
  ingredients: RecipeIngredient[],
  carbId: CarbVariationId,
): RecipeIngredient[] {
  if (carbId === "white-rice" || !recipeIngredientsIncludeRice(ingredients)) {
    return ingredients;
  }
  return ingredients.map((ing) => swapIngredient(ing, carbId));
}

export function applyCarbSwapToMacros(
  macros: MacroSlice,
  ingredients: RecipeIngredient[],
  carbId: CarbVariationId,
): MacroSlice {
  if (carbId === "white-rice") return macros;
  const rice = findRiceIngredient(ingredients);
  if (!rice) return macros;
  const cups = riceCupAmountFromIngredient(rice);
  if (carbId === "riced-cauliflower") return applyMacroSwap(macros, cups, "cauliflower");
  return applyMacroSwap(macros, cups, "broccoli");
}

export function applyCarbSwapToInstructions(
  instructions: string[],
  carbId: CarbVariationId,
): string[] {
  if (carbId === "white-rice") return instructions;

  const carbName = carbId === "riced-cauliflower" ? "riced cauliflower" : "riced broccoli";
  const prep =
    carbId === "riced-cauliflower"
      ? RICED_CAULIFLOWER_PREP_INSTRUCTIONS
      : RICED_BROCCOLI_PREP_INSTRUCTIONS;

  const swapped = instructions.map((step) =>
    step.replace(/\b(cooked )?(white )?rice\b|\bmicrowave rice\b|\bwarm rice\b/gi, carbName),
  );

  return [
    ...swapped,
    ...prep,
    `Use prepared ${carbName} as the base instead of rice — lower calories and higher fiber.`,
  ];
}
