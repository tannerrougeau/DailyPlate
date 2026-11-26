/**
 * food-scan request handling (kept free of Netlify imports so it can be tested and run by the
 * smoke script). POST { image, mediaType, context } → { result, meta } or { error }.
 * Order: body → size → daily caps → provider (one ~45 s deadline for every attempt) → validation.
 * Photos are never stored or logged.
 */
import { describeProviderError } from "./providers/claude";
import { checkAndCount, sha256Hex, type ScanCounter } from "./limits";
import type { ScanContext, ScanErrorCode, ScanImage, ScanProvider, ScanResponse } from "./types";

export const DEFAULT_SCAN_MAX_BYTES = 1_500_000;
/** Whole-scan deadline, well inside Netlify's 60-second function limit. */
export const SCAN_DEADLINE_MS = 45_000;
export const DEVICE_HEADER = "x-dailyplate-device";

const MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const SLOTS = new Set(["breakfast", "lunch", "dinner", "snack"]);

export type ScanDeps = {
  provider: ScanProvider | null;
  counter: ScanCounter;
  limits: { device: number; total: number; maxBytes: number };
  /** Caller's IP, used when the app sends no device ID. */
  clientIp?: string;
  log?: (msg: string) => void;
  now?: () => Date;
  deadlineMs?: number;
};

const STATUS: Record<ScanErrorCode, number> = {
  too_large: 413,
  bad_request: 400,
  limit_reached: 429,
  scan_failed: 502,
};

function fail(code: ScanErrorCode): Response {
  return Response.json({ error: code } satisfies ScanResponse, { status: STATUS[code], headers: { "Cache-Control": "no-store" } });
}

/** Decoded size of a base64 string, without decoding it. */
export function base64Bytes(b64: string): number {
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

type ParsedBody = { image: ScanImage; context: ScanContext };

export function parseScanBody(body: unknown): ParsedBody | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.image !== "string" || b.image.length < 100 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b.image)) return null;
  if (typeof b.mediaType !== "string" || !MEDIA_TYPES.has(b.mediaType)) return null;
  const c = b.context as Record<string, unknown> | undefined;
  if (!c || typeof c.slot !== "string" || !SLOTS.has(c.slot)) return null;
  const context: ScanContext = { slot: c.slot as ScanContext["slot"] };
  const pm = c.plannedMeal as Record<string, unknown> | undefined;
  if (pm != null) {
    if (typeof pm.name !== "string" || !Array.isArray(pm.ingredients)) return null;
    context.plannedMeal = {
      name: pm.name.slice(0, 120),
      ingredients: pm.ingredients.filter((x): x is string => typeof x === "string").slice(0, 30).map((x) => x.slice(0, 80)),
    };
  }
  return { image: { base64: b.image, mediaType: b.mediaType as ScanImage["mediaType"] }, context };
}

export async function handleScanRequest(req: Request, deps: ScanDeps): Promise<Response> {
  const log = deps.log ?? ((m: string) => console.error(m));
  const now = deps.now ?? (() => new Date());
  if (req.method !== "POST") return fail("bad_request");

  // Reject an oversized upload before reading it (base64 is ~4/3 of the image).
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > (deps.limits.maxBytes * 4) / 3 + 4096) return fail("too_large");

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail("bad_request");
  }
  const parsed = parseScanBody(raw);
  if (!parsed) return fail("bad_request");
  if (base64Bytes(parsed.image.base64) > deps.limits.maxBytes) return fail("too_large");

  const provider = deps.provider;
  if (!provider) {
    log("food-scan: unknown SCAN_PROVIDER; no provider configured");
    return fail("scan_failed");
  }

  const deviceId = (req.headers.get(DEVICE_HEADER) ?? "").trim().slice(0, 100);
  const who = deviceId ? `device:${deviceId}` : `ip:${deps.clientIp ?? "unknown"}`;
  let limit: Awaited<ReturnType<typeof checkAndCount>>;
  try {
    limit = await checkAndCount(deps.counter, await sha256Hex(who), deps.limits, now());
  } catch (e) {
    // A broken counter store shouldn't make scanning unusable; the provider's own limits still apply.
    log(`food-scan: limit store failed (${e instanceof Error ? e.message : String(e)}); scanning anyway`);
    limit = "ok";
  }
  if (limit !== "ok") {
    log(`food-scan: ${limit} reached`);
    return fail("limit_reached");
  }

  const started = Date.now();
  const deadline = started + (deps.deadlineMs ?? SCAN_DEADLINE_MS);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deadline - started);
  try {
    const result = await provider.recognize(parsed.image, parsed.context, {
      signal: controller.signal,
      timeLeftMs: () => deadline - Date.now(),
    });
    const ms = Date.now() - started;
    return Response.json(
      { result, meta: { provider: provider.name, model: provider.model, ms } } satisfies ScanResponse,
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    log(
      `food-scan: ${provider.name}/${provider.model} failed after ${Date.now() - started} ms: ${describeProviderError(e)}`,
    );
    return fail("scan_failed");
  } finally {
    clearTimeout(timer);
  }
}
