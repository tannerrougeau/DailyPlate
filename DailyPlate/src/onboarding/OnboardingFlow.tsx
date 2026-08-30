import { useState } from "react";
import { FoodPreferenceSection } from "@/components/FoodPreferenceSection";
import { WeeklyMealPrepSection } from "@/components/WeeklyMealPrepSection";
import { MinimalPrepPreferenceSection } from "@/components/MinimalPrepPreferenceSection";
import { LowComplexityPreferenceSection } from "@/components/LowComplexityPreferenceSection";
import { CuisinePreferenceSection } from "@/components/CuisinePreferenceSection";
import { MinimumProteinSettings } from "@/components/MinimumProteinSettings";
import { proteinGramsFromPreset } from "@/utils/proteinMinimum";
import { applyProfileToTargets, useAppStore } from "@/store/useAppStore";
import type { MealSlotId } from "@/types";
import type {
  ActivityLevel,
  BiologicalSex,
  HouseholdPreset,
  MacroSplitPreference,
  MainGoal,
  MealTimingPreference,
  MealsPerDay,
  UserProfile,
  WeeklyMealPrepRepeatCount,
} from "@/types/profile";
import { computeDailyTargets } from "@/utils/tdee";
import { HOUSEHOLD_OPTIONS } from "@/utils/household";
import { MACRO_SPLIT_OPTIONS } from "@/utils/macroSplit";
import {
  HEIGHT_CM_MAX,
  HEIGHT_CM_MIN,
  WEIGHT_KG_MAX,
  WEIGHT_KG_MIN,
  heightCmFromFeetInches,
  isValidHeightFeetInches,
  isValidWeightInput,
  kgToDisplayWeight,
  weightKgFromInput,
  type WeightUnit,
} from "@/utils/bodyMeasurements";

type Step =
  | "welcome"
  | "age"
  | "sex"
  | "height"
  | "weight"
  | "goal"
  | "meals"
  | "household"
  | "macro_split"
  | "basic_cta"
  | "optional";

const GOAL_OPTIONS: { id: MainGoal; label: string }[] = [
  { id: "lose", label: "Lose weight" },
  { id: "maintain", label: "Maintain weight" },
  { id: "gain", label: "Gain muscle" },
  { id: "health", label: "Improve energy & health" },
];

const MEAL_OPTIONS: { id: MealsPerDay; label: string }[] = [
  { id: "two", label: "2 meals" },
  { id: "three", label: "3 meals" },
  { id: "three_snack", label: "3 meals + 1 snack" },
  { id: "flexible", label: "Flexible" },
];

const TIMING_OPTIONS: { id: MealTimingPreference; label: string }[] = [
  { id: "light_breakfast", label: "Light breakfast" },
  { id: "balanced", label: "Balanced throughout" },
  { id: "bigger_dinner", label: "Bigger dinner" },
];

const ACTIVITY_OPTIONS: { id: ActivityLevel; label: string }[] = [
  { id: "sedentary", label: "Sedentary" },
  { id: "light", label: "Lightly active" },
  { id: "moderate", label: "Moderately active" },
  { id: "very", label: "Very active" },
];

function stepIndex(step: Step): number {
  const order: Step[] = [
    "welcome",
    "age",
    "sex",
    "height",
    "weight",
    "goal",
    "meals",
    "household",
    "macro_split",
    "basic_cta",
    "optional",
  ];
  return order.indexOf(step);
}

function motivationForGoal(goal: MainGoal, kcal: number, protein: number): string {
  switch (goal) {
    case "gain":
      return `Great choice! We’re targeting around ${kcal.toLocaleString()} kcal with higher protein (${protein}g) to support your muscle gain goal.`;
    case "lose":
      return `Nice work. We’ll aim near ${kcal.toLocaleString()} kcal with plenty of protein (${protein}g) to help you lose weight steadily.`;
    case "health":
      return `Love it. Around ${kcal.toLocaleString()} kcal with balanced macros — built for steady energy and day-to-day health.`;
    default:
      return `Perfect. We’re centering on about ${kcal.toLocaleString()} kcal to help you maintain where you’re at.`;
  }
}

export function OnboardingFlow({ onLogin }: { onLogin?: () => void }) {
  const [step, setStep] = useState<Step>("welcome");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<BiologicalSex | null>(null);
  const [heightFeet, setHeightFeet] = useState("");
  const [heightInches, setHeightInches] = useState("");
  const [weightValue, setWeightValue] = useState("");
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("lbs");
  const [goal, setGoal] = useState<MainGoal | null>(null);
  const [knownTdeeInput, setKnownTdeeInput] = useState("");
  const [mealsPerDay, setMealsPerDay] = useState<MealsPerDay | null>(null);
  const [householdPreset, setHouseholdPreset] = useState<HouseholdPreset | null>(null);
  const [householdCustom, setHouseholdCustom] = useState("");
  const [macroSplitPreference, setMacroSplitPreference] =
    useState<MacroSplitPreference>("balanced");
  const [goalHint, setGoalHint] = useState<string | null>(null);
  const [activityHint, setActivityHint] = useState<string | null>(null);
  const [basicMotivation, setBasicMotivation] = useState<string | null>(null);

  const setUserProfile = useAppStore((s) => s.setUserProfile);
  const profileForProtein = useAppStore((s) => s.userProfile);
  const setTargets = useAppStore((s) => s.setTargets);
  const finishOnboarding = useAppStore((s) => s.finishOnboarding);
  const registerAccount = useAppStore((s) => s.registerAccount);
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountError, setAccountError] = useState<string | null>(null);

  const [mealTiming, setMealTiming] = useState<MealTimingPreference | null>(null);
  const [favChips, setFavChips] = useState<string[]>([]);
  const [disChips, setDisChips] = useState<string[]>([]);
  const [favCustom, setFavCustom] = useState("");
  const [disCustom, setDisCustom] = useState("");
  const [weeklyPrepEnabled, setWeeklyPrepEnabled] = useState(false);
  const [weeklyPrepSlot, setWeeklyPrepSlot] = useState<MealSlotId>("dinner");
  const [weeklyPrepRepeat, setWeeklyPrepRepeat] = useState<WeeklyMealPrepRepeatCount>(3);
  const [prioritizeProtein, setPrioritizeProtein] = useState(false);
  const [minProteinGrams, setMinProteinGrams] = useState("");
  const [activity, setActivity] = useState<ActivityLevel | null>(null);
  const [prioritizeMinimalPrep, setPrioritizeMinimalPrep] = useState(false);
  const [lowComplexityEnabled, setLowComplexityEnabled] = useState(false);
  const [preferredCuisines, setPreferredCuisines] = useState<string[]>([]);

  const total = 9;
  const progress = Math.min(1, (stepIndex(step) + (step === "optional" ? 1 : 0)) / total);

  const householdOtherOk =
    householdPreset !== "other" ||
    (Number(householdCustom) >= 1 &&
      Number(householdCustom) <= 20 &&
      Number.isInteger(Number(householdCustom)));

  const resolvedHeightCm = heightCmFromFeetInches(heightFeet, heightInches);
  const resolvedWeightKg = weightKgFromInput(weightValue, weightUnit);

  const parsedKnownTdee = (() => {
    const n = Number(knownTdeeInput);
    if (knownTdeeInput.trim() === "" || !Number.isFinite(n)) return null;
    if (n < 1200 || n > 6000) return null;
    return Math.round(n);
  })();

  function buildDraftProfile(goalId: MainGoal): UserProfile {
    return {
      age: Math.min(120, Math.max(13, Number(age) || 30)),
      sex: sex ?? "unspecified",
      heightCm: Math.min(HEIGHT_CM_MAX, Math.max(HEIGHT_CM_MIN, resolvedHeightCm ?? 170)),
      weightKg: Math.min(WEIGHT_KG_MAX, Math.max(WEIGHT_KG_MIN, resolvedWeightKg ?? 70)),
      goal: goalId,
      mealsPerDay: mealsPerDay ?? "three",
      mealTiming: null,
      favoriteFoodChips: [],
      dislikedFoodChips: [],
      favoriteFoodCustom: "",
      dislikedFoodCustom: "",
      weeklyMealPrepEnabled: false,
      weeklyMealPrepSlot: null,
      weeklyMealPrepRepeatCount: 3,
      prioritizeMinProtein: false,
      minimumProteinGrams: null,
      activityLevel: null,
      householdPreset: householdPreset ?? "single",
      householdCustomCount: null,
      macroSplitPreference: macroSplitPreference ?? "balanced",
      knownTdeeKcal: parsedKnownTdee,
    };
  }

  const canContinueBasic =
    Number(age) >= 13 &&
    Number(age) <= 120 &&
    sex &&
    resolvedHeightCm !== null &&
    resolvedWeightKg !== null &&
    goal &&
    mealsPerDay &&
    householdPreset &&
    householdOtherOk;

  function buildBaseProfile(): UserProfile {
    return {
      age: Number(age),
      sex: sex!,
      heightCm: resolvedHeightCm!,
      weightKg: resolvedWeightKg!,
      goal: goal!,
      mealsPerDay: mealsPerDay!,
      mealTiming: null,
      favoriteFoodChips: [],
      dislikedFoodChips: [],
      favoriteFoodCustom: "",
      dislikedFoodCustom: "",
      weeklyMealPrepEnabled: false,
      weeklyMealPrepSlot: null,
      weeklyMealPrepRepeatCount: 3,
      prioritizeMinProtein: false,
      minimumProteinGrams: null,
      activityLevel: null,
      householdPreset: householdPreset!,
      householdCustomCount:
        householdPreset === "other" ? Math.round(Number(householdCustom)) : null,
      macroSplitPreference,
      knownTdeeKcal: parsedKnownTdee,
    };
  }

  function handleGenerateBasicPlan() {
    if (!canContinueBasic) return;
    const profile = buildBaseProfile();
    const targets = computeDailyTargets(profile);
    setUserProfile(profile);
    setTargets(targets);
    setBasicMotivation(motivationForGoal(profile.goal, targets.calories, targets.protein));
    setStep("optional");
  }

  async function tryRegisterAccount(): Promise<boolean> {
    const email = accountEmail.trim();
    const password = accountPassword;
    if (!email && !password) return true;
    if (!email || password.length < 6) {
      setAccountError("Use a valid email and password (6+ characters), or leave both blank.");
      return false;
    }
    const result = await registerAccount(email, password);
    if (result === "exists") {
      setAccountError("That email already has an account. Log in instead.");
      return false;
    }
    if (result === "invalid") {
      setAccountError("Use a valid email and password (6+ characters).");
      return false;
    }
    setAccountError(null);
    return true;
  }

  async function handleSkipOptional() {
    if (!(await tryRegisterAccount())) return;
    finishOnboarding();
  }

  async function handleSaveOptional() {
    const profile = useAppStore.getState().userProfile;
    if (!profile) return;
    const parsedProtein = Number(minProteinGrams);
    const next: UserProfile = {
      ...profile,
      mealTiming,
      favoriteFoodChips: favChips,
      dislikedFoodChips: disChips,
      favoriteFoodCustom: favCustom.trim(),
      dislikedFoodCustom: disCustom.trim(),
      weeklyMealPrepEnabled: weeklyPrepEnabled,
      weeklyMealPrepSlot: weeklyPrepEnabled ? weeklyPrepSlot : null,
      weeklyMealPrepRepeatCount: weeklyPrepRepeat,
      prioritizeMinProtein: prioritizeProtein,
      minimumProteinGrams:
        prioritizeProtein && Number.isFinite(parsedProtein) && parsedProtein > 0
          ? Math.round(parsedProtein)
          : null,
      activityLevel: activity,
      prioritizeMinimalPrep,
      lowComplexityEnabled,
      preferredCuisines,
    };
    setUserProfile(next);
    setTargets(applyProfileToTargets(next));
    if (!(await tryRegisterAccount())) return;
    finishOnboarding();
  }

  return (
    <div className="min-h-dvh bg-[#f5f5f4] px-4 pb-10 pt-8">
      <div className="mx-auto max-w-lg">
        {step !== "welcome" && step !== "optional" && (
          <div className="mb-6">
            <div className="mb-2 flex justify-between text-xs font-medium text-slate-500">
              <span>Your basic plan</span>
              <span>{Math.round(progress * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-[#2563EB] transition-all duration-300"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        )}

        <p className="mb-6 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-center text-sm leading-relaxed text-slate-600 shadow-sm">
          The more you like, dislike, or rate meals, the smarter and more personalized your plans
          become over time.
        </p>

        {step === "welcome" && (
          <WelcomeStep onNext={() => setStep("age")} onLogin={onLogin} />
        )}

        {step === "age" && (
          <NumberStep
            title="How old are you?"
            hint="We use this to estimate energy needs."
            value={age}
            onChange={setAge}
            min={13}
            max={120}
            suffix="years"
            onBack={() => setStep("welcome")}
            onNext={() => setStep("sex")}
          />
        )}

        {step === "sex" && (
          <ChoiceStep
            title="Biological sex"
            hint="Used in the standard energy equation. Choose what fits best."
            options={[
              { id: "male" as const, label: "Male" },
              { id: "female" as const, label: "Female" },
              { id: "unspecified" as const, label: "Prefer not to say" },
            ]}
            value={sex}
            onChange={(v) => {
              setSex(v);
              setGoalHint(null);
            }}
            onBack={() => setStep("age")}
            onNext={() => setStep("height")}
          />
        )}

        {step === "height" && (
          <HeightStep
            feet={heightFeet}
            inches={heightInches}
            onFeetChange={setHeightFeet}
            onInchesChange={setHeightInches}
            onBack={() => setStep("sex")}
            onNext={() => setStep("weight")}
          />
        )}

        {step === "weight" && (
          <WeightStep
            value={weightValue}
            unit={weightUnit}
            onValueChange={setWeightValue}
            onUnitChange={setWeightUnit}
            onBack={() => setStep("height")}
            onNext={() => setStep("goal")}
          />
        )}

        {step === "goal" && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900">Main goal</h2>
            <p className="text-slate-600">What matters most right now?</p>
            <div className="flex flex-col gap-3">
              {GOAL_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    setGoal(o.id);
                    const t = computeDailyTargets(buildDraftProfile(o.id));
                    setGoalHint(motivationForGoal(o.id, t.calories, t.protein));
                  }}
                  className={`min-h-[56px] rounded-2xl border-2 px-4 py-3 text-left text-base font-semibold transition-colors ${
                    goal === o.id
                      ? "border-[#2563EB] bg-blue-50 text-blue-900"
                      : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {goal && (
              <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Know your maintenance TDEE?{" "}
                    <span className="font-normal text-slate-500">(optional)</span>
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    Maintenance calories before goal adjustment. Leave blank to use our estimate
                    from your stats.
                  </p>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={knownTdeeInput}
                    onChange={(e) => {
                      setKnownTdeeInput(e.target.value);
                      if (goal) {
                        const draft = buildDraftProfile(goal);
                        draft.knownTdeeKcal =
                          e.target.value.trim() === ""
                            ? null
                            : (() => {
                                const n = Number(e.target.value);
                                return Number.isFinite(n) && n >= 1200 && n <= 6000
                                  ? Math.round(n)
                                  : null;
                              })();
                        const t = computeDailyTargets(draft);
                        setGoalHint(motivationForGoal(goal, t.calories, t.protein));
                      }
                    }}
                    placeholder="e.g. 2400"
                    className="min-h-[56px] w-full rounded-2xl border-2 border-slate-200 bg-white px-4 pr-16 text-2xl font-semibold text-slate-900 outline-none focus:border-[#2563EB]"
                    aria-label="Known maintenance TDEE in kcal"
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">
                    kcal
                  </span>
                </div>
                {knownTdeeInput.trim() !== "" && (
                  <div className="flex items-center justify-between gap-2">
                    {parsedKnownTdee == null ? (
                      <p className="text-xs text-amber-800">Enter 1,200–6,000 kcal or clear the field.</p>
                    ) : (
                      <p className="text-xs text-emerald-800">
                        Using your TDEE — target updates with your goal adjustment.
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setKnownTdeeInput("");
                        if (goal) {
                          const t = computeDailyTargets(buildDraftProfile(goal));
                          setGoalHint(motivationForGoal(goal, t.calories, t.protein));
                        }
                      }}
                      className="shrink-0 text-xs font-semibold text-slate-500 underline-offset-2 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </section>
            )}
            {goalHint && (
              <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium leading-relaxed text-emerald-900">
                {goalHint}
              </p>
            )}
            <NavRow
              onBack={() => setStep("weight")}
              onNext={() => setStep("meals")}
              nextDisabled={!goal || (knownTdeeInput.trim() !== "" && parsedKnownTdee == null)}
            />
          </div>
        )}

        {step === "meals" && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900">Meals per day</h2>
            <p className="text-slate-600">How do you usually like to eat?</p>
            <div className="flex flex-col gap-3">
              {MEAL_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setMealsPerDay(o.id)}
                  className={`min-h-[56px] rounded-2xl border-2 px-4 py-3 text-left text-base font-semibold transition-colors ${
                    mealsPerDay === o.id
                      ? "border-[#2563EB] bg-blue-50 text-blue-900"
                      : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {mealsPerDay && (
              <p className="rounded-2xl bg-sky-50 px-4 py-3 text-sm leading-relaxed text-sky-900">
                {mealsPerDay === "two"
                  ? "We’ll focus on two satisfying mains — less planning, still balanced."
                  : mealsPerDay === "three"
                    ? "Classic breakfast, lunch, and dinner — simple rhythm."
                    : "Room for a snack — great for steady energy."}
              </p>
            )}
            <NavRow
              onBack={() => setStep("goal")}
              onNext={() => setStep("household")}
              nextDisabled={!mealsPerDay}
            />
          </div>
        )}

        {step === "household" && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900">How many people are you cooking for?</h2>
            <p className="text-slate-600">
              We use this to scale grocery lists and ingredient amounts. Children count as about 0.6
              of an adult portion.
            </p>
            <div className="flex flex-col gap-3">
              {HOUSEHOLD_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setHouseholdPreset(o.id)}
                  className={`min-h-[56px] rounded-2xl border-2 px-4 py-3 text-left text-base font-semibold transition-colors ${
                    householdPreset === o.id
                      ? "border-[#2563EB] bg-blue-50 text-blue-900"
                      : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {householdPreset === "other" && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Number of people (1–20)
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={20}
                  value={householdCustom}
                  onChange={(e) => setHouseholdCustom(e.target.value)}
                  className="min-h-[56px] w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-xl font-semibold text-slate-900 outline-none focus:border-[#2563EB]"
                />
              </div>
            )}
            <NavRow
              onBack={() => setStep("meals")}
              onNext={() => setStep("macro_split")}
              nextDisabled={!householdPreset || !householdOtherOk}
            />
          </div>
        )}

        {step === "macro_split" && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900">
              Preferred Macro Split (when possible)
            </h2>
            <p className="text-slate-600 leading-relaxed">
              Optional. We always hit your protein target first, then split remaining calories
              between carbs and fat using this preference.
            </p>
            <div className="flex flex-col gap-3">
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
                  <span className="block text-base font-semibold">{o.label}</span>
                  <span className="mt-1 block text-sm font-normal text-slate-600">
                    {o.description}
                  </span>
                </button>
              ))}
            </div>
            <NavRow
              onBack={() => setStep("household")}
              onNext={() => setStep("basic_cta")}
            />
          </div>
        )}

        {step === "basic_cta" && (
          <div className="space-y-6 text-center">
            <h2 className="text-2xl font-bold text-slate-900">You’re almost there</h2>
            <p className="text-left text-slate-600 leading-relaxed">
              We’ll create calorie and macro targets from your answers. You can add optional details
              next — or skip them anytime.
            </p>
            <button
              type="button"
              disabled={!canContinueBasic}
              onClick={handleGenerateBasicPlan}
              className="min-h-[60px] w-full rounded-2xl bg-[#2563EB] px-4 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-600/25 disabled:opacity-40"
            >
              Generate My Basic Plan Now
            </button>
            <button
              type="button"
              onClick={() => setStep("macro_split")}
              className="text-sm font-medium text-slate-500 underline-offset-2 hover:underline"
            >
              Back to edit answers
            </button>
          </div>
        )}

        {step === "optional" && (
          <div className="space-y-8 pb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Optional — your way</h2>
              <p className="mt-2 text-slate-600 leading-relaxed">
                Skip anything you’re unsure about. You can change household anytime from Settings
                (gear on Today).
              </p>
            </div>

            {basicMotivation && (
              <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-medium leading-relaxed text-emerald-950">
                {basicMotivation}
              </p>
            )}

            <section className="space-y-3">
              <h3 className="text-lg font-semibold text-slate-900">Meal timing</h3>
              <div className="flex flex-wrap gap-2">
                {TIMING_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setMealTiming((c) => (c === o.id ? null : o.id))}
                    className={`min-h-[48px] rounded-full border-2 px-4 text-sm font-semibold ${
                      mealTiming === o.id
                        ? "border-[#2563EB] bg-blue-50 text-blue-900"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </section>

            <FoodPreferenceSection
              favoriteChips={favChips}
              dislikedChips={disChips}
              favoriteCustom={favCustom}
              dislikedCustom={disCustom}
              onFavoriteChipsChange={setFavChips}
              onDislikedChipsChange={setDisChips}
              onFavoriteCustomChange={setFavCustom}
              onDislikedCustomChange={setDisCustom}
            />

            <WeeklyMealPrepSection
              enabled={weeklyPrepEnabled}
              slot={weeklyPrepSlot}
              repeatCount={weeklyPrepRepeat}
              onEnabledChange={setWeeklyPrepEnabled}
              onSlotChange={setWeeklyPrepSlot}
              onRepeatCountChange={setWeeklyPrepRepeat}
            />

            <MinimalPrepPreferenceSection
              enabled={prioritizeMinimalPrep}
              onChange={setPrioritizeMinimalPrep}
            />

            <LowComplexityPreferenceSection
              enabled={lowComplexityEnabled}
              onChange={setLowComplexityEnabled}
            />

            <CuisinePreferenceSection
              selected={preferredCuisines}
              onChange={setPreferredCuisines}
            />

            {profileForProtein && (
              <MinimumProteinSettings
                profile={profileForProtein}
                enabled={prioritizeProtein}
                proteinGrams={
                  minProteinGrams ||
                  String(proteinGramsFromPreset(profileForProtein.weightKg, 1.8))
                }
                onEnabledChange={setPrioritizeProtein}
                onProteinGramsChange={setMinProteinGrams}
                onApplyPreset={(grams) => setMinProteinGrams(String(grams))}
              />
            )}

            <section className="space-y-3">
              <h3 className="text-lg font-semibold text-slate-900">Activity level</h3>
              <p className="text-sm text-slate-500">
                Fine-tunes your calorie target. We started with a moderate default for your basic
                plan.
              </p>
              <div className="flex flex-col gap-3">
                {ACTIVITY_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      setActivity(o.id);
                      const p = useAppStore.getState().userProfile;
                      if (p) {
                        const t = computeDailyTargets({ ...p, activityLevel: o.id });
                        setActivityHint(
                          `With ${o.label.toLowerCase()} days, we’d land near ${t.calories.toLocaleString()} kcal — great for personalization.`,
                        );
                      }
                    }}
                    className={`min-h-[56px] rounded-2xl border-2 px-4 py-3 text-left text-base font-semibold ${
                      activity === o.id
                        ? "border-[#2563EB] bg-blue-50 text-blue-900"
                        : "border-slate-200 bg-white text-slate-800"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              {activityHint && activity && (
                <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
                  {activityHint}
                </p>
              )}
            </section>

            <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <h3 className="text-lg font-semibold text-slate-900">Save your account (optional)</h3>
              <p className="text-sm text-slate-600">
                Add an email and password so you can log in on this or another device.
              </p>
              <input
                type="email"
                autoComplete="email"
                value={accountEmail}
                onChange={(e) => setAccountEmail(e.target.value)}
                placeholder="you@example.com"
                className="min-h-[48px] w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-base text-slate-900 outline-none focus:border-[#2563EB]"
              />
              <input
                type="password"
                autoComplete="new-password"
                value={accountPassword}
                onChange={(e) => setAccountPassword(e.target.value)}
                placeholder="Password (6+ characters)"
                className="min-h-[48px] w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-base text-slate-900 outline-none focus:border-[#2563EB]"
              />
              {accountError && (
                <p className="text-sm text-red-700" role="alert">
                  {accountError}
                </p>
              )}
            </section>

            <div className="flex flex-col gap-3 pt-2">
              <button
                type="button"
                onClick={() => void handleSaveOptional()}
                className="min-h-[56px] w-full rounded-2xl bg-[#2563EB] py-3 text-lg font-semibold text-white"
              >
                Save & continue
              </button>
              <button
                type="button"
                onClick={() => void handleSkipOptional()}
                className="min-h-[52px] w-full rounded-2xl border-2 border-slate-200 bg-white py-3 text-base font-semibold text-slate-700"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function WelcomeStep({ onNext, onLogin }: { onNext: () => void; onLogin?: () => void }) {
  return (
    <div className="space-y-8 text-center">
      <div className="rounded-3xl border border-slate-200/80 bg-white px-6 py-12 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">Welcome to DailyPlate</h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-600">
          A few quick questions, then we’ll shape calories and macros around you. No stress — you can
          skip optional steps.
        </p>
      </div>
      <button
        type="button"
        onClick={onNext}
        className="min-h-[56px] w-full rounded-2xl bg-[#2563EB] py-4 text-lg font-semibold text-white shadow-md"
      >
        Let’s begin
      </button>
      {onLogin && (
        <button
          type="button"
          onClick={onLogin}
          className="min-h-[52px] w-full rounded-2xl border-2 border-slate-200 bg-white py-3 text-base font-semibold text-slate-700"
        >
          I already have an account — log in
        </button>
      )}
    </div>
  );
}

const measurementInputClass =
  "min-h-[64px] w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-center text-3xl font-semibold text-slate-900 outline-none focus:border-[#2563EB]";

function HeightStep({
  feet,
  inches,
  onFeetChange,
  onInchesChange,
  onBack,
  onNext,
}: {
  feet: string;
  inches: string;
  onFeetChange: (v: string) => void;
  onInchesChange: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const ok = isValidHeightFeetInches(feet, inches);
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-slate-900">Your height</h2>
      <p className="text-slate-600">Feet and inches (e.g. 5 ft 10 in)</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-2 block text-center text-sm font-semibold text-slate-600">
            Feet
          </label>
          <input
            type="number"
            inputMode="numeric"
            min={3}
            max={8}
            value={feet}
            onChange={(e) => onFeetChange(e.target.value)}
            placeholder="5"
            aria-label="Height in feet"
            className={measurementInputClass}
          />
          <p className="mt-2 text-center text-sm font-medium text-slate-500">ft</p>
        </div>
        <div>
          <label className="mb-2 block text-center text-sm font-semibold text-slate-600">
            Inches
          </label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={11}
            value={inches}
            onChange={(e) => onInchesChange(e.target.value)}
            placeholder="10"
            aria-label="Height in inches"
            className={measurementInputClass}
          />
          <p className="mt-2 text-center text-sm font-medium text-slate-500">in</p>
        </div>
      </div>
      <NavRow onBack={onBack} onNext={onNext} nextDisabled={!ok} />
    </div>
  );
}

function WeightStep({
  value,
  unit,
  onValueChange,
  onUnitChange,
  onBack,
  onNext,
}: {
  value: string;
  unit: WeightUnit;
  onValueChange: (v: string) => void;
  onUnitChange: (u: WeightUnit) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const ok = isValidWeightInput(value, unit);
  const hint =
    unit === "lbs"
      ? "Pounds (e.g. 160)"
      : "Kilograms (e.g. 72)";

  function handleUnitChange(next: WeightUnit) {
    if (next === unit) return;
    const kg = weightKgFromInput(value, unit);
    if (kg !== null) onValueChange(kgToDisplayWeight(kg, next));
    onUnitChange(next);
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-slate-900">Current weight</h2>
      <p className="text-slate-600">{hint}</p>
      <div
        className="flex rounded-2xl border-2 border-slate-200 bg-slate-100 p-1"
        role="group"
        aria-label="Weight unit"
      >
        {(["lbs", "kg"] as const).map((u) => (
          <button
            key={u}
            type="button"
            onClick={() => handleUnitChange(u)}
            className={`min-h-[52px] flex-1 rounded-xl text-base font-semibold transition-colors ${
              unit === u
                ? "bg-white text-blue-900 shadow-sm"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            {u}
          </button>
        ))}
      </div>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder={unit === "lbs" ? "160" : "72"}
          aria-label={`Weight in ${unit}`}
          className={`${measurementInputClass} pr-16`}
        />
        <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-lg font-semibold text-slate-400">
          {unit}
        </span>
      </div>
      <NavRow onBack={onBack} onNext={onNext} nextDisabled={!ok} />
    </div>
  );
}

function NumberStep({
  title,
  hint,
  value,
  onChange,
  min,
  max,
  suffix,
  onBack,
  onNext,
}: {
  title: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  min: number;
  max: number;
  suffix: string;
  onBack: () => void;
  onNext: () => void;
}) {
  const n = Number(value);
  const ok = n >= min && n <= max;
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
      <p className="text-slate-600">{hint}</p>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`${min}–${max}`}
          className="min-h-[56px] w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-2xl font-semibold text-slate-900 outline-none focus:border-[#2563EB]"
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
          {suffix}
        </span>
      </div>
      <NavRow onBack={onBack} onNext={onNext} nextDisabled={!ok} />
    </div>
  );
}

function ChoiceStep<T extends string>({
  title,
  hint,
  options,
  value,
  onChange,
  onBack,
  onNext,
}: {
  title: string;
  hint: string;
  options: { id: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
      <p className="text-slate-600">{hint}</p>
      <div className="flex flex-col gap-3">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`min-h-[56px] rounded-2xl border-2 px-4 py-3 text-left text-base font-semibold ${
              value === o.id
                ? "border-[#2563EB] bg-blue-50 text-blue-900"
                : "border-slate-200 bg-white text-slate-800"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <NavRow onBack={onBack} onNext={onNext} nextDisabled={value === null} />
    </div>
  );
}

function NavRow({
  onBack,
  onNext,
  nextDisabled,
}: {
  onBack: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
}) {
  return (
    <div className="flex gap-3 pt-4">
      <button
        type="button"
        onClick={onBack}
        className="min-h-[52px] flex-1 rounded-2xl border-2 border-slate-200 bg-white py-3 font-semibold text-slate-700"
      >
        Back
      </button>
      <button
        type="button"
        disabled={nextDisabled}
        onClick={onNext}
        className="min-h-[52px] flex-1 rounded-2xl bg-[#2563EB] py-3 font-semibold text-white disabled:opacity-40"
      >
        Continue
      </button>
    </div>
  );
}
