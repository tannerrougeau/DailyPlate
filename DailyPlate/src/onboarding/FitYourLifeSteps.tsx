import { useState } from "react";
import { choiceChip } from "@/components/HowIEatSettings";
import type { MealSource, MealSourceSlot } from "@/types/profile";
import {
  BUDGET_OPTIONS,
  COOKING_AMOUNT_OPTIONS,
  COOKING_LIMIT_OPTIONS,
  MEAL_SOURCE_OPTIONS,
  MEAL_SOURCE_SLOTS,
  type FitAnswers,
} from "@/utils/fitYourLife";

export const FIT_INTRO_TITLE = "Make it fit your life (optional)";
export const FIT_INTRO_TEXT =
  "A few quick questions help DailyPlate plan around how you actually eat. Skip any of them. Your plan works either way, and you can answer later in Settings.";

type Phase = "intro" | 1 | 2 | 3 | 4;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Optional section near the end of onboarding: an intro card, then four short questions, each with
 * Skip. Skipping keeps today's behavior. "Keep it simple" turns on Basic mode.
 */
export function FitYourLifeSteps({
  value,
  onChange,
  onDone,
  onKeepSimple,
  onBack,
}: {
  value: FitAnswers;
  onChange: (next: FitAnswers) => void;
  onDone: () => void;
  onKeepSimple: () => void;
  onBack: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("intro");
  const next = () => (phase === 4 ? onDone() : setPhase(phase === "intro" ? 1 : ((phase + 1) as Phase)));
  const back = () => (phase === "intro" ? onBack() : setPhase(phase === 1 ? "intro" : ((phase - 1) as Phase)));

  if (phase === "intro") {
    return (
      <div className="space-y-4">
        <div className="rounded-3xl border border-slate-200/80 bg-white px-5 py-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">{FIT_INTRO_TITLE}</h2>
          <p className="mt-2 text-[15px] leading-snug text-slate-600">{FIT_INTRO_TEXT}</p>
        </div>
        <button
          type="button"
          onClick={() => setPhase(1)}
          className="min-h-[52px] w-full rounded-2xl bg-[#2563EB] py-3 text-base font-semibold text-white"
        >
          Answer a few questions
        </button>
        <button
          type="button"
          onClick={onDone}
          className="min-h-[48px] w-full rounded-2xl border-2 border-slate-200 bg-white py-2.5 text-base font-semibold text-slate-700"
        >
          Skip for now
        </button>
        <button type="button" onClick={onKeepSimple} className="min-h-[44px] w-full text-sm font-semibold text-slate-600">
          Keep it simple
        </button>
        <button type="button" onClick={onBack} className="min-h-[40px] w-full text-sm text-slate-500">
          Back
        </button>
      </div>
    );
  }

  const sources = value.mealSources ?? {};
  const limits = value.cookingLimits ?? [];
  const setSource = (slot: MealSourceSlot, id: MealSource) =>
    onChange({ ...value, mealSources: { ...sources, [slot]: sources[slot] === id ? undefined : id } });

  return (
    <div className="space-y-5">
      <p className="text-xs font-medium text-slate-500">Question {phase} of 4 · optional</p>
      {phase === 1 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900">How do you usually get each meal?</h2>
          {MEAL_SOURCE_SLOTS.map((slot) => (
            <div key={slot}>
              <p className="text-sm font-semibold text-slate-800">{capitalize(slot)}</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {MEAL_SOURCE_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={sources[slot] === o.id}
                    className={choiceChip(sources[slot] === o.id)}
                    onClick={() => setSource(slot, o.id)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {phase === 2 && (
        <div className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900">How much cooking works for you?</h2>
          <div className="flex flex-wrap gap-2">
            {COOKING_AMOUNT_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                aria-pressed={value.cookingAmount === o.id}
                className={choiceChip(value.cookingAmount === o.id)}
                onClick={() => onChange({ ...value, cookingAmount: value.cookingAmount === o.id ? undefined : o.id })}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {phase === 3 && (
        <div className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900">Food budget?</h2>
          <div className="flex flex-wrap gap-2">
            {BUDGET_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                aria-pressed={value.budget === o.id}
                className={choiceChip(value.budget === o.id)}
                onClick={() => onChange({ ...value, budget: value.budget === o.id ? undefined : o.id })}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {phase === 4 && (
        <div className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900">Anything that limits cooking?</h2>
          <p className="text-sm text-slate-500">Pick any.</p>
          <div className="flex flex-wrap gap-2">
            {COOKING_LIMIT_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                aria-pressed={limits.includes(o.id)}
                className={choiceChip(limits.includes(o.id))}
                onClick={() =>
                  onChange({
                    ...value,
                    cookingLimits: limits.includes(o.id) ? limits.filter((l) => l !== o.id) : [...limits, o.id],
                  })
                }
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={back}
          className="min-h-[48px] rounded-2xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
        >
          Back
        </button>
        <button
          type="button"
          onClick={next}
          className="min-h-[48px] flex-1 rounded-2xl bg-[#2563EB] text-base font-semibold text-white"
        >
          Next
        </button>
        <button type="button" onClick={next} className="min-h-[48px] px-3 text-sm font-semibold text-slate-500">
          Skip
        </button>
      </div>
    </div>
  );
}
