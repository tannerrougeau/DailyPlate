import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** The service worker must never serve the app shell for, or cache, function requests. */
describe("service worker config", () => {
  const config = fs.readFileSync(path.resolve("vite.config.ts"), "utf8");
  const deny = config.match(/navigateFallbackDenylist:\s*\[([^\]]*)\]/)?.[1] ?? "";
  // The regex literals listed in the config.
  const patterns = deny
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.startsWith("/"))
    .map((lit) => new RegExp(lit.slice(1, lit.lastIndexOf("/"))));

  it.each(["/.netlify/functions/food-search?q=x", "/.netlify/functions/food-scan", "/api/food-scan"])("ignores %s", (url) => {
    expect(patterns.some((p) => p.test(url))).toBe(true);
  });

  it("still serves the app for app routes", () => {
    expect(patterns.some((p) => p.test("/today"))).toBe(false);
  });

  it("caches only the barcode reader's wasm at runtime, not function calls", () => {
    expect(config).toMatch(/url\.pathname\.endsWith\("\.wasm"\)/);
    expect(config).not.toMatch(/urlPattern:[^\n]*(netlify|api)/);
  });
});
