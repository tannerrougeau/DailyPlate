import { describe, expect, it, vi } from "vitest";
import type { ScanResult } from "@/server/scan/types";
import { recipeLibrary } from "@/recipes/recipeLibrary";
import type { FoodItem } from "@/utils/foodTypes";
import { foodLogFromFood, foodToSnackItem } from "@/utils/foodSearch";
import { foodLogForServings, macrosForServings } from "@/utils/mealTracking";
import { createPlannedMeal } from "@/utils/recipeDisplay";
import { snackLogEntry } from "@/utils/snackItems";
import { DEVICE_HEADER, FOOD_SCAN_URL, scanPhoto } from "@/utils/scan/scanClient";
import {
  combineFoods,
  confidencesOf,
  FOOD_ITEM_MIN_CONFIDENCE,
  itemQuery,
  labelFood,
  labelForm,
  pickMatch,
  PLANNED_MATCH_MIN_CONFIDENCE,
  SCAN_FAILED_MESSAGE,
  SCAN_OFFLINE_MESSAGE,
  SCAN_PAUSED_MESSAGE,
  scanView,
  sizeFood,
  suggestionsFor,
} from "@/utils/scan/scanFlow";
import { fitWithin } from "@/utils/scan/image";

const DATE = "2026-11-24";
const teriyaki = recipeLibrary.find((r) => r.id === "teriyaki-turkey-rice-bowls-39")!;
const dinner = createPlannedMeal("dinner", teriyaki, { scale: 1 });

const base: ScanResult = {
  type: "food",
  confidence: 0.85,
  plannedMeal: null,
  items: [],
  label: null,
  barcode: null,
  suggestions: [],
};

const item = (name: string, confidence: number, grams: number, brand: string | null = null) => ({
  name,
  brand,
  confidence,
  portion: { amount: 1, unit: "serving", grams },
  notes: [],
});

/** Generic USDA food: values per 100 g. */
const usdaRice: FoodItem = {
  id: "usda:168878",
  name: "Rice, white, cooked",
  servingLabel: "100 g",
  servingGrams: 100,
  calories: 130,
  protein: 2.7,
  carbs: 28.2,
  fat: 0.3,
  source: "usda",
  sourceId: "168878",
  generic: true,
  dataset: "SR Legacy",
};

/** Branded food: values per label serving. */
const snickers: FoodItem = {
  id: "usda:2001",
  name: "Snickers Bar",
  brand: "Snickers",
  servingLabel: "1 bar (52 g)",
  servingGrams: 52,
  calories: 250,
  protein: 4,
  carbs: 31,
  fat: 12,
  source: "usda",
  sourceId: "2001",
  dataset: "Branded",
};

describe("planned meal match", () => {
  const matched: ScanResult = { ...base, plannedMeal: { matches: true, confidence: 0.82 }, items: [item("turkey rice bowl", 0.8, 450)] };

  it("a confident match shows 'Looks like your …' and logs the recipe's own nutrition", () => {
    expect(scanView(matched, { hasPlannedMeal: true })).toEqual({ kind: "planned" });
    const entry = foodLogForServings(DATE, dinner, 1.5);
    const expected = macrosForServings(dinner, 1.5);
    expect(entry).toMatchObject({ recipeId: teriyaki.id, portionMultiplier: 1.5, calories: expected.calories, protein: expected.protein });
  });

  it(`below ${PLANNED_MATCH_MIN_CONFIDENCE} it isn't offered; "Not it" skips to the foods`, () => {
    const unsure = { ...matched, plannedMeal: { matches: true, confidence: PLANNED_MATCH_MIN_CONFIDENCE - 0.01 } };
    expect(scanView(unsure, { hasPlannedMeal: true }).kind).toBe("foods");
    expect(scanView(matched, { hasPlannedMeal: true, skipPlanned: true }).kind).toBe("foods");
    // No planned meal sent (a bought meal or a snack): never offered.
    expect(scanView(matched, { hasPlannedMeal: false }).kind).toBe("foods");
  });
});

describe("low confidence or unknown: no guessing", () => {
  it(`any item under ${FOOD_ITEM_MIN_CONFIDENCE} shows up to 3 suggestions instead`, () => {
    const r: ScanResult = {
      ...base,
      items: [item("chicken salad", 0.9, 300), item("dressing", 0.4, 30)],
      suggestions: ["Caesar salad", "Cobb salad", "Chicken salad", "Greek salad"],
    };
    const view = scanView(r, { hasPlannedMeal: false });
    expect(view).toEqual({ kind: "uncertain", suggestions: ["Caesar salad", "Cobb salad", "Chicken salad"] });
  });

  it("unknown with no suggestions falls back to item names; empty is fine too", () => {
    expect(suggestionsFor({ ...base, type: "unknown", confidence: 0.2, items: [item("bar", 0.3, 50, "Kind")] })).toEqual(["Kind bar"]);
    expect(scanView({ ...base, type: "unknown", confidence: 0.1 }, { hasPlannedMeal: false })).toEqual({ kind: "uncertain", suggestions: [] });
  });

  it("low overall confidence is uncertain even when items look sure", () => {
    expect(scanView({ ...base, confidence: 0.4, items: [item("toast", 0.9, 40)] }, { hasPlannedMeal: false }).kind).toBe("uncertain");
  });

  it("barcode digits from the photo: looked up only when the check digit is right", () => {
    expect(scanView({ ...base, type: "barcode", barcode: { digits: "040000424314" } }, { hasPlannedMeal: false })).toEqual({
      kind: "barcode",
      code: "040000424314",
    });
    expect(scanView({ ...base, type: "barcode", barcode: { digits: "040000424315" } }, { hasPlannedMeal: false }).kind).toBe("uncertain");
    expect(scanView({ ...base, type: "barcode", barcode: { digits: null } }, { hasPlannedMeal: false }).kind).toBe("uncertain");
  });
});

describe("foods: USDA supplies the numbers, the scan supplies the portion", () => {
  it("a generic food is sized to the scan's grams (230 g rice = 299 kcal)", () => {
    const sized = sizeFood(usdaRice, 230, "1 cup")!;
    expect(sized.calories).toBe(299);
    expect(sized.protein).toBe(6.2);
    expect(sized.servingLabel).toBe("1 cup (230 g)");
  });

  it("a branded food is scaled by grams ÷ serving grams (half a bar = 125 kcal)", () => {
    expect(sizeFood(snickers, 26, "half a bar")!.calories).toBe(125);
    // No weight to scale by: the user picks a portion instead.
    expect(sizeFood({ ...snickers, servingGrams: null }, 26, "x")).toBeNull();
  });

  it("the logged calories come from the matched food, not the AI", () => {
    const r: ScanResult = { ...base, items: [item("white rice", 0.9, 230)] };
    expect(scanView(r, { hasPlannedMeal: false }).kind).toBe("foods");
    const entry = foodLogFromFood(DATE, "lunch", sizeFood(usdaRice, 230, "1 cup")!, 1, "scan");
    expect(entry).toMatchObject({ source: "scan", calories: 299, protein: 6 });
  });

  it("a visible brand goes into the search, and branded results are matched first", () => {
    expect(itemQuery({ name: "chocolate bar", brand: "Snickers" })).toBe("Snickers chocolate bar");
    expect(itemQuery({ name: "Snickers bar", brand: "Snickers" })).toBe("Snickers bar");
    expect(itemQuery({ name: "apple", brand: null })).toBe("apple");
    const generic = { ...usdaRice, id: "usda:1", name: "Candies, chocolate bar" };
    expect(pickMatch({ brand: "Snickers" }, [generic, snickers])?.id).toBe("usda:2001");
    expect(pickMatch({ brand: null }, [generic, snickers])?.id).toBe("usda:1");
  });

  it("several foods log as one entry with the sums", () => {
    const combined = combineFoods([sizeFood(usdaRice, 200, "rice")!, snickers]);
    expect(combined.name).toBe("Rice, white, cooked + Snickers Bar");
    expect(combined.calories).toBe(260 + 250);
    expect(combined.protein).toBeCloseTo(5.4 + 4, 5);
  });

  it("snacks log through the snack list with source scan", () => {
    const e = snackLogEntry(DATE, foodToSnackItem(snickers), 2, "scan");
    expect(e).toMatchObject({ slot: "snack", source: "scan", calories: 500, portionMultiplier: 2 });
  });
});

describe("labels", () => {
  const label = {
    productName: "Granola Bar",
    servingSize: { text: "1 bar (40 g)", grams: 40 },
    servingsPerContainer: 6,
    calories: 190,
    protein: 4,
    carbs: 29,
    fat: 7,
    fiber: 2,
    sodiumMg: 140,
  };

  it("values read can be edited, then logged per serving and saved as a food", () => {
    const form = { ...labelForm(label), protein: "5" };
    const food = labelFood(form)!;
    expect(food).toMatchObject({ name: "Granola Bar", servingLabel: "1 bar (40 g)", servingGrams: 40, calories: 190, protein: 5, fiber: 2, sodiumMg: 140, source: "manual" });
    const entry = foodLogFromFood(DATE, "snack", food, 2, "scan");
    expect(entry).toMatchObject({ calories: 380, protein: 10, carbs: 58, fat: 14, fiber: 4, source: "scan" });
  });

  it("without printed grams the label is logged by servings only", () => {
    const food = labelFood(labelForm({ ...label, servingSize: { text: "1 bar", grams: null } }))!;
    expect(food.servingGrams).toBeUndefined();
  });

  it("needs a name, calories and protein", () => {
    expect(labelFood({ ...labelForm(label), name: " " })).toBeNull();
    expect(labelFood({ ...labelForm(label), calories: "" })).toBeNull();
  });
});

describe("scan client: messages for every outcome", () => {
  const photo = { base64: "abc" };
  const ctx = { slot: "lunch" as const };

  it("posts the photo and context with the device header", async () => {
    const result = { ...base, items: [item("toast", 0.9, 40)] };
    const fetchImpl = vi.fn(async () => Response.json({ result, meta: { provider: "claude", model: "m", ms: 900 } }));
    const out = await scanPhoto(photo, ctx, { fetchImpl: fetchImpl as unknown as typeof fetch, online: true, device: "dev-9" });
    expect(out).toMatchObject({ ok: true, result });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(FOOD_SCAN_URL);
    expect((init.headers as Record<string, string>)[DEVICE_HEADER]).toBe("dev-9");
    expect(JSON.parse(init.body as string)).toEqual({ image: "abc", mediaType: "image/jpeg", context: ctx });
  });

  it("a hit limit (daily cap or the per-minute burst rule) says scanning is paused for today", async () => {
    const capped = vi.fn(async () => Response.json({ error: "limit_reached" }, { status: 429 }));
    expect(await scanPhoto(photo, ctx, { fetchImpl: capped as unknown as typeof fetch, online: true })).toEqual({ ok: false, reason: "limit" });
    const burst = vi.fn(async () => new Response("Too many requests", { status: 429 }));
    expect(await scanPhoto(photo, ctx, { fetchImpl: burst as unknown as typeof fetch, online: true })).toEqual({ ok: false, reason: "limit" });
    expect(SCAN_PAUSED_MESSAGE).toBe("Scanning is paused for today. Search or enter it manually.");
  });

  it("provider failure uses the same failure wording as search; offline says a connection is needed", async () => {
    const failed = vi.fn(async () => Response.json({ error: "scan_failed" }, { status: 502 }));
    expect(await scanPhoto(photo, ctx, { fetchImpl: failed as unknown as typeof fetch, online: true })).toEqual({ ok: false, reason: "failed" });
    expect(SCAN_FAILED_MESSAGE).toMatch(/isn't working right now\. Try again later or enter it manually\./);
    const never = vi.fn();
    expect(await scanPhoto(photo, ctx, { fetchImpl: never as unknown as typeof fetch, online: false })).toEqual({ ok: false, reason: "offline" });
    expect(never).not.toHaveBeenCalled();
    expect(SCAN_OFFLINE_MESSAGE).toMatch(/^Scanning needs a connection\./);
  });

  it("too large → too_large; Cancel → cancelled", async () => {
    const big = vi.fn(async () => Response.json({ error: "too_large" }, { status: 413 }));
    expect(await scanPhoto(photo, ctx, { fetchImpl: big as unknown as typeof fetch, online: true })).toEqual({ ok: false, reason: "too_large" });
    const controller = new AbortController();
    const slow = vi.fn(
      (_u: string, init: RequestInit) =>
        new Promise<Response>((_res, rej) => init.signal!.addEventListener("abort", () => rej(new DOMException("Aborted", "AbortError")))),
    );
    const pending = scanPhoto(photo, ctx, { fetchImpl: slow as unknown as typeof fetch, online: true, signal: controller.signal });
    controller.abort();
    expect(await pending).toEqual({ ok: false, reason: "cancelled" });
  });
});

describe("corrections and photo size", () => {
  it("each scan's confidence values are kept for calibration", () => {
    const r: ScanResult = { ...base, confidence: 0.77, plannedMeal: { matches: false, confidence: 0.3 }, items: [item("toast", 0.66, 40)] };
    expect(confidencesOf(r)).toEqual({ overall: 0.77, plannedMeal: 0.3, items: [{ name: "toast", confidence: 0.66 }] });
    expect(confidencesOf(null)).toBeNull();
  });

  it("photos are downscaled to 1,500 px on the long side, never upscaled", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1500, height: 1125 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1125, height: 1500 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
