import "fake-indexeddb/auto";
import { unzipSync, strFromU8 } from "fflate";
import { beforeEach, describe, expect, it } from "vitest";
import type { ScanResult } from "@/server/scan/types";
import {
  clearCorrections,
  countCorrections,
  exportCorrectionsZip,
  listCorrections,
  newCorrection,
  saveCorrection,
} from "@/utils/scan/corrections";

const ai: ScanResult = {
  type: "food",
  confidence: 0.74,
  plannedMeal: { matches: false, confidence: 0.2 },
  items: [{ name: "turkey sandwich", brand: null, confidence: 0.71, portion: { amount: 1, unit: "sandwich", grams: 230 }, notes: [] }],
  label: null,
  barcode: null,
  suggestions: [],
};

const photo = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" });

describe("scan corrections on the device (IndexedDB)", () => {
  beforeEach(async () => {
    await clearCorrections();
  });

  it("saves, counts and lists corrections with the AI result, confidences and the final choice", async () => {
    await saveCorrection(
      newCorrection({
        slot: "lunch",
        plannedMealName: "Teriyaki Turkey Rice Bowls",
        photo: photo(),
        path: "ai",
        aiResult: ai,
        aiMeta: { provider: "claude", model: "claude-haiku-5-5", ms: 1800 },
        final: { kind: "foods", servings: 1, items: [{ aiName: "turkey sandwich", matchId: "usda:1", matchName: "Turkey sub", grams: 230 }] },
      }),
    );
    await saveCorrection(newCorrection({ slot: "snack", plannedMealName: null, photo: photo(), path: "barcode", aiResult: null, aiMeta: null, final: { kind: "cancelled" } }));
    expect(await countCorrections()).toBe(2);
    const [first] = await listCorrections();
    expect(first!.confidences).toEqual({ overall: 0.74, plannedMeal: 0.2, items: [{ name: "turkey sandwich", confidence: 0.71 }] });
  });

  it("exports a zip with scan-corrections.json and one photo per scan", async () => {
    const c = newCorrection({ slot: "dinner", plannedMealName: null, photo: photo(), path: "ai", aiResult: ai, aiMeta: null, final: { kind: "manual" } });
    await saveCorrection(c);
    const { zip, count } = await exportCorrectionsZip();
    expect(count).toBe(1);
    const files = unzipSync(zip);
    expect(Object.keys(files).sort()).toEqual([`photos/${c.id}.jpg`, "scan-corrections.json"]);
    expect([...files[`photos/${c.id}.jpg`]!]).toEqual([0xff, 0xd8, 0xff, 0xd9]);
    const json = JSON.parse(strFromU8(files["scan-corrections.json"]!));
    expect(json.count).toBe(1);
    expect(json.corrections[0]).toMatchObject({ id: c.id, photo: `photos/${c.id}.jpg`, final: { kind: "manual" }, confidences: { overall: 0.74 } });
    expect(json.corrections[0].aiResult.items[0].name).toBe("turkey sandwich");
  });

  it("Delete saved scans clears everything", async () => {
    await saveCorrection(newCorrection({ slot: "lunch", plannedMealName: null, photo: photo(), path: "ai", aiResult: null, aiMeta: null, final: { kind: "cancelled" } }));
    await clearCorrections();
    expect(await countCorrections()).toBe(0);
  });
});
