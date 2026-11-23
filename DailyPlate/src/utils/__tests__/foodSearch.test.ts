import { describe, expect, it, vi } from "vitest";
import {
  normalizeOff,
  normalizeUsda,
  OFF_USER_AGENT,
  searchRemote,
  USDA_ENOUGH,
} from "@/server/foodSources";
import type { FoodItem } from "@/utils/foodTypes";
import { fitLine, manualFood, proteinTopUp, searchFoods, searchLocal } from "@/utils/foodSearch";

const usdaFood = (i: number, branded = true) => ({
  fdcId: 1000 + i,
  description: branded ? "CHOBANI VANILLA YOGURT" : "Yogurt, Greek, vanilla",
  dataType: branded ? "Branded" : "Survey (FNDDS)",
  brandName: branded ? "Chobani" : undefined,
  servingSize: 150,
  servingSizeUnit: "g",
  householdServingFullText: "1 container",
  foodNutrients: [
    { nutrientId: 1008, value: 80 },
    { nutrientId: 1003, value: 8 },
    { nutrientId: 1005, value: 10 },
    { nutrientId: 1004, value: 1 },
  ],
});

const offProduct = { code: "123", product_name: "Turkey hoagie", brands: "Deli Co", serving_size: "1 sandwich (250 g)", serving_quantity: 250, nutriments: { "energy-kcal_100g": 200, proteins_100g: 9, carbohydrates_100g: 22, fat_100g: 8 } };

function mockFetch(usdaCount: number, offCount = 2) {
  return vi.fn(async (url: string | URL) => {
    const u = String(url);
    const body = u.includes("api.nal.usda.gov")
      ? { foods: Array.from({ length: usdaCount }, (_, i) => usdaFood(i)) }
      : { products: Array.from({ length: offCount }, (_, i) => ({ ...offProduct, code: `off${i}` })) };
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

describe("server sources", () => {
  it("branded USDA foods are per label serving; generic per 100 g", () => {
    const branded = normalizeUsda(usdaFood(1))!;
    expect(branded.servingLabel).toBe("1 container (150 g)");
    expect(branded.calories).toBe(120);
    expect(branded.protein).toBe(12);
    expect(branded.brand).toBe("Chobani");
    const generic = normalizeUsda(usdaFood(2, false))!;
    expect(generic.servingLabel).toBe("100 g");
    expect(generic.calories).toBe(80);
  });

  it("Open Food Facts results use the label serving and carry the credit", () => {
    const f = normalizeOff(offProduct)!;
    expect(f.calories).toBe(500);
    expect(f.protein).toBe(22.5);
    expect(f.credit).toBe("Open Food Facts");
    expect(f.source).toBe("off");
  });

  it("USDA first; Open Food Facts is not called when USDA has enough results", async () => {
    const f = mockFetch(USDA_ENOUGH);
    const r = await searchRemote("chobani", "KEY", f);
    expect(r.usdaCount).toBe(USDA_ENOUGH);
    expect(r.offCount).toBe(0);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("falls back to Open Food Facts with the DailyPlate User-Agent when USDA is thin", async () => {
    const f = mockFetch(1);
    const r = await searchRemote("turkey hoagie", "KEY", f);
    expect(r.results.map((x) => x.source)).toEqual(["usda", "off", "off"]);
    const offCall = f.mock.calls.find((call: unknown[]) => String(call[0]).includes("openfoodfacts"))!;
    expect((offCall[1] as { headers: Record<string, string> }).headers["User-Agent"]).toBe(OFF_USER_AGENT);
    expect(OFF_USER_AGENT).toBe("DailyPlate/1.0 (tannerrougeau@gmail.com)");
  });

  it("without a key, only Open Food Facts is searched (the key is never sent to the client)", async () => {
    const f = mockFetch(10);
    const r = await searchRemote("yogurt", undefined, f);
    expect(r.usdaCount).toBe(0);
    expect(f.mock.calls.every((call: unknown[]) => !String(call[0]).includes("api.nal.usda.gov"))).toBe(true);
  });
});

describe("client search order", () => {
  const saved: FoodItem = manualFood({ name: "Turkey hoagie", servingLabel: "1 sandwich", calories: 520, protein: 22 });

  it("saved foods come first, then remote results without duplicates", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ results: [saved, normalizeOff(offProduct)] }), { status: 200 }),
    ) as unknown as typeof fetch;
    const out = await searchFoods("turkey hoagie", { myFoods: [saved], fetchImpl, cache: null, online: true });
    expect(out.local.map((f) => f.id)).toEqual([saved.id]);
    expect(out.remote.map((f) => f.source)).toEqual(["off"]);
  });

  it("offline: saved foods still match and the remote search is skipped", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const out = await searchFoods("hoagie", { myFoods: [saved], fetchImpl, cache: null, online: false });
    expect(out.offline).toBe(true);
    expect(out.local).toHaveLength(1);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("a failed request is treated as offline, so manual entry is the fallback", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network");
    }) as unknown as typeof fetch;
    const out = await searchFoods("bagel", { myFoods: [], fetchImpl, cache: null, online: true });
    expect(out).toEqual({ local: [], remote: [], offline: true });
    const typed = manualFood({ name: "Bagel", servingLabel: "1 bagel (105 g)", calories: 270, protein: 10, carbs: 53 });
    expect(typed).toMatchObject({ source: "manual", calories: 270, protein: 10, carbs: 53 });
  });

  it("searches are cached for a day", async () => {
    const store = new Map<string, string>();
    const cache = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ results: [saved] }), { status: 200 })) as unknown as typeof fetch;
    const t0 = 1_700_000_000_000;
    await searchFoods("yogurt", { myFoods: [], fetchImpl, cache, online: true, now: t0 });
    await searchFoods("yogurt", { myFoods: [], fetchImpl, cache, online: true, now: t0 + 23 * 3600_000 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await searchFoods("yogurt", { myFoods: [], fetchImpl, cache, online: true, now: t0 + 25 * 3600_000 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("local matching needs every typed word", () => {
    expect(searchLocal("turkey hoagie", [saved])).toHaveLength(1);
    expect(searchLocal("turkey wrap", [saved])).toHaveLength(0);
  });
});

describe("framing", () => {
  it("describes the fit without judging the food", () => {
    expect(fitLine({ calories: 520, protein: 22 }, { calories: 600, protein: 40 }, "for lunch")).toBe(
      "About 520 kcal and 22 g protein: 80 kcal under and 18 g short on protein for lunch.",
    );
  });

  it("suggests one simple add only for a real protein gap", () => {
    expect(proteinTopUp(5)).toBeNull();
    expect(proteinTopUp(12)).toBe("Add a Greek yogurt cup to close the protein gap.");
    expect(proteinTopUp(20)).toBe("Add a Protein Drink to close the protein gap.");
  });
});
