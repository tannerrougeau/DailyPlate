import type { DayMealTracking, MealSlotId, PlannedMeal, Recipe } from "@/types";
import type { UserProfile } from "@/types/profile";
import type { CheckInEntry } from "@/types/tdeeFeedback";
import { addDays, fromDateKey, toDateKey } from "@/utils/date";

export const CUISINE_OPTIONS = [
  { id: "american", label: "American" },
  { id: "mediterranean", label: "Mediterranean" },
  { id: "asian", label: "Asian" },
  { id: "mexican", label: "Mexican" },
  { id: "italian", label: "Italian" },
  { id: "japanese", label: "Japanese" },
] as const;

export type PersonalizationSignals = {
  skippedRecipeIds: Set<string>;
  enjoyedRecipeIds: Set<string>;
  recentRecipeIds: Set<string>;
  skippedLongPrepCount: number;
  enjoyedBatchCount: number;
  loggedMealCount: number;
  skipRate: number;
};

export type PersonalizationInsight = {
  id: string;
  message: string;
  generatedAt: string;
};

function totalPrepMinutes(recipe: Recipe): number {
  return recipe.prepMinutes + recipe.cookMinutes;
}

function mealsForDateKey(
  dateKey: string,
  dailyPlans: Record<string, PlannedMeal[]>,
  plannedMeals: PlannedMeal[],
  todayDateKey: string,
): PlannedMeal[] {
  return dailyPlans[dateKey] ?? (dateKey === todayDateKey ? plannedMeals : []);
}

export function analyzePersonalizationSignals(input: {
  mealTracking: Record<string, DayMealTracking>;
  dailyPlans: Record<string, PlannedMeal[]>;
  plannedMeals: PlannedMeal[];
  todayDateKey: string;
  lookbackDays?: number;
}): PersonalizationSignals {
  const lookback = input.lookbackDays ?? 14;
  const anchor = fromDateKey(input.todayDateKey);
  const skippedRecipeIds = new Set<string>();
  const enjoyedRecipeIds = new Set<string>();
  const recentRecipeIds = new Set<string>();
  let skippedLongPrepCount = 0;
  let enjoyedBatchCount = 0;
  let logged = 0;
  let skipped = 0;

  for (let offset = -(lookback - 1); offset <= 0; offset++) {
    const key = toDateKey(addDays(anchor, offset));
    const meals = mealsForDateKey(
      key,
      input.dailyPlans,
      input.plannedMeals,
      input.todayDateKey,
    );
    const dayLog = input.mealTracking[key];
    for (const meal of meals) {
      recentRecipeIds.add(meal.recipe.id);
      const entry = dayLog?.[meal.slot];
      if (!entry) continue;
      logged++;
      if (entry.status === "skipped") {
        skipped++;
        skippedRecipeIds.add(meal.recipe.id);
        if (totalPrepMinutes(meal.recipe) > 35) skippedLongPrepCount++;
      } else {
        enjoyedRecipeIds.add(meal.recipe.id);
        if (
          meal.recipe.tags.includes("batch_friendly") ||
          meal.recipe.tags.includes("meal_prep")
        ) {
          enjoyedBatchCount++;
        }
      }
    }
  }

  return {
    skippedRecipeIds,
    enjoyedRecipeIds,
    recentRecipeIds,
    skippedLongPrepCount,
    enjoyedBatchCount,
    loggedMealCount: logged,
    skipRate: logged > 0 ? skipped / logged : 0,
  };
}

export function recipePersonalizationBoost(
  recipe: Recipe,
  slot: MealSlotId,
  profile: UserProfile,
  signals: PersonalizationSignals,
  favoriteIds: string[],
): number {
  let boost = 0;

  if (profile.prioritizeMinimalPrep) {
    const prep = totalPrepMinutes(recipe);
    if (prep <= 20 || recipe.tags.includes("quick")) boost += 28;
    else if (prep <= 30) boost += 12;
    else boost -= 10;
  }

  if (profile.weeklyMealPrepEnabled) {
    if (recipe.tags.includes("batch_friendly")) boost += 22;
    if (recipe.tags.includes("meal_prep")) boost += 18;
  }

  const cuisines = profile.preferredCuisines ?? [];
  if (cuisines.length > 0 && cuisines.includes(recipe.cuisine)) {
    boost += 20;
  }

  if (signals.skippedRecipeIds.has(recipe.id)) boost -= 45;
  if (signals.enjoyedRecipeIds.has(recipe.id)) boost += 16;
  if (signals.recentRecipeIds.has(recipe.id)) boost -= 12;

  if (favoriteIds.includes(recipe.id) && signals.enjoyedRecipeIds.has(recipe.id)) {
    boost += 10;
  }

  if (profile.mealTiming === "bigger_dinner" && slot === "dinner" && recipe.calories > 480) {
    boost += 8;
  }
  if (profile.mealTiming === "light_breakfast" && slot === "breakfast" && recipe.calories < 380) {
    boost += 8;
  }

  return boost;
}

export function deriveAdaptiveProfileUpdates(
  profile: UserProfile,
  signals: PersonalizationSignals,
  entry?: CheckInEntry,
): Partial<UserProfile> {
  const updates: Partial<UserProfile> = {};

  if (
    !profile.prioritizeMinimalPrep &&
    signals.loggedMealCount >= 4 &&
    signals.skippedLongPrepCount >= 2 &&
    signals.skipRate >= 0.35
  ) {
    updates.prioritizeMinimalPrep = true;
  }

  if (
    !profile.weeklyMealPrepEnabled &&
    signals.loggedMealCount >= 5 &&
    signals.enjoyedBatchCount >= 3
  ) {
    updates.weeklyMealPrepEnabled = true;
    updates.weeklyMealPrepSlot = updates.weeklyMealPrepSlot ?? profile.weeklyMealPrepSlot ?? "dinner";
    updates.weeklyMealPrepRepeatCount =
      updates.weeklyMealPrepRepeatCount ?? profile.weeklyMealPrepRepeatCount ?? 3;
  }

  if (entry) {
    if (entry.proteinAdherence <= 5 && !profile.prioritizeMinProtein) {
      updates.prioritizeMinProtein = true;
    }
    if (entry.planEaseOfUse <= 5 && !profile.weeklyMealPrepEnabled) {
      updates.weeklyMealPrepEnabled = true;
      updates.weeklyMealPrepSlot = profile.weeklyMealPrepSlot ?? "dinner";
      updates.weeklyMealPrepRepeatCount = profile.weeklyMealPrepRepeatCount ?? 3;
    }
    if (entry.recipeEnjoyment <= 5 && !profile.prioritizeMinimalPrep && entry.planEaseOfUse <= 6) {
      updates.prioritizeMinimalPrep = true;
    }
  }

  return updates;
}

function macroSplitLabel(pref: UserProfile["macroSplitPreference"]): string {
  switch (pref) {
    case "higher_carb":
      return "60/40 carbs-to-fat";
    case "lower_carb":
      return "40/60 fat-to-carbs";
    default:
      return "balanced carbs and fat";
  }
}

export function buildPersonalizationInsights(input: {
  profile: UserProfile;
  signals: PersonalizationSignals;
  checkInEntry?: CheckInEntry;
  favoriteIds: string[];
  source?: "check_in" | "tracking" | "profile";
}): PersonalizationInsight[] {
  const { profile, signals, checkInEntry: entry, favoriteIds, source } = input;
  const messages: string[] = [];
  const adaptive = deriveAdaptiveProfileUpdates(profile, signals, entry);
  const nextProfile = { ...profile, ...adaptive };

  if (adaptive.prioritizeMinimalPrep && !profile.prioritizeMinimalPrep) {
    messages.push(
      "Based on your recent logs, we enabled quick & minimal-prep meal priority — future plans will favor faster recipes.",
    );
  }
  if (adaptive.prioritizeMinProtein && !profile.prioritizeMinProtein) {
    messages.push(
      "Based on your check-in and logs, we adjusted protein upward and will prioritize high-protein meals in your plans.",
    );
  }
  if (adaptive.weeklyMealPrepEnabled && !profile.weeklyMealPrepEnabled) {
    messages.push(
      "You’ve been eating batch-friendly meals — we enabled weekly meal prep to reduce cooking days.",
    );
  }

  if (entry && source === "check_in") {
    if (entry.mealVarietySatisfaction <= 5) {
      messages.push(
        "Meals felt repetitive — we’ll rotate recipes more and lean on your favorites and cuisine preferences.",
      );
    }
    if (entry.recipeEnjoyment >= 8 && favoriteIds.length > 0) {
      messages.push(
        "Recipes you marked as favorites are weighted higher in upcoming meal suggestions.",
      );
    }
  }

  if (signals.loggedMealCount >= 3 && source === "tracking") {
    if (signals.skipRate >= 0.4) {
      messages.push(
        "Several logged meals were skipped — we’re deprioritizing those recipes and boosting options that match your preferences.",
      );
    } else if (signals.enjoyedBatchCount >= 2 && nextProfile.weeklyMealPrepEnabled) {
      messages.push(
        "Your eaten meals lean batch-friendly — week plans will prioritize fewer cooking days.",
      );
    }
  }

  if (source === "profile") {
    messages.push(
      `Your macro split is set to ${macroSplitLabel(nextProfile.macroSplitPreference)} and meal timing preferences are applied to each slot.`,
    );
    if (nextProfile.preferredCuisines?.length) {
      const labels = nextProfile.preferredCuisines
        .map((c) => CUISINE_OPTIONS.find((o) => o.id === c)?.label ?? c)
        .join(", ");
      messages.push(`Cuisine preferences (${labels}) will guide recipe selection.`);
    }
  }

  if (messages.length === 0 && signals.loggedMealCount >= 2) {
    messages.push(
      "Keep logging meals and completing check-ins — your plan adapts as we learn what you enjoy.",
    );
  }

  if (messages.length === 0) {
    return [];
  }

  const generatedAt = new Date().toISOString();
  return messages.slice(0, 2).map((message, index) => ({
    id: `${source ?? "general"}-${index}-${message.slice(0, 24).replace(/\s+/g, "-").toLowerCase()}`,
    message,
    generatedAt,
  }));
}

export function pickPrimaryInsight(insights: PersonalizationInsight[]): PersonalizationInsight | null {
  return insights[0] ?? null;
}
