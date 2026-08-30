import type { Recipe } from "@/types";
import type { UserProfile } from "@/types/profile";
import {
  DISLIKED_FOOD_CHIPS,
  FAVORITE_FOOD_CHIPS,
  matchingDislikeChips,
  matchingFavoriteChips,
} from "@/utils/chipMatching";
import { CUISINE_OPTIONS, type PersonalizationInsight } from "@/utils/personalizationEngine";

function customTokens(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length >= 2);
}

function appendCustomToken(existing: string | undefined, token: string): string {
  const norm = token.trim().toLowerCase();
  if (!norm) return existing?.trim() ?? "";
  const tokens = customTokens(existing ?? "");
  if (tokens.includes(norm)) return existing?.trim() ?? "";
  return [...tokens, norm].join(", ");
}

function removeCustomToken(existing: string | undefined, token: string): string {
  const norm = token.trim().toLowerCase();
  return customTokens(existing ?? "")
    .filter((t) => t !== norm)
    .join(", ");
}

function mergeChips(existing: string[], toAdd: string[]): string[] {
  if (toAdd.length === 0) return existing;
  const next = new Set(existing);
  for (const chip of toAdd) next.add(chip);
  next.delete("none");
  return [...next];
}

function normalizeCuisineId(recipe: Recipe): string | null {
  const cuisine = recipe.cuisine?.toLowerCase();
  if (!cuisine) return null;
  return CUISINE_OPTIONS.find((option) => option.id === cuisine)?.id ?? null;
}

function chipLabels(chipIds: string[], options: { id: string; label: string }[]): string[] {
  return chipIds.map((id) => options.find((chip) => chip.id === id)?.label ?? id);
}

function newlyAdded(before: string[], after: string[]): string[] {
  const previous = new Set(before);
  return after.filter((value) => !previous.has(value));
}

export function profileUpdatesForFavorite(
  profile: UserProfile,
  recipe: Recipe,
  isAdding: boolean,
): Partial<UserProfile> {
  if (!isAdding) {
    return {
      favoriteFoodCustom: removeCustomToken(profile.favoriteFoodCustom, recipe.name),
    };
  }

  const favoriteChips = mergeChips(profile.favoriteFoodChips ?? [], matchingFavoriteChips(recipe));
  const cuisine = normalizeCuisineId(recipe);
  const preferredCuisines = profile.preferredCuisines ?? [];
  const updates: Partial<UserProfile> = {
    favoriteFoodChips: favoriteChips,
    favoriteFoodCustom: appendCustomToken(profile.favoriteFoodCustom, recipe.name),
    dislikedFoodCustom: removeCustomToken(profile.dislikedFoodCustom, recipe.name),
  };

  if (cuisine && !preferredCuisines.includes(cuisine)) {
    updates.preferredCuisines = [...preferredCuisines, cuisine];
  }

  return updates;
}

export function profileUpdatesForDislike(
  profile: UserProfile,
  recipe: Recipe,
  isAdding: boolean,
): Partial<UserProfile> {
  if (!isAdding) {
    return {
      dislikedFoodCustom: removeCustomToken(profile.dislikedFoodCustom, recipe.name),
    };
  }

  return {
    dislikedFoodChips: mergeChips(profile.dislikedFoodChips ?? [], matchingDislikeChips(recipe)),
    dislikedFoodCustom: appendCustomToken(profile.dislikedFoodCustom, recipe.name),
    favoriteFoodCustom: removeCustomToken(profile.favoriteFoodCustom, recipe.name),
  };
}

export function buildRecipePreferenceInsight(
  recipe: Recipe,
  action: "favorite" | "unfavorite" | "dislike" | "undislike",
  previousProfile: UserProfile,
  nextProfile: UserProfile,
): PersonalizationInsight {
  const generatedAt = new Date().toISOString();

  if (action === "favorite") {
    const addedChips = newlyAdded(
      previousProfile.favoriteFoodChips ?? [],
      nextProfile.favoriteFoodChips ?? [],
    );
    const addedCuisines = newlyAdded(
      previousProfile.preferredCuisines ?? [],
      nextProfile.preferredCuisines ?? [],
    );
    const chipText = chipLabels(addedChips, FAVORITE_FOOD_CHIPS);
    const cuisineText = chipLabels(addedCuisines, [...CUISINE_OPTIONS]);

    let preferenceDetail = "";
    if (chipText.length > 0 && cuisineText.length > 0) {
      preferenceDetail = ` Updated your preferences with ${chipText.join(", ")} and ${cuisineText.join(", ")} cuisine.`;
    } else if (chipText.length > 0) {
      preferenceDetail = ` Updated your food preferences with ${chipText.join(", ")}.`;
    } else if (cuisineText.length > 0) {
      preferenceDetail = ` Added ${cuisineText.join(", ")} to your cuisine preferences.`;
    }

    return {
      id: `pref-fav-${recipe.id}-${Date.now()}`,
      message: `Saved ${recipe.name} to favorites — future meal plans will suggest more like it.${preferenceDetail}`,
      generatedAt,
    };
  }

  if (action === "unfavorite") {
    return {
      id: `pref-unfav-${recipe.id}-${Date.now()}`,
      message: `Removed ${recipe.name} from favorites.`,
      generatedAt,
    };
  }

  if (action === "dislike") {
    const addedChips = newlyAdded(
      previousProfile.dislikedFoodChips ?? [],
      nextProfile.dislikedFoodChips ?? [],
    );
    const chipText = chipLabels(addedChips, DISLIKED_FOOD_CHIPS);
    const preferenceDetail =
      chipText.length > 0
        ? ` Updated your avoid list with ${chipText.join(", ")}.`
        : "";

    return {
      id: `pref-dislike-${recipe.id}-${Date.now()}`,
      message: `Marked ${recipe.name} as disliked — we’ll avoid it and similar meals in future plans.${preferenceDetail}`,
      generatedAt,
    };
  }

  return {
    id: `pref-undislike-${recipe.id}-${Date.now()}`,
    message: `Removed ${recipe.name} from dislikes — similar recipes may appear in plans again.`,
    generatedAt,
  };
}
