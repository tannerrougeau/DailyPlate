import type { DayMealTracking, MealSlotId, PlannedMeal, Recipe } from "@/types";
import type { UserProfile } from "@/types/profile";
import type { CheckInEntry } from "@/types/tdeeFeedback";
import { checkInScale, isHighScore, isMidLowScore } from "@/utils/checkInScale";
import { addDays, fromDateKey, toDateKey } from "@/utils/date";

export const CUISINE_OPTIONS = [
  { id: "american", label: "American" },
  { id: "mediterranean", label: "Mediterranean" },
  { id: "asian", label: "Asian" },
  { id: "mexican", label: "Mexican" },
  { id: "italian", label: "Italian" },
  { id: "japanese", label: "Japanese" },
] as const;

/** A recipe the user swapped away from (Replace or "New meal"). */
export type SwapLogEntry = { recipeId: string; dateKey: string; at: string };

export type PersonalizationSignals = {
  skippedRecipeIds: Set<string>;
  enjoyedRecipeIds: Set<string>;
  recentRecipeIds: Set<string>;
  /** Swapped away within the last 30 days. */
  swappedRecipeIds: Set<string>;
  /**
   * Cook events per recipe from 7 days back to 7 days ahead. A batch (meal prep, planned
   * leftovers, Low Complexity) counts once, however many days it's eaten.
   */
  recentCounts: Map<string, number>;
  /** Latest check-in said meals felt repetitive (variety 1–2 of 5). */
  wantsMoreVariety: boolean;
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
  swapLog?: SwapLogEntry[];
  latestCheckIn?: CheckInEntry | null;
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

  const swapCutoff = toDateKey(addDays(anchor, -29));
  const swappedRecipeIds = new Set(
    (input.swapLog ?? []).filter((s) => s.dateKey >= swapCutoff).map((s) => s.recipeId),
  );

  // Repeats: cook events per recipe from 7 days back to 7 days ahead. Every day of one batch
  // shares the batch id, so a 4-day batch is one event, not four repeats.
  const cookEvents = new Map<string, Set<string>>();
  for (let offset = -6; offset <= 7; offset++) {
    const key = toDateKey(addDays(anchor, offset));
    for (const meal of mealsForDateKey(key, input.dailyPlans, input.plannedMeals, input.todayDateKey)) {
      const event = meal.mealPrep?.batchId ? `batch:${meal.mealPrep.batchId}` : `day:${key}`;
      const events = cookEvents.get(meal.recipe.id) ?? new Set<string>();
      events.add(event);
      cookEvents.set(meal.recipe.id, events);
    }
  }
  const recentCounts = new Map([...cookEvents].map(([id, events]) => [id, events.size] as const));

  const wantsMoreVariety =
    input.latestCheckIn != null && checkInScale(input.latestCheckIn, "mealVarietySatisfaction") <= 2;

  return {
    skippedRecipeIds,
    enjoyedRecipeIds,
    recentRecipeIds,
    swappedRecipeIds,
    recentCounts,
    wantsMoreVariety,
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
  if (signals.swappedRecipeIds?.has(recipe.id)) boost -= 30;
  if (signals.enjoyedRecipeIds.has(recipe.id)) boost += 16;
  if (signals.recentRecipeIds.has(recipe.id)) boost -= signals.wantsMoreVariety ? 24 : 12;

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

/**
 * Meal-log patterns that suggest a plan setting. Nothing is changed here: the question queue asks
 * (see logPlanQuestions), and only a Yes applies it.
 */
export function logPlanPatterns(
  profile: UserProfile,
  signals: PersonalizationSignals,
): { skipsLongPrep: boolean; eatsBatchMeals: boolean } {
  return {
    skipsLongPrep:
      !profile.prioritizeMinimalPrep &&
      signals.loggedMealCount >= 4 &&
      signals.skippedLongPrepCount >= 2 &&
      signals.skipRate >= 0.35,
    eatsBatchMeals:
      !profile.weeklyMealPrepEnabled && signals.loggedMealCount >= 5 && signals.enjoyedBatchCount >= 3,
  };
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
  // Plan settings only change through a Yes in the question queue, so no "we enabled…" messages here.
  const nextProfile = profile;

  if (entry && source === "check_in") {
    if (isMidLowScore(checkInScale(entry, "mealVarietySatisfaction"))) {
      messages.push(
        "Meals felt repetitive — we’ll rotate recipes more and lean on your favorites and cuisine preferences.",
      );
    }
    if (isHighScore(checkInScale(entry, "recipeEnjoyment")) && favoriteIds.length > 0) {
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
