/**
 * Food search sources, used by the Netlify Function (netlify/functions/food-search.mts).
 * Runs on the server only: the USDA key never reaches the browser, and the Open Food Facts
 * User-Agent can be set (browsers don't allow it).
 */
import type { FoodItem, FoodPortion } from "../utils/foodTypes";

export const OFF_USER_AGENT = "DailyPlate/1.0 (tannerrougeau@gmail.com)";
export const OFF_CREDIT = "Open Food Facts";
/** Ask Open Food Facts only when USDA has fewer results than this. */
export const USDA_ENOUGH = 5;

type Fetch = typeof fetch;

type UsdaNutrient = { nutrientId?: number; nutrientNumber?: string; value?: number };
type UsdaFood = {
  fdcId: number;
  description: string;
  dataType?: string;
  brandName?: string;
  brandOwner?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodNutrients?: UsdaNutrient[];
};

function nutrient(food: UsdaFood, ids: number[]): number | null {
  for (const id of ids) {
    const n = food.foodNutrients?.find((x) => x.nutrientId === id);
    if (n && typeof n.value === "number") return n.value;
  }
  return null;
}

const titleCase = (s: string) =>
  s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** USDA search values are per 100 g; branded foods are converted to their label serving. */
export function normalizeUsda(food: UsdaFood): FoodItem | null {
  const kcal100 = nutrient(food, [1008, 2047, 2048]);
  const protein100 = nutrient(food, [1003]);
  if (kcal100 == null || protein100 == null) return null;
  const carbs100 = nutrient(food, [1005]);
  const fat100 = nutrient(food, [1004]);
  const unit = (food.servingSizeUnit ?? "").toLowerCase();
  const branded = food.dataType === "Branded" && food.servingSize && (unit === "g" || unit === "grm" || unit === "ml" || unit === "mlt");
  const grams = branded ? food.servingSize! : 100;
  const f = grams / 100;
  const amount = `${Math.round(grams)} ${unit === "ml" || unit === "mlt" ? "ml" : "g"}`;
  const servingLabel = branded
    ? food.householdServingFullText
      ? `${food.householdServingFullText} (${amount})`
      : amount
    : "100 g";
  return {
    id: `usda:${food.fdcId}`,
    name: food.dataType === "Branded" ? titleCase(food.description) : food.description,
    brand: food.brandName || food.brandOwner || undefined,
    servingLabel,
    servingGrams: grams,
    calories: Math.round(kcal100 * f),
    protein: Math.round(protein100 * f * 10) / 10,
    carbs: carbs100 != null ? Math.round(carbs100 * f * 10) / 10 : undefined,
    fat: fat100 != null ? Math.round(fat100 * f * 10) / 10 : undefined,
    source: "usda",
    sourceId: String(food.fdcId),
    generic: !branded && food.dataType !== "Branded",
  };
}

type UsdaPortion = {
  amount?: number;
  modifier?: string;
  portionDescription?: string;
  gramWeight?: number;
  measureUnit?: { name?: string };
};

/** Household portions from a USDA detail record, sensible ones first ("1 sandwich", "1 cup"). */
export function normalizePortions(portions: UsdaPortion[] | undefined): FoodPortion[] {
  const out: FoodPortion[] = [];
  for (const p of portions ?? []) {
    const grams = p.gramWeight;
    if (!(typeof grams === "number" && grams > 1)) continue;
    const unit = p.measureUnit?.name && p.measureUnit.name !== "undetermined" ? p.measureUnit.name : "";
    const label = (p.portionDescription?.trim() || `${p.amount ?? 1} ${p.modifier?.trim() || unit}`).trim();
    if (!label || /quantity not specified|not specified/i.test(label)) continue;
    if (out.some((x) => x.label === label)) continue;
    out.push({ label, grams: Math.round(grams * 10) / 10 });
  }
  return out;
}

export async function usdaPortions(fdcId: string, apiKey: string, fetchImpl: Fetch = fetch): Promise<FoodPortion[]> {
  const url = new URL(`https://api.nal.usda.gov/fdc/v1/food/${encodeURIComponent(fdcId)}`);
  url.searchParams.set("api_key", apiKey);
  const res = await fetchImpl(url.toString());
  if (!res.ok) throw new Error(`USDA details failed (${res.status})`);
  const body = (await res.json()) as { foodPortions?: UsdaPortion[] };
  return normalizePortions(body.foodPortions);
}

export async function searchUsda(query: string, apiKey: string, fetchImpl: Fetch = fetch): Promise<FoodItem[]> {
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("query", query);
  url.searchParams.set("dataType", "Branded,Survey (FNDDS),SR Legacy,Foundation");
  url.searchParams.set("pageSize", "15");
  const res = await fetchImpl(url.toString());
  if (!res.ok) throw new Error(`USDA search failed (${res.status})`);
  const body = (await res.json()) as { foods?: UsdaFood[] };
  return (body.foods ?? []).map(normalizeUsda).filter((x): x is FoodItem => x != null);
}

type OffProduct = {
  code?: string;
  product_name?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
};

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

/** Per serving when the label gives one, else per 100 g. */
export function normalizeOff(p: OffProduct): FoodItem | null {
  const n = p.nutriments ?? {};
  const servingG = num(p.serving_quantity);
  const perServing = num(n["energy-kcal_serving"]) != null && num(n["proteins_serving"]) != null;
  const pick = (key: string) => {
    if (perServing) return num(n[`${key}_serving`]);
    const per100 = num(n[`${key}_100g`]);
    return per100 == null ? null : servingG ? per100 * (servingG / 100) : per100;
  };
  const kcal = pick("energy-kcal");
  const protein = pick("proteins");
  if (!p.code || !p.product_name || kcal == null || protein == null) return null;
  const carbs = pick("carbohydrates");
  const fat = pick("fat");
  const servingLabel = perServing || servingG ? p.serving_size || `${servingG} g` : "100 g";
  return {
    id: `off:${p.code}`,
    name: p.product_name,
    brand: p.brands?.split(",")[0]?.trim() || undefined,
    servingLabel,
    servingGrams: servingG ?? (perServing ? null : 100),
    calories: Math.round(kcal),
    protein: Math.round(protein * 10) / 10,
    carbs: carbs != null ? Math.round(carbs * 10) / 10 : undefined,
    fat: fat != null ? Math.round(fat * 10) / 10 : undefined,
    source: "off",
    sourceId: p.code,
    credit: OFF_CREDIT,
  };
}

export async function searchOff(query: string, fetchImpl: Fetch = fetch): Promise<FoodItem[]> {
  const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
  url.searchParams.set("search_terms", query);
  url.searchParams.set("search_simple", "1");
  url.searchParams.set("action", "process");
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", "10");
  url.searchParams.set("fields", "code,product_name,brands,serving_size,serving_quantity,nutriments");
  const res = await fetchImpl(url.toString(), { headers: { "User-Agent": OFF_USER_AGENT } });
  if (!res.ok) throw new Error(`Open Food Facts search failed (${res.status})`);
  const body = (await res.json()) as { products?: OffProduct[] };
  return (body.products ?? []).map(normalizeOff).filter((x): x is FoodItem => x != null);
}

/** USDA first; Open Food Facts only when USDA has fewer than 5 results (or no key / an error). */
export async function searchRemote(
  query: string,
  apiKey: string | undefined,
  fetchImpl: Fetch = fetch,
): Promise<{ results: FoodItem[]; usdaCount: number; offCount: number }> {
  let usda: FoodItem[] = [];
  if (apiKey) {
    try {
      usda = await searchUsda(query, apiKey, fetchImpl);
    } catch {
      usda = [];
    }
  }
  let off: FoodItem[] = [];
  if (usda.length < USDA_ENOUGH) {
    try {
      off = await searchOff(query, fetchImpl);
    } catch {
      off = [];
    }
  }
  return { results: [...usda, ...off], usdaCount: usda.length, offCount: off.length };
}
