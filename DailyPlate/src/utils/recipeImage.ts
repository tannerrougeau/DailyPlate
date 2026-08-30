import type { MealSlotId, Recipe } from "@/types";
import { recipeLibrary } from "@/recipes/recipeLibrary";

/** Use the current library recipe so persisted meal snapshots get up-to-date photos. */
export function resolveRecipeForDisplay(recipe: Recipe): Recipe {
  return recipeLibrary.find((r) => r.id === recipe.id) ?? recipe;
}

/** Curated Unsplash food photography — stable, high-quality thumbnails. */
const SLOT_IMAGES: Record<MealSlotId, string[]> = {
  breakfast: [
    "photo-1494859802809-d06900ae0570",
    "photo-1533089860882-10df1a310606",
    "photo-1484723091731-7a020df4a2cb",
    "photo-1525351484163-7529414344d8",
    "photo-1517673132405-a57141f2eefd",
  ],
  lunch: [
    "photo-1546069901-ba9599a7e63c",
    "photo-1512621776951-a57141f2eefd",
    "photo-1540189549336-e6e99c3679fe",
    "photo-1498837167922-ddd27511e3af",
    "photo-1547592166-23ac45744acd",
  ],
  dinner: [
    "photo-1504674900247-0877df9cc836",
    "photo-1565299624946-b28f40a0ae38",
    "photo-1563379926898-05f4575a45d8",
    "photo-1603133872878-684fc894bb53",
    "photo-1565557623262-b51c2513a641",
  ],
  snack: [
    "photo-1613478223719-0ab772a0e7c8",
    "photo-1606312619070-d48aeb4cdbf6",
    "photo-1590301157890-4810ed352733",
    "photo-1488477181946-6428a0291777",
  ],
};

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function primarySlot(recipe: Recipe): MealSlotId {
  return recipe.mealSlots[0] ?? "lunch";
}

export function recipeImageUrl(
  recipe: Recipe,
  options?: { width?: number; height?: number },
): string {
  const resolved = resolveRecipeForDisplay(recipe);
  if (resolved.imageUrl) return resolved.imageUrl;

  const width = options?.width ?? 480;
  const height = options?.height ?? 360;
  const slot = primarySlot(resolved);
  const pool = SLOT_IMAGES[slot];
  const photoId = pool[hashString(resolved.id) % pool.length]!;
  return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=${width}&h=${height}&q=80`;
}

export function recipeImageGradient(recipe: Recipe): string {
  const slot = primarySlot(recipe);
  const gradients: Record<MealSlotId, string> = {
    breakfast: "from-amber-100 via-orange-50 to-rose-100",
    lunch: "from-emerald-100 via-teal-50 to-cyan-100",
    dinner: "from-indigo-100 via-violet-50 to-purple-100",
    snack: "from-rose-100 via-pink-50 to-fuchsia-100",
  };
  return gradients[slot];
}
