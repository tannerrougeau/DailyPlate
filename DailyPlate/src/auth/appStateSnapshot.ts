import type { AppState } from "@/store/useAppStore";
import type { SavedAccountState } from "./types";

export function snapshotAppState(
  s: Pick<
    AppState,
    | "onboardingComplete"
    | "userProfile"
    | "targets"
    | "todayDateKey"
    | "plannedMeals"
    | "dailyPlans"
    | "lockedDays"
    | "lockedMeals"
    | "selectedPlanDateKey"
    | "grocerySelectedDateKeys"
    | "groceryCheckedKeys"
    | "groceryOwnedKeys"
    | "pantryCheckedKeys"
    | "userRecipes"
    | "todayHouseholdOverride"
    | "dismissedUsageNotes"
    | "favoriteIds"
    | "dislikedIds"
    | "profileAnchoredAt"
    | "tdeeFeedbackHistory"
    | "lastFeedbackSubmittedAt"
    | "lastFeedbackPromptDismissedAt"
    | "adaptiveTdeeEstimate"
  >,
): SavedAccountState {
  return {
    onboardingComplete: s.onboardingComplete,
    userProfile: s.userProfile,
    targets: s.targets,
    todayDateKey: s.todayDateKey,
    plannedMeals: s.plannedMeals,
    dailyPlans: s.dailyPlans,
    lockedDays: s.lockedDays,
    lockedMeals: s.lockedMeals,
    selectedPlanDateKey: s.selectedPlanDateKey,
    grocerySelectedDateKeys: s.grocerySelectedDateKeys,
    groceryCheckedKeys: s.groceryCheckedKeys,
    groceryOwnedKeys: s.groceryOwnedKeys,
    pantryCheckedKeys: s.pantryCheckedKeys,
    userRecipes: s.userRecipes,
    todayHouseholdOverride: s.todayHouseholdOverride,
    dismissedUsageNotes: s.dismissedUsageNotes,
    favoriteIds: s.favoriteIds,
    dislikedIds: s.dislikedIds,
    profileAnchoredAt: s.profileAnchoredAt,
    tdeeFeedbackHistory: s.tdeeFeedbackHistory,
    lastFeedbackSubmittedAt: s.lastFeedbackSubmittedAt,
    lastFeedbackPromptDismissedAt: s.lastFeedbackPromptDismissedAt,
    adaptiveTdeeEstimate: s.adaptiveTdeeEstimate,
  };
}

export function savedStateToPatch(state: SavedAccountState): Partial<AppState> {
  return {
    onboardingComplete: state.onboardingComplete,
    userProfile: state.userProfile,
    targets: state.targets,
    todayDateKey: state.todayDateKey,
    plannedMeals: state.plannedMeals,
    dailyPlans: state.dailyPlans,
    lockedDays: state.lockedDays,
    lockedMeals: state.lockedMeals,
    selectedPlanDateKey: state.selectedPlanDateKey,
    grocerySelectedDateKeys: state.grocerySelectedDateKeys,
    groceryCheckedKeys: state.groceryCheckedKeys,
    groceryOwnedKeys: state.groceryOwnedKeys ?? [],
    pantryCheckedKeys: state.pantryCheckedKeys ?? [],
    userRecipes: state.userRecipes ?? [],
    todayHouseholdOverride: state.todayHouseholdOverride ?? null,
    dismissedUsageNotes: state.dismissedUsageNotes,
    favoriteIds: state.favoriteIds,
    dislikedIds: state.dislikedIds,
    profileAnchoredAt: state.profileAnchoredAt,
    tdeeFeedbackHistory: state.tdeeFeedbackHistory,
    lastFeedbackSubmittedAt: state.lastFeedbackSubmittedAt,
    lastFeedbackPromptDismissedAt: state.lastFeedbackPromptDismissedAt,
    adaptiveTdeeEstimate: state.adaptiveTdeeEstimate,
    nav: "today",
  };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validateAccountCredentials(
  email: string,
  password: string,
): "ok" | "invalid" {
  if (!isValidEmail(email) || password.length < 6) return "invalid";
  return "ok";
}
