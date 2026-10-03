import type { WeightUnit } from "@/utils/bodyMeasurements";

/** @deprecated Use CHECK_IN_DISCLAIMER from @/checkIn/questionnaire */
export const TDEE_FEEDBACK_DISCLAIMER =
  "Scientific formulas give a good starting point, but individual results vary. Your check-in responses are saved to your profile and help personalize targets over time.";

export const MIN_FEEDBACK_FOR_ADAPTIVE = 2;
export const MIN_WEEKS_FOR_ADAPTIVE = 4;

export type WeightChangeDirection = "lost" | "gained" | "same";
export type ActivityChangeOption = "none" | "more" | "less" | "other";
export type LeftoversFeltRepetitive = "yes" | "somewhat" | "no";

/** Saved check-in response (persisted per user / account). */
export interface CheckInEntry {
  id: string;
  submittedAt: string;
  periodDays: number;
  calorieTargetAtSubmit: number;
  weightChangeDirection: WeightChangeDirection;
  weightChangeAmount: number | null;
  weightChangeUnit: WeightUnit;
  /** 5 for current check-ins; missing or 10 means convert from the old 1–10 scale. */
  scaleMax?: 5 | 10;
  energyLevel: number;
  calorieAdherence: number;
  proteinAdherence: number;
  activityChange: ActivityChangeOption;
  activityChangeNotes: string;
  sleepQuality: number;
  strengthProgress: number;
  strengthNotes: string;
  /** User experience refinement (1–5 scales; older rows may still be 1–10). */
  mealVarietySatisfaction: number;
  planEaseOfUse: number;
  recipeEnjoyment: number;
  hungerManagement: number;
  experienceNotes: string;
  timesShoppedThisWeek?: number;
  timesCookedThisWeek?: number;
  leftoversFeltRepetitive?: LeftoversFeltRepetitive;
}

/** @deprecated Use CheckInEntry */
export type TdeeFeedbackEntry = CheckInEntry;

export type CheckInEntryInput = Omit<CheckInEntry, "id" | "submittedAt" | "periodDays">;

export interface CalorieRecommendation {
  suggestedCalories: number;
  deltaCalories: number;
  reasoning: string[];
  usedAdaptiveModel: boolean;
  estimatedTdee: number | null;
}

export interface ExperienceRecommendation {
  suggestions: string[];
  profileUpdates: Partial<import("@/types/profile").UserProfile>;
}

export interface CheckInResult {
  calorie: CalorieRecommendation;
  experience: ExperienceRecommendation;
  entry: CheckInEntry;
}
