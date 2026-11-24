/**
 * npm run scan:smoke [folder] [--url <function URL>]
 *
 * Sends each photo in the folder (default scripts/scan-samples/, git-ignored) to the real scan
 * function and prints type, items, confidence and time. By default it runs the function's handler
 * in this process with the real provider, using ANTHROPIC_API_KEY (and SCAN_PROVIDER / SCAN_MODEL)
 * from DailyPlate/.env. With --url it posts to a running `netlify dev` or a deploy instead, e.g.
 * --url http://localhost:8888/api/food-scan
 *
 * Each photo is first resized the way the app does (camera orientation applied, about 1,500 px on
 * the long side, JPEG at quality 0.8), so full-size photos aren't rejected for size. Files that
 * can't be read as images are skipped with a message. Every photo sent is a real, billed API call.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { DEFAULT_SCAN_MAX_BYTES, DEVICE_HEADER, handleScanRequest } from "../src/server/scan/handler.ts";
import { intFromEnv, memoryCounter } from "../src/server/scan/limits.ts";
import { providerFromEnv } from "../src/server/scan/providers/index.ts";
import type { ScanResponse, ScanResult } from "../src/server/scan/types.ts";
import { SCAN_JPEG_QUALITY, SCAN_MAX_EDGE } from "../src/utils/scan/image.ts";

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

/** Same as the app's resizeForScan: orientation applied, ≤1,500 px on the long side, JPEG q0.8. */
async function resizeLikeApp(input: Buffer): Promise<{ jpeg: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(input)
    .rotate() // EXIF orientation, like createImageBitmap(file, { imageOrientation: "from-image" })
    .resize({ width: SCAN_MAX_EDGE, height: SCAN_MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" }) // JPEG has no transparency
    .jpeg({ quality: Math.round(SCAN_JPEG_QUALITY * 100) })
    .toBuffer({ resolveWithObject: true });
  return { jpeg: data, width: info.width, height: info.height };
}

const args = process.argv.slice(2);
const urlIdx = args.indexOf("--url");
const url = urlIdx >= 0 ? args[urlIdx + 1] : undefined;
const folder = path.resolve(args.find((a, i) => !a.startsWith("--") && i !== urlIdx + 1) ?? "scripts/scan-samples");

const loaded = loadDotEnv(path.resolve(".env"));
const maxBytes = intFromEnv(process.env.SCAN_MAX_BYTES, DEFAULT_SCAN_MAX_BYTES);

const EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".avif", ".gif", ".tif", ".tiff"]);

function summarize(r: ScanResult): string {
  const parts = [`  ${r.type} (confidence ${r.confidence.toFixed(2)})`];
  if (r.plannedMeal) parts.push(`  planned match ${r.plannedMeal.matches} (${r.plannedMeal.confidence.toFixed(2)})`);
  for (const i of r.items) {
    parts.push(
      `  - ${i.brand ? `${i.brand} ` : ""}${i.name}: ${i.portion.amount} ${i.portion.unit} ≈ ${Math.round(i.portion.grams)} g (${i.confidence.toFixed(2)})${i.notes.length ? ` [${i.notes.join(", ")}]` : ""}`,
    );
    if (i.whole) parts.push(`    whole: ${i.whole.name}, ${i.whole.servings} × ${i.whole.unit}, about ${Math.round(i.whole.gramsPerServing)} g each`);
  }
  if (r.multipleLabels) parts.push("  multiple Nutrition Facts labels: asks for a photo of one");
  if (r.label) {
    const l = r.label;
    parts.push(
      `  label: ${l.productName ?? "?"} · ${l.servingSize.text}${l.servingSize.grams != null ? ` (${l.servingSize.grams} g)` : ""} · ${l.calories} kcal · ${l.protein} g protein · carbs ${l.carbs ?? "–"} · fat ${l.fat ?? "–"} · fiber ${l.fiber ?? "–"} · sodium ${l.sodiumMg ?? "–"} mg`,
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
    .filter((f) => EXTENSIONS.has(path.extname(f).toLowerCase()))
    .sort();
  if (files.length === 0) {
    console.error(`No image files in ${folder}.`);
    process.exit(1);
  }
  const provider = url ? null : providerFromEnv(process.env);
  if (!url) {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("ANTHROPIC_API_KEY isn't set (in .env or the environment).");
      process.exit(1);
    }
    const shown = loaded.filter((k) => !/KEY|TOKEN|SECRET/i.test(k));
    console.log(
      `In-process: provider ${provider?.name ?? "?"}, model ${provider?.model ?? "?"}` +
        (loaded.length ? ` (from .env: ${shown.length ? shown.join(", ") : "keys only"})` : ""),
    );
  } else {
    console.log(`Posting to ${url}`);
  }
  const counter = memoryCounter();
  let sent = 0;
  let skipped = 0;
  const started = Date.now();
  for (const file of files) {
    const original = fs.readFileSync(path.join(folder, file));
    let resized: Awaited<ReturnType<typeof resizeLikeApp>>;
    try {
      resized = await resizeLikeApp(original);
    } catch (e) {
      skipped++;
      console.log(`\n${file}: skipped, can't read it as an image (${e instanceof Error ? e.message : String(e)})`);
      continue;
    }
    const sizeNote = `${Math.round(original.length / 1024)} KB → ${resized.width}×${resized.height} JPEG ${Math.round(resized.jpeg.length / 1024)} KB`;
    if (resized.jpeg.length > maxBytes) {
      skipped++;
      console.log(`\n${file}: skipped, still over the size limit after resizing (${sizeNote})`);
      continue;
    }
    sent++;
    const body = JSON.stringify({ image: resized.jpeg.toString("base64"), mediaType: "image/jpeg", context: { slot: "lunch" } });
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
      console.log(`\n${file}: HTTP ${res.status} ${out && "error" in out ? out.error : "(no JSON)"} · ${ms} ms · ${sizeNote}`);
      continue;
    }
    console.log(`\n${file}: ${ms} ms (provider ${out.meta.ms} ms, ${out.meta.model}) · ${sizeNote}\n${summarize(out.result)}`);
  }
  console.log(`\n${files.length} file(s): ${sent} sent, ${skipped} skipped · total ${((Date.now() - started) / 1000).toFixed(1)} s`);
}

void main();
