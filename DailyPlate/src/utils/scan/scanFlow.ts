/**
 * What a scan result turns into, without the UI. The AI identifies; numbers always come from the
 * planned recipe, USDA / Open Food Facts, or the label the user confirmed.
 */
import type { ScanItem, ScanLabel, ScanResult } from "@/server/scan/types";
import type { FoodItem } from "@/utils/foodTypes";
import { applyPortion, manualFood } from "@/utils/foodSearch";
import { normalizeGtin } from "@/utils/gtin";

// ---- Confidence thresholds (calibrate from the exported corrections) ----
/** "Looks like your Teriyaki Turkey Rice Bowl" needs at least this match confidence. */
export const PLANNED_MATCH_MIN_CONFIDENCE = 0.7;
/** Every food item (and the scan overall) needs at least this to be shown as identified. */
export const FOOD_ITEM_MIN_CONFIDENCE = 0.6;

// ---- Messages ----
export const SCAN_FAILED_MESSAGE = "Scanning isn't working right now. Try again later or enter it manually.";
export const SCAN_PAUSED_MESSAGE = "Scanning is paused for today. Search or enter it manually.";
export const SCAN_OFFLINE_MESSAGE =
  "Scanning needs a connection. Barcodes can still be read, and the lookup runs when you're back online.";
export const SCAN_TOO_LARGE_MESSAGE = "That photo is too large to scan. Try again, or search instead.";
export const SCAN_PRIVACY_NOTE =
  "Photos are sent to our AI provider to identify your food. DailyPlate doesn't keep them unless you turn on 'Help improve scanning.'";
export const STILL_WORKING_AFTER_MS = 8000;

export type ScanView =
  | { kind: "planned" }
  | { kind: "foods"; items: ScanItem[] }
  | { kind: "label"; label: ScanLabel }
  | { kind: "barcode"; code: string }
  | { kind: "uncertain"; suggestions: string[] };

/** Up to 3 names to offer when unsure: the AI's suggestions, then any item names it gave. */
export function suggestionsFor(result: ScanResult): string[] {
  const names = [...result.suggestions, ...result.items.map((i) => (i.brand ? `${i.brand} ${i.name}` : i.name))];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    const key = n.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(n.trim());
    if (out.length === 3) break;
  }
  return out;
}

/**
 * Which screen to show. With skipPlanned (the user tapped "Not it"), the planned match is ignored.
 * Anything unclear goes to suggestions: no guessing.
 */
export function scanView(result: ScanResult, opts: { hasPlannedMeal: boolean; skipPlanned?: boolean }): ScanView {
  const pm = result.plannedMeal;
  if (opts.hasPlannedMeal && !opts.skipPlanned && pm?.matches && pm.confidence >= PLANNED_MATCH_MIN_CONFIDENCE) {
    return { kind: "planned" };
  }
  if (result.type === "label" && result.label) return { kind: "label", label: result.label };
  if (result.type === "barcode") {
    const code = result.barcode?.digits ? normalizeGtin(result.barcode.digits) : null;
    if (code) return { kind: "barcode", code };
  }
  if (
    result.type === "food" &&
    result.items.length > 0 &&
    result.confidence >= FOOD_ITEM_MIN_CONFIDENCE &&
    result.items.every((i) => i.confidence >= FOOD_ITEM_MIN_CONFIDENCE)
  ) {
    return { kind: "foods", items: result.items };
  }
  return { kind: "uncertain", suggestions: suggestionsFor(result) };
}

/** Search words for an item: the brand first when one is visible, so branded matches rank first. */
export function itemQuery(item: Pick<ScanItem, "name" | "brand">): string {
  const brand = item.brand?.trim();
  if (!brand) return item.name.trim();
  return item.name.toLowerCase().includes(brand.toLowerCase()) ? item.name.trim() : `${brand} ${item.name.trim()}`;
}

/** The best search result for an item: with a brand, the first result carrying it; else the top result. */
export function pickMatch(item: Pick<ScanItem, "brand">, results: FoodItem[]): FoodItem | null {
  const brand = item.brand?.trim().toLowerCase();
  if (brand) {
    const branded = results.find(
      (f) => (f.brand ?? "").toLowerCase().includes(brand) || f.name.toLowerCase().includes(brand),
    );
    if (branded) return branded;
  }
  return results[0] ?? null;
}

/** "1 sandwich" or "1.5 cups" from the AI's portion. */
export function portionLabel(portion: ScanItem["portion"]): string {
  const amount = Math.round(portion.amount * 100) / 100;
  return `${amount} ${portion.unit}`.trim();
}

/**
 * A matched food sized to a weight. Generic USDA foods (per 100 g) use the grams directly; foods
 * with a known serving weight are scaled by grams ÷ serving grams. Returns null when the food has
 * no weight to scale by (then the user picks servings instead).
 */
export function sizeFood(food: FoodItem, grams: number, label: string): FoodItem | null {
  if (!(grams > 0)) return null;
  if (food.generic) return applyPortion(food, { label, grams });
  const serving = food.servingGrams;
  if (!serving || !(serving > 0)) return null;
  const f = grams / serving;
  const r1 = (v: number | undefined) => (v == null ? undefined : Math.round(v * f * 10) / 10);
  return {
    ...food,
    id: `${food.id}@${Math.round(grams)}g`,
    servingLabel: `${label} (${Math.round(grams)} g)`,
    servingGrams: grams,
    calories: Math.round(food.calories * f),
    protein: r1(food.protein)!,
    carbs: r1(food.carbs),
    fat: r1(food.fat),
    fiber: r1(food.fiber),
  };
}

/** Several sized foods as one loggable food: "Hamburger + French fries" with the sums. */
export function combineFoods(foods: FoodItem[]): FoodItem {
  if (foods.length === 1) return foods[0]!;
  const sum = (k: "calories" | "protein" | "carbs" | "fat" | "fiber") =>
    Math.round(foods.reduce((t, f) => t + (f[k] ?? 0), 0) * 10) / 10;
  // USDA names contain commas ("Rice, white, cooked"), so items are joined with " + ".
  const name = foods.map((f) => f.name).join(" + ");
  const grams = foods.every((f) => f.servingGrams) ? foods.reduce((t, f) => t + (f.servingGrams ?? 0), 0) : null;
  return {
    id: `scan:${foods.map((f) => f.id).join("+")}`,
    name,
    servingLabel: "as scanned",
    servingGrams: grams,
    calories: Math.round(sum("calories")),
    protein: sum("protein"),
    carbs: sum("carbs"),
    fat: sum("fat"),
    fiber: sum("fiber"),
    source: "manual",
    sourceId: foods.map((f) => f.sourceId).join("+"),
  };
}

export type LabelForm = {
  name: string;
  serving: string;
  servingGrams: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  sodiumMg: string;
};

const str = (v: number | null | undefined) => (v == null ? "" : String(v));

/** The label as read, for the editable form. */
export function labelForm(label: ScanLabel): LabelForm {
  return {
    name: label.productName ?? "",
    serving: label.servingSize.text,
    servingGrams: str(label.servingSize.grams),
    calories: str(label.calories),
    protein: str(label.protein),
    carbs: str(label.carbs),
    fat: str(label.fat),
    fiber: str(label.fiber),
    sodiumMg: str(label.sodiumMg),
  };
}

/** The edited label as a food for My foods (per serving), or null until name, calories and protein are set. */
export function labelFood(form: LabelForm): FoodItem | null {
  const n = (s: string) => (s.trim() === "" ? undefined : Number(s));
  const calories = n(form.calories);
  const protein = n(form.protein);
  if (!form.name.trim() || calories == null || !(calories >= 0) || protein == null || !(protein >= 0)) return null;
  const grams = n(form.servingGrams);
  return manualFood({
    name: form.name,
    servingLabel: form.serving,
    calories,
    protein,
    carbs: n(form.carbs),
    fat: n(form.fat),
    fiber: n(form.fiber),
    sodiumMg: n(form.sodiumMg),
    // Without printed grams the label is logged by servings only.
    servingGrams: grams != null && grams > 0 ? grams : null,
  });
}

// ---- Corrections (opt-in, kept on the device) ----

export type ScanFinal =
  | { kind: "planned"; recipeId: string; servings: number }
  | { kind: "foods"; items: { aiName: string; matchId: string; matchName: string; grams: number | null }[]; servings: number }
  | { kind: "label"; values: LabelForm; servings: number }
  | { kind: "barcode"; code: string; matchId: string | null }
  | { kind: "search"; query?: string; matchId?: string }
  | { kind: "manual" }
  | { kind: "cancelled" };

export type ScanConfidences = {
  overall: number;
  plannedMeal: number | null;
  items: { name: string; confidence: number }[];
};

export function confidencesOf(result: ScanResult | null): ScanConfidences | null {
  if (!result) return null;
  return {
    overall: result.confidence,
    plannedMeal: result.plannedMeal?.confidence ?? null,
    items: result.items.map((i) => ({ name: i.name, confidence: i.confidence })),
  };
}
