import type { DailyTargets, MealTrackingEntry, Recipe } from "@/types";
import { gramsPerUnit, nutritionForGrams, type NutrientVector } from "@/utils/ingredientNutrition";
import { formatServings, statusForServings } from "@/utils/mealTracking";
import { recipeFiberGrams, resolveRecipeMacros, resolveVariationId } from "@/utils/recipeDisplay";

/** Something that can be logged as a snack: one serving's nutrition and, when known, its weight. */
export type SnackItem = {
  key: string;
  name: string;
  /** e.g. "1 bar (52 g)" */
  servingLabel: string;
  nutrition: NutrientVector;
  /** One serving's weight, so grams eaten can be converted to servings. */
  servingGrams: number | null;
  source: "recipe" | "manual";
  recipeId?: string;
  /** Why typed values are used instead of ingredients.json. */
  reason?: string;
};

/** A custom snack the user saved for reuse. */
export type SavedSnack = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs?: number;
  fat?: number;
};

type CommonDef = { key: string; name: string; food: string; unit: string; qty: number; label: string };

/** Common packaged and whole-food snacks, valued from ingredients.json. */
const COMMON: CommonDef[] = [
  { key: "protein-bar", name: "Protein bar", food: "Protein bar", unit: "bar", qty: 1, label: "1 bar" },
  { key: "greek-cup", name: "Greek yogurt cup", food: "Plain Greek yogurt cup (5.3 oz)", unit: "each", qty: 1, label: "1 cup (5.3 oz)" },
  { key: "string-cheese", name: "String cheese", food: "Mozzarella string cheese", unit: "stick", qty: 1, label: "1 stick" },
  { key: "jerky", name: "Jerky", food: "Beef jerky", unit: "oz", qty: 1, label: "1 oz" },
  { key: "banana", name: "Banana", food: "Banana", unit: "medium", qty: 1, label: "1 medium" },
  { key: "apple", name: "Apple", food: "Apple", unit: "medium", qty: 1, label: "1 medium" },
  { key: "milk", name: "Milk (2%)", food: "Milk (2%)", unit: "cup", qty: 1, label: "1 cup" },
  { key: "protein-drink", name: "Protein Drink", food: "Whey protein powder", unit: "scoop", qty: 1, label: "1 scoop in water" },
];

const ZERO: NutrientVector = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

export function commonSnackItems(): SnackItem[] {
  return COMMON.map((d) => {
    const per = gramsPerUnit(d.food, d.unit);
    const grams = per != null ? per * d.qty : null;
    const n = grams != null ? nutritionForGrams(d.food, grams) : null;
    return {
      key: `common:${d.key}`,
      name: d.name,
      servingLabel: grams != null ? `${d.label} (${Math.round(grams)} g)` : d.label,
      nutrition: n ?? ZERO,
      servingGrams: grams,
      source: "manual" as const,
      reason: n ? undefined : "Not in ingredients.json; typed values.",
    };
  });
}

export function snackItemFromRecipe(recipe: Recipe): SnackItem {
  const variationId = resolveVariationId(recipe, undefined);
  const m = resolveRecipeMacros(recipe, variationId);
  return {
    key: `recipe:${recipe.id}`,
    name: recipe.name,
    servingLabel: "1 serving",
    nutrition: { ...m, fiber: recipeFiberGrams(recipe, variationId) },
    servingGrams: null,
    source: "recipe",
    recipeId: recipe.id,
  };
}

export function snackItemFromSaved(s: SavedSnack): SnackItem {
  return {
    key: `saved:${s.id}`,
    name: s.name,
    servingLabel: "1 serving",
    nutrition: { calories: s.calories, protein: s.protein, carbs: s.carbs ?? 0, fat: s.fat ?? 0, fiber: 0 },
    servingGrams: null,
    source: "manual",
  };
}

/** A snack log entry for `servings` of an item (existing MealTrackingEntry fields only). */
/** source: "scan" when the snack came from a photo scan; otherwise the item's own source. */
export function snackLogEntry(
  date: string,
  item: SnackItem,
  servings: number,
  source?: MealTrackingEntry["source"],
): MealTrackingEntry {
  const n = item.nutrition;
  return {
    status: statusForServings(servings) === "skipped" ? "skipped" : "custom",
    note: servings === 1 ? item.name : `${item.name} · ${formatServings(servings)}`,
    loggedAt: new Date().toISOString(),
    date,
    slot: "snack",
    source: source ?? item.source,
    recipeId: item.recipeId,
    portionMultiplier: servings,
    calories: Math.round(n.calories * servings),
    protein: Math.round(n.protein * servings),
    carbs: Math.round(n.carbs * servings),
    fat: Math.round(n.fat * servings),
    fiber: Math.round(n.fiber * servings),
  };
}

/** Name of the item a snack log was made from (the note without its serving suffix). */
export function snackLogName(entry: MealTrackingEntry): string {
  return (entry.note ?? "Snack").split(" · ")[0]!.trim();
}

/** Last `limit` distinct snacks logged, newest first, as one-serving items. */
export function recentSnacks(snackLogs: Record<string, MealTrackingEntry[]>, limit = 5): SnackItem[] {
  const all = Object.values(snackLogs)
    .flat()
    .filter((e) => (e.portionMultiplier ?? 0) > 0)
    .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
  const seen = new Set<string>();
  const out: SnackItem[] = [];
  for (const e of all) {
    const name = snackLogName(e);
    if (seen.has(name)) continue;
    seen.add(name);
    const s = e.portionMultiplier && e.portionMultiplier > 0 ? e.portionMultiplier : 1;
    out.push({
      key: `recent:${name}`,
      name,
      servingLabel: "1 serving",
      nutrition: {
        calories: (e.calories ?? 0) / s,
        protein: (e.protein ?? 0) / s,
        carbs: (e.carbs ?? 0) / s,
        fat: (e.fat ?? 0) / s,
        fiber: (e.fiber ?? 0) / s,
      },
      servingGrams: null,
      source: e.source === "recipe" ? "recipe" : "manual",
      recipeId: e.recipeId,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** Calories and protein left today after everything logged. */
export function remainingToday(targets: DailyTargets, eaten: DailyTargets): { calories: number; protein: number } {
  return {
    calories: Math.max(0, Math.round(targets.calories - eaten.calories)),
    protein: Math.max(0, Math.round(targets.protein - eaten.protein)),
  };
}
