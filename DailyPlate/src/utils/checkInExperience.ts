import type { UserProfile } from "@/types/profile";
import type { CheckInEntry, ExperienceRecommendation } from "@/types/tdeeFeedback";
import {
  analyzePersonalizationSignals,
  buildPersonalizationInsights,
  deriveAdaptiveProfileUpdates,
  type PersonalizationSignals,
} from "@/utils/personalizationEngine";

export function buildExperienceRecommendations(
  entry: CheckInEntry,
  profile: UserProfile,
  signals?: PersonalizationSignals,
): ExperienceRecommendation {
  const suggestions: string[] = [];
  const logSignals =
    signals ??
    analyzePersonalizationSignals({
      mealTracking: {},
      dailyPlans: {},
      plannedMeals: [],
      todayDateKey: entry.submittedAt.slice(0, 10),
    });

  const profileUpdates = deriveAdaptiveProfileUpdates(profile, logSignals, entry);

  if (entry.mealVarietySatisfaction <= 5) {
    suggestions.push(
      "Meals felt repetitive — update cuisines and food preferences, then regenerate your week for more variety.",
    );
  }

  if (entry.planEaseOfUse <= 5) {
    suggestions.push(
      "Following the plan felt hard — batch-cooking one lunch or dinner and locking meals you like can simplify your week.",
    );
  }

  if (entry.recipeEnjoyment <= 5) {
    suggestions.push(
      "Suggested meals weren't hitting the mark — refine food preferences in check-in and mark dislikes on recipe cards.",
    );
  }

  if (entry.hungerManagement <= 4) {
    suggestions.push(
      "You reported often feeling too hungry — a modest calorie increase may improve satiety (see calorie suggestions).",
    );
  } else if (entry.hungerManagement >= 9 && profile.goal === "lose") {
    suggestions.push(
      "Hunger was well managed — you're in a good spot to stay consistent without feeling deprived.",
    );
  }

  if (entry.proteinAdherence <= 5 && !profile.prioritizeMinProtein && !profileUpdates.prioritizeMinProtein) {
    suggestions.push(
      "Protein was a struggle — enable “Prioritize minimum protein target” in Settings to build more protein-forward plans.",
    );
  }

  if (entry.mealVarietySatisfaction <= 6 && !profile.weeklyMealPrepEnabled && !profileUpdates.weeklyMealPrepEnabled) {
    suggestions.push(
      "Batch-cooking one lunch or dinner for a few days can reduce decision fatigue while keeping variety elsewhere.",
    );
  }

  if (entry.planEaseOfUse <= 6 && !profile.prioritizeMinimalPrep && !profileUpdates.prioritizeMinimalPrep) {
    suggestions.push(
      "Enable quick & minimal prep in Settings if you want more no-cook and under-30-minute meals.",
    );
  }

  if (entry.sleepQuality <= 4) {
    suggestions.push(
      "Sleep was low — recovery affects hunger and training. Avoid aggressive calorie cuts until sleep improves.",
    );
  }

  const insightMessages = buildPersonalizationInsights({
    profile: { ...profile, ...profileUpdates },
    signals: logSignals,
    checkInEntry: entry,
    favoriteIds: [],
    source: "check_in",
  }).map((i) => i.message);

  for (const line of insightMessages) {
    if (!suggestions.includes(line)) suggestions.push(line);
  }

  if (entry.experienceNotes.trim()) {
    profileUpdates.lastExperienceNotes = entry.experienceNotes.trim();
    suggestions.push(
      `We saved your note: “${entry.experienceNotes.trim().slice(0, 120)}${entry.experienceNotes.length > 120 ? "…" : ""}” — we'll factor your stated preferences into future plans.`,
    );
  }

  if (suggestions.length === 0) {
    suggestions.push(
      "Your experience scores look solid — keep logging meals and favorites so plans stay personalized.",
    );
  }

  return {
    suggestions,
    profileUpdates,
  };
}
