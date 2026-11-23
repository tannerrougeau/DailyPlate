import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (f: string) => readFileSync(resolve(__dirname, "../../..", f), "utf8");

describe("light design only", () => {
  const html = read("index.html");
  const css = read("src/index.css");
  const vite = read("vite.config.ts");
  const cream = css.match(/--color-cream:\s*(#[0-9a-f]{6})/i)![1]!.toLowerCase();

  it("tells browsers not to auto-darken the page", () => {
    expect(html).toContain('<meta name="color-scheme" content="only light" />');
    expect(css).toMatch(/:root\s*\{\s*color-scheme:\s*only light;/);
    expect(css).not.toMatch(/prefers-color-scheme:\s*dark/);
  });

  it("theme and manifest colors match the light page background", () => {
    expect(html).toContain(`<meta name="theme-color" content="${cream}" />`);
    expect(vite).toContain(`theme_color: "${cream}"`);
    expect(vite).toContain(`background_color: "${cream}"`);
  });
});
