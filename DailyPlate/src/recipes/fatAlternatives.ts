import type { FatVariationId, RecipeIngredient } from "@/types";

export const FAT_VARIATION_OPTIONS: { id: FatVariationId; label: string }[] = [
  { id: "olive-oil", label: "Olive oil" },
  { id: "butter", label: "Butter" },
];

const COMPOUND_BUTTER = /peanut|almond|cashew|garlic butter|herb butter|cocoa/i;

export function resolveFatVariationId(selected?: FatVariationId | null): FatVariationId {
  return selected ?? "olive-oil";
}

export function fatVariationLabel(id: FatVariationId): string {
  return FAT_VARIATION_OPTIONS.find((o) => o.id === id)?.label ?? "Olive oil";
}

export function isCookingFatIngredient(ing: RecipeIngredient): boolean {
  const name = ing.name.trim();
  if (COMPOUND_BUTTER.test(name)) return false;
  return /^(extra virgin )?olive oil(\s*\(.*\))?$|^butter$|^oil$|^cooking oil$|olive oil or butter|butter or oil|butter or olive oil/i.test(
    name,
  );
}

export function recipeHasCookingFatSwap(ingredients: RecipeIngredient[]): boolean {
  return ingredients.some(isCookingFatIngredient);
}

function fatIngredient(id: FatVariationId, quantity: number, unit: string): RecipeIngredient {
  if (id === "butter") {
    return { name: "Butter", quantity, unit, category: "Dairy" };
  }
  return { name: "Olive oil", quantity, unit, category: "Pantry" };
}

export function applyFatSwapToIngredients(
  ingredients: RecipeIngredient[],
  fatId: FatVariationId,
): RecipeIngredient[] {
  if (!recipeHasCookingFatSwap(ingredients)) return ingredients;
  const mapped = ingredients.map((ing) =>
    isCookingFatIngredient(ing) ? fatIngredient(fatId, ing.quantity, ing.unit) : ing,
  );
  const merged: RecipeIngredient[] = [];
  for (const ing of mapped) {
    const existing = merged.find(
      (row) =>
        row.name.toLowerCase() === ing.name.toLowerCase() &&
        row.unit.toLowerCase() === ing.unit.toLowerCase() &&
        row.category === ing.category,
    );
    if (existing) {
      existing.quantity += ing.quantity;
      continue;
    }
    merged.push({ ...ing });
  }
  return merged;
}

function protectCompounds(text: string): { text: string; tokens: string[] } {
  const tokens: string[] = [];
  const next = text.replace(/\b(peanut|almond|cashew|garlic|herb) butter\b/gi, (m) => {
    tokens.push(m);
    return `__FATCOMP_${tokens.length - 1}__`;
  });
  return { text: next, tokens };
}

function restoreCompounds(text: string, tokens: string[]): string {
  return text.replace(/__FATCOMP_(\d+)__/g, (_, i) => tokens[Number(i)] ?? "");
}

function swapFatPhrase(text: string, fatId: FatVariationId): string {
  const chosen = fatId === "olive-oil" ? "olive oil" : "butter";
  const protectedText = protectCompounds(text);
  let next = protectedText.text;
  if (fatId === "olive-oil") {
    next = next.replace(/\bMelt butter\b/g, "Heat olive oil");
    next = next.replace(/\bmelt butter\b/g, "heat olive oil");
    next = next.replace(/\bbuttered skillet\b/gi, "skillet with olive oil");
    next = next.replace(/\bbuttered\b/gi, "oiled");
  } else {
    next = next.replace(/\bHeat olive oil\b/g, "Melt butter");
    next = next.replace(/\bheat olive oil\b/g, "melt butter");
    next = next.replace(/\bskillet with olive oil\b/gi, "buttered skillet");
  }
  next = next.replace(/\bolive oil or butter\b/gi, chosen);
  next = next.replace(/\bbutter or (?:olive )?oil\b/gi, chosen);
  next = next.replace(/\b(?:extra virgin )?olive oil\b/gi, chosen);
  next = next.replace(/\bbutter\b/gi, chosen);
  return restoreCompounds(next, protectedText.tokens);
}

export function applyFatSwapToInstructions(
  instructions: string[],
  fatId: FatVariationId,
  ingredients: RecipeIngredient[],
): string[] {
  if (!recipeHasCookingFatSwap(ingredients)) return instructions;
  return instructions.map((step) => swapFatPhrase(step, fatId));
}
