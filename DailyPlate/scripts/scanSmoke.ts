/**
 * npm run scan:smoke [folder] [--url <function URL>]
 *
 * Sends each photo in the folder (default scripts/scan-samples/, git-ignored) to the real scan
 * function and prints type, items, confidence and time. By default it runs the function's handler
 * in this process with the real provider, using ANTHROPIC_API_KEY (and SCAN_PROVIDER / SCAN_MODEL)
 * from DailyPlate/.env. With --url it posts to a running `netlify dev` or a deploy instead, e.g.
 * --url http://localhost:8888/api/food-scan
 *
 * Every photo is a real, billed API call. Photos larger than the size limit are skipped
 * (the app downsizes to ~1,500 px first; do the same for samples).
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SCAN_MAX_BYTES, DEVICE_HEADER, handleScanRequest } from "../src/server/scan/handler.ts";
import { intFromEnv, memoryCounter } from "../src/server/scan/limits.ts";
import { providerFromEnv } from "../src/server/scan/providers/index.ts";
import type { ScanResponse, ScanResult } from "../src/server/scan/types.ts";

/** Reads KEY=value lines from .env into process.env (existing variables win). Never prints values. */
function loadDotEnv(file: string): string[] {
  if (!fs.existsSync(file)) return [];
  const loaded: string[] = [];
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    const key = m[1]!;
    const value = m[2]!.replace(/^(['"])(.*)\1$/, "$2");
    if (process.env[key] === undefined) {
      process.env[key] = value;
      loaded.push(key);
    }
  }
  return loaded;
}

const args = process.argv.slice(2);
const urlIdx = args.indexOf("--url");
const url = urlIdx >= 0 ? args[urlIdx + 1] : undefined;
const folder = path.resolve(args.find((a, i) => !a.startsWith("--") && i !== urlIdx + 1) ?? "scripts/scan-samples");

const loaded = loadDotEnv(path.resolve(".env"));
const maxBytes = intFromEnv(process.env.SCAN_MAX_BYTES, DEFAULT_SCAN_MAX_BYTES);

const MEDIA: Record<string, "image/jpeg" | "image/png" | "image/webp"> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function summarize(r: ScanResult): string {
  const parts = [`${r.type} (${r.confidence.toFixed(2)})`];
  if (r.plannedMeal) parts.push(`planned match ${r.plannedMeal.matches} (${r.plannedMeal.confidence.toFixed(2)})`);
  for (const i of r.items) {
    parts.push(
      `  - ${i.brand ? `${i.brand} ` : ""}${i.name}: ${i.portion.amount} ${i.portion.unit} ≈ ${Math.round(i.portion.grams)} g (${i.confidence.toFixed(2)})${i.notes.length ? ` [${i.notes.join(", ")}]` : ""}`,
    );
  }
  if (r.label) {
    parts.push(
      `  label: ${r.label.productName ?? "?"} · ${r.label.servingSize.text} · ${r.label.calories} kcal · ${r.label.protein} g protein`,
    );
  }
  if (r.barcode) parts.push(`  barcode digits: ${r.barcode.digits ?? "unreadable"}`);
  if (r.suggestions.length) parts.push(`  suggestions: ${r.suggestions.join(", ")}`);
  return parts.join("\n");
}

async function main() {
  if (!fs.existsSync(folder)) {
    console.error(`No folder ${folder}. Put 5–10 photos there, or pass a folder.`);
    process.exit(1);
  }
  const files = fs
    .readdirSync(folder)
    .filter((f) => MEDIA[path.extname(f).toLowerCase()])
    .sort();
  if (files.length === 0) {
    console.error(`No .jpg, .jpeg, .png or .webp files in ${folder}.`);
    process.exit(1);
  }
  const provider = url ? null : providerFromEnv(process.env);
  if (!url) {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("ANTHROPIC_API_KEY isn't set (in .env or the environment).");
      process.exit(1);
    }
    console.log(
      `In-process: provider ${provider?.name ?? "?"}, model ${provider?.model ?? "?"}` +
        (loaded.length ? ` (from .env: ${loaded.filter((k) => !/KEY|TOKEN|SECRET/i.test(k)).join(", ") || "keys only"})` : ""),
    );
  } else {
    console.log(`Posting to ${url}`);
  }
  const counter = memoryCounter();
  const started = Date.now();
  for (const file of files) {
    const bytes = fs.readFileSync(path.join(folder, file));
    if (bytes.length > maxBytes) {
      console.log(`\n${file}: skipped (${Math.round(bytes.length / 1024)} KB is over the ${Math.round(maxBytes / 1024)} KB limit; resize it first)`);
      continue;
    }
    const body = JSON.stringify({
      image: bytes.toString("base64"),
      mediaType: MEDIA[path.extname(file).toLowerCase()],
      context: { slot: "lunch" },
    });
    const t0 = Date.now();
    let res: Response;
    if (url) {
      res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", [DEVICE_HEADER]: "scan-smoke" }, body });
    } else {
      const req = new Request("http://localhost/api/food-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json", [DEVICE_HEADER]: "scan-smoke" },
        body,
      });
      res = await handleScanRequest(req, {
        provider,
        counter,
        limits: { device: 1000, total: 1000, maxBytes },
        log: (m) => console.error(`  log: ${m}`),
      });
    }
    const ms = Date.now() - t0;
    const out = (await res.json().catch(() => null)) as ScanResponse | null;
    if (!out || "error" in out) {
      console.log(`\n${file}: HTTP ${res.status} ${out && "error" in out ? out.error : "(no JSON)"} · ${ms} ms`);
      continue;
    }
    console.log(`\n${file}: ${ms} ms (provider ${out.meta.ms} ms, ${out.meta.model})\n${summarize(out.result)}`);
  }
  console.log(`\n${files.length} photo(s) in ${((Date.now() - started) / 1000).toFixed(1)} s`);
}

void main();
