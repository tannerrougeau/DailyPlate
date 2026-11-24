/**
 * POST /api/food-scan   { image (base64 JPEG), mediaType, context: { slot, plannedMeal? } }
 * Identifies a food, Nutrition Facts label or barcode in a photo. Provider from SCAN_PROVIDER
 * (default "claude", model SCAN_MODEL, key ANTHROPIC_API_KEY: server-side only). Daily caps are
 * counted in Netlify Blobs; a burst rule limits each IP to 10 requests a minute.
 * Errors are logged (Netlify → Logs → Functions → food-scan). Photos are not stored.
 */
import { getStore } from "@netlify/blobs";
import { DEFAULT_SCAN_MAX_BYTES, handleScanRequest } from "../../src/server/scan/handler.ts";
import {
  blobCounter,
  DEFAULT_DAILY_LIMIT,
  DEFAULT_DEVICE_DAILY_LIMIT,
  intFromEnv,
  type BlobStoreLike,
} from "../../src/server/scan/limits.ts";
import { providerFromEnv } from "../../src/server/scan/providers/index.ts";

export default async (req: Request, context: { ip?: string }): Promise<Response> => {
  const env = process.env;
  return handleScanRequest(req, {
    provider: providerFromEnv(env),
    counter: blobCounter(getStore({ name: "scan-limits", consistency: "strong" }) as unknown as BlobStoreLike),
    limits: {
      device: intFromEnv(env.SCAN_DEVICE_DAILY_LIMIT, DEFAULT_DEVICE_DAILY_LIMIT),
      total: intFromEnv(env.SCAN_DAILY_LIMIT, DEFAULT_DAILY_LIMIT),
      maxBytes: intFromEnv(env.SCAN_MAX_BYTES, DEFAULT_SCAN_MAX_BYTES),
    },
    clientIp: context?.ip,
  });
};

// A rate-limit rule needs a custom path, so this function is served at /api/food-scan.
export const config = {
  path: "/api/food-scan",
  rateLimit: {
    windowLimit: 10,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
  },
};
