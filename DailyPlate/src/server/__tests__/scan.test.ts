import { describe, expect, it, vi } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { base64Bytes, DEVICE_HEADER, handleScanRequest, parseScanBody, type ScanDeps } from "@/server/scan/handler";
import { checkAndCount, dayKey, memoryCounter } from "@/server/scan/limits";
import { contextText, createClaudeProvider, SCAN_TOOL_NAME } from "@/server/scan/providers/claude";
import { providerFromEnv } from "@/server/scan/providers/index";
import { SCAN_RESULT_SCHEMA, validateScanResult } from "@/server/scan/schema";
import type { ScanProvider, ScanResult } from "@/server/scan/types";

const IMAGE = "A".repeat(400); // valid base64, ~300 bytes

const foodResult: ScanResult = {
  type: "food",
  confidence: 0.86,
  plannedMeal: null,
  items: [
    { name: "turkey sandwich", brand: null, confidence: 0.84, portion: { amount: 1, unit: "sandwich", grams: 230 }, notes: [] },
    { name: "potato chips", brand: "Lay's", confidence: 0.7, portion: { amount: 1, unit: "bag", grams: 28 }, notes: ["fried"] },
  ],
  label: null,
  barcode: null,
  suggestions: [],
};

const labelResult: ScanResult = {
  type: "label",
  confidence: 0.95,
  plannedMeal: null,
  items: [],
  label: {
    productName: "Granola Bar",
    servingSize: { text: "1 bar (40 g)", grams: 40 },
    servingsPerContainer: 6,
    calories: 190,
    protein: 4,
    carbs: 29,
    fat: 7,
    fiber: 2,
    sodiumMg: 140,
  },
  barcode: null,
  suggestions: [],
};

const barcodeResult: ScanResult = {
  type: "barcode",
  confidence: 0.8,
  plannedMeal: null,
  items: [],
  label: null,
  barcode: { digits: "040000424314" },
  suggestions: [],
};

const unknownResult: ScanResult = {
  type: "unknown",
  confidence: 0.2,
  plannedMeal: null,
  items: [],
  label: null,
  barcode: null,
  suggestions: ["granola", "trail mix"],
};

/** A fake Anthropic client returning the given replies in order. */
function fakeClient(...replies: (Partial<Anthropic.Message> | Error)[]) {
  const create = vi.fn(async () => {
    const next = replies.shift();
    if (!next) throw new Error("no more replies");
    if (next instanceof Error) throw next;
    return { stop_reason: "tool_use", content: [], ...next } as Anthropic.Message;
  });
  return { client: { messages: { create } } as unknown as Pick<Anthropic, "messages">, create };
}

const toolReply = (input: unknown): Partial<Anthropic.Message> => ({
  stop_reason: "tool_use",
  content: [{ type: "tool_use", id: "t1", name: SCAN_TOOL_NAME, input } as Anthropic.ToolUseBlock],
});

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://x.test/api/food-scan", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const goodBody = { image: IMAGE, mediaType: "image/jpeg", context: { slot: "lunch" } };

function deps(provider: ScanProvider | null, overrides: Partial<ScanDeps> = {}) {
  const log = vi.fn();
  return {
    log,
    deps: {
      provider,
      counter: memoryCounter(),
      limits: { device: 30, total: 300, maxBytes: 1_500_000 },
      log,
      ...overrides,
    } satisfies ScanDeps,
  };
}

async function scanWith(...replies: (Partial<Anthropic.Message> | Error)[]) {
  const { client, create } = fakeClient(...replies);
  const provider = createClaudeProvider({ client, model: "claude-haiku-5-5" });
  const d = deps(provider);
  const res = await handleScanRequest(request(goodBody, { [DEVICE_HEADER]: "dev-1" }), d.deps);
  return { res, body: (await res.json()) as Record<string, unknown>, create, log: d.log };
}

describe("food-scan with mocked provider replies", () => {
  it("food: returns the items with a meta block", async () => {
    const { res, body } = await scanWith(toolReply(foodResult));
    expect(res.status).toBe(200);
    expect(body.result).toEqual(foodResult);
    expect(body.meta).toMatchObject({ provider: "claude", model: "claude-haiku-5-5" });
  });

  it("label: returns the per-serving values", async () => {
    const { body } = await scanWith(toolReply(labelResult));
    expect((body.result as ScanResult).label?.calories).toBe(190);
  });

  it("barcode: returns the legible digits", async () => {
    const { body } = await scanWith(toolReply(barcodeResult));
    expect((body.result as ScanResult).barcode?.digits).toBe("040000424314");
  });

  it("unknown: returns suggestions", async () => {
    const { body } = await scanWith(toolReply(unknownResult));
    expect((body.result as ScanResult).suggestions).toEqual(["granola", "trail mix"]);
  });

  it("malformed tool input fails validation → scan_failed, logged", async () => {
    const { res, body, log } = await scanWith(toolReply({ type: "food", confidence: 3, items: "nope" }));
    expect(res.status).toBe(502);
    expect(body).toEqual({ error: "scan_failed" });
    expect(log.mock.calls[0]![0]).toMatch(/invalid_reply/);
  });

  it("no tool call: retries once, then scan_failed", async () => {
    const text = { stop_reason: "end_turn", content: [{ type: "text", text: "It's a sandwich." }] } as Partial<Anthropic.Message>;
    const { res, create } = await scanWith(text, text);
    expect(create).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(502);
  });

  it("no tool call then a good reply: succeeds on the retry", async () => {
    const text = { stop_reason: "end_turn", content: [{ type: "text", text: "Hmm." }] } as Partial<Anthropic.Message>;
    const { res, create } = await scanWith(text, toolReply(foodResult));
    expect(create).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(200);
  });

  it("provider error → 502 scan_failed; the log has no image or key", async () => {
    const { res, body, log } = await scanWith(new Error("upstream exploded"));
    expect(res.status).toBe(502);
    expect(body).toEqual({ error: "scan_failed" });
    const line = log.mock.calls.map((c) => c[0]).join("\n");
    expect(line).toMatch(/claude\/claude-haiku-5-5 failed/);
    expect(line).not.toContain(IMAGE.slice(0, 50));
  });

  it("refusal and max_tokens stop reasons are failures", async () => {
    expect((await scanWith({ stop_reason: "refusal" as Anthropic.Message["stop_reason"], content: [] })).res.status).toBe(502);
    expect((await scanWith({ stop_reason: "max_tokens", content: [] })).res.status).toBe(502);
  });

  it("sends the image, the strict tool and tool_choice auto, with the planned meal in the prompt", async () => {
    const { client, create } = fakeClient(toolReply({ ...foodResult, plannedMeal: { matches: true, confidence: 0.9 } }));
    const provider = createClaudeProvider({ client });
    const d = deps(provider);
    const body = {
      ...goodBody,
      context: { slot: "dinner", plannedMeal: { name: "Teriyaki Turkey Rice Bowl", ingredients: ["Lean ground turkey", "Rice"] } },
    };
    const res = await handleScanRequest(request(body), d.deps);
    expect(res.status).toBe(200);
    const [params, options] = create.mock.calls[0] as unknown as [Anthropic.MessageCreateParams, { timeout: number; signal: AbortSignal }];
    expect(params.model).toBe("claude-haiku-5-5");
    expect(params.tool_choice).toEqual({ type: "auto" });
    expect((params.tools![0] as { strict?: boolean }).strict).toBe(true);
    const content = params.messages[0]!.content as Anthropic.ContentBlockParam[];
    expect(content[0]).toMatchObject({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: IMAGE } });
    expect((content[1] as Anthropic.TextBlockParam).text).toContain("Planned meal: Teriyaki Turkey Rice Bowl.");
    expect((content[1] as Anthropic.TextBlockParam).text).toContain("Lean ground turkey; Rice");
    expect(options.timeout).toBeLessThanOrEqual(45_000);
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it("without a planned meal the prompt asks for plannedMeal null", () => {
    expect(contextText({ slot: "snack" })).toMatch(/No planned meal/);
  });
});

describe("one deadline for the whole scan", () => {
  it("each attempt gets only the time left, and no attempt starts when too little is left", async () => {
    const text = { stop_reason: "end_turn", content: [] } as Partial<Anthropic.Message>;
    const { client, create } = fakeClient(text, toolReply(foodResult));
    const provider = createClaudeProvider({ client });
    let left = 45_000;
    const timeLeftMs = () => {
      const v = left;
      left = 3000; // the first attempt "used" most of the time
      return v;
    };
    await expect(provider.recognize({ base64: IMAGE, mediaType: "image/jpeg" }, { slot: "lunch" }, { timeLeftMs })).rejects.toThrow(
      /deadline/,
    );
    expect(create).toHaveBeenCalledTimes(1);
    expect((create.mock.calls[0] as unknown as [unknown, { timeout: number }])[1].timeout).toBe(45_000);
  });

  it("a provider that hangs past the deadline is aborted and returns scan_failed", async () => {
    const hanging: ScanProvider = {
      name: "slow",
      model: "m",
      recognize: (_img, _ctx, opts) =>
        new Promise((_resolve, reject) => opts?.signal?.addEventListener("abort", () => reject(new Error("aborted")))),
    };
    const d = deps(hanging, { deadlineMs: 30 });
    const res = await handleScanRequest(request(goodBody), d.deps);
    expect(res.status).toBe(502);
    expect(d.log.mock.calls[0]![0]).toMatch(/slow\/m failed/);
  });
});

describe("request checks and limits", () => {
  const okProvider = (): ScanProvider & { calls: number } => {
    const p = {
      name: "fake",
      model: "fake-1",
      calls: 0,
      async recognize() {
        p.calls++;
        return foodResult;
      },
    };
    return p;
  };

  it("too large → 413 without calling the provider", async () => {
    const p = okProvider();
    const d = deps(p, { limits: { device: 30, total: 300, maxBytes: 100 } });
    const res = await handleScanRequest(request(goodBody), d.deps);
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "too_large" });
    expect(p.calls).toBe(0);
  });

  it("bad body or method → 400", async () => {
    const p = okProvider();
    expect((await handleScanRequest(request({ image: "x" }), deps(p).deps)).status).toBe(400);
    expect((await handleScanRequest(request({ ...goodBody, mediaType: "image/gif" }), deps(p).deps)).status).toBe(400);
    expect((await handleScanRequest(request({ ...goodBody, context: { slot: "brunch" } }), deps(p).deps)).status).toBe(400);
    expect((await handleScanRequest(new Request("https://x.test/api/food-scan"), deps(p).deps)).status).toBe(400);
    expect(p.calls).toBe(0);
  });

  it("device limit → 429 limit_reached, provider not called", async () => {
    const p = okProvider();
    const d = deps(p, { limits: { device: 2, total: 300, maxBytes: 1_500_000 } });
    for (let i = 0; i < 2; i++) {
      expect((await handleScanRequest(request(goodBody, { [DEVICE_HEADER]: "phone-a" }), d.deps)).status).toBe(200);
    }
    const res = await handleScanRequest(request(goodBody, { [DEVICE_HEADER]: "phone-a" }), d.deps);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "limit_reached" });
    expect(p.calls).toBe(2);
    // Another device still scans.
    expect((await handleScanRequest(request(goodBody, { [DEVICE_HEADER]: "phone-b" }), d.deps)).status).toBe(200);
  });

  it("total daily limit → 429 for every device", async () => {
    const p = okProvider();
    const d = deps(p, { limits: { device: 30, total: 2, maxBytes: 1_500_000 } });
    await handleScanRequest(request(goodBody, { [DEVICE_HEADER]: "a" }), d.deps);
    await handleScanRequest(request(goodBody, { [DEVICE_HEADER]: "b" }), d.deps);
    expect((await handleScanRequest(request(goodBody, { [DEVICE_HEADER]: "c" }), d.deps)).status).toBe(429);
    expect(p.calls).toBe(2);
  });

  it("rejected requests don't count toward the caps", async () => {
    const counter = memoryCounter();
    const p = okProvider();
    const d = deps(p, { counter, limits: { device: 30, total: 300, maxBytes: 100 } });
    await handleScanRequest(request(goodBody), d.deps);
    expect(counter.counts.size).toBe(0);
  });

  it("without a device ID the IP is the device; only hashes are stored", async () => {
    const counter = memoryCounter();
    const d = deps(okProvider(), { counter, clientIp: "203.0.113.9" });
    await handleScanRequest(request(goodBody), d.deps);
    const keys = [...counter.counts.keys()].join(" ");
    expect(keys).not.toContain("203.0.113.9");
    expect(keys).toMatch(/\/device\/[0-9a-f]{64}/);
  });

  it("caps reset each UTC day", async () => {
    const counter = memoryCounter();
    const limits = { device: 1, total: 10 };
    const day1 = new Date("2026-11-24T23:00:00Z");
    expect(await checkAndCount(counter, "h", limits, day1)).toBe("ok");
    expect(await checkAndCount(counter, "h", limits, day1)).toBe("device_limit");
    expect(await checkAndCount(counter, "h", limits, new Date("2026-11-25T00:30:00Z"))).toBe("ok");
    expect(dayKey(day1)).toBe("2026-11-24");
  });

  it("unknown SCAN_PROVIDER → no provider → scan_failed, logged", async () => {
    expect(providerFromEnv({ SCAN_PROVIDER: "mystery" })).toBeNull();
    expect(providerFromEnv({})?.name).toBe("claude");
    expect(providerFromEnv({ SCAN_MODEL: "claude-sonnet-5-5" })?.model).toBe("claude-sonnet-5-5");
    expect(providerFromEnv({})?.model).toBe("claude-haiku-5-5");
    const d = deps(null);
    const res = await handleScanRequest(request(goodBody), d.deps);
    expect(res.status).toBe(502);
    expect(d.log.mock.calls[0]![0]).toMatch(/SCAN_PROVIDER/);
  });
});

describe("schema and parsing", () => {
  it("the tool schema is strict-ready: every object lists all its keys and forbids extras", () => {
    const check = (node: unknown): void => {
      if (!node || typeof node !== "object") return;
      const n = node as Record<string, unknown>;
      if (n.type === "object") {
        expect(n.additionalProperties).toBe(false);
        expect([...(n.required as string[])].sort()).toEqual(Object.keys(n.properties as object).sort());
      }
      Object.values(n).forEach(check);
    };
    check(SCAN_RESULT_SCHEMA);
  });

  it("validation trims suggestions to 3 and rejects a label scan without label values", () => {
    expect(validateScanResult({ ...unknownResult, suggestions: ["a", "b", "c", "d"] })?.suggestions).toEqual(["a", "b", "c"]);
    expect(validateScanResult({ ...labelResult, label: null })).toBeNull();
    expect(validateScanResult({ ...foodResult, items: [{ ...foodResult.items[0], portion: { amount: 1, unit: "x", grams: -5 } }] })).toBeNull();
  });

  it("parses the body and caps the planned-meal context", () => {
    const parsed = parseScanBody({
      ...goodBody,
      context: { slot: "dinner", plannedMeal: { name: "x".repeat(500), ingredients: Array(50).fill("rice") } },
    });
    expect(parsed?.context.plannedMeal?.name.length).toBe(120);
    expect(parsed?.context.plannedMeal?.ingredients.length).toBe(30);
    expect(base64Bytes("QUJD")).toBe(3);
    expect(base64Bytes("QUI=")).toBe(2);
  });
});
