import { describe, expect, it, vi } from "vitest";
import {
  handleFoodSearchRequest,
  isNearDuplicate,
  normalizeOff,
  normalizeUsda,
  OFF_USER_AGENT,
  rankAndDedupe,
  searchRemote,
  setOffRetryMs,
  tidyCase,
  tidyUsdaName,
  USDA_DATA_TYPES,
  USDA_ENOUGH,
} from "@/server/foodSources";
import type { FoodItem } from "@/utils/foodTypes";
import {
  fitLine,
  manualFood,
  proteinTopUp,
  SEARCH_FAILED_MESSAGE,
  searchFoods,
  searchLocal,
} from "@/utils/foodSearch";

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
    expect(branded.name).toBe("Chobani Vanilla Yogurt");
    expect(branded.brand).toBeUndefined(); // already in the name
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

  it("a failed request is reported as failed (not offline, not 'no matches'); manual entry still works", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network");
    }) as unknown as typeof fetch;
    const out = await searchFoods("bagel", { myFoods: [], fetchImpl, cache: null, online: true });
    expect(out).toEqual({ local: [], remote: [], offline: false, failed: true });
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

describe("when search fails", () => {
  setOffRetryMs(0);
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const html = (status: number) => new Response("<html>error</html>", { status });

  it("USDA is called with POST and the data types in the body (GET with them in the URL gets HTTP 400)", async () => {
    const fetchImpl = vi.fn(async () => json({ foods: Array.from({ length: 5 }, (_, i) => usdaFood(i)) })) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
    await searchRemote("snickers", "KEY", fetchImpl);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body)).dataType).toEqual(USDA_DATA_TYPES);
    expect(url).not.toContain("dataType");
  });

  it("Open Food Facts is retried once after a 503", async () => {
    let off = 0;
    const fetchImpl = vi.fn(async (url: string | URL) => {
      if (String(url).includes("api.nal.usda.gov")) return html(400);
      off += 1;
      return off === 1 ? html(503) : json({ products: [offProduct] });
    }) as unknown as typeof fetch;
    const r = await searchRemote("snickers", "KEY", fetchImpl);
    expect(off).toBe(2);
    expect(r.results).toHaveLength(1);
    expect(r.failed).toBe(false);
    expect(r.errors).toEqual(["USDA search failed (HTTP 400)"]);
  });

  it("USDA error and Open Food Facts down → 502 search_failed, errors logged", async () => {
    const fetchImpl = vi.fn(async (url: string | URL) =>
      String(url).includes("api.nal.usda.gov") ? html(400) : html(503),
    ) as unknown as typeof fetch;
    const logs: string[] = [];
    const res = await handleFoodSearchRequest("http://x/fn?q=snickers", "KEY", fetchImpl, (m) => logs.push(m));
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: "search_failed", results: [] });
    expect(logs).toEqual([
      'food-search "snickers": USDA search failed (HTTP 400)',
      'food-search "snickers": Open Food Facts search failed (HTTP 503)',
    ]);
  });

  it("missing key is logged; Open Food Facts results still come back", async () => {
    const fetchImpl = vi.fn(async () => json({ products: [offProduct] })) as unknown as typeof fetch;
    const logs: string[] = [];
    const res = await handleFoodSearchRequest("http://x/fn?q=snickers", undefined, fetchImpl, (m) => logs.push(m));
    expect(res.status).toBe(200);
    expect((await res.json()).results).toHaveLength(1);
    expect(logs).toEqual(['food-search "snickers": USDA_API_KEY is not set']);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("a real empty result is 200 'no matches', not a failure", async () => {
    const fetchImpl = vi.fn(async (url: string | URL) =>
      String(url).includes("api.nal.usda.gov") ? json({ foods: [] }) : json({ products: [] }),
    ) as unknown as typeof fetch;
    const res = await handleFoodSearchRequest("http://x/fn?q=zzzz", "KEY", fetchImpl, () => undefined);
    expect(res.status).toBe(200);
    expect((await res.json()).results).toEqual([]);
  });

  it("the app shows the failure message on a 502 and never caches empty results", async () => {
    const store = new Map<string, string>();
    const cache = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    const failing = vi.fn(async () => json({ error: "search_failed", results: [] }, 502)) as unknown as typeof fetch;
    const out = await searchFoods("snickers", { myFoods: [], fetchImpl: failing, cache, online: true });
    expect(out.failed).toBe(true);
    expect(SEARCH_FAILED_MESSAGE).toBe("Food search isn't working right now. Try again later or enter it manually.");
    expect(store.size).toBe(0);
    // An empty list cached earlier (while search was broken) is ignored.
    store.set("dailyplate-food-search:snickers", JSON.stringify({ at: Date.now(), results: [] }));
    const ok = vi.fn(async () => json({ results: [normalizeOff(offProduct)] })) as unknown as typeof fetch;
    const again = await searchFoods("snickers", { myFoods: [], fetchImpl: ok, cache, online: true });
    expect(ok).toHaveBeenCalledTimes(1);
    expect(again.remote).toHaveLength(1);
  });
});

describe("search results cleanup", () => {
  const usda = (fdcId: number, description: string, dataType: string, kcal: number, brandName?: string) => ({
    fdcId,
    description,
    dataType,
    brandName,
    servingSize: 50,
    servingSizeUnit: "g",
    foodNutrients: [
      { nutrientId: 1008, value: kcal },
      { nutrientId: 1003, value: 7 },
    ],
  });
  // Real USDA results for "snickers" (abridged), in USDA's order.
  const snickers = [
    usda(1, "Candies, MARS SNACKFOOD US, SNICKERS CRUNCHER", "SR Legacy", 488),
    usda(2, "Nutrition bar (Snickers Marathon Protein Bar)", "Survey (FNDDS)", 415),
    usda(3, "SNICKERS LIQUID CREAMER SINGLES, SNICKERS", "Branded", 273, "COFFEE-MATE"),
    usda(4, "Formulated bar, MARS SNACKFOOD US, SNICKERS MARATHON Protein Performance Bar, Caramel Nut Rush", "SR Legacy", 415),
    usda(5, "Candies, MARS SNACKFOOD US, SNICKERS Bar", "SR Legacy", 491),
  ].map((f) => normalizeUsda(f)!);

  it("tidies USDA names and capitalization; the original name is kept", () => {
    expect(snickers[4]!.name).toBe("Snickers Bar");
    expect(snickers[4]!.brand).toBe("Mars Snackfood");
    expect(snickers[4]!.sourceName).toBe("Candies, MARS SNACKFOOD US, SNICKERS Bar");
    expect(snickers[1]!.name).toBe("Snickers Marathon Protein Bar");
    expect(snickers[2]!.name).toBe("Snickers Liquid Creamer Singles");
    expect(snickers[2]!.brand).toBe("Coffee-Mate");
    expect(tidyUsdaName({ description: "SNICKERS, SNICKERS MINIS", dataType: "Branded", brandName: "SNICKERS" })).toEqual({
      name: "Snickers Minis",
      brand: undefined,
    });
    expect(tidyUsdaName({ description: "Yogurt, Greek, nonfat, vanilla, CHOBANI", dataType: "SR Legacy" })).toEqual({
      name: "Yogurt, Greek, nonfat, vanilla",
      brand: "Chobani",
    });
    expect(tidyCase("18TH STREET SELECT")).toBe("18th Street Select");
    expect(tidyCase("Turkey sandwich on wheat")).toBe("Turkey sandwich on wheat");
    expect(normalizeOff({ ...offProduct, product_name: "SNICKERS", brands: "MARS" })!.name).toBe("Snickers");
  });

  it("closest names first: Snickers Bar before the creamer and the Marathon bars", () => {
    const names = rankAndDedupe("snickers", snickers).map((f) => f.name);
    expect(names[0]).toBe("Snickers Bar");
    expect(names.indexOf("Snickers Bar")).toBeLessThan(names.indexOf("Snickers Liquid Creamer Singles"));
    expect(names.indexOf("Snickers Bar")).toBeLessThan(names.indexOf("Snickers Marathon Protein Bar"));
  });

  it("the same food in two USDA datasets with matching calories appears once", () => {
    const out = rankAndDedupe("snickers", snickers);
    expect(out).toHaveLength(4);
    expect(out.filter((f) => /Marathon Protein/.test(f.name))).toHaveLength(1);
    expect(isNearDuplicate(snickers[1]!, snickers[3]!)).toBe(true);
    // Different calories, or the same dataset: kept.
    expect(isNearDuplicate(snickers[0]!, snickers[4]!)).toBe(false);
    const a = normalizeUsda(usda(8, "Turkey sandwich on wheat", "Survey (FNDDS)", 187))!;
    const b = normalizeUsda(usda(9, "Turkey sandwich on wheat, with cheese", "Survey (FNDDS)", 187))!;
    expect(isNearDuplicate(a, b)).toBe(false);
  });
});
