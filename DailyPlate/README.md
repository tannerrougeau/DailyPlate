# DailyPlate

A calm, mobile-first meal planning **Progressive Web App** built with React, TypeScript, Vite, Tailwind CSS, and Zustand (with persistence). Recipes live in local TypeScript data — no backend required for this version.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+ recommended

## Run locally

```bash
cd DailyPlate
npm install
npm run dev
```

Open the URL shown in the terminal (usually **http://localhost:5173**).

## Build & preview (PWA)

```bash
npm run build
npm run preview
```

The production build registers a service worker for offline caching of static assets (via `vite-plugin-pwa`).

## Project layout

| Path | Purpose |
|------|---------|
| `src/components/` | UI pieces (nav, meal cards, buttons) |
| `src/screens/` | Full-page views |
| `src/store/` | Zustand store + `persist` |
| `src/recipes/recipeLibrary.ts` | Whole-food recipe list (edit this file to change recipes) |
| `src/utils/` | Helpers (e.g. day plan generation) |
| `src/types/` | Shared TypeScript types |

## Product name

The codebase uses **DailyPlate** as the app name; you can rebrand in `index.html`, the PWA manifest in `vite.config.ts`, and UI copy as you like.
