import type { DailyTargets, PlannedMeal, Recipe } from "@/types";
import type { UserProfile } from "@/types/profile";
import type { TdeeFeedbackEntry } from "@/types/tdeeFeedback";
import type { UsageNoteKey } from "@/store/useAppStore";

export interface AuthSession {
  email: string;
}

export interface SavedAccountState {
  onboardingComplete: boolean;
  userProfile: UserProfile | null;
  targets: DailyTargets;
  todayDateKey: string;
  plannedMeals: PlannedMeal[];
  dailyPlans: Record<string, PlannedMeal[]>;
  lockedDays: string[];
  lockedMeals: string[];
  selectedPlanDateKey: string | null;
  grocerySelectedDateKeys: string[];
  groceryCheckedKeys: string[];
  groceryOwnedKeys?: string[];
  pantryCheckedKeys?: string[];
  userRecipes?: Recipe[];
  dismissedUsageNotes: Record<UsageNoteKey, boolean>;
  favoriteIds: string[];
  dislikedIds: string[];
  profileAnchoredAt: string | null;
  tdeeFeedbackHistory: TdeeFeedbackEntry[];
  lastFeedbackSubmittedAt: string | null;
  lastFeedbackPromptDismissedAt: string | null;
  adaptiveTdeeEstimate: number | null;
}

export interface StoredAccount {
  email: string;
  passwordHash: string;
  savedAt: string;
  state: SavedAccountState;
}

export type LoginResult = "ok" | "not-found" | "invalid";
export type RegisterResult = "ok" | "exists" | "invalid";
