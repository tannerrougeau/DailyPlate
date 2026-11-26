import type { MealSizes, UserProfile } from "@/types/profile";
import { applyFitAnswers, type FitAnswers } from "@/utils/fitYourLife";
import type { Question } from "@/utils/questionQueue";
import {
  profilePatchFromRefine,
  type HouseholdCardValue,
  type RefineCardValues,
} from "@/components/ProfileRefineCards";
import { migrateProteinPreference } from "@/utils/proteinMinimum";

/**
 * Personalization questions, asked one at a time after "Personalized" in onboarding (most
 * plan-changing first). "avoid" is asked of everyone right after meals, so it's not in this list.
 */
export type PersonalizeTopic =
  | "sizes"
  | "love"
  | "mealSources"
  | "cookingAmount"
  | "cookingLimits"
  | "budget"
  | "cuisines"
  | "rhythm"
  | "household"
  | "targets";

export type TopicId = PersonalizeTopic | "avoid";

export const TOPIC_ORDER: PersonalizeTopic[] = [
  "sizes",
  "love",
  "mealSources",
  "cookingAmount",
  "cookingLimits",
  "budget",
  "cuisines",
  "rhythm",
  "household",
  "targets",
];

export const TOPIC_TITLE: Record<TopicId, string> = {
  avoid: "Any foods to avoid?",
  sizes: "How big should each meal be?",
  love: "Foods you love",
  mealSources: "How do you usually get each meal?",
  cookingAmount: "How much cooking works for you?",
  cookingLimits: "Anything that limits cooking?",
  budget: "Food budget?",
  cuisines: "Cuisines you like",
  rhythm: "How often do you shop and cook?",
  household: "About the people you cook for",
  targets: "Fine-tune your targets",
};

/** The question-queue card for a topic skipped or not reached in onboarding. */
export const TOPIC_ASK: Record<PersonalizeTopic, string> = {
  sizes: "Want to set Light, Normal or Large for each meal?",
  love: "Want to tell DailyPlate which foods you love?",
  mealSources: "Want to tell DailyPlate how you usually get each meal?",
  cookingAmount: "Want to tell DailyPlate how much cooking works for you?",
  cookingLimits: "Anything that limits your cooking? Want to tell DailyPlate?",
  budget: "Want to set a food budget for your plans?",
  cuisines: "Want to pick cuisines you like?",
  rhythm: "Want to set how often you shop and cook?",
  household: "Want to add details about the people you cook for?",
  targets: "Want to fine-tune your calorie and protein targets?",
};

/** The topics asked for this household (household details only when more than one person eats). */
export function topicsFor(householdPeople: number): PersonalizeTopic[] {
  return TOPIC_ORDER.filter((t) => t !== "household" || householdPeople > 1);
}

/** Skipped, or not reached before "I'm done for now". */
export function unansweredTopics(asked: PersonalizeTopic[], answered: ReadonlySet<PersonalizeTopic>): PersonalizeTopic[] {
  return asked.filter((t) => !answered.has(t));
}

export function topicQuestionId(topic: PersonalizeTopic): string {
  return `topic:${topic}`;
}

/** Queue cards for unanswered topics. Yes opens that same question on Today. */
export function topicQuestions(topics: PersonalizeTopic[], now: Date): Question[] {
  return topics.map((topic) => ({
    id: topicQuestionId(topic),
    text: TOPIC_ASK[topic],
    why: "You skipped this during setup.",
    source: "onboarding",
    change: { kind: "askTopic", topic },
    addedAt: now.toISOString(),
  }));
}

/** Everything a topic screen edits. */
export type PersonalizeDraft = {
  refine: RefineCardValues;
  fit: FitAnswers;
  mealSizes: MealSizes;
  household: HouseholdCardValue | null;
};

const FIT_KEYS: Partial<Record<TopicId, keyof FitAnswers>> = {
  mealSources: "mealSources",
  cookingAmount: "cookingAmount",
  cookingLimits: "cookingLimits",
  budget: "budget",
};

/** The profile with one topic's answer applied; nothing else changes. */
export function applyTopic(profile: UserProfile, topic: TopicId, draft: PersonalizeDraft): UserProfile {
  const fitKey = FIT_KEYS[topic];
  if (fitKey) return applyFitAnswers(profile, { [fitKey]: draft.fit[fitKey] } as FitAnswers);
  if (topic === "sizes") return { ...profile, mealSizes: draft.mealSizes, mealTiming: null };
  if (topic === "household") {
    const h = draft.household;
    if (!h) return profile;
    return {
      ...profile,
      householdMembers: h.members,
      householdFoodAvoidChips: h.avoidChips,
      householdFoodAvoidCustom: h.avoidCustom,
    };
  }
  const full = profilePatchFromRefine(draft.refine, {
    weightKg: profile.weightKg,
    heightCm: profile.heightCm,
    goal: profile.goal,
    proteinPreference: migrateProteinPreference(profile.proteinPreference),
  });
  const {
    favoriteFoodChips,
    dislikedFoodChips,
    favoriteFoodCustom,
    dislikedFoodCustom,
    preferredCuisines,
    avoidedProteinSources,
    knownTdeeKcal,
    macroSplitPreference,
    prioritizeMinProtein,
    minimumProteinCustom,
    minimumProteinGrams,
    ...rhythm
  } = full;
  switch (topic) {
    case "love":
      return { ...profile, favoriteFoodChips: favoriteFoodChips ?? [], favoriteFoodCustom };
    case "avoid":
      return { ...profile, dislikedFoodChips: dislikedFoodChips ?? [], dislikedFoodCustom, avoidedProteinSources };
    case "cuisines":
      return { ...profile, preferredCuisines };
    case "rhythm":
      return { ...profile, ...rhythm };
    case "targets":
      return { ...profile, knownTdeeKcal, macroSplitPreference, prioritizeMinProtein, minimumProteinCustom, minimumProteinGrams };
    default:
      return profile;
  }
}
