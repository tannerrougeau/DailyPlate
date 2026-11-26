/**
 * Talks to the food-scan function and the barcode lookup in food-search. Never sends anything but
 * the downscaled photo, the meal slot and (if any) the planned meal's name and ingredients.
 */
import type { ScanContext, ScanResponse, ScanResult } from "@/server/scan/types";
import type { FoodItem } from "@/utils/foodTypes";
import { FOOD_SEARCH_URL } from "@/utils/foodSearch";

export const FOOD_SCAN_URL = "/api/food-scan";
export const DEVICE_HEADER = "x-dailyplate-device";
const DEVICE_KEY = "dailyplate-device-id";

/** A random ID for this device, used only for the per-device daily scan cap. */
export function deviceId(store: Pick<Storage, "getItem" | "setItem"> | null = safeStorage()): string {
  try {
    const existing = store?.getItem(DEVICE_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    store?.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return "";
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

const isOnline = () => (typeof navigator === "undefined" ? true : navigator.onLine !== false);

export type ScanOutcome =
  | { ok: true; result: ScanResult; meta: { provider: string; model: string; ms: number } }
  | { ok: false; reason: "offline" | "failed" | "limit" | "too_large" | "cancelled" };

export async function scanPhoto(
  photo: { base64: string; mediaType?: "image/jpeg" },
  context: ScanContext,
  deps: { fetchImpl?: typeof fetch; signal?: AbortSignal; online?: boolean; device?: string } = {},
): Promise<ScanOutcome> {
  if (!(deps.online ?? isOnline())) return { ok: false, reason: "offline" };
  try {
    const res = await (deps.fetchImpl ?? fetch)(FOOD_SCAN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", [DEVICE_HEADER]: deps.device ?? deviceId() },
      body: JSON.stringify({ image: photo.base64, mediaType: photo.mediaType ?? "image/jpeg", context }),
      signal: deps.signal,
    });
    // 429 also comes from Netlify's per-minute burst rule (no JSON body): same message.
    if (res.status === 429) return { ok: false, reason: "limit" };
    if (res.status === 413) return { ok: false, reason: "too_large" };
    const body = (await res.json().catch(() => null)) as ScanResponse | null;
    if (!res.ok || !body || "error" in body) return { ok: false, reason: "failed" };
    return { ok: true, result: body.result, meta: body.meta };
  } catch (e) {
    if (deps.signal?.aborted || (e instanceof DOMException && e.name === "AbortError")) {
      return { ok: false, reason: "cancelled" };
    }
    return { ok: false, reason: isOnline() ? "failed" : "offline" };
  }
}

export type BarcodeOutcome =
  | { kind: "found"; foods: FoodItem[] }
  | { kind: "not_found" }
  | { kind: "failed" }
  | { kind: "offline" };

export async function lookupBarcode(
  code: string,
  deps: { fetchImpl?: typeof fetch; online?: boolean } = {},
): Promise<BarcodeOutcome> {
  if (!(deps.online ?? isOnline())) return { kind: "offline" };
  try {
    const res = await (deps.fetchImpl ?? fetch)(`${FOOD_SEARCH_URL}?upc=${encodeURIComponent(code)}`);
    if (res.status === 404) return { kind: "not_found" };
    if (!res.ok) return { kind: "failed" };
    const body = (await res.json()) as { results?: FoodItem[] };
    const foods = body.results ?? [];
    return foods.length > 0 ? { kind: "found", foods } : { kind: "not_found" };
  } catch {
    return { kind: isOnline() ? "failed" : "offline" };
  }
}

/**
 * Barcodes read offline, looked up once there's a connection: found products go to My foods.
 * Returns the names found and the codes still pending (failed or offline); not-found codes are dropped.
 */
export async function resolvePendingBarcodes(
  codes: string[],
  deps: { lookup?: typeof lookupBarcode; saveFood: (food: FoodItem) => void },
): Promise<{ found: string[]; stillPending: string[] }> {
  const lookup = deps.lookup ?? lookupBarcode;
  const found: string[] = [];
  const stillPending: string[] = [];
  for (const code of codes) {
    const r = await lookup(code);
    if (r.kind === "found") {
      deps.saveFood(r.foods[0]!);
      found.push(r.foods[0]!.name);
    } else if (r.kind === "failed" || r.kind === "offline") {
      stillPending.push(code);
    }
  }
  return { found, stillPending };
}
