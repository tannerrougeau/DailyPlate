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
};

const NUTRIENT = { calories: 1008, protein: 1003, carbs: 1005, fat: 1004, fiber: 1079 } as const;

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

function nutrientAmount(food: { foodNutrients?: Array<Record<string, unknown>> }, id: number): number {
  for (const row of food.foodNutrients ?? []) {
    const nutrient = row.nutrient as { id?: number; number?: string } | undefined;
    const nid = nutrient?.id ?? (row.nutrientId as number | undefined);
    if (nid !== id) continue;
    const amount = row.amount ?? row.value;
    return typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
  }
  return 0;
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
  url.searchParams.set("query", query);
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
    let fdcId = food.fdcId;
    if (fdcId == null) fdcId = await searchId(apiKey, food.query);
    if (fdcId == null) {
      console.log(`skip ${food.name}: no FDC match`);
      continue;
    }
    const detail = await fetchFood(apiKey, fdcId);
    food.fdcId = fdcId;
    food.per100g = {
      calories: nutrientAmount(detail, NUTRIENT.calories),
      protein: nutrientAmount(detail, NUTRIENT.protein),
      carbs: nutrientAmount(detail, NUTRIENT.carbs),
      fat: nutrientAmount(detail, NUTRIENT.fat),
      fiber: nutrientAmount(detail, NUTRIENT.fiber),
    };
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
