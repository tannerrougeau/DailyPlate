import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { prepareZXingModule, readBarcodes, writeBarcode } from "zxing-wasm/full";
import { handleFoodSearchRequest, lookupBarcode as lookupRemote, setOffRetryMs } from "@/server/foodSources";
import { firstValidCode, readWithZxing } from "@/utils/scan/barcode";
import { gtinCheckDigitOk, normalizeGtin, sameGtin, upcEToUpcA } from "@/utils/gtin";
import { lookupBarcode, resolvePendingBarcodes } from "@/utils/scan/scanClient";

const FIXTURES = path.resolve(__dirname, "__fixtures__");
const reader = { readBarcodes };

beforeAll(() => {
  // In Node the WebAssembly comes from the package on disk (the app serves it from its own assets).
  const wasm = fs.readFileSync(path.resolve("node_modules/zxing-wasm/dist/full/zxing_full.wasm"));
  prepareZXingModule({
    overrides: { wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) as ArrayBuffer },
  });
  setOffRetryMs(0);
});

/** A tiny seeded random generator so the noisy image is the same every run. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

/**
 * A photo-like image of a barcode: the symbol scaled up on a white margin, rotated by `degrees`
 * (nearest-neighbour), with optional grey noise. Returns an ImageData-shaped object.
 */
async function photoOf(text: string, format: "EAN13" | "UPCA" | "EAN8", degrees: number, noise = 0): Promise<ImageData> {
  const { symbol } = await writeBarcode(text, { format, scale: 1 });
  const scale = 4;
  const margin = 60;
  const sw = symbol.width * scale;
  const sh = symbol.height * scale;
  const W = sw + margin * 2;
  const H = sh + margin * 2 + Math.round(sw * Math.abs(Math.sin((degrees * Math.PI) / 180)));
  const data = new Uint8ClampedArray(W * H * 4);
  const rad = (degrees * Math.PI) / 180;
  const cx = W / 2;
  const cy = H / 2;
  const rand = rng(42);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Inverse-rotate to find the source pixel in the unrotated, centred barcode.
      const dx = x - cx;
      const dy = y - cy;
      const sx = Math.cos(-rad) * dx - Math.sin(-rad) * dy + sw / 2;
      const sy = Math.sin(-rad) * dx + Math.cos(-rad) * dy + sh / 2;
      let v = 255;
      if (sx >= 0 && sy >= 0 && sx < sw && sy < sh) {
        v = symbol.data[Math.floor(sy / scale) * symbol.width + Math.floor(sx / scale)]!;
      }
      if (noise) v = Math.max(0, Math.min(255, v + (rand() - 0.5) * 2 * noise));
      const i = (y * W + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { data, width: W, height: H, colorSpace: "srgb" } as ImageData;
}

describe("barcode reading on sample images", () => {
  it.each([
    ["ean13-4006381333931.png", "4006381333931"],
    ["upca-036000291452.png", "036000291452"],
    ["ean8-96385074.png", "96385074"],
    // UPC-E is expanded to UPC-A for the lookup.
    ["upce-01234565.png", "012345000065"],
  ])("reads %s", async (file, expected) => {
    const png = new Blob([fs.readFileSync(path.join(FIXTURES, file))], { type: "image/png" });
    expect(await readWithZxing(png, reader)).toBe(expected);
  });

  it("reads a barcode photographed upside down (180°)", async () => {
    expect(await readWithZxing(await photoOf("4006381333931", "EAN13", 180), reader)).toBe("4006381333931");
  });

  it("reads a barcode turned sideways (90°)", async () => {
    expect(await readWithZxing(await photoOf("036000291452", "UPCA", 90), reader)).toBe("036000291452");
  });

  it("reads a slightly tilted, noisy barcode", async () => {
    expect(await readWithZxing(await photoOf("96385074", "EAN8", 4, 40), reader)).toBe("96385074");
  });

  it("finds nothing in a blank image", async () => {
    const blank = { data: new Uint8ClampedArray(200 * 100 * 4).fill(255), width: 200, height: 100, colorSpace: "srgb" } as ImageData;
    expect(await readWithZxing(blank, reader)).toBeNull();
  });
});

describe("GTIN helpers", () => {
  it("checks check digits", () => {
    expect(gtinCheckDigitOk("4006381333931")).toBe(true);
    expect(gtinCheckDigitOk("4006381333932")).toBe(false);
    expect(gtinCheckDigitOk("036000291452")).toBe(true);
    expect(gtinCheckDigitOk("96385074")).toBe(true);
  });

  it("normalizes codes: UPC-E → UPC-A, spaces removed, bad codes rejected", () => {
    expect(upcEToUpcA("01234565")).toBe("012345000065");
    expect(normalizeGtin("01234565")).toBe("012345000065");
    expect(normalizeGtin("0 36000 29145 2")).toBe("036000291452");
    expect(normalizeGtin("036000291453")).toBeNull();
    expect(normalizeGtin("12345")).toBeNull();
    expect(normalizeGtin("abc")).toBeNull();
    expect(firstValidCode(["123", "4006381333931"])).toBe("4006381333931");
  });

  it("treats UPC-A, EAN-13 and GTIN-14 forms as the same product", () => {
    expect(sameGtin("036000291452", "0036000291452")).toBe(true);
    expect(sameGtin("00036000291452", "036000291452")).toBe(true);
    expect(sameGtin("036000291452", "036000291453")).toBe(false);
  });
});

const usdaBranded = {
  fdcId: 2001,
  description: "SNICKERS Bar",
  dataType: "Branded",
  brandName: "SNICKERS",
  gtinUpc: "040000424314",
  servingSize: 52,
  servingSizeUnit: "g",
  householdServingFullText: "1 bar",
  foodNutrients: [
    { nutrientId: 1008, value: 481 },
    { nutrientId: 1003, value: 7.7 },
    { nutrientId: 1005, value: 59.6 },
    { nutrientId: 1004, value: 23.1 },
  ],
};

const offProduct = {
  status: 1,
  product: {
    code: "4006381333931",
    product_name: "Stabilo Snack",
    brands: "Example",
    serving_size: "30 g",
    serving_quantity: 30,
    nutriments: { "energy-kcal_100g": 400, proteins_100g: 10, carbohydrates_100g: 60, fat_100g: 12 },
  },
};

describe("barcode lookup through food-search (?upc=)", () => {
  it("USDA Branded first, matched by GTIN in any form", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toContain("api.nal.usda.gov");
      return Response.json({ foods: [{ ...usdaBranded, gtinUpc: "00040000424314" }, { ...usdaBranded, fdcId: 9, gtinUpc: "999" }] });
    }) as unknown as typeof fetch;
    const res = await handleFoodSearchRequest("https://x.test/f?upc=040000424314", "key", fetchImpl, () => undefined);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: { id: string; calories: number }[] };
    expect(body.results.map((r) => r.id)).toEqual(["usda:2001"]);
    expect(body.results[0]!.calories).toBe(250); // 481 kcal/100 g × 52 g
  });

  it("falls back to the Open Food Facts product when USDA has no match", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) =>
      String(url).includes("openfoodfacts") ? Response.json(offProduct) : Response.json({ foods: [] }),
    ) as unknown as typeof fetch;
    const r = await lookupRemote("4006381333931", "key", fetchImpl);
    expect(r.results[0]).toMatchObject({ id: "off:4006381333931", calories: 120, protein: 3 });
    expect(String((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0])).toContain(
      "/api/v2/product/4006381333931.json",
    );
  });

  it("not in either → 404 not_found; both failing → 502 search_failed; bad digits → 400", async () => {
    const none = vi.fn(async (url: string | URL | Request) =>
      String(url).includes("openfoodfacts") ? Response.json({ status: 0 }) : Response.json({ foods: [] }),
    ) as unknown as typeof fetch;
    expect((await handleFoodSearchRequest("https://x.test/f?upc=4006381333931", "key", none, () => undefined)).status).toBe(404);
    const broken = vi.fn(async () => new Response("down", { status: 500 })) as unknown as typeof fetch;
    expect((await handleFoodSearchRequest("https://x.test/f?upc=4006381333931", "key", broken, () => undefined)).status).toBe(502);
    expect((await handleFoodSearchRequest("https://x.test/f?upc=4006381333932", "key", none, () => undefined)).status).toBe(400);
  });

  it("app side: found, not found, failed and offline", async () => {
    const found = vi.fn(async () => Response.json({ results: [{ id: "usda:1", name: "Snickers Bar" }] })) as unknown as typeof fetch;
    expect(await lookupBarcode("040000424314", { fetchImpl: found, online: true })).toMatchObject({ kind: "found" });
    const missing = vi.fn(async () => Response.json({ error: "not_found" }, { status: 404 })) as unknown as typeof fetch;
    expect(await lookupBarcode("040000424314", { fetchImpl: missing, online: true })).toEqual({ kind: "not_found" });
    const failing = vi.fn(async () => Response.json({ error: "search_failed" }, { status: 502 })) as unknown as typeof fetch;
    expect(await lookupBarcode("040000424314", { fetchImpl: failing, online: true })).toEqual({ kind: "failed" });
    expect(await lookupBarcode("040000424314", { fetchImpl: found, online: false })).toEqual({ kind: "offline" });
  });

  it("barcodes read offline are looked up later: found ones go to My foods, failed ones stay pending", async () => {
    const saved: string[] = [];
    const lookup = vi.fn(async (code: string) =>
      code === "1"
        ? ({ kind: "found", foods: [{ id: "usda:1", name: "Snickers Bar" }] } as never)
        : code === "2"
          ? ({ kind: "offline" } as const)
          : ({ kind: "not_found" } as const),
    );
    const r = await resolvePendingBarcodes(["1", "2", "3"], { lookup, saveFood: (f) => saved.push(f.name) });
    expect(r).toEqual({ found: ["Snickers Bar"], stillPending: ["2"] });
    expect(saved).toEqual(["Snickers Bar"]);
  });
});
