import { useEffect, useState } from "react";
import { useOverlayBack } from "@/hooks/useOverlayBack";
import { X } from "lucide-react";
import { AccountSignupSection } from "@/components/AccountSignupSection";
import { FeedbackCheckInButton } from "@/components/FeedbackCheckIn";
import { CheckInSheet } from "@/components/CheckInSheet";
import { HouseholdPicker } from "@/components/HouseholdPicker";
import { HouseholdDetailsSection } from "@/components/HouseholdDetailsSection";
import { useAppStore } from "@/store/useAppStore";
import { targetsAfterProfileChange } from "@/utils/tdee";
import { MealPatternSection } from "@/components/MealPatternSection";
import { ProteinPreferenceSection } from "@/components/ProteinPreferenceSection";
import { PlanningPrefsSection, type PlanningPrefsValue } from "@/components/PlanningPrefsSection";
import { CookingShoppingSection } from "@/components/CookingShoppingSection";
import type { RecipeMealSlotId } from "@/types";
import type { HouseholdMember, MacroSplitPreference, MealTimingPreference, ProteinPreference, UserProfile } from "@/types/profile";
import {
  clampAdults,
  clampChildren,
  householdPresetFromCounts,
  resolveHouseholdCounts,
  resolveHouseholdMembers,
  syncHouseholdMembers,
} from "@/utils/household";
import { MinimumProteinSettings } from "@/components/MinimumProteinSettings";
import { MACRO_SPLIT_OPTIONS } from "@/utils/macroSplit";
import { DisplaySettings } from "@/components/DisplaySettings";
import { DevPanel } from "@/components/DevPanel";
import { BUILD_INFO } from "@/utils/buildInfo";
import { useDisplayPrefs } from "@/hooks/useDisplayPrefs";
import { MealTimingPreferenceSection } from "@/components/MealTimingPreferenceSection";
import { CuisinePreferenceSection } from "@/components/CuisinePreferenceSection";
import {
  DEFAULT_COOKING_EVENTS,
  DEFAULT_EATEN_MEALS,
  DEFAULT_INGREDIENT_VARIETY,
  DEFAULT_KITCHEN_EQUIPMENT,
  DEFAULT_LEFTOVER_STREAK,
  DEFAULT_MAX_PREP_MINUTES,
  DEFAULT_PROTEIN_PREFERENCE,
  DEFAULT_SHOPPING_TRIPS,
  DEFAULT_SNACK_STYLE,
  DEFAULT_SNACKS_PER_DAY,
  DEFAULT_WEEKLY_PREP_SLOT,
  deriveCookingFlags,
  mealsPerDayFromSelections,
  resolveEatenMeals,
  resolveSnacksPerDay,
} from "@/utils/planningPrefs";
import {
  goalLinkedProteinGrams,
  isCustomProteinOverride,
  migrateProteinPreference,
} from "@/utils/proteinMinimum";

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const display = useDisplayPrefs();
  // Hidden Dev panel: tap the version 5 times.
  const [versionTaps, setVersionTaps] = useState(0);
  const [devOpen, setDevOpen] = useState(false);
  const userProfile = useAppStore((s) => s.userProfile);
  const setUserProfile = useAppStore((s) => s.setUserProfile);
  const setTargets = useAppStore((s) => s.setTargets);
  const targets = useAppStore((s) => s.targets);
  const authSession = useAppStore((s) => s.authSession);
  const logout = useAppStore((s) => s.logout);
  const syncAccountSnapshot = useAppStore((s) => s.syncAccountSnapshot);

  const [adults, setAdults] = useState(2);
  const [childrenCount, setChildrenCount] = useState(0);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [householdAvoidChips, setHouseholdAvoidChips] = useState<string[]>([]);
  const [householdAvoidCustom, setHouseholdAvoidCustom] = useState("");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const lastFeedbackSubmittedAt = useAppStore((s) => s.lastFeedbackSubmittedAt);
  const adaptiveTdeeEstimate = useAppStore((s) => s.adaptiveTdeeEstimate);
  const [minProteinGrams, setMinProteinGrams] = useState("");
  const [macroSplitPreference, setMacroSplitPreference] =
    useState<MacroSplitPreference>("balanced");
  const [mealTiming, setMealTiming] = useState<MealTimingPreference | null>(null);
  const [preferredCuisines, setPreferredCuisines] = useState<string[]>([]);
  const [proteinPreference, setProteinPreference] =
    useState<ProteinPreference>(DEFAULT_PROTEIN_PREFERENCE);
  const [eatenMeals, setEatenMeals] = useState<RecipeMealSlotId[]>(() => [...DEFAULT_EATEN_MEALS]);
  const [snacksPerDay, setSnacksPerDay] = useState(DEFAULT_SNACKS_PER_DAY);
  const [planningPrefs, setPlanningPrefs] = useState<PlanningPrefsValue>({
    shoppingTripsPerWeek: DEFAULT_SHOPPING_TRIPS,
    cookingEventsPerWeek: DEFAULT_COOKING_EVENTS,
    maxLeftoverStreakDays: DEFAULT_LEFTOVER_STREAK,
    ingredientVariety: DEFAULT_INGREDIENT_VARIETY,
    maxPrepMinutes: DEFAULT_MAX_PREP_MINUTES,
    weeklyMealPrepSlot: DEFAULT_WEEKLY_PREP_SLOT,
    snackStyle: DEFAULT_SNACK_STYLE,
    preferredProteinSources: [],
    avoidedProteinSources: [],
    foodsToAvoid: "",
    kitchenEquipment: [...DEFAULT_KITCHEN_EQUIPMENT],
  });
  useOverlayBack(userProfile != null, onClose);

  useEffect(() => {
    if (!userProfile) return;
    const counts = resolveHouseholdCounts(userProfile);
    setAdults(counts.adults);
    setChildrenCount(counts.children);
    setMembers(resolveHouseholdMembers(userProfile));
    setHouseholdAvoidChips(userProfile.householdFoodAvoidChips ?? []);
    setHouseholdAvoidCustom(userProfile.householdFoodAvoidCustom ?? "");
    const preference = migrateProteinPreference(userProfile.proteinPreference);
    setMinProteinGrams(
      (userProfile.minimumProteinCustom ??
        isCustomProteinOverride(userProfile.minimumProteinGrams, {
          goal: userProfile.goal,
          preference,
          weightKg: userProfile.weightKg,
          heightCm: userProfile.heightCm,
        }))
        ? String(userProfile.minimumProteinGrams)
        : "",
    );
    setMacroSplitPreference(userProfile.macroSplitPreference ?? "balanced");
    setMealTiming(userProfile.mealTiming ?? null);
    setPreferredCuisines(userProfile.preferredCuisines ?? []);
    setProteinPreference(preference);
    setEatenMeals(resolveEatenMeals(userProfile));
    setSnacksPerDay(resolveSnacksPerDay(userProfile));
    setPlanningPrefs({
      shoppingTripsPerWeek: userProfile.shoppingTripsPerWeek ?? DEFAULT_SHOPPING_TRIPS,
      cookingEventsPerWeek: userProfile.cookingEventsPerWeek ?? DEFAULT_COOKING_EVENTS,
      maxLeftoverStreakDays: userProfile.maxLeftoverStreakDays ?? DEFAULT_LEFTOVER_STREAK,
      ingredientVariety: userProfile.ingredientVariety ?? DEFAULT_INGREDIENT_VARIETY,
      maxPrepMinutes:
        userProfile.maxPrepMinutes === undefined
          ? DEFAULT_MAX_PREP_MINUTES
          : userProfile.maxPrepMinutes,
      weeklyMealPrepSlot: userProfile.weeklyMealPrepSlot ?? DEFAULT_WEEKLY_PREP_SLOT,
      snackStyle: userProfile.snackStyle ?? DEFAULT_SNACK_STYLE,
      preferredProteinSources: userProfile.preferredProteinSources ?? [],
      avoidedProteinSources: userProfile.avoidedProteinSources ?? [],
      foodsToAvoid: "",
      kitchenEquipment: userProfile.kitchenEquipment ?? [...DEFAULT_KITCHEN_EQUIPMENT],
    });
  }, [userProfile]);

  if (!userProfile) return null;

  const handleSave = () => {
    const nextAdults = clampAdults(adults);
    const nextChildren = clampChildren(childrenCount);
    const parsedProtein = Number(minProteinGrams);
    const next: UserProfile = {
      ...userProfile,
      householdAdults: nextAdults,
      householdChildren: nextChildren,
      householdMembers: syncHouseholdMembers(nextAdults, nextChildren, members),
      householdFoodAvoidChips: householdAvoidChips,
      householdFoodAvoidCustom: householdAvoidCustom,
      householdPreset: householdPresetFromCounts(nextAdults, nextChildren),
      householdCustomCount: null,
      prioritizeMinProtein: userProfile.prioritizeMinProtein ?? true,
      macroSplitPreference,
      mealTiming,
      preferredCuisines,
      ...deriveCookingFlags(planningPrefs),
      proteinPreference,
      eatenMeals,
      snacksPerDay,
      mealsPerDay: mealsPerDayFromSelections(eatenMeals, snacksPerDay),
      shoppingTripsPerWeek: planningPrefs.shoppingTripsPerWeek,
      cookingEventsPerWeek: planningPrefs.cookingEventsPerWeek,
      maxLeftoverStreakDays: planningPrefs.maxLeftoverStreakDays,
      ingredientVariety: planningPrefs.ingredientVariety,
      maxPrepMinutes: planningPrefs.maxPrepMinutes,
      snackStyle: planningPrefs.snackStyle,
      preferredProteinSources: planningPrefs.preferredProteinSources,
      avoidedProteinSources: planningPrefs.avoidedProteinSources,
      kitchenEquipment: planningPrefs.kitchenEquipment,
      dislikedFoodCustom: [userProfile.dislikedFoodCustom ?? "", planningPrefs.foodsToAvoid]
        .flatMap((s) => s.split(","))
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .join(", "),
      // Typed value = set by hand (kept as-is); empty = follows goal, weight and preference.
      minimumProteinCustom:
        minProteinGrams.trim() !== "" && Number.isFinite(parsedProtein) && parsedProtein > 0,
      minimumProteinGrams:
        minProteinGrams.trim() !== "" && Number.isFinite(parsedProtein) && parsedProtein > 0
          ? Math.round(parsedProtein)
          : goalLinkedProteinGrams({
              goal: userProfile.goal,
              preference: proteinPreference,
              weightKg: userProfile.weightKg,
              heightCm: userProfile.heightCm,
            }),
    };
    setUserProfile(next);
    // Keep current targets (e.g. an applied recommendation) unless a target input changed.
    setTargets(targetsAfterProfileChange(userProfile, useAppStore.getState().userProfile ?? next, targets));
    void syncAccountSnapshot();
    onClose();
  };

  return (
    <>
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close settings"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-labelledby="settings-title"
        className="relative z-[81] flex max-h-[90dvh] w-full max-w-lg flex-col overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="settings-title" className="text-xl font-bold text-slate-900">
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {authSession ? (
          <section className="space-y-2 border-b border-slate-100 pb-5">
            <h3 className="text-base font-semibold text-slate-900">Account</h3>
            <p className="text-sm text-slate-600">Signed in as {authSession.email}</p>
            <button
              type="button"
              onClick={() => {
                void syncAccountSnapshot();
                logout();
                onClose();
              }}
              className="min-h-[48px] w-full rounded-2xl border-2 border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700"
            >
              Log out
            </button>
          </section>
        ) : (
          <div className="border-b border-slate-100 pb-5">
            <AccountSignupSection />
          </div>
        )}

        <MinimumProteinSettings
          derivedGrams={goalLinkedProteinGrams({
            goal: userProfile.goal,
            preference: proteinPreference,
            weightKg: userProfile.weightKg,
            heightCm: userProfile.heightCm,
          })}
          weightKg={userProfile.weightKg}
          heightCm={userProfile.heightCm}
          goal={userProfile.goal}
          preference={proteinPreference}
          proteinGrams={minProteinGrams}
          onProteinGramsChange={setMinProteinGrams}
        />

        <section className="space-y-4 border-b border-slate-100 pb-5">
          <ProteinPreferenceSection
            value={proteinPreference}
            onChange={setProteinPreference}
            goal={userProfile.goal}
            weightKg={userProfile.weightKg}
            heightCm={userProfile.heightCm}
            eatenMeals={eatenMeals}
            snacksPerDay={snacksPerDay}
          />
        </section>

        <section className="space-y-4 border-b border-slate-100 pb-5">
          <MealPatternSection
            eatenMeals={eatenMeals}
            snacksPerDay={snacksPerDay}
            onEatenMealsChange={setEatenMeals}
            onSnacksPerDayChange={setSnacksPerDay}
            compact
          />
        </section>

        <section className="space-y-4 border-b border-slate-100 pb-5">
          <CookingShoppingSection value={planningPrefs} onChange={setPlanningPrefs} />
        </section>

        <section className="space-y-4 border-b border-slate-100 pb-5">
          <PlanningPrefsSection value={planningPrefs} onChange={setPlanningPrefs} />
        </section>

        {display.macroSplitSetting && (
        <section className="space-y-3 border-b border-slate-100 pb-5">
          <h3 className="text-base font-semibold text-slate-900">
            Preferred macro split
          </h3>
          <p className="text-sm text-slate-600">
            Protein target is always met first. Remaining calories are split between carbs and fat
            using this preference when possible.
          </p>
          <div className="flex flex-col gap-2">
            {MACRO_SPLIT_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setMacroSplitPreference(o.id)}
                className={`rounded-2xl border-2 px-4 py-3 text-left transition-colors ${
                  macroSplitPreference === o.id
                    ? "border-[#2563EB] bg-blue-50 text-blue-900"
                    : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
                }`}
              >
                <span className="block text-sm font-semibold">{o.label}</span>
                <span className="mt-0.5 block text-xs font-normal text-slate-600">
                  {o.description}
                </span>
              </button>
            ))}
          </div>
        </section>
        )}

        <section className="space-y-4 border-b border-slate-100 pb-5">
          <MealTimingPreferenceSection
            value={mealTiming}
            onChange={setMealTiming}
            eatenMeals={eatenMeals}
          />
        </section>

        <section className="space-y-4 border-b border-slate-100 pb-5">
          <CuisinePreferenceSection selected={preferredCuisines} onChange={setPreferredCuisines} />
        </section>

        <DisplaySettings />

        <section className="space-y-3 border-b border-slate-100 pb-5">
          <h3 className="text-base font-semibold text-slate-900">Check-in</h3>
          <p className="text-sm text-slate-600">
            Optional — open anytime to refine your calorie target, food preferences, and meal
            planning experience. All responses are saved to your profile.
          </p>
          {lastFeedbackSubmittedAt && (
            <p className="text-xs text-slate-500">
              Last check-in:{" "}
              {new Date(lastFeedbackSubmittedAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              {adaptiveTdeeEstimate != null &&
                ` · Personal TDEE ~${adaptiveTdeeEstimate.toLocaleString()} kcal`}
            </p>
          )}
          <FeedbackCheckInButton variant="card" onOpen={() => setFeedbackOpen(true)} />
        </section>

        <section className="space-y-3 pt-5">
          <h3 className="text-base font-semibold text-slate-900">Household size</h3>
          <HouseholdPicker
            adults={adults}
            childrenCount={childrenCount}
            onAdultsChange={(n) => {
              setAdults(n);
              setMembers(syncHouseholdMembers(n, childrenCount, members));
            }}
            onChildrenChange={(n) => {
              setChildrenCount(n);
              setMembers(syncHouseholdMembers(adults, n, members));
            }}
            compact
          />
          {adults + childrenCount > 1 && (
            <HouseholdDetailsSection
              members={members}
              onMembersChange={setMembers}
              avoidChips={householdAvoidChips}
              avoidCustom={householdAvoidCustom}
              onAvoidChipsChange={setHouseholdAvoidChips}
              onAvoidCustomChange={setHouseholdAvoidCustom}
            />
          )}
        </section>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[52px] flex-1 rounded-2xl border-2 border-slate-200 bg-white py-3 text-base font-semibold text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="min-h-[52px] flex-1 rounded-2xl bg-[#2563EB] py-3 text-base font-semibold text-white"
          >
            Save
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            const next = versionTaps + 1;
            if (next >= 5) {
              setVersionTaps(0);
              setDevOpen(true);
            } else {
              setVersionTaps(next);
            }
          }}
          className="mt-6 block w-full text-center text-xs text-slate-400"
        >
          Version {BUILD_INFO.version} ({BUILD_INFO.commit})
        </button>
      </div>
    </div>
    {feedbackOpen && <CheckInSheet onClose={() => setFeedbackOpen(false)} />}
    {devOpen && <DevPanel onClose={() => setDevOpen(false)} />}
    </>
  );
}
