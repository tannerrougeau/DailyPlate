import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BeverageId, DailyTargets, DayMealTracking, MealSlotId, MealTrackingEntry, PlannedMeal, Recipe, RecipeIngredient, RecipeMealSlotId } from "@/types";
import type { UserProfile } from "@/types/profile";
import { allRecipes, findRecipe } from "@/recipes/recipePool";
import {
  type GenerateOptions,
  generateDayPlan,
  generateSlotsPlan,
  pickRecipeForSlot,
  slotsForMealsPerDay,
  sumPlannedMacros,
} from "@/utils/generateDayPlan";
import { isMealLocked, mealLockKey } from "@/utils/mealLocks";
import { withPlanningDefaults } from "@/utils/planningPrefs";
import { CHECK_IN_SCALE_MAX, normalizeCheckInHistory } from "@/utils/checkInScale";
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
import { dateKeysForRange, fromDateKey, toDateKey, weekDateKeys } from "@/utils/date";
import { migrateMealTracking } from "@/utils/mealTracking";
import {
  applyWeeklyMealPrepToPlans,
  groupDateKeysByWeek,
} from "@/utils/weeklyMealPrep";
import {
  applyLowComplexityFromDay,
  applyLowComplexityToPlans,
} from "@/utils/lowComplexityPlan";
import { applyGoalPortions, samePortions } from "@/utils/mealPortions";
import { splitMealTargets } from "@/utils/mealTargets";
import { createPlannedMeal, resolveVariationId } from "@/utils/recipeDisplay";
import {
  applySlotBeverageDefaults,
  canonicalBeverageSlot,
  defaultBeverageForSlot,
} from "@/utils/beverages";
import { effectiveMinimumProteinGrams } from "@/utils/proteinMinimum";
import { mergeFoodAvoidLists } from "@/utils/chipMatching";
import { migratePlannedMeals, migrateRecipeIdList } from "@/utils/recipeMigration";
import { pickPreferredVariationId } from "@/utils/variationPrefs";
import {
  analyzePersonalizationSignals,
  buildPersonalizationInsights,
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
import type { HouseholdDayOverride } from "@/utils/household";
import type { SavedSnack } from "@/utils/snackItems";
import type { SwapLogEntry } from "@/utils/personalizationEngine";
import {
  DISPLAY_ELEMENTS,
  resolveDisplayPrefs,
  simplestView,
  startingDisplayPrefs,
  type Checkpoint,
  type CheckpointState,
  type DisplayElement,
  type DisplayPrefs,
} from "@/utils/displayPrefs";
import {
  applyChange,
  enqueue,
  logPlanQuestions,
  recordAnswer,
  tasteQuestions,
  usageQuestions,
  type Question,
  type QuestionAnswer,
  type QuestionLog,
  type UsageEvent,
} from "@/utils/questionQueue";
import type { FoodItem } from "@/utils/foodTypes";

export type NavTab = "today" | "plan" | "recipes" | "grocery" | "guide";
export type UsageNoteKey = "today" | "plan" | "recipes" | "grocery";

function mealsForDate(
  s: Pick<AppState, "dailyPlans" | "plannedMeals" | "todayDateKey">,
  dateKey: string,
): PlannedMeal[] {
  const raw = s.dailyPlans[dateKey] ?? (dateKey === s.todayDateKey ? s.plannedMeals : []);
  return raw.filter((m) => !m.recipe.tags.includes("beverage") && !m.recipe.id.startsWith("bev-"));
}

function recipesFor(s: Pick<AppState, "userRecipes">): Recipe[] {
  return allRecipes(s.userRecipes);
}

function mergeGroceryDates(selected: string[], generatedKeys: string[]): string[] {
  const next = new Set(selected);
  for (const key of generatedKeys) next.add(key);
  return [...next].sort();
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
    | "userRecipes"
    | "lastBeverageBySlot"
  >,
  dateKey: string,
  slot: MealSlotId,
  recipe: Recipe,
): { meals: PlannedMeal[]; redistributed: boolean } | null {
  const opts = buildGenerateOptions(state);
  if (!opts) return null;
  const base = mealsForDate(state, dateKey);
  const others = base.filter((m) => m.slot !== slot);
  const prior = base.find((m) => m.slot === slot);
  const draft = [
    ...others,
    createPlannedMeal(slot, recipe, {
      scale: 1,
      mealPrep: undefined,
      beverageId: prior?.beverageId ?? defaultBeverageForSlot(state.lastBeverageBySlot, slot),
      selectedVariationId: pickPreferredVariationId(
        recipe,
        slot,
        opts.dislikedChips,
        opts.dislikedCustom,
        opts.snackStyle,
      ),
    }),
  ];
  const order = slotsForMealsPerDay(state.userProfile!);
  const sorted = draft.sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot));
  return { meals: sorted, redistributed: false };
}

/** Patch one meal's fields in dailyPlans (and plannedMeals when the day is today). */
function patchMealInDay(
  set: (fn: (s: AppState) => Partial<AppState>) => void,
  get: () => AppState,
  dateKey: string,
  slot: MealSlotId,
  patch: Partial<PlannedMeal>,
) {
  if (!mealsForDate(get(), dateKey).some((m) => m.slot === slot)) return;
  const update = (meals: PlannedMeal[]) =>
    meals.map((m) => (m.slot === slot ? { ...m, ...patch } : m));
  set((s) => ({
    dailyPlans: s.dailyPlans[dateKey]
      ? { ...s.dailyPlans, [dateKey]: update(s.dailyPlans[dateKey]!) }
      : s.dailyPlans,
    plannedMeals: dateKey === s.todayDateKey ? update(s.plannedMeals) : s.plannedMeals,
  }));
}

/** Record a swap away from `fromId` (ignored when it's the same recipe). */
function logSwap(log: SwapLogEntry[], fromId: string | undefined, toId: string, dateKey: string): SwapLogEntry[] {
  if (!fromId || fromId === toId) return log;
  const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;
  return [
    ...log.filter((e) => new Date(e.at).getTime() >= cutoff),
    { recipeId: fromId, dateKey, at: new Date().toISOString() },
  ];
}

/** Apply a checkpoint's `after` state and save the checkpoint. Changes happen only through here. */
function commitCheckpoint(
  set: (partial: Partial<AppState>) => void,
  get: () => AppState,
  what: string,
  why: string,
  before: CheckpointState,
  after: CheckpointState,
): Checkpoint {
  const s = get();
  const cp: Checkpoint = { id: crypto.randomUUID(), at: new Date().toISOString(), what, why, before, after };
  const patch: Partial<AppState> = { checkpoints: [cp, ...s.checkpoints].slice(0, 100) };
  if (after.displayPrefs) patch.displayPrefs = after.displayPrefs;
  const profileFields = {
    ...(after.dislikedFoodCustom != null ? { dislikedFoodCustom: after.dislikedFoodCustom } : {}),
    ...(after.ingredientVariety != null ? { ingredientVariety: after.ingredientVariety } : {}),
    ...(after.weeklyMealPrepRepeatCount != null ? { weeklyMealPrepRepeatCount: after.weeklyMealPrepRepeatCount } : {}),
    ...(after.maxLeftoverStreakDays != null ? { maxLeftoverStreakDays: after.maxLeftoverStreakDays } : {}),
    ...(after.planSettings ?? {}),
  };
  if (s.userProfile && Object.keys(profileFields).length > 0) {
    patch.userProfile = { ...s.userProfile, ...profileFields };
  }
  set(patch);
  return cp;
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
    | "userRecipes"
    | "lastBeverageBySlot"
  >,
  dateKey: string,
  overrides?: GenerateOverrides,
  /** Slots to keep as they are besides locked ones (e.g. kept or eaten meals). */
  keepSlots?: Set<MealSlotId>,
): DayPlanBuildResult | null {
  const library = recipesFor(state);
  const opts = buildGenerateOptions(state, overrides);
  if (!opts) return null;

  const existing = mealsForDate(state, dateKey);
  const preserved = existing.filter(
    (m) => isMealLocked(state.lockedMeals, dateKey, m.slot) || keepSlots?.has(m.slot) === true,
  );
  const lockedSlots = new Set(preserved.map((m) => m.slot));
  const slotsToFill = opts.slots.filter((s) => !lockedSlots.has(s));

  if (slotsToFill.length === 0) {
    return preserved.length > 0 ? { meals: preserved, redistributed: false } : null;
  }

  let merged: PlannedMeal[];
  if (preserved.length === 0) {
    // Full day replacement — discard any existing unlocked meals.
    merged = generateDayPlan(library, opts);
  } else {
    const usedIds = new Set(preserved.map((m) => m.recipe.id));
    const fresh = generateSlotsPlan(
      library,
      opts,
      slotsToFill,
      usedIds,
    );
    const order = opts.slots;
    merged = [...preserved, ...fresh].sort(
      (a, b) => order.indexOf(a.slot) - order.indexOf(b.slot),
    );
  }

  return {
    meals: applySlotBeverageDefaults(merged, state.lastBeverageBySlot, preserved),
    redistributed: false,
  };
}

function buildGenerateOptions(
  s: Pick<
    AppState,
    | "targets"
    | "favoriteIds"
    | "dislikedIds"
    | "userProfile"
    | "mealTracking"
    | "dailyPlans"
    | "plannedMeals"
    | "todayDateKey"
  > &
    Partial<Pick<AppState, "swapLog" | "tdeeFeedbackHistory">>,
  overrides?: GenerateOverrides,
): GenerateOptions | null {
  if (!s.userProfile) return null;
  const minimumProteinGrams = effectiveMinimumProteinGrams(s.userProfile);
  const signals = analyzePersonalizationSignals({
    mealTracking: s.mealTracking,
    dailyPlans: s.dailyPlans,
    plannedMeals: s.plannedMeals,
    todayDateKey: s.todayDateKey,
    swapLog: s.swapLog,
    latestCheckIn: s.tdeeFeedbackHistory?.at(-1) ?? null,
  });
  const lowComplexity =
    overrides?.lowComplexity ?? s.userProfile.lowComplexityEnabled === true;
  const avoids = mergeFoodAvoidLists(
    s.userProfile.dislikedFoodChips,
    s.userProfile.dislikedFoodCustom,
    s.userProfile.householdFoodAvoidChips,
    s.userProfile.householdFoodAvoidCustom,
  );
  return {
    dislikedIds: s.dislikedIds,
    dislikedChips: avoids.chips,
    dislikedCustom: avoids.custom,
    favoriteIds: s.favoriteIds,
    favoriteChips: s.userProfile.favoriteFoodChips,
    favoriteCustom: s.userProfile.favoriteFoodCustom ?? "",
    slots: slotsForMealsPerDay(s.userProfile),
    mealTiming: s.userProfile.mealTiming,
    prioritizeMinProtein: s.userProfile.prioritizeMinProtein !== false,
    minimumProteinGrams,
    lowComplexity,
    snackStyle: s.userProfile.snackStyle ?? "both",
    maxPrepMinutes: s.userProfile.maxPrepMinutes,
    preferredProteinSources: s.userProfile.preferredProteinSources ?? [],
    avoidedProteinSources: s.userProfile.avoidedProteinSources ?? [],
    kitchenEquipment: s.userProfile.kitchenEquipment,
    ingredientVariety: s.userProfile.ingredientVariety ?? "minimal",
    personalization: {
      profile: s.userProfile,
      signals,
    },
    slotTargets: splitMealTargets({
      daily: s.targets,
      slots: slotsForMealsPerDay(s.userProfile).map((slot) => ({ slot, kind: "cooked" as const })),
      timing: s.userProfile.mealTiming,
    }),
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
  /** Items already at home — pantry inventory; persists across plan regenerations. */
  groceryOwnedKeys: string[];
  /** Checked visual state for pantry rows; resets when a new plan is generated. */
  pantryCheckedKeys: string[];
  /** User-created recipes included in generation and the Recipes list. */
  userRecipes: Recipe[];
  /** One-day people count for Today only; does not change onboarding. */
  todayHouseholdOverride: HouseholdDayOverride | null;
  /** dateKey → slot → log entry */
  mealTracking: Record<string, DayMealTracking>;
  /** Snacks logged on Today that were not planned, per day. */
  snackLogs: Record<string, MealTrackingEntry[]>;
  /** Custom snacks saved for reuse. */
  savedSnacks: SavedSnack[];
  /** Recipes swapped away (Replace / New meal), for generation and taste questions. */
  swapLog: SwapLogEntry[];
  /** Optional display switches; null = profile from before display settings (everything on). */
  displayPrefs: Partial<DisplayPrefs> | null;
  /** Rolling 14-day usage, used only to queue questions. */
  usageEvents: UsageEvent[];
  questionQueue: Question[];
  questionLog: QuestionLog;
  lastQuestionAskedAt: string | null;
  /** Every applied display or plan change, restorable from Settings. */
  checkpoints: Checkpoint[];
  /** Foods found by name or typed from a label, saved for reuse and offline. */
  myFoods: FoodItem[];
  /** Dev panel: a question to show on Today right away (not persisted). */
  devForcedQuestionId: string | null;
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
  /** Last drink chosen per meal slot; used as the default on new plans. */
  lastBeverageBySlot: Partial<Record<RecipeMealSlotId, BeverageId>>;
  /** Transient flag so onboarding can open Settings after “Save your account”. */
  openSettingsOnStart: boolean;
  requestOpenSettings: () => void;
  consumeOpenSettingsRequest: () => void;
  setNav: (tab: NavTab) => void;
  setTargets: (t: Partial<DailyTargets>) => void;
  setUserProfile: (p: UserProfile) => void;
  normalizeProfileDefaults: () => void;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  registerAccount: (email: string, password: string) => Promise<RegisterResult>;
  syncAccountSnapshot: () => Promise<void>;
  finishOnboarding: () => void;
  setTodayDateKey: (key: string) => void;
  ensureTodaySynced: () => void;
  setTodayHouseholdOverride: (override: HouseholdDayOverride | null) => void;
  setSelectedPlanDateKey: (key: string | null) => void;
  dismissUsageNote: (key: UsageNoteKey) => void;
  dismissMacroRedistributionNotice: (dateKey: string) => void;
  refreshPersonalization: (source?: "check_in" | "tracking" | "profile") => void;
  dismissPersonalizationInsight: () => void;
  generateDay: (dateKey?: string, overrides?: GenerateOverrides) => GenerateDayResult;
  generateWeek: (anchorDate?: Date, overrides?: GenerateOverrides) => void;
  generateDays: (startDate: Date, dayCount: number, overrides?: GenerateOverrides) => void;
  generateForDateKeys: (dateKeys: string[], overrides?: GenerateOverrides) => void;
  clearDayMeals: (dateKey: string) => void;
  clearWeekMeals: (anchorDate: Date) => void;
  clearRangeMeals: (dateKeys: string[]) => void;
  generateMonth: (anchorDate?: Date, overrides?: GenerateOverrides) => void;
  addUserRecipe: (recipe: Recipe) => void;
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
  setMealBeverage: (dateKey: string, slot: PlannedMeal["slot"], beverageId: BeverageId) => void;
  /** Keep a meal that cannot fit its target: use the closest fit and stop showing the notice. */
  keepMeal: (dateKey: string, slot: MealSlotId) => void;
  addSnackLog: (dateKey: string, entry: MealTrackingEntry) => void;
  /** Count a usage event (details opened, Adjust used, meal cards shown). */
  recordUsage: (kind: UsageEvent["kind"], n?: number) => void;
  /** Queue questions from usage and taste patterns (and any extra, e.g. from a check-in). */
  refreshQuestions: (extra?: Question[]) => void;
  /** Mark questions as asked now (for the 3-day spacing). */
  markQuestionsAsked: () => void;
  /** Yes applies the change and returns its checkpoint; Not now / No change nothing. */
  answerQuestion: (id: string, answer: QuestionAnswer) => Checkpoint | null;
  setDisplayPref: (element: DisplayElement, on: boolean) => void;
  applySimplestView: () => Checkpoint;
  /** Restore how things were before a checkpoint (saved as a new checkpoint). */
  restoreCheckpoint: (id: string) => Checkpoint | null;
  /** Starting display switches from onboarding. */
  setStartingDisplay: (kind: "basic" | "detailed") => void;
  saveMyFood: (food: FoodItem) => void;
  /** Dev panel: show the next queued question on Today now, ignoring spacing. */
  devShowNextQuestion: () => string | null;
  /** Dev panel: clear the 3-day spacing and every Not now / No snooze. */
  devResetQuestionTimers: () => void;
  clearDevForcedQuestion: () => void;
  removeSnackLog: (dateKey: string, loggedAt: string) => void;
  saveSnack: (snack: Omit<SavedSnack, "id">) => SavedSnack;
  deleteSavedSnack: (id: string) => void;
  /**
   * Replace today's meals, keeping locked, kept, and eaten meals (and their logs).
   * Returns the previous meals and logs so the change can be undone.
   */
  regenerateToday: () =>
    | { ok: true; previous: { dateKey: string; meals: PlannedMeal[]; tracking: DayMealTracking | null } }
    | { ok: false };
  /** Put a day's meals and meal logs back (Undo for Regenerate today). */
  restoreDay: (dateKey: string, meals: PlannedMeal[], tracking: DayMealTracking | null) => void;
  /** Actual cooked batch weight (g) for a meal and every day of the same batch; null clears it. */
  setWeighedBatch: (dateKey: string, slot: MealSlotId, grams: number | null) => void;
  /** Add whole-food sides to a meal (from the "Add side" suggestion). */
  addMealSides: (dateKey: string, slot: MealSlotId, sides: RecipeIngredient[]) => void;
  /** Remove one side from a meal. */
  removeMealSide: (dateKey: string, slot: MealSlotId, index: number) => void;
  setMealFatVariation: (
    dateKey: string,
    slot: PlannedMeal["slot"],
    fatVariationId: import("@/types").FatVariationId,
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
  togglePantryItemChecked: (itemKey: string) => void;
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
    selectedVariationId?: string;
  }) => void;
}

const defaultTargets: DailyTargets = {
  calories: 2200,
  protein: 165,
  carbs: 220,
  fat: 73,
  fiber: 31,
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
      pantryCheckedKeys: [],
      userRecipes: [],
      todayHouseholdOverride: null,
      lastBeverageBySlot: {},
      mealTracking: {},
      snackLogs: {},
      savedSnacks: [],
      swapLog: [],
      displayPrefs: null,
      usageEvents: [],
      questionQueue: [],
      questionLog: {},
      lastQuestionAskedAt: null,
      checkpoints: [],
      myFoods: [],
      devForcedQuestionId: null,
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
      openSettingsOnStart: false,
      requestOpenSettings: () => set({ openSettingsOnStart: true }),
      consumeOpenSettingsRequest: () => set({ openSettingsOnStart: false }),

      setNav: (tab) => set({ nav: tab }),

      setTargets: (partial) =>
        set((s) => ({
          targets: { ...s.targets, ...partial },
        })),

      setUserProfile: (p) => {
        set({ userProfile: withPlanningDefaults(p) });
        const insight = computePersonalizationInsight(get(), "profile");
        if (insight) set({ personalizationInsight: insight });
      },

      /** Backfills fields older saves predate, so every profile behaves like a new one. */
      normalizeProfileDefaults: () => {
        const state = get();
        const profile = state.userProfile;
        const history = normalizeCheckInHistory(state.tdeeFeedbackHistory);
        const nextProfile = profile ? withPlanningDefaults(profile) : profile;
        const dailyPlans = Object.fromEntries(
          Object.entries(state.dailyPlans).map(([key, meals]) => [
            key,
            migratePlannedMeals(meals, state.userRecipes),
          ]),
        );
        const plannedMeals = migratePlannedMeals(
          dailyPlans[state.todayDateKey] ?? state.plannedMeals,
          state.userRecipes,
        );
        set({
          lastBeverageBySlot: state.lastBeverageBySlot ?? {},
          userProfile: nextProfile,
          tdeeFeedbackHistory: history,
          dailyPlans,
          plannedMeals,
          favoriteIds: migrateRecipeIdList(state.favoriteIds),
          dislikedIds: migrateRecipeIdList(state.dislikedIds),
          mealTracking: migrateMealTracking(
            state.mealTracking,
            dailyPlans,
            plannedMeals,
            state.todayDateKey,
          ),
          targets: nextProfile
            ? targetsWithCalories(nextProfile, state.targets.calories)
            : state.targets,
        });
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
        get().normalizeProfileDefaults();
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
          pantryCheckedKeys: [],
          userRecipes: [],
          todayHouseholdOverride: null,
          lastBeverageBySlot: {},
          mealTracking: {},
          snackLogs: {},
          savedSnacks: [],
          swapLog: [],
          displayPrefs: null,
          usageEvents: [],
          questionQueue: [],
          questionLog: {},
          lastQuestionAskedAt: null,
          checkpoints: [],
          myFoods: [],
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

      setTodayDateKey: (key) =>
        set((s) => ({
          todayDateKey: key,
          todayHouseholdOverride:
            s.todayHouseholdOverride?.dateKey === key ? s.todayHouseholdOverride : null,
        })),
      ensureTodaySynced: () => {
        const actual = toDateKey(new Date());
        const s = get();
        const nextPlans = { ...s.dailyPlans };
        if (s.plannedMeals.length > 0 && (nextPlans[s.todayDateKey]?.length ?? 0) === 0) {
          nextPlans[s.todayDateKey] = s.plannedMeals;
        }
        const sourceMeals =
          (nextPlans[s.todayDateKey]?.length ? nextPlans[s.todayDateKey] : null) ??
          (s.plannedMeals.length > 0 ? s.plannedMeals : null) ??
          [];
        if ((nextPlans[actual]?.length ?? 0) === 0 && sourceMeals.length > 0) {
          nextPlans[actual] = sourceMeals;
        }
        const todayMeals = nextPlans[actual] ?? [];
        const plansUnchanged =
          nextPlans[actual] === s.dailyPlans[actual] &&
          nextPlans[s.todayDateKey] === s.dailyPlans[s.todayDateKey];
        if (
          s.todayDateKey === actual &&
          s.plannedMeals === todayMeals &&
          plansUnchanged
        ) {
          return;
        }
        set({
          todayDateKey: actual,
          dailyPlans: nextPlans,
          plannedMeals: todayMeals,
          todayHouseholdOverride:
            s.todayHouseholdOverride?.dateKey === actual ? s.todayHouseholdOverride : null,
        });
      },
      setTodayHouseholdOverride: (override) => set({ todayHouseholdOverride: override }),
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
        nextDailyPlans = {
          ...nextDailyPlans,
          [targetDateKey]: applySlotBeverageDefaults(
            nextDailyPlans[targetDateKey] ?? built.meals,
            state.lastBeverageBySlot,
          ),
        };
        const finalMeals = nextDailyPlans[targetDateKey] ?? built.meals;
        set((s) => ({
          plannedMeals: targetDateKey === s.todayDateKey ? finalMeals : s.plannedMeals,
          dailyPlans: nextDailyPlans,
          macroRedistributionNotices: built.redistributed
            ? [...new Set([...s.macroRedistributionNotices, targetDateKey])]
            : s.macroRedistributionNotices,
          mealTracking: clearDayTracking(s.mealTracking, targetDateKey),
          grocerySelectedDateKeys: mergeGroceryDates(s.grocerySelectedDateKeys, [targetDateKey]),
          groceryCheckedKeys: [],
          pantryCheckedKeys: [],
        }));
        void get().syncAccountSnapshot();
        return { ok: true, dateKey: targetDateKey };
      },

      generateWeek: (anchorDate = new Date(), overrides) => {
        const state = get();
        const opts = buildGenerateOptions(state, overrides);
        if (!opts || !state.userProfile) return;
        const library = recipesFor(state);
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
          library,
        );
        nextDailyPlans = applyLowComplexityToPlans(
          keys,
          nextDailyPlans,
          state.userProfile,
          opts,
          state.lockedDays,
          state.lockedMeals,
          state.targets.calories,
          library,
        );
        for (const key of keys) {
          if (nextDailyPlans[key]) {
            nextDailyPlans[key] = applySlotBeverageDefaults(
              nextDailyPlans[key]!,
              state.lastBeverageBySlot,
            );
          }
        }
        set((s) => ({
          dailyPlans: nextDailyPlans,
          plannedMeals: nextDailyPlans[s.todayDateKey] ?? s.plannedMeals,
          macroRedistributionNotices:
            noticeKeys.length > 0
              ? [...new Set([...s.macroRedistributionNotices, ...noticeKeys])]
              : s.macroRedistributionNotices,
          grocerySelectedDateKeys: mergeGroceryDates(s.grocerySelectedDateKeys, keys),
          groceryCheckedKeys: [],
          pantryCheckedKeys: [],
        }));
        void get().syncAccountSnapshot();
      },

      generateDays: (startDate, dayCount, overrides) => {
        get().generateForDateKeys(dateKeysForRange(startDate, dayCount), overrides);
      },

      generateForDateKeys: (dateKeys, overrides) => {
        const state = get();
        const opts = buildGenerateOptions(state, overrides);
        if (!opts || !state.userProfile) return;
        const library = recipesFor(state);
        const keys = [...new Set(dateKeys)].sort();
        if (keys.length === 0) return;
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
        for (const weekKeys of groupDateKeysByWeek(keys)) {
          nextDailyPlans = applyWeeklyMealPrepToPlans(
            weekKeys,
            nextDailyPlans,
            state.userProfile,
            opts,
            state.lockedDays,
            state.targets.calories,
            library,
          );
          nextDailyPlans = applyLowComplexityToPlans(
            weekKeys,
            nextDailyPlans,
            state.userProfile,
            opts,
            state.lockedDays,
            state.lockedMeals,
            state.targets.calories,
            library,
          );
        }
        for (const key of keys) {
          if (nextDailyPlans[key]) {
            nextDailyPlans[key] = applySlotBeverageDefaults(
              nextDailyPlans[key]!,
              state.lastBeverageBySlot,
            );
          }
        }
        set((s) => ({
          dailyPlans: nextDailyPlans,
          plannedMeals: nextDailyPlans[s.todayDateKey] ?? s.plannedMeals,
          macroRedistributionNotices:
            noticeKeys.length > 0
              ? [...new Set([...s.macroRedistributionNotices, ...noticeKeys])]
              : s.macroRedistributionNotices,
          grocerySelectedDateKeys: mergeGroceryDates(s.grocerySelectedDateKeys, keys),
        }));
        void get().syncAccountSnapshot();
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

      clearRangeMeals: (dateKeys) => {
        const state = get();
        let nextDailyPlans = { ...state.dailyPlans };
        let nextPlannedMeals = state.plannedMeals;
        let nextNotices = state.macroRedistributionNotices;
        let changed = false;

        for (const key of dateKeys) {
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
        const library = recipesFor(state);
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
            library,
          );
          nextDailyPlans = applyLowComplexityToPlans(
            weekKeys,
            nextDailyPlans,
            state.userProfile,
            opts,
            state.lockedDays,
            state.lockedMeals,
            state.targets.calories,
            library,
          );
        }
        for (const key of monthKeys) {
          if (nextDailyPlans[key]) {
            nextDailyPlans[key] = applySlotBeverageDefaults(
              nextDailyPlans[key]!,
              state.lastBeverageBySlot,
            );
          }
        }
        set((s) => ({
          dailyPlans: nextDailyPlans,
          plannedMeals: nextDailyPlans[s.todayDateKey] ?? s.plannedMeals,
          macroRedistributionNotices:
            noticeKeys.length > 0
              ? [...new Set([...s.macroRedistributionNotices, ...noticeKeys])]
              : s.macroRedistributionNotices,
          grocerySelectedDateKeys: mergeGroceryDates(s.grocerySelectedDateKeys, monthKeys),
          groceryCheckedKeys: [],
          pantryCheckedKeys: [],
        }));
        void get().syncAccountSnapshot();
      },

      addUserRecipe: (recipe) => {
        set((s) => ({
          userRecipes: [...s.userRecipes.filter((r) => r.id !== recipe.id), recipe],
        }));
        void get().syncAccountSnapshot();
      },

      toggleFavorite: (recipeId) => {
        const state = get();
        const recipe = findRecipe(recipeId, state.userRecipes);
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
        const recipe = findRecipe(recipeId, state.userRecipes);
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

      setMealFatVariation: (dateKey, slot, fatVariationId) => {
        const state = get();
        const meal = mealsForDate(state, dateKey).find((m) => m.slot === slot);
        if (!meal) return;
        const updateMeals = (meals: PlannedMeal[]) =>
          meals.map((m) =>
            m.slot === slot ? { ...m, selectedFatVariationId: fatVariationId } : m,
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

      setMealBeverage: (dateKey, slot, beverageId) => {
        const state = get();
        const meal = mealsForDate(state, dateKey).find((m) => m.slot === slot);
        if (!meal) return;
        const updateMeals = (meals: PlannedMeal[]) =>
          meals.map((m) => (m.slot === slot ? { ...m, beverageId } : m));
        const nextDaily = { ...state.dailyPlans };
        if (nextDaily[dateKey]) {
          nextDaily[dateKey] = updateMeals(nextDaily[dateKey]!);
        }
        set((s) => ({
          dailyPlans: nextDaily,
          plannedMeals:
            dateKey === s.todayDateKey ? updateMeals(s.plannedMeals) : s.plannedMeals,
          lastBeverageBySlot: {
            ...s.lastBeverageBySlot,
            [canonicalBeverageSlot(slot)]: beverageId,
          },
        }));
        void get().syncAccountSnapshot();
      },

      recordUsage: (kind, n) => {
        const now = new Date();
        const cutoff = now.getTime() - 14 * 24 * 60 * 60 * 1000;
        set((s) => ({
          usageEvents: [
            ...s.usageEvents.filter((e) => new Date(e.at).getTime() >= cutoff),
            { kind, at: now.toISOString(), ...(n != null ? { n } : {}) },
          ],
        }));
      },

      refreshQuestions: (extra = []) => {
        const s = get();
        if (!s.userProfile) return;
        const now = new Date();
        const prefs = resolveDisplayPrefs(s.displayPrefs);
        const library = recipesFor(s);
        const byId = new Map(library.map((r) => [r.id, r] as const));
        const passes: { recipe: Recipe; at: string }[] = [];
        for (const [dateKey, day] of Object.entries(s.mealTracking)) {
          const meals = mealsForDate(s, dateKey);
          for (const [slot, entry] of Object.entries(day ?? {})) {
            if (entry?.status !== "skipped") continue;
            const meal = meals.find((m) => m.slot === slot);
            if (meal) passes.push({ recipe: meal.recipe, at: entry.loggedAt });
          }
        }
        for (const swap of s.swapLog) {
          const recipe = byId.get(swap.recipeId);
          if (recipe) passes.push({ recipe, at: swap.at });
        }
        const logSignals = analyzePersonalizationSignals({
          mealTracking: s.mealTracking,
          dailyPlans: s.dailyPlans,
          plannedMeals: s.plannedMeals,
          todayDateKey: s.todayDateKey,
        });
        const candidates = [
          ...extra,
          ...logPlanQuestions(s.userProfile, logSignals, now),
          ...usageQuestions(s.usageEvents, prefs, s.profileAnchoredAt, now),
          ...tasteQuestions(passes, s.userProfile.dislikedFoodCustom ?? "", now),
        ];
        let queue = s.questionQueue;
        for (const q of candidates) queue = enqueue(queue, s.questionLog, q, now);
        if (queue !== s.questionQueue) set({ questionQueue: queue });
      },

      markQuestionsAsked: () => set({ lastQuestionAskedAt: new Date().toISOString() }),

      answerQuestion: (id, answer) => {
        const s = get();
        const question = s.questionQueue.find((q) => q.id === id);
        const now = new Date();
        const next = recordAnswer(s.questionQueue, s.questionLog, id, answer, now);
        set({ questionQueue: next.queue, questionLog: next.log, lastQuestionAskedAt: now.toISOString() });
        if (answer !== "yes" || !question || !s.userProfile) return null;
        const change = applyChange(
          {
            displayPrefs: resolveDisplayPrefs(s.displayPrefs),
            dislikedFoodCustom: s.userProfile.dislikedFoodCustom ?? "",
            ingredientVariety: s.userProfile.ingredientVariety,
            weeklyMealPrepRepeatCount: s.userProfile.weeklyMealPrepRepeatCount,
            maxLeftoverStreakDays: s.userProfile.maxLeftoverStreakDays,
            planSettings: {
              prioritizeMinProtein: s.userProfile.prioritizeMinProtein,
              weeklyMealPrepEnabled: s.userProfile.weeklyMealPrepEnabled,
              weeklyMealPrepSlot: s.userProfile.weeklyMealPrepSlot,
              weeklyMealPrepRepeatCount: s.userProfile.weeklyMealPrepRepeatCount,
              prioritizeMinimalPrep: s.userProfile.prioritizeMinimalPrep,
            },
          },
          question.change,
        );
        return commitCheckpoint(set, get, change.what, question.why, change.before, change.after);
      },

      setDisplayPref: (element, on) => {
        const before = resolveDisplayPrefs(get().displayPrefs);
        if (before[element] === on) return;
        const label = DISPLAY_ELEMENTS.find((e) => e.id === element)?.label ?? element;
        commitCheckpoint(
          set,
          get,
          `${on ? "Turned on" : "Turned off"}: ${label}`,
          "Changed in Settings",
          { displayPrefs: before },
          { displayPrefs: { ...before, [element]: on } },
        );
      },

      applySimplestView: () => {
        const before = resolveDisplayPrefs(get().displayPrefs);
        return commitCheckpoint(set, get, "Simplest view", "Chosen in Settings", { displayPrefs: before }, {
          displayPrefs: simplestView(),
        });
      },

      restoreCheckpoint: (id) => {
        const s = get();
        const cp = s.checkpoints.find((c) => c.id === id);
        if (!cp || !s.userProfile) return null;
        const current: CheckpointState = {};
        if (cp.before.displayPrefs) current.displayPrefs = resolveDisplayPrefs(s.displayPrefs);
        if (cp.before.dislikedFoodCustom != null) current.dislikedFoodCustom = s.userProfile.dislikedFoodCustom ?? "";
        if (cp.before.ingredientVariety != null) current.ingredientVariety = s.userProfile.ingredientVariety;
        if (cp.before.weeklyMealPrepRepeatCount != null) {
          current.weeklyMealPrepRepeatCount = s.userProfile.weeklyMealPrepRepeatCount ?? 3;
        }
        if (cp.before.maxLeftoverStreakDays != null) {
          current.maxLeftoverStreakDays = s.userProfile.maxLeftoverStreakDays ?? 2;
        }
        if (cp.before.planSettings) {
          const now: Record<string, unknown> = {};
          for (const key of Object.keys(cp.before.planSettings)) {
            now[key] = (s.userProfile as unknown as Record<string, unknown>)[key];
          }
          current.planSettings = now as typeof cp.before.planSettings;
        }
        return commitCheckpoint(set, get, `Restored: ${cp.what}`, "Restored from Display history", current, cp.before);
      },

      setStartingDisplay: (kind) => set({ displayPrefs: startingDisplayPrefs(kind) }),

      devShowNextQuestion: () => {
        get().refreshQuestions();
        const id = get().questionQueue[0]?.id ?? null;
        set({ devForcedQuestionId: id });
        return id;
      },

      devResetQuestionTimers: () => set({ lastQuestionAskedAt: null, questionLog: {} }),

      clearDevForcedQuestion: () => set({ devForcedQuestionId: null }),

      saveMyFood: (food) => {
        set((s) => ({ myFoods: [food, ...s.myFoods.filter((f) => f.id !== food.id)].slice(0, 200) }));
      },

      addSnackLog: (dateKey, entry) => {
        set((s) => ({
          snackLogs: { ...s.snackLogs, [dateKey]: [...(s.snackLogs[dateKey] ?? []), entry] },
        }));
        void get().syncAccountSnapshot();
      },

      removeSnackLog: (dateKey, loggedAt) => {
        set((s) => {
          const next = (s.snackLogs[dateKey] ?? []).filter((e) => e.loggedAt !== loggedAt);
          const snackLogs = { ...s.snackLogs };
          if (next.length > 0) snackLogs[dateKey] = next;
          else delete snackLogs[dateKey];
          return { snackLogs };
        });
        void get().syncAccountSnapshot();
      },

      saveSnack: (snack) => {
        const saved: SavedSnack = { ...snack, id: crypto.randomUUID() };
        set((s) => ({ savedSnacks: [...s.savedSnacks.filter((x) => x.name !== saved.name), saved] }));
        void get().syncAccountSnapshot();
        return saved;
      },

      deleteSavedSnack: (id) => {
        set((s) => ({ savedSnacks: s.savedSnacks.filter((x) => x.id !== id) }));
        void get().syncAccountSnapshot();
      },

      regenerateToday: () => {
        const state = get();
        const dateKey = state.todayDateKey;
        if (state.lockedDays.includes(dateKey) || !state.userProfile) return { ok: false };
        const before = mealsForDate(state, dateKey);
        const tracking = state.mealTracking[dateKey] ?? {};
        const keepSlots = new Set(
          before
            .filter((m) => {
              const entry = tracking[m.slot];
              return m.kept === true || (entry != null && entry.status !== "skipped");
            })
            .map((m) => m.slot),
        );
        // Today only: no low-complexity changes to other days.
        const built = buildDayPlanRespectingLocks(state, dateKey, { lowComplexity: false }, keepSlots);
        if (!built) return { ok: false };
        const lockedOrKept = new Set(
          built.meals
            .filter((m) => keepSlots.has(m.slot) || isMealLocked(state.lockedMeals, dateKey, m.slot))
            .map((m) => m.slot),
        );
        const keptTracking: DayMealTracking = Object.fromEntries(
          Object.entries(tracking).filter(([slot]) => lockedOrKept.has(slot as MealSlotId)),
        );
        set((s) => {
          const mealTracking = { ...s.mealTracking };
          if (Object.keys(keptTracking).length > 0) mealTracking[dateKey] = keptTracking;
          else delete mealTracking[dateKey];
          return {
            ...setDayMeals(s, dateKey, built.meals),
            mealTracking,
            grocerySelectedDateKeys: mergeGroceryDates(s.grocerySelectedDateKeys, [dateKey]),
          };
        });
        void get().syncAccountSnapshot();
        return {
          ok: true,
          previous: { dateKey, meals: before, tracking: state.mealTracking[dateKey] ?? null },
        };
      },

      restoreDay: (dateKey, meals, tracking) => {
        set((s) => {
          const mealTracking = { ...s.mealTracking };
          if (tracking && Object.keys(tracking).length > 0) mealTracking[dateKey] = tracking;
          else delete mealTracking[dateKey];
          return { ...setDayMeals(s, dateKey, meals), mealTracking };
        });
        void get().syncAccountSnapshot();
      },

      keepMeal: (dateKey, slot) => {
        patchMealInDay(set, get, dateKey, slot, { kept: true });
        void get().syncAccountSnapshot();
      },

      setWeighedBatch: (dateKey, slot, grams) => {
        const value = grams != null && Number.isFinite(grams) && grams > 0 ? Math.round(grams) : undefined;
        const meal = mealsForDate(get(), dateKey).find((m) => m.slot === slot);
        const batchId = meal?.mealPrep?.batchId;
        if (!batchId) {
          patchMealInDay(set, get, dateKey, slot, { weighedBatchGrams: value });
        } else {
          // Meal prep and leftovers: every day cooked from this batch shares the weight.
          const update = (meals: PlannedMeal[]) =>
            meals.map((m) => (m.mealPrep?.batchId === batchId ? { ...m, weighedBatchGrams: value } : m));
          set((s) => ({
            dailyPlans: Object.fromEntries(
              Object.entries(s.dailyPlans).map(([key, meals]) => [
                key,
                meals.some((m) => m.mealPrep?.batchId === batchId) ? update(meals) : meals,
              ]),
            ),
            plannedMeals: update(s.plannedMeals),
          }));
        }
        void get().syncAccountSnapshot();
      },

      addMealSides: (dateKey, slot, sides) => {
        const meal = mealsForDate(get(), dateKey).find((m) => m.slot === slot);
        if (!meal || sides.length === 0) return;
        patchMealInDay(set, get, dateKey, slot, { sides: [...(meal.sides ?? []), ...sides] });
        void get().syncAccountSnapshot();
      },

      removeMealSide: (dateKey, slot, index) => {
        const meal = mealsForDate(get(), dateKey).find((m) => m.slot === slot);
        if (!meal?.sides) return;
        const next = meal.sides.filter((_, i) => i !== index);
        patchMealInDay(set, get, dateKey, slot, { sides: next.length > 0 ? next : undefined });
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
        const pick = pickRecipeForSlot(recipesFor(state), slot, opts, exclude);
        if (!pick) return;

        const built = buildSlotReplacementMeals(state, targetDateKey, slot, pick);
        if (!built) return;
        const regenerated = built.meals.map((m) => (m.slot === slot ? { ...m, generated: true } : m));

        set((s) => ({
          ...setDayMeals(s, targetDateKey, regenerated),
          swapLog: logSwap(s.swapLog, base.find((m) => m.slot === slot)?.recipe.id, pick.id, targetDateKey),
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
        const recipe = findRecipe(recipeId, state.userRecipes);
        if (!recipe) return;
        const base = mealsForDate(state, dateKey);
        if (!base.some((m) => m.slot === slot)) return;

        const built = buildSlotReplacementMeals(state, dateKey, slot, recipe);
        if (!built) return;

        const swappedFrom = base.find((m) => m.slot === slot)?.recipe.id;
        set((s) => ({
          ...setDayMeals(s, dateKey, built.meals),
          swapLog: logSwap(s.swapLog, swappedFrom, recipe.id, dateKey),
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
          };
        }),

      togglePantryItemChecked: (itemKey) =>
        set((s) => ({
          pantryCheckedKeys: s.pantryCheckedKeys.includes(itemKey)
            ? s.pantryCheckedKeys.filter((k) => k !== itemKey)
            : [...s.pantryCheckedKeys, itemKey],
        })),

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

          // Log patterns only queue questions (refreshQuestions); settings change on a Yes.
          if (loggedCount >= 3 && s.userProfile) {
            const insight = computePersonalizationInsight(
              { ...s, mealTracking: nextTracking },
              "tracking",
            );
            if (insight) patch.personalizationInsight = insight;
          }

          return patch;
        }),

      clearGroceryAll: () =>
        set({
          groceryCheckedKeys: [],
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
              scaleMax: CHECK_IN_SCALE_MAX,
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
          scaleMax: CHECK_IN_SCALE_MAX,
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

        const history = normalizeCheckInHistory([...state.tdeeFeedbackHistory, entry]);
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

        const finalProfile: UserProfile = withPlanningDefaults({
          ...mergedProfile,
          ...experience.profileUpdates,
        });

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

      assignMealPrepBatch: ({
        recipe,
        slot,
        portionsCooked,
        dateKeys,
        scale = 1,
        selectedVariationId,
      }) => {
        const state = get();
        const batchId = crypto.randomUUID();
        const keys = dateKeys.slice(0, portionsCooked);
        const portions = Math.min(portionsCooked, keys.length);
        if (portions === 0) return;

        const order = state.userProfile
          ? slotsForMealsPerDay(state.userProfile)
          : (["breakfast", "lunch", "dinner", "snack"] as MealSlotId[]);

        const nextDailyPlans = { ...state.dailyPlans };
        keys.forEach((dateKey, index) => {
          if (state.lockedDays.includes(dateKey)) return;
          const existing = mealsForDate(state, dateKey).filter((m) => m.slot !== slot);
          const meal = createPlannedMeal(slot, recipe, {
            scale,
            selectedVariationId,
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
        pantryCheckedKeys: s.pantryCheckedKeys,
        userRecipes: s.userRecipes,
        todayHouseholdOverride: s.todayHouseholdOverride,
        lastBeverageBySlot: s.lastBeverageBySlot,
        mealTracking: s.mealTracking,
        snackLogs: s.snackLogs,
        savedSnacks: s.savedSnacks,
        swapLog: s.swapLog,
        displayPrefs: s.displayPrefs,
        usageEvents: s.usageEvents,
        questionQueue: s.questionQueue,
        questionLog: s.questionLog,
        lastQuestionAskedAt: s.lastQuestionAskedAt,
        checkpoints: s.checkpoints,
        myFoods: s.myFoods,
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
      onRehydrateStorage: () => (state) => {
        state?.normalizeProfileDefaults();
        state?.ensureTodaySynced();
      },
    },
  ),
);

/** Apply profile to targets (call after profile save / activity change). */
export function applyProfileToTargets(profile: UserProfile): DailyTargets {
  return computeDailyTargets(profile);
}

export function useTodayTotals() {
  const todayDateKey = useAppStore((s) => s.todayDateKey);
  const dailyPlans = useAppStore((s) => s.dailyPlans);
  const plannedMeals = useAppStore((s) => s.plannedMeals);
  return sumPlannedMacros(mealsForDate({ dailyPlans, plannedMeals, todayDateKey }, todayDateKey));
}

/**
 * Goal-based portions: whenever plans, targets, the profile, meal locks, or logs change, re-size
 * today's and future meals to their share of the daily targets. Never changed: past days, kept
 * meals, locked meals, and meals logged as eaten. The samePortions check stops the update from
 * re-triggering itself.
 */
function portionedPlans(
  s: AppState,
): Pick<AppState, "dailyPlans" | "plannedMeals"> | null {
  if (!s.userProfile || !(s.targets.calories > 0)) return null;
  const timing = s.userProfile.mealTiming;
  const resize = (dateKey: string, meals: PlannedMeal[]) => {
    const lockedSlots = new Set(
      meals.filter((m) => isMealLocked(s.lockedMeals, dateKey, m.slot)).map((m) => m.slot),
    );
    // Meals already logged as eaten keep the amounts they were eaten at.
    const day = s.mealTracking[dateKey] ?? {};
    const fixedSlots = new Set(
      meals
        .filter((m) => {
          const entry = day[m.slot];
          return entry != null && entry.status !== "skipped";
        })
        .map((m) => m.slot),
    );
    return applyGoalPortions(meals, s.targets, { timing, lockedSlots, fixedSlots });
  };
  let dailyChanged = false;
  let todayChanged = false;
  const nextDaily: Record<string, PlannedMeal[]> = {};
  for (const [dateKey, meals] of Object.entries(s.dailyPlans)) {
    if (dateKey < s.todayDateKey) {
      nextDaily[dateKey] = meals;
      continue;
    }
    const next = resize(dateKey, meals);
    if (samePortions(next, meals)) {
      nextDaily[dateKey] = meals;
    } else {
      nextDaily[dateKey] = next;
      dailyChanged = true;
    }
  }
  let plannedMeals = s.plannedMeals;
  const today = nextDaily[s.todayDateKey];
  if (today) {
    if (today !== s.plannedMeals && !samePortions(today, s.plannedMeals)) {
      plannedMeals = today;
      todayChanged = true;
    }
  } else if (s.plannedMeals.length > 0) {
    const next = resize(s.todayDateKey, s.plannedMeals);
    if (!samePortions(next, s.plannedMeals)) {
      plannedMeals = next;
      todayChanged = true;
    }
  }
  if (!dailyChanged && !todayChanged) return null;
  return { dailyPlans: dailyChanged ? nextDaily : s.dailyPlans, plannedMeals };
}

useAppStore.subscribe((s, prev) => {
  if (
    s.dailyPlans === prev.dailyPlans &&
    s.plannedMeals === prev.plannedMeals &&
    s.targets === prev.targets &&
    s.userProfile === prev.userProfile &&
    s.lockedMeals === prev.lockedMeals &&
    s.mealTracking === prev.mealTracking &&
    s.todayDateKey === prev.todayDateKey
  ) {
    return;
  }
  const next = portionedPlans(s);
  if (next) useAppStore.setState(next);
});
