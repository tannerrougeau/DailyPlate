import type { DailyTargets } from "@/types";
import type { FoodItem, FoodPortion } from "@/utils/foodTypes";
import { commonSnackItems, type SnackItem } from "@/utils/snackItems";

export const FOOD_SEARCH_URL = "/.netlify/functions/food-search";
export const OFFLINE_MESSAGE = "Search needs a connection. Your saved foods and manual entry still work.";
export const SEARCH_FAILED_MESSAGE = "Food search isn't working right now. Try again later or enter it manually.";
const CACHE_PREFIX = "dailyplate-food-search:";
const DAY_MS = 24 * 60 * 60 * 1000;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

/** Saved foods and recent snacks whose name or brand contains every word typed. */
export function searchLocal(query: string, myFoods: FoodItem[], recent: SnackItem[] = []): FoodItem[] {
  const words = norm(query).split(" ").filter(Boolean);
  if (words.length === 0) return [];
  const matches = (text: string) => {
    const t = norm(text);
    return words.every((w) => t.includes(w));
  };
  const saved = myFoods.filter((f) => matches(`${f.name} ${f.brand ?? ""}`));
  const fromRecent = recent
    .filter((r) => matches(r.name) && !saved.some((f) => norm(f.name) === norm(r.name)))
    .map(snackItemToFood);
  return [...saved, ...fromRecent];
}

function snackItemToFood(item: SnackItem): FoodItem {
  return {
    id: `manual:${norm(item.name).replace(/\s/g, "-")}`,
    name: item.name,
    servingLabel: item.servingLabel,
    servingGrams: item.servingGrams,
    calories: Math.round(item.nutrition.calories),
    protein: Math.round(item.nutrition.protein),
    carbs: Math.round(item.nutrition.carbs),
    fat: Math.round(item.nutrition.fat),
    source: "manual",
    sourceId: norm(item.name),
  };
}

type CacheStore = Pick<Storage, "getItem" | "setItem">;

function readCache(store: CacheStore | null, query: string, now: number): FoodItem[] | null {
  try {
    const raw = store?.getItem(CACHE_PREFIX + norm(query));
    if (!raw) return null;
    const hit = JSON.parse(raw) as { at: number; results: FoodItem[] };
    // An empty list may be from a time search was failing: treat it as a miss.
    return now - hit.at < DAY_MS && hit.results.length > 0 ? hit.results : null;
  } catch {
    return null;
  }
}

function writeCache(store: CacheStore | null, query: string, results: FoodItem[], now: number) {
  if (results.length === 0) return;
  try {
    store?.setItem(CACHE_PREFIX + norm(query), JSON.stringify({ at: now, results }));
  } catch {
    /* storage full or blocked: search still works */
  }
}

export type FoodSearchOutcome = {
  /** Saved and recent foods: always first. */
  local: FoodItem[];
  /** USDA results, then Open Food Facts. */
  remote: FoodItem[];
  offline: boolean;
  /** The search service failed (missing key, USDA/Open Food Facts errors): not the same as no matches. */
  failed?: boolean;
};

/**
 * Search on submit: 1) saved and recent foods, 2) USDA then Open Food Facts via the Netlify
 * Function (cached for a day), 3) manual entry is always available in the UI.
 */
export async function searchFoods(
  query: string,
  deps: {
    myFoods: FoodItem[];
    recent?: SnackItem[];
    fetchImpl?: typeof fetch;
    cache?: CacheStore | null;
    online?: boolean;
    now?: number;
  },
): Promise<FoodSearchOutcome> {
  const local = searchLocal(query, deps.myFoods, deps.recent);
  const q = query.trim();
  if (q.length < 2) return { local, remote: [], offline: false };
  const now = deps.now ?? Date.now();
  const cache = deps.cache === undefined ? safeLocalStorage() : deps.cache;
  const cached = readCache(cache, q, now);
  const localIds = new Set(local.map((f) => f.id));
  const withoutLocal = (list: FoodItem[]) => list.filter((f) => !localIds.has(f.id));
  if (cached) return { local, remote: withoutLocal(cached), offline: false };
  const online = deps.online ?? (typeof navigator === "undefined" ? true : navigator.onLine !== false);
  if (!online) return { local, remote: [], offline: true };
  try {
    const res = await (deps.fetchImpl ?? fetch)(`${FOOD_SEARCH_URL}?q=${encodeURIComponent(q)}`);
    if (!res.ok) return { local, remote: [], offline: false, failed: true };
    const body = (await res.json()) as { results?: FoodItem[] };
    const results = body.results ?? [];
    writeCache(cache, q, results, now);
    return { local, remote: withoutLocal(results), offline: false };
  } catch {
    // Online but the request or its JSON failed (e.g. the function isn't deployed).
    return { local, remote: [], offline: false, failed: true };
  }
}

function safeLocalStorage(): CacheStore | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** A food typed in from a label. */
export function manualFood(input: {
  name: string;
  servingLabel: string;
  calories: number;
  protein: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sodiumMg?: number;
  servingGrams?: number | null;
}): FoodItem {
  const slug = `${norm(input.name).replace(/\s/g, "-")}-${norm(input.servingLabel).replace(/\s/g, "-") || "serving"}`;
  return {
    id: `manual:${slug}`,
    name: input.name.trim(),
    servingLabel: input.servingLabel.trim() || "1 serving",
    calories: Math.round(input.calories),
    protein: Math.round(input.protein),
    carbs: input.carbs,
    fat: input.fat,
    fiber: input.fiber,
    sodiumMg: input.sodiumMg,
    servingGrams: input.servingGrams ?? undefined,
    source: "manual",
    sourceId: slug,
  };
}

export function foodToSnackItem(food: FoodItem): SnackItem {
  return {
    key: `food:${food.id}`,
    name: food.brand ? `${food.name} (${food.brand})` : food.name,
    servingLabel: food.servingLabel,
    nutrition: {
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs ?? 0,
      fat: food.fat ?? 0,
      fiber: food.fiber ?? 0,
    },
    servingGrams: food.servingGrams ?? null,
    source: "manual",
  };
}

/**
 * How a pick fits a target, without judging the food:
 * "About 520 kcal and 22 g protein: 80 kcal under and 18 g short on protein for lunch."
 */
export function fitLine(
  food: Pick<FoodItem, "calories" | "protein">,
  target: Pick<DailyTargets, "calories" | "protein">,
  forLabel: string,
): string {
  const kcal = Math.round(food.calories);
  const protein = Math.round(food.protein);
  const kcalGap = Math.round(target.calories - kcal);
  const proteinGap = Math.round(target.protein - protein);
  const parts: string[] = [];
  if (Math.abs(kcalGap) <= Math.max(25, target.calories * 0.05)) parts.push("about right on calories");
  else parts.push(kcalGap > 0 ? `${kcalGap} kcal under` : `${-kcalGap} kcal over`);
  if (proteinGap > 2) parts.push(`${proteinGap} g short on protein`);
  else if (proteinGap < -2) parts.push(`${-proteinGap} g more protein than planned`);
  else parts.push("on target for protein");
  return `About ${kcal} kcal and ${protein} g protein: ${parts.join(" and ")} ${forLabel}.`;
}

/** One simple common item to close a protein gap of 10 g or more. */
export function proteinTopUp(proteinGap: number): string | null {
  if (proteinGap < 10) return null;
  const common = commonSnackItems();
  const pick = (key: string) => common.find((c) => c.key === key)!;
  const choice = proteinGap >= 18 ? pick("common:protein-drink") : pick("common:greek-cup");
  return `Add a ${choice.name} to close the protein gap.`;
}

/** Log a found or typed food in place of a planned meal (existing log fields only). */
export function foodLogFromFood(
  date: string,
  slot: import("@/types").MealSlotId,
  food: FoodItem,
  servings: number,
  source: "manual" | "scan" = "manual",
): import("@/types").MealTrackingEntry {
  const name = food.brand ? `${food.name} (${food.brand})` : food.name;
  return {
    status: "custom",
    note: servings === 1 ? name : `${name} · ${servings} servings`,
    loggedAt: new Date().toISOString(),
    date,
    slot,
    source,
    portionMultiplier: servings,
    calories: Math.round(food.calories * servings),
    protein: Math.round(food.protein * servings),
    carbs: Math.round((food.carbs ?? 0) * servings),
    fat: Math.round((food.fat ?? 0) * servings),
    fiber: Math.round((food.fiber ?? 0) * servings),
  };
}

/**
 * Household portions for a generic USDA food, through the same Netlify Function, cached a day.
 * Returns [] when there are none (then per 100 g is used) or the request fails.
 */
export async function fetchPortions(
  food: FoodItem,
  deps: { fetchImpl?: typeof fetch; cache?: CacheStore | null; now?: number } = {},
): Promise<FoodPortion[]> {
  if (food.source !== "usda" || !food.generic) return [];
  const now = deps.now ?? Date.now();
  const cache = deps.cache === undefined ? safeLocalStorage() : deps.cache;
  const key = `details:${food.sourceId}`;
  try {
    const raw = cache?.getItem(CACHE_PREFIX + key);
    if (raw) {
      const hit = JSON.parse(raw) as { at: number; portions: FoodPortion[] };
      if (now - hit.at < DAY_MS) return hit.portions;
    }
  } catch {
    /* ignore a bad cache entry */
  }
  try {
    const res = await (deps.fetchImpl ?? fetch)(`${FOOD_SEARCH_URL}?fdcId=${encodeURIComponent(food.sourceId)}`);
    if (!res.ok) return [];
    const portions = ((await res.json()) as { portions?: FoodPortion[] }).portions ?? [];
    try {
      cache?.setItem(CACHE_PREFIX + key, JSON.stringify({ at: now, portions }));
    } catch {
      /* storage full or blocked */
    }
    return portions;
  } catch {
    return [];
  }
}

/** A generic food (values per 100 g) sized to a portion or a gram amount. */
export function applyPortion(food: FoodItem, portion: FoodPortion): FoodItem {
  if (!food.generic) return food;
  const f = portion.grams / 100;
  const r1 = (v: number | undefined) => (v == null ? undefined : Math.round(v * f * 10) / 10);
  return {
    ...food,
    generic: false,
    id: `${food.id}@${Math.round(portion.grams)}g`,
    servingLabel: `${portion.label} (${Math.round(portion.grams)} g)`,
    servingGrams: portion.grams,
    calories: Math.round(food.calories * f),
    protein: r1(food.protein)!,
    carbs: r1(food.carbs),
    fat: r1(food.fat),
    fiber: r1(food.fiber),
  };
}
