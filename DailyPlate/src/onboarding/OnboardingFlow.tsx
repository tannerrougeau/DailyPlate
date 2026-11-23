import { useState } from "react";
import { HouseholdPicker } from "@/components/HouseholdPicker";
import { MealPatternSection } from "@/components/MealPatternSection";
import { ProteinPreferenceSection } from "@/components/ProteinPreferenceSection";
import {
  ProfileRefineCards,
  defaultRefineValues,
  profilePatchFromRefine,
  type HouseholdCardValue,
  type RefineCardValues,
} from "@/components/ProfileRefineCards";
import { applyProfileToTargets, useAppStore } from "@/store/useAppStore";
import type { RecipeMealSlotId } from "@/types";
import type {
  ActivityLevel,
  BiologicalSex,
  HouseholdMember,
  MainGoal,
  ProteinPreference,
  UserProfile,
} from "@/types/profile";
import { computeDailyTargets } from "@/utils/tdee";
import {
  clampAdults,
  clampChildren,
  householdPresetFromCounts,
  HOUSEHOLD_ADULTS_DEFAULT,
  syncHouseholdMembers,
} from "@/utils/household";
import {
  DEFAULT_EATEN_MEALS,
  DEFAULT_PROTEIN_PREFERENCE,
  DEFAULT_SNACKS_PER_DAY,
  mealsPerDayFromSelections,
  planningDefaultsForNewProfile,
} from "@/utils/planningPrefs";
import { goalLinkedProteinGrams } from "@/utils/proteinMinimum";
import { applyFitAnswers, type FitAnswers } from "@/utils/fitYourLife";
import { FitYourLifeSteps } from "@/onboarding/FitYourLifeSteps";
import {
  HEIGHT_CM_MAX,
  HEIGHT_CM_MIN,
  WEIGHT_KG_MAX,
  WEIGHT_KG_MIN,
  heightCmFromFeetInches,
  kgToDisplayWeight,
  weightKgFromInput,
  type WeightUnit,
} from "@/utils/bodyMeasurements";

type Step = "welcome" | "household" | "stats" | "goal" | "meals" | "fit" | "summary";

const BASIC_STEPS: Exclude<Step, "welcome">[] = [
  "household",
  "stats",
  "goal",
  "meals",
  "fit",
  "summary",
];

export const QUESTIONS_OPTIONAL_LINE = "Questions are always optional. Skip or pause them anytime.";

const GOAL_OPTIONS: { id: MainGoal; label: string }[] = [
  { id: "lose", label: "Lose weight" },
  { id: "maintain", label: "Maintain weight" },
  { id: "gain", label: "Gain muscle" },
  { id: "health", label: "Improve energy & health" },
];

const SEX_OPTIONS = [
  { id: "male" as const, label: "Male" },
  { id: "female" as const, label: "Female" },
  { id: "unspecified" as const, label: "Prefer not to say" },
];

const ACTIVITY_OPTIONS: { id: ActivityLevel; label: string; recommended?: boolean }[] = [
  { id: "sedentary", label: "Sedentary" },
  { id: "light", label: "Lightly active" },
  { id: "moderate", label: "Moderately active", recommended: true },
  { id: "very", label: "Very active" },
];

const DEFAULT_ACTIVITY: ActivityLevel = "moderate";

function motivationForGoal(goal: MainGoal, kcal: number, protein: number): string {
  switch (goal) {
    case "gain":
      return `Around ${kcal.toLocaleString()} kcal with ${protein}g protein to support muscle gain.`;
    case "lose":
      return `Around ${kcal.toLocaleString()} kcal with ${protein}g protein to lose weight steadily.`;
    case "health":
      return `Around ${kcal.toLocaleString()} kcal with ${protein}g protein for steady energy.`;
    default:
      return `Around ${kcal.toLocaleString()} kcal with ${protein}g protein to maintain.`;
  }
}

export function OnboardingFlow({ onLogin }: { onLogin?: () => void }) {
  const [step, setStep] = useState<Step>("welcome");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<BiologicalSex>("unspecified");
  const [heightFeet, setHeightFeet] = useState("");
  const [heightInches, setHeightInches] = useState("");
  const [weightValue, setWeightValue] = useState("");
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("lbs");
  const [goal, setGoal] = useState<MainGoal | null>(null);
  const [activity, setActivity] = useState<ActivityLevel>(DEFAULT_ACTIVITY);
  const [proteinPreference, setProteinPreference] =
    useState<ProteinPreference>(DEFAULT_PROTEIN_PREFERENCE);
  const [eatenMeals, setEatenMeals] = useState<RecipeMealSlotId[]>(() => [...DEFAULT_EATEN_MEALS]);
  const [snacksPerDay, setSnacksPerDay] = useState(DEFAULT_SNACKS_PER_DAY);
  const [householdAdults, setHouseholdAdults] = useState(HOUSEHOLD_ADULTS_DEFAULT);
  const [householdChildren, setHouseholdChildren] = useState(0);
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>(() =>
    syncHouseholdMembers(HOUSEHOLD_ADULTS_DEFAULT, 0),
  );
  const [refine, setRefine] = useState<RefineCardValues>(() => defaultRefineValues());
  const [householdAvoidChips, setHouseholdAvoidChips] = useState<string[]>([]);
  const [householdAvoidCustom, setHouseholdAvoidCustom] = useState("");
  // "Fit your life": optional answers and "Keep it simple" (Basic mode).
  const [fitAnswers, setFitAnswers] = useState<FitAnswers>({});
  const [basicMode, setBasicMode] = useState(false);

  const setUserProfile = useAppStore((s) => s.setUserProfile);
  const setTargets = useAppStore((s) => s.setTargets);
  const finishOnboarding = useAppStore((s) => s.finishOnboarding);
  const requestOpenSettings = useAppStore((s) => s.requestOpenSettings);

  const progressIndex = BASIC_STEPS.indexOf(step as Exclude<Step, "welcome">);
  const progress = progressIndex >= 0 ? (progressIndex + 1) / BASIC_STEPS.length : 0;

  const resolvedHeightCm = heightCmFromFeetInches(heightFeet, heightInches);
  const resolvedWeightKg = weightKgFromInput(weightValue, weightUnit);

  const parsedAge = (() => {
    const n = Number(age);
    return Number.isFinite(n) && n >= 13 && n <= 120 ? Math.round(n) : null;
  })();

  const canContinueStats =
    parsedAge != null && resolvedHeightCm != null && resolvedWeightKg != null;

  function resolvedBodyStats(): {
    age: number;
    sex: BiologicalSex;
    heightCm: number;
    weightKg: number;
  } | null {
    if (parsedAge == null || resolvedHeightCm == null || resolvedWeightKg == null) return null;
    return {
      age: parsedAge,
      sex,
      heightCm: Math.min(HEIGHT_CM_MAX, Math.max(HEIGHT_CM_MIN, resolvedHeightCm)),
      weightKg: Math.min(WEIGHT_KG_MAX, Math.max(WEIGHT_KG_MIN, resolvedWeightKg)),
    };
  }

  const bodyStats = resolvedBodyStats();
  const derivedProteinGrams = goalLinkedProteinGrams({
    goal,
    preference: proteinPreference,
    weightKg: bodyStats?.weightKg ?? 0,
    heightCm: bodyStats?.heightCm ?? 0,
  });

  function buildProfile(goalId: MainGoal): UserProfile {
    const body = resolvedBodyStats();
    if (!body) {
      throw new Error("Body stats are required before building a plan.");
    }
    const meals = mealsPerDayFromSelections(eatenMeals, snacksPerDay);
    const patch = profilePatchFromRefine(refine, {
      weightKg: body.weightKg,
      heightCm: body.heightCm,
      goal: goalId,
      proteinPreference,
    });
    return {
      age: body.age,
      sex: body.sex,
      heightCm: body.heightCm,
      weightKg: body.weightKg,
      goal: goalId,
      mealTiming: null,
      ...planningDefaultsForNewProfile(),
      ...patch,
      favoriteFoodChips: patch.favoriteFoodChips ?? [],
      dislikedFoodChips: patch.dislikedFoodChips ?? [],
      proteinPreference,
      eatenMeals,
      snacksPerDay,
      mealsPerDay: meals,
      activityLevel: activity,
      householdPreset: householdPresetFromCounts(householdAdults, householdChildren),
      householdCustomCount: null,
      householdAdults: clampAdults(householdAdults),
      householdChildren: clampChildren(householdChildren),
      householdMembers: syncHouseholdMembers(
        householdAdults,
        householdChildren,
        householdMembers,
      ),
      householdFoodAvoidChips: householdAvoidChips,
      householdFoodAvoidCustom: householdAvoidCustom,
      basicMode,
    };
  }

  /** The built profile with the "fit your life" answers applied (cooking fields, meal-prep slot). */
  function buildFinalProfile(goalId: MainGoal): UserProfile {
    return applyFitAnswers(buildProfile(goalId), fitAnswers);
  }

  const canFinish = Boolean(goal && eatenMeals.length >= 1 && householdAdults >= 1 && canContinueStats);

  const previewTargets =
    canFinish && goal && bodyStats
      ? computeDailyTargets(buildProfile(goal))
      : null;

  const setStartingDisplay = useAppStore((st) => st.setStartingDisplay);

  function persistAndFinish(openSettings: boolean) {
    if (!canFinish || !goal) return;
    const profile = buildFinalProfile(goal);
    setUserProfile(profile);
    setTargets(applyProfileToTargets(profile));
    // Starting display: detailed if any refine card was changed, basic if they went straight through.
    const refined = JSON.stringify(refine) !== JSON.stringify(defaultRefineValues());
    setStartingDisplay(refined ? "detailed" : "basic");
    finishOnboarding();
    if (openSettings) requestOpenSettings();
  }

  return (
    <div className="min-h-dvh bg-[#f5f5f4] px-4 pb-10 pt-8">
      <div className="mx-auto max-w-lg">
        {step !== "welcome" && (
          <div className="mb-6">
            <div className="mb-2 flex justify-between text-xs font-medium text-slate-500">
              <span>
                {progressIndex + 1} of {BASIC_STEPS.length}
              </span>
              <span>{Math.round(progress * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
        )}

        {step === "welcome" && (
          <WelcomeStep onNext={() => setStep("household")} onLogin={onLogin} />
        )}

        {step === "household" && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900">Who is this food for?</h2>
            <HouseholdPicker
              adults={householdAdults}
              childrenCount={householdChildren}
              onAdultsChange={(n) => {
                setHouseholdAdults(n);
                setHouseholdMembers(syncHouseholdMembers(n, householdChildren, householdMembers));
              }}
              onChildrenChange={(n) => {
                setHouseholdChildren(n);
                setHouseholdMembers(syncHouseholdMembers(householdAdults, n, householdMembers));
              }}
            />
            <StickyNav onBack={() => setStep("welcome")} onNext={() => setStep("stats")} />
          </div>
        )}

        {step === "stats" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Your stats</h2>
              <p className="mt-2 leading-relaxed text-slate-600">
                These set your calorie and protein targets. Gender is optional.
              </p>
            </div>
            <NumberStep
              title="Age"
              hint="Used only for your calorie target."
              value={age}
              onChange={setAge}
              min={13}
              max={120}
              suffix="years"
              embedded
            />
            <ChoiceStep
              title="Gender"
              hint="Used in the energy equation if you share it."
              options={SEX_OPTIONS}
              value={sex}
              onChange={setSex}
              embedded
            />
            <HeightStep
              feet={heightFeet}
              inches={heightInches}
              onFeetChange={setHeightFeet}
              onInchesChange={setHeightInches}
              embedded
            />
            <WeightStep
              value={weightValue}
              unit={weightUnit}
              onValueChange={setWeightValue}
              onUnitChange={setWeightUnit}
              embedded
            />
            <ChoiceStep
              title="Activity level"
              hint="How active is a typical week?"
              options={ACTIVITY_OPTIONS}
              value={activity}
              onChange={setActivity}
              embedded
            />
            <StickyNav
              onBack={() => setStep("household")}
              onNext={() => setStep("goal")}
              nextDisabled={!canContinueStats}
            />
          </div>
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
                    setStep("meals");
                  }}
                  className={`min-h-[56px] rounded-2xl border-2 px-4 py-3 text-left text-base font-semibold ${
                    goal === o.id
                      ? "border-[#2563EB] bg-blue-50 text-blue-900"
                      : "border-slate-200 bg-white text-slate-800"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <StickyNav onBack={() => setStep("stats")} />
          </div>
        )}

        {step === "meals" && (
          <div className="space-y-6">
            <MealPatternSection
              eatenMeals={eatenMeals}
              snacksPerDay={snacksPerDay}
              onEatenMealsChange={setEatenMeals}
              onSnacksPerDayChange={setSnacksPerDay}
            />
            <ProteinPreferenceSection
              value={proteinPreference}
              onChange={setProteinPreference}
              goal={goal}
              weightKg={bodyStats?.weightKg ?? 0}
              heightCm={bodyStats?.heightCm ?? 0}
              eatenMeals={eatenMeals}
              snacksPerDay={snacksPerDay}
            />
            <StickyNav
              onBack={() => setStep("goal")}
              onNext={() => setStep("fit")}
              nextDisabled={eatenMeals.length === 0}
            />
          </div>
        )}

        {step === "fit" && (
          <FitYourLifeSteps
            value={fitAnswers}
            onChange={setFitAnswers}
            onDone={() => setStep("summary")}
            onKeepSimple={() => {
              setBasicMode(true);
              setStep("summary");
            }}
            onBack={() => setStep("meals")}
          />
        )}

        {step === "summary" && previewTargets && goal && bodyStats && (
          <div className="space-y-5 pb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Your targets</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                The more you like, dislike, or rate meals, the smarter and more personalized your
                plans become over time.
              </p>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white px-5 py-5">
              <p className="text-sm font-medium text-slate-500">Daily target</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {previewTargets.calories.toLocaleString()}{" "}
                <span className="text-lg font-semibold text-slate-500">kcal</span>
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-700">
                {previewTargets.protein}g protein · {eatenMeals.length + snacksPerDay} meals/day
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {motivationForGoal(goal, previewTargets.calories, previewTargets.protein)}
              </p>
              <button
                type="button"
                disabled={!canFinish}
                onClick={() => persistAndFinish(false)}
                className="mt-5 min-h-[56px] w-full rounded-2xl bg-[#2563EB] py-3 text-lg font-semibold text-white disabled:opacity-40"
              >
                Looks good
              </button>
              <button
                type="button"
                onClick={() => persistAndFinish(true)}
                className="mt-3 w-full text-sm font-semibold text-[#2563EB] underline-offset-2 hover:underline"
              >
                Save your account
              </button>
            </section>

            <ProfileRefineCards
              value={refine}
              onChange={setRefine}
              weightKg={bodyStats.weightKg}
              heightCm={bodyStats.heightCm}
              goal={goal}
              preference={proteinPreference}
              derivedProteinGrams={derivedProteinGrams}
              household={{
                adults: householdAdults,
                children: householdChildren,
                members: householdMembers,
                avoidChips: householdAvoidChips,
                avoidCustom: householdAvoidCustom,
              }}
              onHouseholdChange={(next: HouseholdCardValue) => {
                setHouseholdMembers(next.members);
                setHouseholdAvoidChips(next.avoidChips);
                setHouseholdAvoidCustom(next.avoidCustom);
              }}
            />

            <StickyNav onBack={() => setStep("fit")} />
          </div>
        )}
      </div>
    </div>
  );
}

function WelcomeStep({ onNext, onLogin }: { onNext: () => void; onLogin?: () => void }) {
  // Fits one phone screen (375×667) without scrolling, including the optional-questions line.
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-200/80 bg-white px-5 py-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Welcome to DailyPlate</h1>
        <div className="mt-3 space-y-3 text-[15px] leading-snug text-slate-600">
          <p>
            DailyPlate builds a meal plan around your goals and sizes each meal to fit your targets.
          </p>
          <p>
            It's flexible. Swap any meal you don't want, and the more you rate and use your meals,
            the more personal your plan gets.
          </p>
          <p>
            There's no perfect diet. The best plan is one you can keep doing, so give it a few
            weeks. Consistency is what makes results show.
          </p>
          <p className="text-sm font-medium text-slate-700">{QUESTIONS_OPTIONAL_LINE}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onNext}
        className="min-h-[52px] w-full rounded-2xl bg-[#2563EB] py-3 text-lg font-semibold text-white shadow-md"
      >
        Get started
      </button>
      {onLogin && (
        <button
          type="button"
          onClick={onLogin}
          className="min-h-[44px] w-full rounded-2xl py-2 text-sm font-semibold text-slate-600"
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
  embedded = false,
}: {
  feet: string;
  inches: string;
  onFeetChange: (v: string) => void;
  onInchesChange: (v: string) => void;
  embedded?: boolean;
}) {
  return (
    <div className="space-y-3">
      <h2 className={embedded ? "text-base font-semibold text-slate-900" : "text-2xl font-bold text-slate-900"}>
        Height
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-2 block text-center text-sm font-semibold text-slate-600">Feet</label>
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
          <label className="mb-2 block text-center text-sm font-semibold text-slate-600">Inches</label>
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
    </div>
  );
}

function WeightStep({
  value,
  unit,
  onValueChange,
  onUnitChange,
  embedded = false,
}: {
  value: string;
  unit: WeightUnit;
  onValueChange: (v: string) => void;
  onUnitChange: (u: WeightUnit) => void;
  embedded?: boolean;
}) {
  function handleUnitChange(next: WeightUnit) {
    if (next === unit) return;
    const kg = weightKgFromInput(value, unit);
    if (kg !== null) onValueChange(kgToDisplayWeight(kg, next));
    onUnitChange(next);
  }

  return (
    <div className="space-y-3">
      <h2 className={embedded ? "text-base font-semibold text-slate-900" : "text-2xl font-bold text-slate-900"}>
        Weight
      </h2>
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
            className={`min-h-[44px] flex-1 rounded-xl text-sm font-semibold ${
              unit === u ? "bg-white text-blue-900 shadow-sm" : "text-slate-600"
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
  embedded = false,
}: {
  title: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  min: number;
  max: number;
  suffix: string;
  embedded?: boolean;
}) {
  return (
    <div className="space-y-3">
      <h2 className={embedded ? "text-base font-semibold text-slate-900" : "text-2xl font-bold text-slate-900"}>
        {title}
      </h2>
      {!embedded && <p className="text-slate-600">{hint}</p>}
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
    </div>
  );
}

function ChoiceStep<T extends string>({
  title,
  hint,
  options,
  value,
  onChange,
  embedded = false,
}: {
  title: string;
  hint: string;
  options: { id: T; label: string; recommended?: boolean }[];
  value: T | null;
  onChange: (v: T) => void;
  embedded?: boolean;
}) {
  return (
    <div className="space-y-3">
      <h2 className={embedded ? "text-base font-semibold text-slate-900" : "text-2xl font-bold text-slate-900"}>
        {title}
      </h2>
      {!embedded && <p className="text-slate-600">{hint}</p>}
      <div className="flex flex-col gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`min-h-[48px] rounded-2xl border-2 px-4 py-2.5 text-left text-sm font-semibold ${
              value === o.id
                ? "border-[#2563EB] bg-blue-50 text-blue-900"
                : "border-slate-200 bg-white text-slate-800"
            }`}
          >
            {o.label}
            {o.recommended ? " · Recommended" : ""}
          </button>
        ))}
      </div>
    </div>
  );
}

function StickyNav({
  onBack,
  onNext,
  nextDisabled,
}: {
  onBack: () => void;
  onNext?: () => void;
  nextDisabled?: boolean;
}) {
  return (
    <div className="sticky bottom-0 -mx-4 mt-8 border-t border-slate-200 bg-[#f5f5f4] px-4 py-3">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[52px] flex-1 rounded-2xl border-2 border-slate-200 bg-white py-3 font-semibold text-slate-700"
        >
          Back
        </button>
        {onNext && (
          <button
            type="button"
            disabled={nextDisabled}
            onClick={onNext}
            className="min-h-[52px] flex-1 rounded-2xl bg-[#2563EB] py-3 font-semibold text-white disabled:opacity-40"
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
}
