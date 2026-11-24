/**
 * What a scan result turns into, without the UI. The AI identifies; numbers always come from the
 * planned recipe, USDA / Open Food Facts, or the label the user confirmed.
 */
import type { ScanItem, ScanLabel, ScanResult, ScanWhole } from "@/server/scan/types";
import type { FoodItem } from "@/utils/foodTypes";
import { applyPortion, manualFood } from "@/utils/foodSearch";
import { normalizeGtin } from "@/utils/gtin";

// ---- Confidence thresholds (calibrate from the exported corrections) ----
/** "Looks like your Teriyaki Turkey Rice Bowl" needs at least this match confidence. */
export const PLANNED_MATCH_MIN_CONFIDENCE = 0.7;
/** Food items at or above this are shown as identified; below it they're listed as "Not sure". */
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
export const MULTIPLE_LABELS_MESSAGE =
  "This photo shows more than one Nutrition Facts label. Take a photo of just one label so the right numbers are logged.";
export const LABEL_MISMATCH_WARNING = "These numbers don't add up. Check them before logging.";
/** How far printed calories may be from 4×protein + 4×carbs + 9×fat before the warning shows. */
export const LABEL_MISMATCH_TOLERANCE = 0.2;
/** Default "how many slices did you have?" for a whole or shared dish. */
export const WHOLE_DEFAULT_SERVINGS = 2;

export type ScanView =
  | { kind: "planned" }
  /** items: the confident ones, logged as usual. unsure: listed underneath as "Not sure: … Keep or remove?" */
  | { kind: "foods"; items: ScanItem[]; unsure: ScanItem[] }
  | { kind: "label"; label: ScanLabel }
  | { kind: "multipleLabels" }
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
 * Foods: the confident items are shown with the unsure ones listed underneath; suggestions only
 * when the main (first) item is unsure or nothing is confident.
 */
export function scanView(result: ScanResult, opts: { hasPlannedMeal: boolean; skipPlanned?: boolean }): ScanView {
  const pm = result.plannedMeal;
  if (opts.hasPlannedMeal && !opts.skipPlanned && pm?.matches && pm.confidence >= PLANNED_MATCH_MIN_CONFIDENCE) {
    return { kind: "planned" };
  }
  if (result.multipleLabels) return { kind: "multipleLabels" };
  if (result.type === "label" && result.label) return { kind: "label", label: result.label };
  if (result.type === "barcode") {
    const code = result.barcode?.digits ? normalizeGtin(result.barcode.digits) : null;
    if (code) return { kind: "barcode", code };
  }
  const main = result.items[0];
  if (result.type === "food" && main && main.confidence >= FOOD_ITEM_MIN_CONFIDENCE) {
    return {
      kind: "foods",
      items: result.items.filter((i) => i.confidence >= FOOD_ITEM_MIN_CONFIDENCE),
      unsure: result.items.filter((i) => i.confidence < FOOD_ITEM_MIN_CONFIDENCE),
    };
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

/** "slice" → "slices" for counts other than 1. */
export function unitFor(unit: string, count: number): string {
  if (count === 1 || /s$/i.test(unit)) return unit;
  return /(ch|sh|x)$/i.test(unit) ? `${unit}es` : `${unit}s`;
}

/** "12-inch pizza, 8 slices, about 80 g per slice". */
export function wholeSummary(whole: ScanWhole): string {
  return `${whole.name}, ${whole.servings} ${unitFor(whole.unit, whole.servings)}, about ${Math.round(whole.gramsPerServing)} g per ${whole.unit}`;
}

/** "How many slices did you have?" */
export function wholeQuestion(whole: ScanWhole): string {
  return `How many ${unitFor(whole.unit, 2)} did you have?`;
}

/** The portion for a count of servings of a whole dish: 2 slices of 80 g = "2 slices", 160 g. */
export function wholePortion(whole: ScanWhole, count: number): { label: string; grams: number } | null {
  if (!(count > 0)) return null;
  const n = Math.round(count * 100) / 100;
  return { label: `${n} ${unitFor(whole.unit, n)}`, grams: Math.round(n * whole.gramsPerServing) };
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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Scanned label (Nov 24)" for a label with no product name visible. */
export function scannedLabelName(dateKey: string): string {
  const [, m, d] = dateKey.split("-").map(Number);
  const month = m && MONTHS[m - 1];
  return month && d ? `Scanned label (${month} ${d})` : "Scanned label";
}

/**
 * The label as read, for the editable form. The name is the product name from the label or the
 * package front, otherwise "Scanned label (date)", so it can be logged in one tap.
 */
export function labelForm(label: ScanLabel, dateKey: string): LabelForm {
  return {
    name: label.productName?.trim() || scannedLabelName(dateKey),
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

/**
 * true when the printed calories are more than 20% away from 4×protein + 4×carbs + 9×fat. A warning
 * only, never a block. Not checked until calories, protein, carbs and fat are all filled in.
 */
export function labelDoesntAddUp(form: Pick<LabelForm, "calories" | "protein" | "carbs" | "fat">): boolean {
  const vals = [form.calories, form.protein, form.carbs, form.fat].map((s) => (s.trim() === "" ? NaN : Number(s)));
  if (vals.some((v) => !Number.isFinite(v) || v < 0)) return false;
  const [calories, protein, carbs, fat] = vals as [number, number, number, number];
  const fromMacros = 4 * protein + 4 * carbs + 9 * fat;
  if (fromMacros === 0) return calories > 0;
  return Math.abs(calories - fromMacros) / fromMacros > LABEL_MISMATCH_TOLERANCE;
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
  | {
      kind: "foods";
      items: { aiName: string; matchId: string; matchName: string; grams: number | null }[];
      servings: number;
      /** What the user did with each "Not sure" item: kept (logged), removed, or left alone (not logged). */
      unsure?: { aiName: string; choice: "kept" | "removed" | "unanswered" }[];
    }
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
