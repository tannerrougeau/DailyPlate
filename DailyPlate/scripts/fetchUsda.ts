/**
 * Fill or refresh src/data/ingredients.json from USDA FoodData Central.
 * Reads USDA_API_KEY from DailyPlate/.env (never commit that file).
 *
 * Usage: npm run usda:fetch
 * The app ships the saved JSON. This script does not run at runtime.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = path.join(root, "src", "data", "ingredients.json");
const envPath = path.join(root, ".env");

type Grams = Record<string, number | null>;
type Food = {
  id: string;
  name: string;
  fdcId: number | null;
  query: string;
  per100g: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
  grams: Grams;
  aliases: string[];
  /** Portion role, measuring state, and yield — set by buildIngredients.mjs; kept as-is on refresh. */
  role?: string;
  state?: string;
  yield?: { cookedPerRaw: number; source: string; dryCupGrams?: number } | null;
  edible?: { fraction: number; source: string } | null;
  usda?: { description: string; dataType?: string } | null;
  /** Reason this food keeps typed values (wrong or no USDA match). */
  skipUsda?: string;
};

const NUTRIENT = { calories: 1008, protein: 1003, carbs: 1005, fat: 1004, fiber: 1079 } as const;
/** Foundation foods often report energy only as Atwater general (2047) or specific (2048) factors. */
const ENERGY_FALLBACKS = [2047, 2048] as const;

function readKey(): string {
  if (!fs.existsSync(envPath)) {
    throw new Error("Missing .env. Add USDA_API_KEY=your_key (this file is gitignored).");
  }
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key === "USDA_API_KEY" && value) return value;
  }
  throw new Error("USDA_API_KEY is not set in .env.");
}

/** Amount per 100 g, or null when USDA does not report the nutrient (keep the typed value then). */
function nutrientAmount(food: { foodNutrients?: Array<Record<string, unknown>> }, id: number): number | null {
  for (const row of food.foodNutrients ?? []) {
    const nutrient = row.nutrient as { id?: number; number?: string } | undefined;
    const nid = nutrient?.id ?? (row.nutrientId as number | undefined);
    if (nid !== id) continue;
    const amount = row.amount ?? row.value;
    return typeof amount === "number" && Number.isFinite(amount) ? amount : null;
  }
  return null;
}

function energyAmount(food: { foodNutrients?: Array<Record<string, unknown>> }): number | null {
  for (const id of [NUTRIENT.calories, ...ENERGY_FALLBACKS]) {
    const v = nutrientAmount(food, id);
    if (v != null) return v;
  }
  return null;
}

function portionGrams(portions: Array<Record<string, unknown>> | undefined, label: RegExp): number | null {
  for (const portion of portions ?? []) {
    const text = `${portion.portionDescription ?? ""} ${portion.modifier ?? ""}`.toLowerCase();
    const amount = typeof portion.amount === "number" ? portion.amount : 1;
    const grams = portion.gramWeight;
    if (label.test(text) && typeof grams === "number" && amount > 0) {
      return grams / amount;
    }
  }
  return null;
}

async function searchId(apiKey: string, query: string): Promise<number | null> {
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("api_key", apiKey);
  // The search endpoint rejects some characters (e.g. "1/8"); search on plain words.
  url.searchParams.set("query", query.replace(/[^\p{L}\p{N}\s,%-]/gu, " ").replace(/\s+/g, " ").trim());
  url.searchParams.set("dataType", "Foundation,SR Legacy");
  url.searchParams.set("pageSize", "1");
  const response = await fetch(url);
  if (response.status === 429) throw new Error("USDA rate limit");
  if (!response.ok) throw new Error(`USDA search failed (${response.status}) for ${query}`);
  const body = (await response.json()) as { foods?: Array<{ fdcId: number }> };
  return body.foods?.[0]?.fdcId ?? null;
}

async function fetchFood(apiKey: string, fdcId: number) {
  const response = await fetch(`https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${apiKey}`);
  if (response.status === 429) throw new Error("USDA rate limit");
  if (!response.ok) throw new Error(`USDA food ${fdcId} failed (${response.status})`);
  return response.json() as Promise<{
    description?: string;
    dataType?: string;
    foodNutrients?: Array<Record<string, unknown>>;
    foodPortions?: Array<Record<string, unknown>>;
  }>;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const apiKey = readKey();
  const foods = JSON.parse(fs.readFileSync(dataPath, "utf8")) as Food[];
  let updated = 0;
  for (const food of foods) {
    if (food.skipUsda) {
      console.log(`skip ${food.name}: ${food.skipUsda}`);
      continue;
    }
    let fdcId = food.fdcId;
    let detail: Awaited<ReturnType<typeof fetchFood>>;
    try {
      if (fdcId == null) fdcId = await searchId(apiKey, food.query);
      if (fdcId == null) {
        console.log(`skip ${food.name}: no FDC match`);
        continue;
      }
      detail = await fetchFood(apiKey, fdcId);
    } catch (error) {
      if (error instanceof Error && error.message === "USDA rate limit") throw error;
      console.log(`skip ${food.name}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    food.fdcId = fdcId;
    const typed = food.per100g;
    food.per100g = {
      calories: energyAmount(detail) ?? typed.calories,
      protein: nutrientAmount(detail, NUTRIENT.protein) ?? typed.protein,
      carbs: nutrientAmount(detail, NUTRIENT.carbs) ?? typed.carbs,
      fat: nutrientAmount(detail, NUTRIENT.fat) ?? typed.fat,
      fiber: nutrientAmount(detail, NUTRIENT.fiber) ?? typed.fiber,
    };
    food.usda = { description: detail.description ?? "", dataType: detail.dataType };
    const cup = portionGrams(detail.foodPortions, /\b1\s+cup\b|\bcup\b/);
    const tbsp = portionGrams(detail.foodPortions, /\b1\s+tbsp\b|\btablespoon\b/);
    const tsp = portionGrams(detail.foodPortions, /\b1\s+tsp\b|\bteaspoon\b/);
    if (food.grams.cup == null && cup != null) food.grams.cup = Math.round(cup * 10) / 10;
    if (food.grams.tbsp == null && tbsp != null) food.grams.tbsp = Math.round(tbsp * 10) / 10;
    if (food.grams.tsp == null && tsp != null) food.grams.tsp = Math.round(tsp * 10) / 10;
    updated += 1;
    console.log(`${fdcId} ${detail.description ?? food.name}`);
    fs.writeFileSync(dataPath, JSON.stringify(foods, null, 2) + "\n");
    await sleep(250);
  }
  console.log(`updated ${updated} / ${foods.length}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
