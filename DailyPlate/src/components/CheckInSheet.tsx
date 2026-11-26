import { useState } from "react";
import { QuestionCard } from "@/components/QuestionCard";
import { resolveDisplayPrefs, type Checkpoint } from "@/utils/displayPrefs";
import {
  checkInPlanQuestions,
  checkInQuestions,
  MAX_IN_CHECK_IN,
  nextQuestions,
  usesLongBatches,
  type Question,
} from "@/utils/questionQueue";
import { useOverlayBack } from "@/hooks/useOverlayBack";
import { ChevronDown, X } from "lucide-react";
import { CHECK_IN_DISCLAIMER } from "@/checkIn/questionnaire";
import { PrefStepper } from "@/components/PrefStepper";
import { TapScale } from "@/components/TapScale";
import {
  ProfileRefineCards,
  defaultRefineValues,
  profilePatchFromRefine,
  refineValuesFromProfile,
  type HouseholdCardValue,
  type RefineCardValues,
  householdCardValueFromProfile,
} from "@/components/ProfileRefineCards";
import { useAppStore } from "@/store/useAppStore";
import type { UserProfile } from "@/types/profile";
import type {
  ActivityChangeOption,
  CheckInResult,
  LeftoversFeltRepetitive,
  WeightChangeDirection,
} from "@/types/tdeeFeedback";
import type { WeightUnit } from "@/utils/bodyMeasurements";
import {
  withPlanningDefaults,
} from "@/utils/planningPrefs";
import { goalLinkedProteinGrams, migrateProteinPreference } from "@/utils/proteinMinimum";
import { keepInPlace } from "@/utils/scrollAnchor";

type Screen = 1 | 2 | 3 | 4;
type Phase = "form" | "results";

const measurementInputClass =
  "min-h-[56px] w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-center text-2xl font-semibold text-slate-900 outline-none focus:border-[#2563EB]";

export function CheckInSheet({ onClose }: { onClose: () => void }) {
  useOverlayBack(true, onClose);
  const storedProfile = useAppStore((s) => s.userProfile);
  const userProfile = storedProfile ? withPlanningDefaults(storedProfile) : null;
  const targets = useAppStore((s) => s.targets);
  const submitCheckIn = useAppStore((s) => s.submitCheckIn);
  const applyCalorieRecommendation = useAppStore((s) => s.applyCalorieRecommendation);
  const authSession = useAppStore((s) => s.authSession);

  const [phase, setPhase] = useState<Phase>("form");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [applied, setApplied] = useState<Checkpoint[]>([]);
  const refreshQuestions = useAppStore((s) => s.refreshQuestions);
  const answerQuestion = useAppStore((s) => s.answerQuestion);
  const restoreCheckpoint = useAppStore((s) => s.restoreCheckpoint);
  const [screen, setScreen] = useState<Screen>(1);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const [direction, setDirection] = useState<WeightChangeDirection>("same");
  const [weightAmount, setWeightAmount] = useState("");
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("lbs");
  const [energyLevel, setEnergyLevel] = useState(3);
  const [hungerManagement, setHungerManagement] = useState(3);
  const [calorieAdherence, setCalorieAdherence] = useState(3);
  const [proteinAdherence, setProteinAdherence] = useState(3);
  const [recipeEnjoyment, setRecipeEnjoyment] = useState(3);
  const [mealVarietySatisfaction, setMealVarietySatisfaction] = useState(3);
  const [planEaseOfUse, setPlanEaseOfUse] = useState(3);
  const [sleepQuality, setSleepQuality] = useState(3);
  const [strengthProgress, setStrengthProgress] = useState(3);
  const [activityChange, setActivityChange] = useState<ActivityChangeOption>("none");
  const [timesShoppedThisWeek, setTimesShoppedThisWeek] = useState(
    userProfile?.shoppingTripsPerWeek ?? 1,
  );
  const [timesCookedThisWeek, setTimesCookedThisWeek] = useState(
    userProfile?.cookingEventsPerWeek ?? 4,
  );
  const [leftoversFeltRepetitive, setLeftoversFeltRepetitive] =
    useState<LeftoversFeltRepetitive | null>(null);
  const [experienceNotes, setExperienceNotes] = useState("");
  const [refine, setRefine] = useState<RefineCardValues>(() =>
    userProfile ? refineValuesFromProfile(userProfile) : defaultRefineValues(),
  );
  const [household, setHousehold] = useState<HouseholdCardValue | null>(() =>
    userProfile ? householdCardValueFromProfile(userProfile) : null,
  );

  if (!userProfile) return null;
  const profile = userProfile;
  const proteinPreference = migrateProteinPreference(profile.proteinPreference);
  const derivedProteinGrams = goalLinkedProteinGrams({
    goal: profile.goal,
    preference: proteinPreference,
    weightKg: profile.weightKg,
    heightCm: profile.heightCm,
  });

  const weightOk =
    direction === "same" ||
    (weightAmount.trim() !== "" && Number(weightAmount) > 0 && Number.isFinite(Number(weightAmount)));

  function buildProfileUpdates(): Partial<UserProfile> {
    return {
      ...profilePatchFromRefine(refine, {
        weightKg: profile.weightKg,
        heightCm: profile.heightCm,
        goal: profile.goal,
        proteinPreference,
      }),
      ...(household
        ? {
            householdMembers: household.members,
            householdFoodAvoidChips: household.avoidChips,
            householdFoodAvoidCustom: household.avoidCustom,
          }
        : {}),
    };
  }

  function handleSubmit() {
    if (!weightOk) return;
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
        activityChangeNotes: "",
        sleepQuality,
        strengthProgress,
        strengthNotes: "",
        mealVarietySatisfaction,
        planEaseOfUse,
        recipeEnjoyment,
        hungerManagement,
        experienceNotes: experienceNotes.trim(),
        timesShoppedThisWeek,
        timesCookedThisWeek,
        leftoversFeltRepetitive: leftoversFeltRepetitive ?? "no",
      },
      buildProfileUpdates(),
    );
    setResult(checkInResult);
    // Checkpoint: up to two questions from this check-in and the queue.
    const now = new Date();
    const st = useAppStore.getState();
    // Plans with batches longer than 2 days, from settings or from batches already planned ahead.
    const plannedLongBatch = Object.entries(st.dailyPlans).some(
      ([key, meals]) => key >= st.todayDateKey && meals.some((m) => (m.mealPrep?.portionsCooked ?? 1) > 2),
    );
    refreshQuestions([
      // Plan changes from low (1–2) answers are asked, never applied automatically.
      ...checkInPlanQuestions(checkInResult.entry, st.userProfile, now),
      ...checkInQuestions(
        checkInResult.entry,
        resolveDisplayPrefs(st.displayPrefs),
        st.userProfile,
        now,
        usesLongBatches(st.userProfile) || plannedLongBatch,
      ),
    ]);
    const after = useAppStore.getState();
    // Two at most; plan changes first, the rest stay queued. None in Basic mode or while paused.
    setQuestions(
      after.questionsAllowedNow()
        ? nextQuestions(
            // Setup questions open their own sheet on Today, so they aren't asked here.
            after.questionQueue.filter((q) => q.change.kind !== "askTopic"),
            after.questionLog,
            now,
            MAX_IN_CHECK_IN,
            { planFirst: true },
          )
        : [],
    );
    setPhase("results");
  }

  const progress = screen / 4;

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

        {phase === "form" && (
          <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-3">
            <div className="mb-2 flex justify-between text-xs font-medium text-slate-500">
              <span>{screen} of 4</span>
              <span>{Math.round(progress * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
        )}

        <div className="overflow-y-auto px-5 py-5">
          {phase === "form" && screen === 1 && (
            <div className="space-y-4">
              <p className="text-xs leading-relaxed text-slate-500">{CHECK_IN_DISCLAIMER}</p>
              {authSession && (
                <p className="text-xs text-slate-500">Signed in as {authSession.email}</p>
              )}
              <h3 className="text-xl font-bold text-slate-900">Weight change</h3>
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
                    onClick={() => {
                      setDirection(o.id);
                      if (o.id === "same") setScreen(2);
                    }}
                    className={`min-h-[52px] rounded-2xl border-2 px-4 text-left text-sm font-semibold ${
                      direction === o.id
                        ? "border-[#2563EB] bg-blue-50 text-blue-900"
                        : "border-slate-200 bg-white text-slate-800"
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
                          weightUnit === u ? "bg-white text-blue-900 shadow-sm" : "text-slate-600"
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
              <ScreenNav
                onBack={onClose}
                backLabel="Close"
                onNext={() => setScreen(2)}
                nextDisabled={!weightOk}
              />
            </div>
          )}

          {phase === "form" && screen === 2 && (
            <div className="space-y-5">
              <h3 className="text-xl font-bold text-slate-900">How it went</h3>
              <TapScale
                label="Energy"
                hint="1 = exhausted · 5 = great"
                value={energyLevel}
                onChange={setEnergyLevel}
              />
              <TapScale
                label="Hunger & fullness"
                hint="1 = too hungry · 5 = well satisfied"
                value={hungerManagement}
                onChange={setHungerManagement}
              />
              <TapScale
                label="Calorie adherence"
                hint="1 = rarely on target · 5 = very consistent"
                value={calorieAdherence}
                onChange={setCalorieAdherence}
              />
              <TapScale
                label="Protein adherence"
                hint="1 = struggled · 5 = nailed it"
                value={proteinAdherence}
                onChange={setProteinAdherence}
              />
              <TapScale
                label="Meal enjoyment"
                hint="1 = rarely enjoyed · 5 = loved them"
                value={recipeEnjoyment}
                onChange={setRecipeEnjoyment}
              />

              <div className="rounded-2xl border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={(e) => keepInPlace(e.currentTarget, () => setMoreOpen((o) => !o))}
                  aria-expanded={moreOpen}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <span className="text-sm font-semibold text-slate-900">More</span>
                  <ChevronDown className={`h-4 w-4 text-slate-400 ${moreOpen ? "rotate-180" : ""}`} />
                </button>
                {moreOpen && (
                  <div className="space-y-5 border-t border-slate-100 px-4 py-4">
                    <TapScale
                      label="Variety"
                      hint="1 = too repetitive · 5 = great variety"
                      value={mealVarietySatisfaction}
                      onChange={setMealVarietySatisfaction}
                    />
                    <TapScale
                      label="Ease of use"
                      hint="1 = difficult · 5 = very easy"
                      value={planEaseOfUse}
                      onChange={setPlanEaseOfUse}
                    />
                    <TapScale
                      label="Sleep"
                      hint="1 = very poor · 5 = excellent"
                      value={sleepQuality}
                      onChange={setSleepQuality}
                    />
                    <TapScale
                      label="Strength"
                      hint="1 = regressing · 5 = strong progress"
                      value={strengthProgress}
                      onChange={setStrengthProgress}
                    />
                    <section className="space-y-2">
                      <p className="text-sm font-semibold text-slate-900">Activity change</p>
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
                            className={`min-h-[44px] rounded-2xl border-2 px-4 text-left text-sm font-semibold ${
                              activityChange === o.id
                                ? "border-[#2563EB] bg-blue-50 text-blue-900"
                                : "border-slate-200 text-slate-800"
                            }`}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </section>
                  </div>
                )}
              </div>
              <ScreenNav onBack={() => setScreen(1)} onNext={() => setScreen(3)} />
            </div>
          )}

          {phase === "form" && screen === 3 && (
            <div className="space-y-5">
              <h3 className="text-xl font-bold text-slate-900">Plan structure</h3>
              <PrefStepper
                label="Times shopped this week"
                value={timesShoppedThisWeek}
                min={0}
                max={7}
                recommended={profile.shoppingTripsPerWeek}
                onChange={setTimesShoppedThisWeek}
              />
              <PrefStepper
                label="Times cooked this week"
                value={timesCookedThisWeek}
                min={0}
                max={7}
                recommended={profile.cookingEventsPerWeek}
                onChange={setTimesCookedThisWeek}
              />
              <section className="space-y-2">
                <p className="text-sm font-semibold text-slate-900">Leftovers felt repetitive?</p>
                <div className="flex flex-col gap-2">
                  {(
                    [
                      { id: "yes" as const, label: "Yes" },
                      { id: "somewhat" as const, label: "Somewhat" },
                      { id: "no" as const, label: "No" },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setLeftoversFeltRepetitive(o.id)}
                      className={`min-h-[48px] rounded-2xl border-2 px-4 text-left text-sm font-semibold ${
                        leftoversFeltRepetitive === o.id
                          ? "border-[#2563EB] bg-blue-50 text-blue-900"
                          : "border-slate-200 bg-white text-slate-800"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </section>
              <ScreenNav
                onBack={() => setScreen(2)}
                onNext={() => setScreen(4)}
                nextDisabled={leftoversFeltRepetitive == null}
              />
            </div>
          )}

          {phase === "form" && screen === 4 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Anything to change?</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Optional. Tap a card to edit. Updates save with this check-in.
                </p>
              </div>
              <ProfileRefineCards
                value={refine}
                onChange={setRefine}
                weightKg={profile.weightKg}
                heightCm={profile.heightCm}
                goal={profile.goal}
                preference={proteinPreference}
                derivedProteinGrams={derivedProteinGrams}
                household={household}
                onHouseholdChange={setHousehold}
              />
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">
                  Notes (optional)
                </span>
                <textarea
                  value={experienceNotes}
                  onChange={(e) => setExperienceNotes(e.target.value)}
                  placeholder="Anything else you want us to remember…"
                  rows={3}
                  className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#2563EB]"
                />
              </label>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setScreen(3)}
                  className="min-h-[52px] flex-1 rounded-2xl border-2 border-slate-200 bg-white py-3 font-semibold text-slate-700"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="min-h-[52px] flex-1 rounded-2xl bg-[#2563EB] py-3 font-semibold text-white"
                >
                  Submit
                </button>
              </div>
            </div>
          )}

          {phase === "results" && (questions.length > 0 || applied.length > 0) && (
            <div className="mb-4 space-y-2">
              {applied.map((cp) => (
                <p key={cp.id} className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  <span>{cp.what}.</span>
                  <button
                    type="button"
                    onClick={() => {
                      restoreCheckpoint(cp.id);
                      setApplied((list) => list.filter((x) => x.id !== cp.id));
                    }}
                    className="font-semibold"
                  >
                    Undo
                  </button>
                </p>
              ))}
              {questions.map((q) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  onAnswer={(answer) => {
                    const cp = answerQuestion(q.id, answer);
                    setQuestions((list) => list.filter((x) => x.id !== q.id));
                    if (cp) setApplied((list) => [...list, cp]);
                  }}
                  onPaused={() => setQuestions([])}
                />
              ))}
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

function ScreenNav({
  onBack,
  onNext,
  nextDisabled,
  backLabel = "Back",
}: {
  onBack: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  backLabel?: string;
}) {
  return (
    <div className="flex gap-3 pt-2">
      <button
        type="button"
        onClick={onBack}
        className="min-h-[52px] flex-1 rounded-2xl border-2 border-slate-200 bg-white py-3 font-semibold text-slate-700"
      >
        {backLabel}
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
  const { calorie, experience } = result;
  const showCalorieAdjust = calorie.deltaCalories !== 0;
  const verdict =
    calorie.deltaCalories > 0
      ? `Increase your target to ${calorie.suggestedCalories.toLocaleString()} kcal.`
      : calorie.deltaCalories < 0
        ? `Lower your target to ${calorie.suggestedCalories.toLocaleString()} kcal.`
        : `Stay at ${currentCalories.toLocaleString()} kcal — your target still looks right.`;

  return (
    <div className="space-y-5">
      <p className="text-lg font-bold leading-snug text-slate-900">{verdict}</p>

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
        <p className="text-sm font-medium text-emerald-800">No calorie change suggested right now.</p>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-bold text-slate-900">Why</h3>
        <ul className="space-y-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm leading-relaxed text-slate-700">
          {calorie.reasoning.map((line) => (
            <li key={line} className="list-disc pl-1 marker:text-[#2563EB]">
              {line}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-bold text-slate-900">Plan notes</h3>
        <ul className="space-y-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm leading-relaxed text-slate-700">
          {experience.suggestions.map((line) => (
            <li key={line} className="list-disc pl-1 marker:text-emerald-600">
              {line}
            </li>
          ))}
        </ul>
      </section>

      <button
        type="button"
        onClick={onStay}
        className="min-h-[56px] w-full rounded-2xl border-2 border-slate-200 bg-white py-3 text-base font-semibold text-slate-800"
      >
        Done
      </button>
    </div>
  );
}

/** @deprecated Use CheckInSheet */
export const TdeeFeedbackSheet = CheckInSheet;
