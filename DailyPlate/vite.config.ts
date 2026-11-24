import path from "node:path";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

/** Short commit for the Dev panel: Netlify's COMMIT_REF, else git, else "unknown". */
function buildCommit(): string {
  if (process.env.COMMIT_REF) return process.env.COMMIT_REF.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "unknown";
  }
}

const appVersion = (JSON.parse(readFileSync(path.join(__dirname, "package.json"), "utf8")) as { version: string }).version;

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_COMMIT__: JSON.stringify(buildCommit()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "DailyPlate",
        short_name: "DailyPlate",
        description: "Simple, calm meal planning",
        theme_color: "#f5f5f4",
        background_color: "#f5f5f4",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/favicon.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Netlify Functions are never served the app shell or cached: opening
        // /.netlify/functions/... shows the function's JSON, and fetch() goes to the network.
        // The same for /api/ (food-scan is served at /api/food-scan for its rate-limit rule).
        navigateFallbackDenylist: [/^\/\.netlify\//, /^\/api\//],
        // The barcode reader's WebAssembly (about 1 MB) isn't precached: browsers without a native
        // BarcodeDetector fetch it the first time Scan opens, and it's kept for offline reading.
        runtimeCaching: [
          {
            urlPattern: ({ sameOrigin, url }) => sameOrigin && url.pathname.endsWith(".wasm"),
            handler: "CacheFirst",
            options: {
              cacheName: "dailyplate-wasm",
              expiration: { maxEntries: 4 },
            },
          },
        ],
        // A new deploy takes over right away and old precaches are removed.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
