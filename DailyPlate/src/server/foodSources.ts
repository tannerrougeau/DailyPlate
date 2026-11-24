/**
 * Food search sources, used by the Netlify Function (netlify/functions/food-search.mts).
 * Runs on the server only: the USDA key never reaches the browser, and the Open Food Facts
 * User-Agent can be set (browsers don't allow it).
 */
import type { FoodItem, FoodPortion } from "../utils/foodTypes";
import { normalizeGtin, sameGtin } from "../utils/gtin";

export const OFF_USER_AGENT = "DailyPlate/1.0 (tannerrougeau@gmail.com)";
export const OFF_CREDIT = "Open Food Facts";
/** Ask Open Food Facts only when USDA has fewer results than this. */
export const USDA_ENOUGH = 5;
/** Pause before retrying Open Food Facts after a 503/429. */
export let OFF_RETRY_MS = 600;
/** Tests only: skip the retry pause. */
export function setOffRetryMs(ms: number) {
  OFF_RETRY_MS = ms;
}

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
  gtinUpc?: string;
  foodNutrients?: UsdaNutrient[];
};

function nutrient(food: UsdaFood, ids: number[]): number | null {
  for (const id of ids) {
    const n = food.foodNutrients?.find((x) => x.nutrientId === id);
    if (n && typeof n.value === "number") return n.value;
  }
  return null;
}

/** Words kept upper case when tidying names. */
const KEEP_UPPER = new Set(["US", "USA", "UK", "BBQ", "LLC", "II", "III", "XL"]);

/** "SNICKERS Bar" → "Snickers Bar": all-caps words get normal capitalization; mixed case is kept. */
export function tidyCase(s: string): string {
  return s
    .split(/(\s+|-|\/)/)
    .map((w) => {
      if (!/[A-Z]{2,}/.test(w) || /[a-z]/.test(w) || KEEP_UPPER.has(w)) return w;
      if (/\d/.test(w)) return w.toLowerCase(); // "18TH" → "18th", "2PK" → "2pk"
      return w.charAt(0) + w.slice(1).toLowerCase();
    })
    .join("");
}

const isAllCaps = (s: string) => /[A-Z]/.test(s) && !/[a-z]/.test(s);

/**
 * Readable USDA names, keeping the brand separate:
 * - SR Legacy "Candies, MARS SNACKFOOD US, SNICKERS Bar" → "Snickers Bar"
 * - SR Legacy "Yogurt, Greek, nonfat, vanilla, CHOBANI" → "Yogurt, Greek, nonfat, vanilla" (brand Chobani)
 * - Branded "SNICKERS, SNICKERS MINIS" (brand SNICKERS) → "Snickers Minis"
 * - FNDDS "Nutrition bar (Snickers Marathon Protein Bar)" → "Snickers Marathon Protein Bar"
 */
export function tidyUsdaName(food: Pick<UsdaFood, "description" | "dataType" | "brandName" | "brandOwner">): {
  name: string;
  brand?: string;
} {
  const desc = food.description.trim();
  const brandRaw = food.brandName || food.brandOwner || "";
  if (food.dataType === "Branded") {
    const brandKey = brandRaw.trim().toLowerCase();
    const parts = desc.split(/,\s*/).filter(Boolean);
    const kept = parts.filter((p) => p.toLowerCase() !== brandKey);
    // Drop a trailing part whose words are already in the name ("…CREAMER SINGLES, SNICKERS").
    const named = (kept.length > 0 ? kept : parts).filter((p, i, all) => {
      if (i === 0) return true;
      const before = new Set(words(all.slice(0, i).join(" ")));
      return !words(p).every((w) => before.has(w));
    });
    const name = tidyCase(named.join(", "));
    // Brand shown only when the name doesn't already start with it ("Snickers Minis", not "… · Snickers").
    const brand = brandRaw && !name.toLowerCase().startsWith(brandKey) ? tidyCase(brandRaw) : undefined;
    return { name, brand };
  }
  // FNDDS: "Generic (Specific Product Name)" when the parenthetical is a proper name.
  const paren = desc.match(/^[^()]+\(([^()]+)\)$/);
  if (paren && /^[A-Z]/.test(paren[1]!.trim()) && /[A-Z].*\s.*[A-Z]/.test(paren[1]!)) {
    return { name: paren[1]!.trim() };
  }
  const parts = desc.split(/,\s*/);
  // SR Legacy branded: "Category, BRAND OWNER, PRODUCT…"
  if (parts.length >= 3 && isAllCaps(parts[1]!) && parts[1]!.split(/\s+/).length >= 2) {
    const owner = parts[1]!.replace(/\s+(US|USA|INC\.?|LLC)$/i, "");
    return { name: tidyCase(parts.slice(2).join(", ")), brand: tidyCase(owner) };
  }
  // Brand at the end: "Yogurt, Greek, nonfat, vanilla, CHOBANI"
  const last = parts[parts.length - 1]!;
  if (parts.length >= 2 && isAllCaps(last) && last.length >= 3) {
    return { name: parts.slice(0, -1).join(", "), brand: tidyCase(last) };
  }
  return { name: desc };
}

// ---------- Ranking and duplicates ----------

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);

/** Lower is closer: exact name, then names starting with the query, then all words present; fewer extra words first. */
export function matchScore(query: string, food: Pick<FoodItem, "name">): number {
  const q = words(query);
  const n = words(food.name);
  const qs = q.join(" ");
  const ns = n.join(" ");
  const tier = ns === qs ? 0 : ns.startsWith(qs) ? 1 : q.every((w) => n.includes(w)) ? 2 : 3;
  const extra = n.filter((w) => !q.includes(w)).length;
  return tier * 1000 + extra * 20 + Math.min(ns.length, 19);
}

/**
 * The same food in two USDA datasets: different datasets, calories per 100 g within 1%, and one
 * name's words contain the other's.
 */
export function isNearDuplicate(a: FoodItem, b: FoodItem): boolean {
  if (a.source !== "usda" || b.source !== "usda" || a.kcalPer100g == null || b.kcalPer100g == null) return false;
  if (!a.dataset || !b.dataset || a.dataset === b.dataset) return false;
  const k = Math.max(a.kcalPer100g, b.kcalPer100g, 1);
  if (Math.abs(a.kcalPer100g - b.kcalPer100g) / k > 0.01) return false;
  const wa = new Set(words(a.name));
  const wb = new Set(words(b.name));
  const [small, big] = wa.size <= wb.size ? [wa, wb] : [wb, wa];
  return small.size >= 2 && [...small].every((w) => big.has(w));
}

/** USDA before Open Food Facts; within each, closest names first (stable). Then near-duplicates are dropped. */
export function rankAndDedupe(query: string, foods: FoodItem[]): FoodItem[] {
  const sourceOrder = (f: FoodItem) => (f.source === "usda" ? 0 : 1);
  const ranked = foods
    .map((f, i) => ({ f, i, s: sourceOrder(f) * 100000 + matchScore(query, f) }))
    .sort((x, y) => x.s - y.s || x.i - y.i)
    .map((x) => x.f);
  const out: FoodItem[] = [];
  for (const f of ranked) {
    if (!out.some((kept) => isNearDuplicate(kept, f))) out.push(f);
  }
  return out;
}

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
  const tidy = tidyUsdaName(food);
  return {
    id: `usda:${food.fdcId}`,
    name: tidy.name,
    brand: tidy.brand,
    sourceName: food.description,
    kcalPer100g: kcal100,
    dataset: food.dataType,
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

/** USDA data types searched: Branded for packaged products, the rest for generic foods. */
export const USDA_DATA_TYPES = ["Branded", "Survey (FNDDS)", "SR Legacy", "Foundation"];

/**
 * USDA search uses POST with a JSON body: the GET form with "Survey (FNDDS)" in the query string is
 * rejected by USDA's server with HTTP 400.
 */
export async function searchUsda(query: string, apiKey: string, fetchImpl: Fetch = fetch): Promise<FoodItem[]> {
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, dataType: USDA_DATA_TYPES, pageSize: 15 }),
  });
  if (!res.ok) throw new Error(`USDA search failed (HTTP ${res.status})`);
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
    name: tidyCase(p.product_name),
    brand: p.brands?.split(",")[0]?.trim() ? tidyCase(p.brands.split(",")[0]!.trim()) : undefined,
    sourceName: p.product_name,
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
  let res = await fetchImpl(url.toString(), { headers: { "User-Agent": OFF_USER_AGENT } });
  if (res.status === 503 || res.status === 429) {
    // Often briefly overloaded: one retry after a short pause.
    await new Promise((r) => setTimeout(r, OFF_RETRY_MS));
    res = await fetchImpl(url.toString(), { headers: { "User-Agent": OFF_USER_AGENT } });
  }
  if (!res.ok) throw new Error(`Open Food Facts search failed (HTTP ${res.status})`);
  const body = (await res.json()) as { products?: OffProduct[] };
  return (body.products ?? []).map(normalizeOff).filter((x): x is FoodItem => x != null);
}

// ---------- Barcode lookup ----------

/** USDA Branded foods whose GTIN/UPC is this code (a search by the code, then an exact GTIN match). */
export async function usdaByGtin(code: string, apiKey: string, fetchImpl: Fetch = fetch): Promise<FoodItem[]> {
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}`;
  const queries = [...new Set([code, code.replace(/^0+/, "")])].filter(Boolean);
  const found: FoodItem[] = [];
  for (const query of queries) {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, dataType: ["Branded"], pageSize: 10 }),
    });
    if (!res.ok) throw new Error(`USDA barcode search failed (HTTP ${res.status})`);
    const body = (await res.json()) as { foods?: UsdaFood[] };
    for (const f of body.foods ?? []) {
      if (!f.gtinUpc || !sameGtin(f.gtinUpc, code)) continue;
      const item = normalizeUsda(f);
      if (item && !found.some((x) => x.id === item.id)) found.push(item);
    }
    if (found.length > 0) break;
  }
  return found;
}

/** Open Food Facts product by barcode (a UPC-A is also tried as EAN-13); null when it isn't there. */
export async function offByBarcode(code: string, fetchImpl: Fetch = fetch): Promise<FoodItem | null> {
  const first = await offProductByCode(code, fetchImpl);
  if (first || code.length !== 12) return first;
  return offProductByCode(`0${code}`, fetchImpl);
}

async function offProductByCode(code: string, fetchImpl: Fetch): Promise<FoodItem | null> {
  const url = new URL(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`);
  url.searchParams.set("fields", "code,product_name,brands,serving_size,serving_quantity,nutriments");
  let res = await fetchImpl(url.toString(), { headers: { "User-Agent": OFF_USER_AGENT } });
  if (res.status === 503 || res.status === 429) {
    await new Promise((r) => setTimeout(r, OFF_RETRY_MS));
    res = await fetchImpl(url.toString(), { headers: { "User-Agent": OFF_USER_AGENT } });
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Food Facts product lookup failed (HTTP ${res.status})`);
  const body = (await res.json()) as { status?: number; product?: OffProduct };
  if (body.status !== 1 || !body.product) return null;
  return normalizeOff({ ...body.product, code: body.product.code || code });
}

export type BarcodeLookup = { results: FoodItem[]; errors: string[]; failed: boolean };

/** USDA Branded first, then Open Food Facts. failed = both sources errored (not the same as not found). */
export async function lookupBarcode(
  code: string,
  apiKey: string | undefined,
  fetchImpl: Fetch = fetch,
): Promise<BarcodeLookup> {
  const errors: string[] = [];
  let usdaOk = false;
  if (!apiKey) errors.push("USDA_API_KEY is not set");
  else {
    try {
      const usda = await usdaByGtin(code, apiKey, fetchImpl);
      usdaOk = true;
      if (usda.length > 0) return { results: usda, errors, failed: false };
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  try {
    const off = await offByBarcode(code, fetchImpl);
    return { results: off ? [off] : [], errors, failed: false };
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
    return { results: [], errors, failed: !usdaOk };
  }
}

export type RemoteSearch = {
  results: FoodItem[];
  usdaCount: number;
  offCount: number;
  /** What went wrong (missing key, HTTP errors). Logged by the function, never shown verbatim. */
  errors: string[];
  /** Every source that was tried failed, so an empty list means "search is broken", not "no matches". */
  failed: boolean;
};

/** USDA first; Open Food Facts when USDA has fewer than 5 results, has no key, or errors. */
export async function searchRemote(
  query: string,
  apiKey: string | undefined,
  fetchImpl: Fetch = fetch,
): Promise<RemoteSearch> {
  const errors: string[] = [];
  let usda: FoodItem[] = [];
  let usdaOk = false;
  if (!apiKey) {
    errors.push("USDA_API_KEY is not set");
  } else {
    try {
      usda = await searchUsda(query, apiKey, fetchImpl);
      usdaOk = true;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  let off: FoodItem[] = [];
  let offOk = false;
  if (usda.length < USDA_ENOUGH) {
    try {
      off = await searchOff(query, fetchImpl);
      offOk = true;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  const results = rankAndDedupe(query, [...usda, ...off]);
  return {
    results,
    usdaCount: results.filter((f) => f.source === "usda").length,
    offCount: results.filter((f) => f.source === "off").length,
    errors,
    failed: results.length === 0 && !usdaOk && !offOk,
  };
}

/**
 * The function's request handling (kept here so it can be tested): search with ?q=, portions with
 * ?fdcId=. Errors are logged; when every source fails the response is 502 with error
 * "search_failed", so the app can say search isn't working instead of "no matches".
 */
export async function handleFoodSearchRequest(
  url: string,
  apiKey: string | undefined,
  fetchImpl: Fetch = fetch,
  log: (msg: string) => void = (m) => console.error(m),
): Promise<Response> {
  const params = new URL(url).searchParams;
  const upcRaw = params.get("upc");
  if (upcRaw != null) {
    const code = normalizeGtin(upcRaw);
    if (!code) return Response.json({ error: "bad_request", results: [] }, { status: 400 });
    const r = await lookupBarcode(code, apiKey, fetchImpl);
    for (const err of r.errors) log(`food-search barcode ${code}: ${err}`);
    if (r.failed) return Response.json({ error: "search_failed", upc: code, results: [] }, { status: 502 });
    if (r.results.length === 0) {
      return Response.json({ error: "not_found", upc: code, results: [] }, { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    return Response.json(
      { upc: code, results: r.results },
      { headers: { "Cache-Control": r.errors.length ? "no-store" : "public, max-age=86400" } },
    );
  }
  const fdcId = (params.get("fdcId") ?? "").trim();
  if (fdcId) {
    if (!apiKey) {
      log("food-search: USDA_API_KEY is not set");
      return Response.json({ error: "search_failed", portions: [] }, { status: 502 });
    }
    if (!/^\d{1,10}$/.test(fdcId)) return Response.json({ error: "bad_request", portions: [] }, { status: 400 });
    try {
      const portions = await usdaPortions(fdcId, apiKey, fetchImpl);
      return Response.json({ fdcId, portions }, { headers: { "Cache-Control": "public, max-age=86400" } });
    } catch (e) {
      log(`food-search: portions for ${fdcId} failed: ${e instanceof Error ? e.message : String(e)}`);
      return Response.json({ error: "search_failed", portions: [] }, { status: 502 });
    }
  }
  const q = (params.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return Response.json({ error: "Type at least 2 characters." }, { status: 400 });
  const r = await searchRemote(q, apiKey, fetchImpl);
  for (const err of r.errors) log(`food-search "${q}": ${err}`);
  if (r.failed) {
    return Response.json({ error: "search_failed", query: q, results: [] }, { status: 502 });
  }
  return Response.json(
    { query: q, results: r.results, usdaCount: r.usdaCount, offCount: r.offCount },
    // Don't let a CDN keep a partial result (e.g. USDA errored) for a day.
    { headers: { "Cache-Control": r.errors.length ? "no-store" : "public, max-age=86400" } },
  );
}
