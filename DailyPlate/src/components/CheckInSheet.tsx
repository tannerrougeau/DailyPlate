import { useState } from "react";
import { X } from "lucide-react";
import { CHECK_IN_DISCLAIMER, CHECK_IN_INTRO } from "@/checkIn/questionnaire";
import { FoodPreferenceSection } from "@/components/FoodPreferenceSection";
import { MinimumProteinSettings } from "@/components/MinimumProteinSettings";
import { WeeklyMealPrepSection } from "@/components/WeeklyMealPrepSection";
import { MealTimingPreferenceSection } from "@/components/MealTimingPreferenceSection";
import { MinimalPrepPreferenceSection } from "@/components/MinimalPrepPreferenceSection";
import { LowComplexityPreferenceSection } from "@/components/LowComplexityPreferenceSection";
import { CuisinePreferenceSection } from "@/components/CuisinePreferenceSection";
import { useAppStore } from "@/store/useAppStore";
import type { MealSlotId } from "@/types";
import type { MealTimingPreference, UserProfile, WeeklyMealPrepRepeatCount } from "@/types/profile";
import type {
  ActivityChangeOption,
  CheckInResult,
  WeightChangeDirection,
} from "@/types/tdeeFeedback";
import type { WeightUnit } from "@/utils/bodyMeasurements";
import { proteinGramsFromPreset } from "@/utils/proteinMinimum";

type Phase = "intro" | "form" | "results";

const measurementInputClass =
  "min-h-[56px] w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-center text-2xl font-semibold text-slate-900 outline-none focus:border-[#2563EB]";

function ScaleInput({
  label,
  hint,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-3 flex-1 accent-[#2563EB]"
        />
        <span className="w-10 text-right text-lg font-bold tabular-nums text-slate-900">
          {value}
        </span>
      </div>
    </div>
  );
}

export function CheckInSheet({ onClose }: { onClose: () => void }) {
  const userProfile = useAppStore((s) => s.userProfile);
  const targets = useAppStore((s) => s.targets);
  const submitCheckIn = useAppStore((s) => s.submitCheckIn);
  const applyCalorieRecommendation = useAppStore((s) => s.applyCalorieRecommendation);
  const authSession = useAppStore((s) => s.authSession);

  const [phase, setPhase] = useState<Phase>("intro");
  const [result, setResult] = useState<CheckInResult | null>(null);

  const [direction, setDirection] = useState<WeightChangeDirection>("same");
  const [weightAmount, setWeightAmount] = useState("");
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("lbs");
  const [energyLevel, setEnergyLevel] = useState(6);
  const [calorieAdherence, setCalorieAdherence] = useState(7);
  const [proteinAdherence, setProteinAdherence] = useState(7);
  const [activityChange, setActivityChange] = useState<ActivityChangeOption>("none");
  const [activityNotes, setActivityNotes] = useState("");
  const [sleepQuality, setSleepQuality] = useState(6);
  const [strengthProgress, setStrengthProgress] = useState(6);
  const [strengthNotes, setStrengthNotes] = useState("");
  const [mealVarietySatisfaction, setMealVarietySatisfaction] = useState(6);
  const [planEaseOfUse, setPlanEaseOfUse] = useState(6);
  const [recipeEnjoyment, setRecipeEnjoyment] = useState(6);
  const [hungerManagement, setHungerManagement] = useState(6);
  const [experienceNotes, setExperienceNotes] = useState("");

  const [favChips, setFavChips] = useState<string[]>(userProfile?.favoriteFoodChips ?? []);
  const [disChips, setDisChips] = useState<string[]>(userProfile?.dislikedFoodChips ?? []);
  const [favCustom, setFavCustom] = useState(userProfile?.favoriteFoodCustom ?? "");
  const [disCustom, setDisCustom] = useState(userProfile?.dislikedFoodCustom ?? "");
  const [weeklyPrepEnabled, setWeeklyPrepEnabled] = useState(
    userProfile?.weeklyMealPrepEnabled ?? false,
  );
  const [weeklyPrepSlot, setWeeklyPrepSlot] = useState<MealSlotId>(
    userProfile?.weeklyMealPrepSlot ?? "dinner",
  );
  const [weeklyPrepRepeat, setWeeklyPrepRepeat] = useState<WeeklyMealPrepRepeatCount>(
    userProfile?.weeklyMealPrepRepeatCount ?? 3,
  );
  const [prioritizeProtein, setPrioritizeProtein] = useState(
    userProfile?.prioritizeMinProtein ?? false,
  );
  const [minProteinGrams, setMinProteinGrams] = useState(
    userProfile?.minimumProteinGrams != null
      ? String(userProfile.minimumProteinGrams)
      : userProfile
        ? String(proteinGramsFromPreset(userProfile.weightKg, 1.8))
        : "",
  );
  const [mealTiming, setMealTiming] = useState<MealTimingPreference | null>(
    userProfile?.mealTiming ?? null,
  );
  const [prioritizeMinimalPrep, setPrioritizeMinimalPrep] = useState(
    userProfile?.prioritizeMinimalPrep ?? false,
  );
  const [lowComplexityEnabled, setLowComplexityEnabled] = useState(
    userProfile?.lowComplexityEnabled ?? false,
  );
  const [preferredCuisines, setPreferredCuisines] = useState<string[]>(
    userProfile?.preferredCuisines ?? [],
  );

  if (!userProfile) return null;

  const weightOk =
    direction === "same" ||
    (weightAmount.trim() !== "" && Number(weightAmount) > 0 && Number.isFinite(Number(weightAmount)));

  function buildProfileUpdates(): Partial<UserProfile> {
    const parsedProtein = Number(minProteinGrams);
    return {
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
      mealTiming,
      prioritizeMinimalPrep,
      lowComplexityEnabled,
      preferredCuisines,
    };
  }

  function handleSubmit() {
    if (!weightOk || !userProfile) return;
    const profileUpdates = buildProfileUpdates();
    const checkInResult = submitCheckIn(
      {
        calorieTargetAtSubmit: targets.calories,
        weightChangeDirection: direction,
        weightChangeAmount: direction === "same" ? null : Number(weightAmount),
        weightChangeUnit: weightUnit,
        energyLevel,
        calorieAdherence,
        proteinAdherence,
        activityChange,
        activityChangeNotes: activityNotes.trim(),
        sleepQuality,
        strengthProgress,
        strengthNotes: strengthNotes.trim(),
        mealVarietySatisfaction,
        planEaseOfUse,
        recipeEnjoyment,
        hungerManagement,
        experienceNotes: experienceNotes.trim(),
      },
      profileUpdates,
    );
    setResult(checkInResult);
    setPhase("results");
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close check-in"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-labelledby="check-in-title"
        className="relative z-[91] flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl border border-slate-200 bg-[#f5f5f4] shadow-2xl sm:rounded-3xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <h2 id="check-in-title" className="text-lg font-bold text-slate-900">
            {phase === "results" ? "Your check-in" : "Check-in"}
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

        <div className="overflow-y-auto px-5 py-5">
          {phase === "intro" && (
            <div className="space-y-6">
              <p className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 text-sm leading-relaxed text-blue-950">
                {CHECK_IN_DISCLAIMER}
              </p>
              <p className="text-sm text-slate-600">{CHECK_IN_INTRO}</p>
              {authSession && (
                <p className="text-xs text-slate-500">
                  Signed in as {authSession.email} — responses sync to your account.
                </p>
              )}
              <button
                type="button"
                onClick={() => setPhase("form")}
                className="min-h-[56px] w-full rounded-2xl bg-[#2563EB] py-3 text-base font-semibold text-white"
              >
                Start check-in
              </button>
            </div>
          )}

          {phase === "form" && (
            <div className="space-y-6">
              <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">Body & progress</p>
                <div className="flex flex-col gap-2">
                  {(
                    [
                      { id: "lost" as const, label: "Lost weight" },
                      { id: "gained" as const, label: "Gained weight" },
                      { id: "same" as const, label: "About the same" },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setDirection(o.id)}
                      className={`min-h-[52px] rounded-2xl border-2 px-4 text-left text-sm font-semibold ${
                        direction === o.id
                          ? "border-[#2563EB] bg-blue-50 text-blue-900"
                          : "border-slate-200 text-slate-800"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                {direction !== "same" && (
                  <div className="space-y-3 pt-1">
                    <div
                      className="flex rounded-2xl border-2 border-slate-200 bg-slate-100 p-1"
                      role="group"
                      aria-label="Weight unit"
                    >
                      {(["lbs", "kg"] as const).map((u) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setWeightUnit(u)}
                          className={`min-h-[48px] flex-1 rounded-xl text-sm font-semibold ${
                            weightUnit === u
                              ? "bg-white text-blue-900 shadow-sm"
                              : "text-slate-600"
                          }`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={weightAmount}
                      onChange={(e) => setWeightAmount(e.target.value)}
                      placeholder={weightUnit === "lbs" ? "e.g. 3" : "e.g. 1.5"}
                      className={measurementInputClass}
                      aria-label={`Amount ${weightUnit}`}
                    />
                  </div>
                )}
              </section>

              <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">How the plan felt</p>
                <ScaleInput
                  label="Energy levels"
                  hint="1 = exhausted · 10 = great"
                  value={energyLevel}
                  onChange={setEnergyLevel}
                  min={1}
                  max={10}
                />
                <ScaleInput
                  label="Calorie target adherence"
                  hint="1 = rarely on target · 10 = very consistent"
                  value={calorieAdherence}
                  onChange={setCalorieAdherence}
                  min={1}
                  max={10}
                />
                <ScaleInput
                  label="Protein adherence"
                  hint="1 = struggled · 10 = nailed it"
                  value={proteinAdherence}
                  onChange={setProteinAdherence}
                  min={1}
                  max={10}
                />
                <ScaleInput
                  label="Sleep quality"
                  hint="0 = very poor · 10 = excellent"
                  value={sleepQuality}
                  onChange={setSleepQuality}
                  min={0}
                  max={10}
                />
                <ScaleInput
                  label="Strength / conditioning"
                  hint="1 = regressing · 10 = strong progress"
                  value={strengthProgress}
                  onChange={setStrengthProgress}
                  min={1}
                  max={10}
                />
                <ScaleInput
                  label="Meal variety"
                  hint="1 = too repetitive · 10 = great variety"
                  value={mealVarietySatisfaction}
                  onChange={setMealVarietySatisfaction}
                  min={1}
                  max={10}
                />
                <ScaleInput
                  label="Ease of following your plan"
                  hint="1 = difficult · 10 = very easy"
                  value={planEaseOfUse}
                  onChange={setPlanEaseOfUse}
                  min={1}
                  max={10}
                />
                <ScaleInput
                  label="Enjoyment of suggested meals"
                  hint="1 = rarely enjoyed · 10 = loved them"
                  value={recipeEnjoyment}
                  onChange={setRecipeEnjoyment}
                  min={1}
                  max={10}
                />
                <ScaleInput
                  label="Hunger & fullness balance"
                  hint="1 = too hungry · 10 = well satisfied"
                  value={hungerManagement}
                  onChange={setHungerManagement}
                  min={1}
                  max={10}
                />
                <label className="block pt-1">
                  <span className="mb-1.5 block text-xs font-medium text-slate-500">
                    Anything else about your experience? (optional)
                  </span>
                  <textarea
                    value={experienceNotes}
                    onChange={(e) => setExperienceNotes(e.target.value)}
                    placeholder="e.g. want more quick breakfasts, less spicy food…"
                    rows={3}
                    className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#2563EB]"
                  />
                </label>
              </section>

              <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">Activity</p>
                <div className="flex flex-col gap-2">
                  {(
                    [
                      { id: "none" as const, label: "No major change" },
                      { id: "more" as const, label: "More active" },
                      { id: "less" as const, label: "Less active" },
                      { id: "other" as const, label: "Other" },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setActivityChange(o.id)}
                      className={`min-h-[48px] rounded-2xl border-2 px-4 text-left text-sm font-semibold ${
                        activityChange === o.id
                          ? "border-[#2563EB] bg-blue-50 text-blue-900"
                          : "border-slate-200 text-slate-800"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={activityNotes}
                  onChange={(e) => setActivityNotes(e.target.value)}
                  placeholder="Optional activity notes…"
                  rows={2}
                  className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#2563EB]"
                />
                <textarea
                  value={strengthNotes}
                  onChange={(e) => setStrengthNotes(e.target.value)}
                  placeholder="Optional training notes…"
                  rows={2}
                  className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#2563EB]"
                />
              </section>

              <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">Refine your profile</p>
                <p className="text-xs text-slate-500">
                  Updates below are saved to your profile when you submit.
                </p>
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
                <MealTimingPreferenceSection value={mealTiming} onChange={setMealTiming} />
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
                <MinimumProteinSettings
                  profile={userProfile}
                  enabled={prioritizeProtein}
                  proteinGrams={minProteinGrams}
                  onEnabledChange={setPrioritizeProtein}
                  onProteinGramsChange={setMinProteinGrams}
                  onApplyPreset={(grams) => setMinProteinGrams(String(grams))}
                />
              </section>

              <button
                type="button"
                disabled={!weightOk}
                onClick={handleSubmit}
                className="min-h-[56px] w-full rounded-2xl bg-[#2563EB] py-3 text-base font-semibold text-white disabled:opacity-40"
              >
                Submit check-in
              </button>
            </div>
          )}

          {phase === "results" && result && (
            <ResultsView
              result={result}
              currentCalories={targets.calories}
              onStay={onClose}
              onAdjustCalories={() => {
                applyCalorieRecommendation(result.calorie.suggestedCalories);
                onClose();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ResultsView({
  result,
  currentCalories,
  onStay,
  onAdjustCalories,
}: {
  result: CheckInResult;
  currentCalories: number;
  onStay: () => void;
  onAdjustCalories: () => void;
}) {
  const authSession = useAppStore((s) => s.authSession);
  const { calorie, experience } = result;
  const showCalorieAdjust = calorie.deltaCalories !== 0;

  return (
    <div className="space-y-5">
      <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
        Your responses and profile refinements are saved.{" "}
        {authSession
          ? "They’ll stay with your account when you’re signed in."
          : "Sign in from Settings to sync across devices."}
      </p>

      <section className="space-y-2">
        <h3 className="text-sm font-bold text-slate-900">Calorie target</h3>
        <p className="text-xs text-slate-500">
          {calorie.usedAdaptiveModel
            ? "Based on your check-in history:"
            : "Based on this check-in:"}
        </p>
        <ul className="space-y-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm leading-relaxed text-slate-700">
          {calorie.reasoning.map((line) => (
            <li key={line} className="list-disc pl-1 marker:text-[#2563EB]">
              {line}
            </li>
          ))}
        </ul>
        <p className="text-center text-sm text-slate-500">
          Current target: <span className="font-semibold text-slate-800">{currentCalories}</span>{" "}
          kcal
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-bold text-slate-900">Experience & plan refinement</h3>
        <ul className="space-y-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm leading-relaxed text-slate-700">
          {experience.suggestions.map((line) => (
            <li key={line} className="list-disc pl-1 marker:text-emerald-600">
              {line}
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onStay}
          className="min-h-[56px] w-full rounded-2xl border-2 border-slate-200 bg-white py-3 text-base font-semibold text-slate-800"
        >
          Done
        </button>
        {showCalorieAdjust ? (
          <button
            type="button"
            onClick={onAdjustCalories}
            className="min-h-[56px] w-full rounded-2xl bg-[#2563EB] py-3 text-base font-semibold text-white"
          >
            Apply calorie change ({calorie.deltaCalories > 0 ? "+" : ""}
            {calorie.deltaCalories} → {calorie.suggestedCalories} kcal)
          </button>
        ) : (
          <p className="text-center text-sm font-medium text-emerald-800">
            No calorie change suggested right now.
          </p>
        )}
      </div>
    </div>
  );
}

/** @deprecated Use CheckInSheet */
export const TdeeFeedbackSheet = CheckInSheet;
