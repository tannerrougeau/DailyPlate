import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DailyTargets, DayMealTracking, MealSlotId, MealTrackingEntry, PlannedMeal, Recipe } from "@/types";
import type { UserProfile } from "@/types/profile";
import { recipeLibrary } from "@/recipes/recipeLibrary";
import {
  type GenerateOptions,
  generateDayPlan,
  generateSlotsPlan,
  pickRecipeForSlot,
  slotsForMealsPerDay,
  sumPlannedMacros,
} from "@/utils/generateDayPlan";
import { isMealLocked, mealLockKey } from "@/utils/mealLocks";
import type {
  CalorieRecommendation,
  CheckInEntry,
  CheckInEntryInput,
  CheckInResult,
} from "@/types/tdeeFeedback";
import { buildExperienceRecommendations } from "@/utils/checkInExperience";
import {
  buildCalorieRecommendation,
  daysBetweenDates,
  targetsWithCalories,
} from "@/utils/adaptiveTdee";
import { computeDailyTargets } from "@/utils/tdee";
import { fromDateKey, toDateKey, weekDateKeys } from "@/utils/date";
import {
  applyWeeklyMealPrepToPlans,
  groupDateKeysByWeek,
} from "@/utils/weeklyMealPrep";
import {
  applyLowComplexityFromDay,
  applyLowComplexityToPlans,
} from "@/utils/lowComplexityPlan";
import { applyMacroRedistribution } from "@/utils/macroRedistribution";
import { createPlannedMeal, resolveVariationId } from "@/utils/recipeDisplay";
import { effectiveMinimumProteinGrams } from "@/utils/proteinMinimum";
import {
  analyzePersonalizationSignals,
  buildPersonalizationInsights,
  deriveAdaptiveProfileUpdates,
  pickPrimaryInsight,
  type PersonalizationInsight,
} from "@/utils/personalizationEngine";
import {
  buildRecipePreferenceInsight,
  profileUpdatesForDislike,
  profileUpdatesForFavorite,
} from "@/utils/recipePreferenceSync";
import {
  accountExists,
  getAccount,
  hashPassword,
  saveAccount,
  verifyPassword,
} from "@/auth/accountStorage";
import {
  savedStateToPatch,
  snapshotAppState,
  validateAccountCredentials,
} from "@/auth/appStateSnapshot";
import type { AuthSession, LoginResult, RegisterResult } from "@/auth/types";

export type NavTab = "today" | "plan" | "recipes" | "grocery" | "guide";
export type UsageNoteKey = "today" | "plan" | "recipes" | "grocery";

function mealsForDate(
  s: Pick<AppState, "dailyPlans" | "plannedMeals" | "todayDateKey">,
  dateKey: string,
): PlannedMeal[] {
  return s.dailyPlans[dateKey] ?? (dateKey === s.todayDateKey ? s.plannedMeals : []);
}

function applyDayMealsClear(
  state: Pick<
    AppState,
    "dailyPlans" | "plannedMeals" | "todayDateKey" | "lockedDays" | "lockedMeals" | "macroRedistributionNotices"
  >,
  dateKey: string,
): Pick<AppState, "dailyPlans" | "plannedMeals" | "macroRedistributionNotices"> | null {
  if (state.lockedDays.includes(dateKey)) return null;
  const existing = mealsForDate(state, dateKey);
  const preserved = existing.filter((m) =>
    isMealLocked(state.lockedMeals, dateKey, m.slot),
  );
  const nextDailyPlans = { ...state.dailyPlans };
  if (preserved.length === 0) {
    delete nextDailyPlans[dateKey];
  } else {
    nextDailyPlans[dateKey] = preserved;
  }
  return {
    dailyPlans: nextDailyPlans,
    plannedMeals: dateKey === state.todayDateKey ? preserved : state.plannedMeals,
    macroRedistributionNotices: state.macroRedistributionNotices.filter(
      (k) => k !== dateKey,
    ),
  };
}

function clearDayTracking(
  tracking: Record<string, DayMealTracking>,
  dateKey: string,
): Record<string, DayMealTracking> {
  if (!tracking[dateKey]) return tracking;
  const next = { ...tracking };
  delete next[dateKey];
  return next;
}

function setDayMeals(
  state: Pick<AppState, "dailyPlans" | "plannedMeals" | "todayDateKey">,
  dateKey: string,
  meals: PlannedMeal[],
): Pick<AppState, "dailyPlans" | "plannedMeals"> {
  const nextDailyPlans = { ...state.dailyPlans };
  if (meals.length === 0) {
    delete nextDailyPlans[dateKey];
  } else {
    nextDailyPlans[dateKey] = meals;
  }
  return {
    dailyPlans: nextDailyPlans,
    plannedMeals: dateKey === state.todayDateKey ? meals : state.plannedMeals,
  };
}

function clearSlotTracking(
  tracking: Record<string, DayMealTracking>,
  dateKey: string,
  slot: MealSlotId,
): Record<string, DayMealTracking> {
  const day = tracking[dateKey];
  if (!day?.[slot]) return tracking;
  const nextDay = { ...day };
  delete nextDay[slot];
  const next = { ...tracking };
  if (Object.keys(nextDay).length === 0) {
    delete next[dateKey];
  } else {
    next[dateKey] = nextDay;
  }
  return next;
}

function buildSlotReplacementMeals(
  state: Pick<
    AppState,
    | "lockedMeals"
    | "userProfile"
    | "targets"
    | "dailyPlans"
    | "plannedMeals"
    | "todayDateKey"
    | "favoriteIds"
    | "dislikedIds"
    | "mealTracking"
  >,
  dateKey: string,
  slot: MealSlotId,
  recipe: Recipe,
): { meals: PlannedMeal[]; redistributed: boolean } | null {
  const opts = buildGenerateOptions(state);
  if (!opts) return null;
  const base = mealsForDate(state, dateKey);
  const others = base.filter((m) => m.slot !== slot);
  const lockedSlots = new Set(
    base
      .filter((m) => isMealLocked(state.lockedMeals, dateKey, m.slot))
      .map((m) => m.slot),
  );
  const draft = [
    ...others,
    createPlannedMeal(slot, recipe, { scale: 1, mealPrep: undefined }),
  ];
  const order = slotsForMealsPerDay(state.userProfile!.mealsPerDay);
  const sorted = draft.sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot));
  return applyMacroRedistribution(sorted, state.targets, opts, recipeLibrary, lockedSlots);
}

export type DayPlanBuildResult = {
  meals: PlannedMeal[];
  redistributed: boolean;
};

export type GenerateDayResult =
  | { ok: true; dateKey: string }
  | { ok: false; reason: "locked_day" | "no_profile" | "nothing_generated" };

export type GenerateOverrides = {
  lowComplexity?: boolean;
};

function buildDayPlanRespectingLocks(
  state: Pick<
    AppState,
    | "favoriteIds"
    | "dislikedIds"
    | "userProfile"
    | "targets"
    | "lockedMeals"
    | "dailyPlans"
    | "plannedMeals"
    | "todayDateKey"
    | "mealTracking"
  >,
  dateKey: string,
  overrides?: GenerateOverrides,
): DayPlanBuildResult | null {
  const opts = buildGenerateOptions(state, overrides);
  if (!opts) return null;

  const existing = mealsForDate(state, dateKey);
  const preserved = existing.filter((m) => isMealLocked(state.lockedMeals, dateKey, m.slot));
  const lockedSlots = new Set(preserved.map((m) => m.slot));
  const slotsToFill = opts.slots.filter((s) => !lockedSlots.has(s));

  if (slotsToFill.length === 0) {
    return preserved.length > 0 ? { meals: preserved, redistributed: false } : null;
  }

  let merged: PlannedMeal[];
  if (preserved.length === 0) {
    // Full day replacement — discard any existing unlocked meals.
    merged = generateDayPlan(recipeLibrary, state.targets, opts);
  } else {
    const preservedCals = sumPlannedMacros(preserved).calories;
    const calorieBudget = Math.max(300, state.targets.calories - preservedCals);
    const usedIds = new Set(preserved.map((m) => m.recipe.id));
    const fresh = generateSlotsPlan(
      recipeLibrary,
      calorieBudget,
      opts,
      slotsToFill,
      usedIds,
    );
    const order = opts.slots;
    merged = [...preserved, ...fresh].sort(
      (a, b) => order.indexOf(a.slot) - order.indexOf(b.slot),
    );
  }

  const { meals, redistributed } = applyMacroRedistribution(
    merged,
    state.targets,
    opts,
    recipeLibrary,
    lockedSlots,
  );
  return { meals, redistributed };
}

function buildGenerateOptions(
  s: Pick<
    AppState,
    | "favoriteIds"
    | "dislikedIds"
    | "userProfile"
    | "mealTracking"
    | "dailyPlans"
    | "plannedMeals"
    | "todayDateKey"
  >,
  overrides?: GenerateOverrides,
): GenerateOptions | null {
  if (!s.userProfile) return null;
  const minimumProteinGrams = effectiveMinimumProteinGrams(s.userProfile);
  const signals = analyzePersonalizationSignals({
    mealTracking: s.mealTracking,
    dailyPlans: s.dailyPlans,
    plannedMeals: s.plannedMeals,
    todayDateKey: s.todayDateKey,
  });
  const lowComplexity =
    overrides?.lowComplexity ?? s.userProfile.lowComplexityEnabled === true;
  return {
    dislikedIds: s.dislikedIds,
    dislikedChips: s.userProfile.dislikedFoodChips,
    dislikedCustom: s.userProfile.dislikedFoodCustom ?? "",
    favoriteIds: s.favoriteIds,
    favoriteChips: s.userProfile.favoriteFoodChips,
    favoriteCustom: s.userProfile.favoriteFoodCustom ?? "",
    slots: slotsForMealsPerDay(s.userProfile.mealsPerDay),
    mealTiming: s.userProfile.mealTiming,
    prioritizeMinProtein: s.userProfile.prioritizeMinProtein === true,
    minimumProteinGrams,
    lowComplexity,
    personalization: {
      profile: s.userProfile,
      signals,
    },
  };
}

function computePersonalizationInsight(
  state: Pick<
    AppState,
    | "userProfile"
    | "mealTracking"
    | "dailyPlans"
    | "plannedMeals"
    | "todayDateKey"
    | "favoriteIds"
    | "tdeeFeedbackHistory"
  >,
  source: "check_in" | "tracking" | "profile",
  checkInEntry?: CheckInEntry,
): PersonalizationInsight | null {
  if (!state.userProfile) return null;
  const signals = analyzePersonalizationSignals({
    mealTracking: state.mealTracking,
    dailyPlans: state.dailyPlans,
    plannedMeals: state.plannedMeals,
    todayDateKey: state.todayDateKey,
  });
  const insights = buildPersonalizationInsights({
    profile: state.userProfile,
    signals,
    checkInEntry: checkInEntry ?? state.tdeeFeedbackHistory.at(-1),
    favoriteIds: state.favoriteIds,
    source,
  });
  return pickPrimaryInsight(insights);
}

export interface AppState {
  nav: NavTab;
  authSession: AuthSession | null;
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
  /** Items checked off while shopping this trip — stay visible in the list. */
  groceryCheckedKeys: string[];
  /** Items already at home — hidden from the active shopping list. */
  groceryOwnedKeys: string[];
  /** dateKey → slot → log entry */
  mealTracking: Record<string, DayMealTracking>;
  dismissedUsageNotes: Record<UsageNoteKey, boolean>;
  favoriteIds: string[];
  dislikedIds: string[];
  profileAnchoredAt: string | null;
  tdeeFeedbackHistory: CheckInEntry[];
  lastFeedbackSubmittedAt: string | null;
  lastFeedbackPromptDismissedAt: string | null;
  adaptiveTdeeEstimate: number | null;
  macroRedistributionNotices: string[];
  personalizationInsight: PersonalizationInsight | null;
  setNav: (tab: NavTab) => void;
  setTargets: (t: Partial<DailyTargets>) => void;
  setUserProfile: (p: UserProfile) => void;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  registerAccount: (email: string, password: string) => Promise<RegisterResult>;
  syncAccountSnapshot: () => Promise<void>;
  finishOnboarding: () => void;
  setTodayDateKey: (key: string) => void;
  setSelectedPlanDateKey: (key: string | null) => void;
  dismissUsageNote: (key: UsageNoteKey) => void;
  dismissMacroRedistributionNotice: (dateKey: string) => void;
  refreshPersonalization: (source?: "check_in" | "tracking" | "profile") => void;
  dismissPersonalizationInsight: () => void;
  generateDay: (dateKey?: string, overrides?: GenerateOverrides) => GenerateDayResult;
  generateWeek: (anchorDate?: Date, overrides?: GenerateOverrides) => void;
  clearDayMeals: (dateKey: string) => void;
  clearWeekMeals: (anchorDate: Date) => void;
  generateMonth: (anchorDate?: Date, overrides?: GenerateOverrides) => void;
  toggleFavorite: (recipeId: string) => void;
  toggleDislike: (recipeId: string) => void;
  regenerateSlot: (slot: PlannedMeal["slot"], dateKey?: string) => void;
  replaceMealSlot: (dateKey: string, slot: MealSlotId, recipeId: string) => void;
  removeMealSlot: (dateKey: string, slot: MealSlotId) => void;
  setMealVariation: (
    dateKey: string,
    slot: PlannedMeal["slot"],
    variationId: string,
  ) => void;
  setMealCarbVariation: (
    dateKey: string,
    slot: PlannedMeal["slot"],
    carbVariationId: import("@/types").CarbVariationId,
  ) => void;
  swapMealSlots: (dateKey: string, slotA: MealSlotId, slotB: MealSlotId) => void;
  moveMealToSlot: (
    fromDateKey: string,
    fromSlot: MealSlotId,
    toDateKey: string,
    toSlot: MealSlotId,
  ) => void;
  toggleDayLock: (dateKey: string) => void;
  toggleMealLock: (dateKey: string, slot: PlannedMeal["slot"]) => void;
  toggleGroceryDateSelected: (dateKey: string) => void;
  setGrocerySelectedDateKeys: (keys: string[]) => void;
  toggleGroceryItemChecked: (itemKey: string) => void;
  toggleGroceryItemOwned: (itemKey: string) => void;
  setMealTracking: (
    dateKey: string,
    slot: MealSlotId,
    entry: MealTrackingEntry | null,
  ) => void;
  clearGroceryAll: () => void;
  dismissFeedbackPrompt: () => void;
  submitCheckIn: (
    entry: CheckInEntryInput,
    profileUpdates: Partial<UserProfile>,
  ) => CheckInResult;
  /** @deprecated Use submitCheckIn */
  submitTdeeFeedback: (entry: CheckInEntryInput) => CalorieRecommendation;
  applyCalorieRecommendation: (calories: number) => void;
  assignMealPrepBatch: (params: {
    recipe: Recipe;
    slot: MealSlotId;
    portionsCooked: number;
    dateKeys: string[];
    scale?: number;
  }) => void;
}

const defaultTargets: DailyTargets = {
  calories: 2200,
  protein: 165,
  carbs: 220,
  fat: 73,
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      nav: "today",
      authSession: null,
      onboardingComplete: false,
      userProfile: null,
      targets: defaultTargets,
      todayDateKey: toDateKey(new Date()),
      plannedMeals: [],
      dailyPlans: {},
      lockedDays: [],
      lockedMeals: [],
      selectedPlanDateKey: null,
      grocerySelectedDateKeys: [],
      groceryCheckedKeys: [],
      groceryOwnedKeys: [],
      mealTracking: {},
      dismissedUsageNotes: {
        today: false,
        plan: false,
        recipes: false,
        grocery: false,
      },
      favoriteIds: [],
      dislikedIds: [],
      profileAnchoredAt: null,
      tdeeFeedbackHistory: [],
      lastFeedbackSubmittedAt: null,
      lastFeedbackPromptDismissedAt: null,
      adaptiveTdeeEstimate: null,
      macroRedistributionNotices: [],
      personalizationInsight: null,

      setNav: (tab) => set({ nav: tab }),

      setTargets: (partial) =>
        set((s) => ({
          targets: { ...s.targets, ...partial },
        })),

      setUserProfile: (p) => {
        set({ userProfile: p });
        const insight = computePersonalizationInsight(get(), "profile");
        if (insight) set({ personalizationInsight: insight });
      },

      login: async (email, password) => {
        if (validateAccountCredentials(email, password) !== "ok") return "invalid";
        const account = getAccount(email);
        if (!account) return "not-found";
        if (!(await verifyPassword(account, password))) return "invalid";
        const normalized = email.trim().toLowerCase();
        set({
          ...savedStateToPatch(account.state),
          authSession: { email: normalized },
        });
        return "ok";
      },

      logout: () => {
        set({
          authSession: null,
          onboardingComplete: false,
          userProfile: null,
          targets: defaultTargets,
          plannedMeals: [],
          dailyPlans: {},
          lockedDays: [],
          lockedMeals: [],
          selectedPlanDateKey: null,
          grocerySelectedDateKeys: [],
          groceryCheckedKeys: [],
          groceryOwnedKeys: [],
          mealTracking: {},
          favoriteIds: [],
          dislikedIds: [],
          profileAnchoredAt: null,
          tdeeFeedbackHistory: [],
          lastFeedbackSubmittedAt: null,
          lastFeedbackPromptDismissedAt: null,
          adaptiveTdeeEstimate: null,
          personalizationInsight: null,
          nav: "today",
        });
      },

      registerAccount: async (email, password) => {
        if (validateAccountCredentials(email, password) !== "ok") return "invalid";
        const normalized = email.trim().toLowerCase();
        if (accountExists(normalized)) return "exists";
        const state = get();
        const saved = snapshotAppState(state);
        if (state.userProfile) {
          saved.onboardingComplete = true;
        }
        const passwordHash = await hashPassword(password);
        saveAccount({
          email: normalized,
          passwordHash,
          savedAt: new Date().toISOString(),
          state: saved,
        });
        set({ authSession: { email: normalized } });
        return "ok";
      },

      syncAccountSnapshot: async () => {
        const { authSession } = get();
        if (!authSession) return;
        const account = getAccount(authSession.email);
        if (!account) return;
        saveAccount({
          ...account,
          savedAt: new Date().toISOString(),
          state: snapshotAppState(get()),
        });
      },

      finishOnboarding: () => {
        set((s) => ({
          onboardingComplete: true,
          nav: "today",
          profileAnchoredAt: s.profileAnchoredAt ?? new Date().toISOString(),
        }));
        void get().syncAccountSnapshot();
      },

      setTodayDateKey: (key) => set({ todayDateKey: key }),
      setSelectedPlanDateKey: (key) => set({ selectedPlanDateKey: key }),
      dismissUsageNote: (key) =>
        set((s) => ({
          dismissedUsageNotes: { ...s.dismissedUsageNotes, [key]: true },
        })),

      dismissMacroRedistributionNotice: (dateKey) =>
        set((s) => ({
          macroRedistributionNotices: s.macroRedistributionNotices.filter((k) => k !== dateKey),
        })),

      refreshPersonalization: (source = "tracking") => {
        const state = get();
        const insight = computePersonalizationInsight(state, source);
        if (insight) set({ personalizationInsight: insight });
      },

      dismissPersonalizationInsight: () => set({ personalizationInsight: null }),

      generateDay: (dateKey, overrides) => {
        const state = get();
        const targetDateKey = dateKey ?? state.todayDateKey;
        if (state.lockedDays.includes(targetDateKey)) {
          return { ok: false, reason: "locked_day" };
        }
        if (!state.userProfile) {
          return { ok: false, reason: "no_profile" };
        }
        const opts = buildGenerateOptions(state, overrides);
        if (!opts) {
          return { ok: false, reason: "no_profile" };
        }
        const built = buildDayPlanRespectingLocks(state, targetDateKey, overrides);
        if (!built) {
          return { ok: false, reason: "nothing_generated" };
        }
        const anchor = fromDateKey(targetDateKey);
        const weekKeys = weekDateKeys(anchor);
        let nextDailyPlans = {
          ...state.dailyPlans,
          [targetDateKey]: built.meals,
        };
        if (opts.lowComplexity) {
          nextDailyPlans = applyLowComplexityFromDay(
            targetDateKey,
            nextDailyPlans,
            weekKeys,
            state.userProfile,
            opts,
            state.lockedDays,
            state.lockedMeals,
            state.targets.calories,
          );
        }
        const finalMeals = nextDailyPlans[targetDateKey] ?? built.meals;
        set((s) => ({
          plannedMeals: targetDateKey === s.todayDateKey ? finalMeals : s.plannedMeals,
          dailyPlans: nextDailyPlans,
          macroRedistributionNotices: built.redistributed
            ? [...new Set([...s.macroRedistributionNotices, targetDateKey])]
            : s.macroRedistributionNotices,
          mealTracking: clearDayTracking(s.mealTracking, targetDateKey),
          grocerySelectedDateKeys: s.grocerySelectedDateKeys.includes(targetDateKey)
            ? s.grocerySelectedDateKeys
            : [...s.grocerySelectedDateKeys, targetDateKey].sort(),
        }));
        void get().syncAccountSnapshot();
        return { ok: true, dateKey: targetDateKey };
      },

      generateWeek: (anchorDate = new Date(), overrides) => {
        const state = get();
        const opts = buildGenerateOptions(state, overrides);
        if (!opts || !state.userProfile) return;
        const keys = weekDateKeys(anchorDate);
        let nextDailyPlans = { ...state.dailyPlans };
        const noticeKeys: string[] = [];
        for (const key of keys) {
          if (state.lockedDays.includes(key)) continue;
          const built = buildDayPlanRespectingLocks(state, key, overrides);
          if (built) {
            nextDailyPlans[key] = built.meals;
            if (built.redistributed) noticeKeys.push(key);
          }
        }
        nextDailyPlans = applyWeeklyMealPrepToPlans(
          keys,
          nextDailyPlans,
          state.userProfile,
          opts,
          state.lockedDays,
          state.targets.calories,
        );
        nextDailyPlans = applyLowComplexityToPlans(
          keys,
          nextDailyPlans,
          state.userProfile,
          opts,
          state.lockedDays,
          state.lockedMeals,
          state.targets.calories,
        );
        set((s) => ({
          dailyPlans: nextDailyPlans,
          plannedMeals: nextDailyPlans[s.todayDateKey] ?? s.plannedMeals,
          macroRedistributionNotices:
            noticeKeys.length > 0
              ? [...new Set([...s.macroRedistributionNotices, ...noticeKeys])]
              : s.macroRedistributionNotices,
        }));
      },

      clearDayMeals: (dateKey) => {
        const state = get();
        const patch = applyDayMealsClear(state, dateKey);
        if (!patch) return;
        set(patch);
        void get().syncAccountSnapshot();
      },

      clearWeekMeals: (anchorDate) => {
        const state = get();
        const keys = weekDateKeys(anchorDate);
        let nextDailyPlans = { ...state.dailyPlans };
        let nextPlannedMeals = state.plannedMeals;
        let nextNotices = state.macroRedistributionNotices;
        let changed = false;

        for (const key of keys) {
          const patch = applyDayMealsClear(
            {
              ...state,
              dailyPlans: nextDailyPlans,
              plannedMeals: nextPlannedMeals,
              macroRedistributionNotices: nextNotices,
            },
            key,
          );
          if (!patch) continue;
          nextDailyPlans = patch.dailyPlans;
          nextPlannedMeals = patch.plannedMeals;
          nextNotices = patch.macroRedistributionNotices;
          changed = true;
        }

        if (!changed) return;
        set({
          dailyPlans: nextDailyPlans,
          plannedMeals: nextPlannedMeals,
          macroRedistributionNotices: nextNotices,
        });
        void get().syncAccountSnapshot();
      },

      generateMonth: (anchorDate = new Date(), overrides) => {
        const state = get();
        const opts = buildGenerateOptions(state, overrides);
        if (!opts || !state.userProfile) return;
        const year = anchorDate.getFullYear();
        const month = anchorDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const monthKeys: string[] = [];
        let nextDailyPlans = { ...state.dailyPlans };
        const noticeKeys: string[] = [];
        for (let day = 1; day <= daysInMonth; day++) {
          const key = toDateKey(new Date(year, month, day));
          monthKeys.push(key);
          if (state.lockedDays.includes(key)) continue;
          const built = buildDayPlanRespectingLocks(state, key, overrides);
          if (built) {
            nextDailyPlans[key] = built.meals;
            if (built.redistributed) noticeKeys.push(key);
          }
        }
        for (const weekKeys of groupDateKeysByWeek(monthKeys)) {
          nextDailyPlans = applyWeeklyMealPrepToPlans(
            weekKeys,
            nextDailyPlans,
            state.userProfile,
            opts,
            state.lockedDays,
            state.targets.calories,
          );
          nextDailyPlans = applyLowComplexityToPlans(
            weekKeys,
            nextDailyPlans,
            state.userProfile,
            opts,
            state.lockedDays,
            state.lockedMeals,
            state.targets.calories,
          );
        }
        set((s) => ({
          dailyPlans: nextDailyPlans,
          plannedMeals: nextDailyPlans[s.todayDateKey] ?? s.plannedMeals,
          macroRedistributionNotices:
            noticeKeys.length > 0
              ? [...new Set([...s.macroRedistributionNotices, ...noticeKeys])]
              : s.macroRedistributionNotices,
        }));
      },

      toggleFavorite: (recipeId) => {
        const state = get();
        const recipe = recipeLibrary.find((r) => r.id === recipeId);
        if (!recipe) return;

        const has = state.favoriteIds.includes(recipeId);
        const isAdding = !has;
        const nextFavoriteIds = has
          ? state.favoriteIds.filter((id) => id !== recipeId)
          : [...state.favoriteIds, recipeId];
        const nextDislikedIds = isAdding
          ? state.dislikedIds.filter((id) => id !== recipeId)
          : state.dislikedIds;

        if (!state.userProfile) {
          set({ favoriteIds: nextFavoriteIds, dislikedIds: nextDislikedIds });
          return;
        }

        const profileUpdates = profileUpdatesForFavorite(state.userProfile, recipe, isAdding);
        const nextProfile: UserProfile = { ...state.userProfile, ...profileUpdates };
        const personalizationInsight = buildRecipePreferenceInsight(
          recipe,
          isAdding ? "favorite" : "unfavorite",
          state.userProfile,
          nextProfile,
        );

        set({
          favoriteIds: nextFavoriteIds,
          dislikedIds: nextDislikedIds,
          userProfile: nextProfile,
          personalizationInsight,
        });
        void get().syncAccountSnapshot();
      },

      toggleDislike: (recipeId) => {
        const state = get();
        const recipe = recipeLibrary.find((r) => r.id === recipeId);
        if (!recipe) return;

        const has = state.dislikedIds.includes(recipeId);
        const isAdding = !has;
        const nextDislikedIds = has
          ? state.dislikedIds.filter((id) => id !== recipeId)
          : [...state.dislikedIds, recipeId];
        const nextFavoriteIds = isAdding
          ? state.favoriteIds.filter((id) => id !== recipeId)
          : state.favoriteIds;

        if (!state.userProfile) {
          set({ favoriteIds: nextFavoriteIds, dislikedIds: nextDislikedIds });
          return;
        }

        const profileUpdates = profileUpdatesForDislike(state.userProfile, recipe, isAdding);
        const nextProfile: UserProfile = { ...state.userProfile, ...profileUpdates };
        const personalizationInsight = buildRecipePreferenceInsight(
          recipe,
          isAdding ? "dislike" : "undislike",
          state.userProfile,
          nextProfile,
        );

        set({
          favoriteIds: nextFavoriteIds,
          dislikedIds: nextDislikedIds,
          userProfile: nextProfile,
          personalizationInsight,
        });
        void get().syncAccountSnapshot();
      },

      setMealVariation: (dateKey, slot, variationId) => {
        const state = get();
        const meal = mealsForDate(state, dateKey).find((m) => m.slot === slot);
        if (!meal) return;
        const validId = resolveVariationId(meal.recipe, variationId);
        const updateMeals = (meals: PlannedMeal[]) =>
          meals.map((m) =>
            m.slot === slot ? { ...m, selectedVariationId: validId } : m,
          );
        const nextDaily = { ...state.dailyPlans };
        if (nextDaily[dateKey]) {
          nextDaily[dateKey] = updateMeals(nextDaily[dateKey]!);
        }
        set((s) => ({
          dailyPlans: nextDaily,
          plannedMeals:
            dateKey === s.todayDateKey ? updateMeals(s.plannedMeals) : s.plannedMeals,
        }));
        void get().syncAccountSnapshot();
      },

      setMealCarbVariation: (dateKey, slot, carbVariationId) => {
        const state = get();
        const meal = mealsForDate(state, dateKey).find((m) => m.slot === slot);
        if (!meal) return;
        const updateMeals = (meals: PlannedMeal[]) =>
          meals.map((m) =>
            m.slot === slot ? { ...m, selectedCarbVariationId: carbVariationId } : m,
          );
        const nextDaily = { ...state.dailyPlans };
        if (nextDaily[dateKey]) {
          nextDaily[dateKey] = updateMeals(nextDaily[dateKey]!);
        }
        set((s) => ({
          dailyPlans: nextDaily,
          plannedMeals:
            dateKey === s.todayDateKey ? updateMeals(s.plannedMeals) : s.plannedMeals,
        }));
        void get().syncAccountSnapshot();
      },

      swapMealSlots: (dateKey, slotA, slotB) => {
        if (slotA === slotB) return;
        const state = get();
        if (state.lockedDays.includes(dateKey)) return;
        if (
          isMealLocked(state.lockedMeals, dateKey, slotA) ||
          isMealLocked(state.lockedMeals, dateKey, slotB)
        ) {
          return;
        }
        const meals = mealsForDate(state, dateKey);
        const mealA = meals.find((m) => m.slot === slotA);
        const mealB = meals.find((m) => m.slot === slotB);
        if (!mealA || !mealB) return;
        const updated = meals.map((m) => {
          if (m.slot === slotA) return { ...mealB, slot: slotA };
          if (m.slot === slotB) return { ...mealA, slot: slotB };
          return m;
        });
        set(setDayMeals(state, dateKey, updated));
        void get().syncAccountSnapshot();
      },

      moveMealToSlot: (fromDateKey, fromSlot, toDateKey, toSlot) => {
        if (fromDateKey === toDateKey && fromSlot === toSlot) return;
        const state = get();
        if (state.lockedDays.includes(fromDateKey) || state.lockedDays.includes(toDateKey)) {
          return;
        }
        if (isMealLocked(state.lockedMeals, fromDateKey, fromSlot)) return;
        if (isMealLocked(state.lockedMeals, toDateKey, toSlot)) return;

        const fromMeals = [...mealsForDate(state, fromDateKey)];
        const moving = fromMeals.find((m) => m.slot === fromSlot);
        if (!moving) return;

        if (fromDateKey === toDateKey) {
          const target = fromMeals.find((m) => m.slot === toSlot);
          let updated = fromMeals.filter((m) => m.slot !== fromSlot && m.slot !== toSlot);
          if (target) updated.push({ ...target, slot: fromSlot });
          updated.push({ ...moving, slot: toSlot });
          set(setDayMeals(state, fromDateKey, updated));
          void get().syncAccountSnapshot();
          return;
        }

        const toMeals = [...mealsForDate(state, toDateKey)];
        const displaced = toMeals.find((m) => m.slot === toSlot);
        const newFrom = fromMeals.filter((m) => m.slot !== fromSlot);
        const newTo = toMeals.filter((m) => m.slot !== toSlot);

        if (displaced) newFrom.push({ ...displaced, slot: fromSlot });
        newTo.push({ ...moving, slot: toSlot });

        const afterFrom = setDayMeals(state, fromDateKey, newFrom);
        const afterBoth = setDayMeals({ ...state, ...afterFrom }, toDateKey, newTo);
        set(afterBoth);
        void get().syncAccountSnapshot();
      },

      regenerateSlot: (slot, dateKey) => {
        const state = get();
        const targetDateKey = dateKey ?? state.todayDateKey;
        if (state.lockedDays.includes(targetDateKey)) return;
        if (isMealLocked(state.lockedMeals, targetDateKey, slot)) return;
        const opts = buildGenerateOptions(state);
        if (!opts) return;
        const base = mealsForDate(state, targetDateKey);
        const others = base.filter((m) => m.slot !== slot);
        const exclude = new Set(others.map((m) => m.recipe.id));
        const pick = pickRecipeForSlot(recipeLibrary, slot, opts, exclude);
        if (!pick) return;

        const built = buildSlotReplacementMeals(state, targetDateKey, slot, pick);
        if (!built) return;

        set((s) => ({
          ...setDayMeals(s, targetDateKey, built.meals),
          mealTracking: clearSlotTracking(s.mealTracking, targetDateKey, slot),
          macroRedistributionNotices: built.redistributed
            ? [...new Set([...s.macroRedistributionNotices, targetDateKey])]
            : s.macroRedistributionNotices,
        }));
        void get().syncAccountSnapshot();
      },

      replaceMealSlot: (dateKey, slot, recipeId) => {
        const state = get();
        if (state.lockedDays.includes(dateKey)) return;
        if (isMealLocked(state.lockedMeals, dateKey, slot)) return;
        const recipe = recipeLibrary.find((r) => r.id === recipeId);
        if (!recipe) return;
        const base = mealsForDate(state, dateKey);
        if (!base.some((m) => m.slot === slot)) return;

        const built = buildSlotReplacementMeals(state, dateKey, slot, recipe);
        if (!built) return;

        set((s) => ({
          ...setDayMeals(s, dateKey, built.meals),
          mealTracking: clearSlotTracking(s.mealTracking, dateKey, slot),
          macroRedistributionNotices: built.redistributed
            ? [...new Set([...s.macroRedistributionNotices, dateKey])]
            : s.macroRedistributionNotices,
        }));
        void get().syncAccountSnapshot();
      },

      removeMealSlot: (dateKey, slot) => {
        const state = get();
        if (state.lockedDays.includes(dateKey)) return;
        if (isMealLocked(state.lockedMeals, dateKey, slot)) return;
        const base = mealsForDate(state, dateKey);
        const meals = base.filter((m) => m.slot !== slot);
        if (meals.length === base.length) return;

        set((s) => ({
          ...setDayMeals(s, dateKey, meals),
          mealTracking: clearSlotTracking(s.mealTracking, dateKey, slot),
          macroRedistributionNotices: s.macroRedistributionNotices.filter((k) => k !== dateKey),
        }));
        void get().syncAccountSnapshot();
      },

      toggleDayLock: (dateKey) =>
        set((s) => ({
          lockedDays: s.lockedDays.includes(dateKey)
            ? s.lockedDays.filter((d) => d !== dateKey)
            : [...s.lockedDays, dateKey],
        })),

      toggleMealLock: (dateKey, slot) =>
        set((s) => {
          const key = mealLockKey(dateKey, slot);
          return {
            lockedMeals: s.lockedMeals.includes(key)
              ? s.lockedMeals.filter((k) => k !== key)
              : [...s.lockedMeals, key],
          };
        }),

      toggleGroceryDateSelected: (dateKey) =>
        set((s) => ({
          grocerySelectedDateKeys: s.grocerySelectedDateKeys.includes(dateKey)
            ? s.grocerySelectedDateKeys.filter((d) => d !== dateKey)
            : [...s.grocerySelectedDateKeys, dateKey],
        })),

      setGrocerySelectedDateKeys: (keys) => set({ grocerySelectedDateKeys: keys }),

      toggleGroceryItemChecked: (itemKey) =>
        set((s) => ({
          groceryCheckedKeys: s.groceryCheckedKeys.includes(itemKey)
            ? s.groceryCheckedKeys.filter((k) => k !== itemKey)
            : [...s.groceryCheckedKeys, itemKey],
        })),

      toggleGroceryItemOwned: (itemKey) =>
        set((s) => {
          const owned = s.groceryOwnedKeys.includes(itemKey);
          return {
            groceryOwnedKeys: owned
              ? s.groceryOwnedKeys.filter((k) => k !== itemKey)
              : [...s.groceryOwnedKeys, itemKey],
            groceryCheckedKeys: owned
              ? s.groceryCheckedKeys
              : s.groceryCheckedKeys.filter((k) => k !== itemKey),
          };
        }),

      setMealTracking: (dateKey, slot, entry) =>
        set((s) => {
          const day = { ...(s.mealTracking[dateKey] ?? {}) };
          if (entry === null) {
            delete day[slot];
          } else {
            day[slot] = entry;
          }
          const nextTracking = { ...s.mealTracking };
          if (Object.keys(day).length === 0) {
            delete nextTracking[dateKey];
          } else {
            nextTracking[dateKey] = day;
          }

          const loggedCount = Object.values(nextTracking).reduce(
            (sum, d) => sum + Object.keys(d).length,
            0,
          );
          const patch: Partial<AppState> = { mealTracking: nextTracking };

          if (loggedCount >= 3 && s.userProfile) {
            const signals = analyzePersonalizationSignals({
              mealTracking: nextTracking,
              dailyPlans: s.dailyPlans,
              plannedMeals: s.plannedMeals,
              todayDateKey: s.todayDateKey,
            });
            const adaptive = deriveAdaptiveProfileUpdates(s.userProfile, signals);
            if (Object.keys(adaptive).length > 0) {
              patch.userProfile = { ...s.userProfile, ...adaptive };
            }
            const insight = computePersonalizationInsight(
              { ...s, mealTracking: nextTracking, userProfile: patch.userProfile ?? s.userProfile },
              "tracking",
            );
            if (insight) patch.personalizationInsight = insight;
          }

          return patch;
        }),

      clearGroceryAll: () =>
        set({
          groceryCheckedKeys: [],
          groceryOwnedKeys: [],
          grocerySelectedDateKeys: [],
        }),

      dismissFeedbackPrompt: () =>
        set({ lastFeedbackPromptDismissedAt: new Date().toISOString() }),

      submitCheckIn: (partial, profileUpdates) => {
        const state = get();
        if (!state.userProfile) {
          const emptyCalorie: CalorieRecommendation = {
            suggestedCalories: state.targets.calories,
            deltaCalories: 0,
            reasoning: ["Complete your profile to personalize targets."],
            usedAdaptiveModel: false,
            estimatedTdee: null,
          };
          return {
            calorie: emptyCalorie,
            experience: { suggestions: [], profileUpdates: {} },
            entry: {
              ...partial,
              id: crypto.randomUUID(),
              submittedAt: new Date().toISOString(),
              periodDays: 14,
            },
          };
        }

        const submittedAt = new Date().toISOString();
        const lastAt = state.lastFeedbackSubmittedAt;
        const periodDays = lastAt
          ? daysBetweenDates(new Date(lastAt), new Date(submittedAt))
          : state.profileAnchoredAt
            ? daysBetweenDates(new Date(state.profileAnchoredAt), new Date(submittedAt))
            : 14;

        const entry: CheckInEntry = {
          ...partial,
          id: crypto.randomUUID(),
          submittedAt,
          periodDays: Math.min(28, Math.max(1, periodDays)),
        };

        const mergedProfile: UserProfile = {
          ...state.userProfile,
          ...profileUpdates,
          lastCheckInAt: submittedAt,
          lastExperienceNotes:
            partial.experienceNotes.trim() ||
            profileUpdates.lastExperienceNotes ||
            state.userProfile.lastExperienceNotes ||
            null,
        };

        const history = [...state.tdeeFeedbackHistory, entry];
        const calorie = buildCalorieRecommendation(
          mergedProfile,
          history,
          state.targets.calories,
          state.profileAnchoredAt,
        );
        const signals = analyzePersonalizationSignals({
          mealTracking: state.mealTracking,
          dailyPlans: state.dailyPlans,
          plannedMeals: state.plannedMeals,
          todayDateKey: state.todayDateKey,
        });
        const experience = buildExperienceRecommendations(entry, mergedProfile, signals);

        const adaptiveFromLogs = deriveAdaptiveProfileUpdates(mergedProfile, signals, entry);
        const finalProfile: UserProfile = {
          ...mergedProfile,
          ...experience.profileUpdates,
          ...adaptiveFromLogs,
        };

        const personalizationInsight = computePersonalizationInsight(
          {
            ...state,
            userProfile: finalProfile,
            tdeeFeedbackHistory: history,
          },
          "check_in",
          entry,
        );

        set({
          userProfile: finalProfile,
          targets: applyProfileToTargets(finalProfile),
          tdeeFeedbackHistory: history,
          lastFeedbackSubmittedAt: submittedAt,
          lastFeedbackPromptDismissedAt: submittedAt,
          adaptiveTdeeEstimate: calorie.estimatedTdee,
          personalizationInsight: personalizationInsight ?? state.personalizationInsight,
        });

        void get().syncAccountSnapshot();

        return { calorie, experience, entry };
      },

      submitTdeeFeedback: (partial) => {
        const result = get().submitCheckIn(partial, {});
        return result.calorie;
      },

      applyCalorieRecommendation: (calories) => {
        const state = get();
        if (!state.userProfile) return;
        const nextTargets = targetsWithCalories(state.userProfile, calories);
        set({ targets: nextTargets });
        void get().syncAccountSnapshot();
      },

      assignMealPrepBatch: ({ recipe, slot, portionsCooked, dateKeys, scale = 1 }) => {
        const state = get();
        const batchId = crypto.randomUUID();
        const keys = dateKeys.slice(0, portionsCooked);
        const portions = Math.min(portionsCooked, keys.length);
        if (portions === 0) return;

        const order = state.userProfile
          ? slotsForMealsPerDay(state.userProfile.mealsPerDay)
          : (["breakfast", "lunch", "dinner", "snack"] as MealSlotId[]);

        const nextDailyPlans = { ...state.dailyPlans };
        keys.forEach((dateKey, index) => {
          if (state.lockedDays.includes(dateKey)) return;
          const existing = mealsForDate(state, dateKey).filter((m) => m.slot !== slot);
          const meal = createPlannedMeal(slot, recipe, {
            scale,
            mealPrep: {
              batchId,
              portionsCooked: portions,
              portionIndex: index + 1,
              source: "manual",
            },
          });
          const merged = [...existing, meal].sort(
            (a, b) => order.indexOf(a.slot) - order.indexOf(b.slot),
          );
          nextDailyPlans[dateKey] = merged;
        });

        set((s) => ({
          dailyPlans: nextDailyPlans,
          plannedMeals: nextDailyPlans[s.todayDateKey] ?? s.plannedMeals,
        }));
      },
    }),
    {
      name: "dailyplate-storage",
      partialize: (s) => ({
        authSession: s.authSession,
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
        mealTracking: s.mealTracking,
        dismissedUsageNotes: s.dismissedUsageNotes,
        favoriteIds: s.favoriteIds,
        dislikedIds: s.dislikedIds,
        profileAnchoredAt: s.profileAnchoredAt,
        tdeeFeedbackHistory: s.tdeeFeedbackHistory,
        lastFeedbackSubmittedAt: s.lastFeedbackSubmittedAt,
        lastFeedbackPromptDismissedAt: s.lastFeedbackPromptDismissedAt,
        adaptiveTdeeEstimate: s.adaptiveTdeeEstimate,
        personalizationInsight: s.personalizationInsight,
      }),
    },
  ),
);

/** Apply profile to targets (call after profile save / activity change). */
export function applyProfileToTargets(profile: UserProfile): DailyTargets {
  return computeDailyTargets(profile);
}

export function useTodayTotals() {
  const todayDateKey = useAppStore((s) => s.todayDateKey);
  const meals = useAppStore((s) => s.dailyPlans[todayDateKey] ?? s.plannedMeals);
  return sumPlannedMacros(meals);
}
