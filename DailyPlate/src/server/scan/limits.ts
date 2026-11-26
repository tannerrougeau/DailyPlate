/**
 * Daily scan caps: per device (a hash of the app's random device ID, or the IP) and in total.
 * Counts live in a key-value store (Netlify Blobs in production, memory in tests and the smoke
 * script). There's no atomic increment, so two simultaneous scans can each pass one over a cap.
 */

export interface ScanCounter {
  get(key: string): Promise<number>;
  increment(key: string): Promise<void>;
}

export const DEFAULT_DEVICE_DAILY_LIMIT = 30;
export const DEFAULT_DAILY_LIMIT = 300;

export type LimitCheck = "ok" | "device_limit" | "total_limit";

/** UTC day, e.g. "2026-11-24". */
export function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Checks both caps and, when the scan may go ahead, counts it. */
export async function checkAndCount(
  counter: ScanCounter,
  deviceHash: string,
  limits: { device: number; total: number },
  now: Date,
): Promise<LimitCheck> {
  const day = dayKey(now);
  const totalKey = `${day}/total`;
  const deviceKey = `${day}/device/${deviceHash}`;
  const [total, device] = await Promise.all([counter.get(totalKey), counter.get(deviceKey)]);
  if (total >= limits.total) return "total_limit";
  if (device >= limits.device) return "device_limit";
  await Promise.all([counter.increment(totalKey), counter.increment(deviceKey)]);
  return "ok";
}

export function memoryCounter(): ScanCounter & { counts: Map<string, number> } {
  const counts = new Map<string, number>();
  return {
    counts,
    async get(key) {
      return counts.get(key) ?? 0;
    },
    async increment(key) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    },
  };
}

/** Minimal shape of a Netlify Blobs store used here (kept loose so tests needn't import Blobs). */
export type BlobStoreLike = {
  get(key: string, opts: { type: "text" }): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
};

export function blobCounter(store: BlobStoreLike): ScanCounter {
  return {
    async get(key) {
      const raw = await store.get(key, { type: "text" });
      const n = raw == null ? 0 : Number(raw);
      return Number.isFinite(n) ? n : 0;
    },
    async increment(key) {
      const raw = await store.get(key, { type: "text" });
      const n = raw == null ? 0 : Number(raw) || 0;
      await store.set(key, String(n + 1));
    },
  };
}

export function intFromEnv(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}
