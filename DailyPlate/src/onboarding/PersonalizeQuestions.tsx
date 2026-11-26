import { useState } from "react";
import type { RecipeMealSlotId } from "@/types";
import type { MainGoal, MealSource, MealSourceSlot, ProteinPreference } from "@/types/profile";
import { choiceChip } from "@/components/HowIEatSettings";
import { CookingShoppingSection } from "@/components/CookingShoppingSection";
import { CuisinePreferenceSection } from "@/components/CuisinePreferenceSection";
import { FoodPreferenceSection } from "@/components/FoodPreferenceSection";
import { HouseholdDetailsSection } from "@/components/HouseholdDetailsSection";
import { MealSizesSection } from "@/components/MealTimingPreferenceSection";
import { MinimumProteinSettings } from "@/components/MinimumProteinSettings";
import type { PlanningPrefsValue } from "@/components/PlanningPrefsSection";
import {
  BUDGET_OPTIONS,
  COOKING_AMOUNT_OPTIONS,
  COOKING_LIMIT_OPTIONS,
  MEAL_SOURCE_OPTIONS,
  MEAL_SOURCE_SLOTS,
} from "@/utils/fitYourLife";
import { MACRO_SPLIT_OPTIONS } from "@/utils/macroSplit";
import { PROTEIN_SOURCE_PREF_OPTIONS } from "@/utils/planningPrefs";
import {
  TOPIC_TITLE,
  type PersonalizeDraft,
  type PersonalizeTopic,
  type TopicId,
} from "@/utils/personalizeTopics";

export const CHOICE_TITLE = "How should DailyPlate work for you?";
export const BASIC_TEXT = "Straightforward plans sized to your goals. Minimal questions.";
export const PERSONALIZED_TEXT =
  "Plans adapt to your tastes, schedule and how you get food. This means more questions and input from you over time.";
export const CHOICE_FOOTER =
  "Either way, your meal plan, grocery list and tracking work fully. You can switch anytime in Settings.";
export const FIRST_QUESTION_NOTE = "Skip anything. Your plan works either way.";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const toggle = <T,>(list: T[], id: T) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

export type TopicContext = {
  eatenMeals: RecipeMealSlotId[];
  weightKg: number;
  heightCm: number;
  goal: MainGoal | null;
  preference: ProteinPreference;
  derivedProteinGrams: number;
};

/** The body of one question (also used on Today when a queued question is answered). */
export function TopicBody({
  topic,
  draft,
  onChange,
  ctx,
}: {
  topic: TopicId;
  draft: PersonalizeDraft;
  onChange: (next: PersonalizeDraft) => void;
  ctx: TopicContext;
}) {
  const refine = draft.refine;
  const fit = draft.fit;
  const patchRefine = (partial: Partial<typeof refine>) => onChange({ ...draft, refine: { ...refine, ...partial } });
  const patchPlanning = (partial: Partial<PlanningPrefsValue>) =>
    patchRefine({ planningPrefs: { ...refine.planningPrefs, ...partial } });
  const patchFit = (partial: Partial<typeof fit>) => onChange({ ...draft, fit: { ...fit, ...partial } });

  switch (topic) {
    case "avoid":
      return (
        <div className="space-y-5">
          <p className="text-sm text-slate-600">
            Allergies and foods you won&apos;t eat. DailyPlate leaves these out of every plan.
          </p>
          <FoodPreferenceSection
            show="avoid"
            hideTitles
            favoriteChips={refine.favoriteChips}
            dislikedChips={refine.dislikedChips}
            favoriteCustom={refine.favoriteCustom}
            dislikedCustom={refine.dislikedCustom}
            onFavoriteChipsChange={(favoriteChips) => patchRefine({ favoriteChips })}
            onDislikedChipsChange={(dislikedChips) => patchRefine({ dislikedChips })}
            onFavoriteCustomChange={(favoriteCustom) => patchRefine({ favoriteCustom })}
            onDislikedCustomChange={(dislikedCustom) => patchRefine({ dislikedCustom })}
          />
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-900">Proteins you don&apos;t eat</h3>
            <div className="flex flex-wrap gap-2">
              {PROTEIN_SOURCE_PREF_OPTIONS.map((o) => {
                const on = refine.planningPrefs.avoidedProteinSources.includes(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      patchPlanning({ avoidedProteinSources: toggle(refine.planningPrefs.avoidedProteinSources, o.id) })
                    }
                    className={`min-h-[44px] rounded-full border-2 px-3.5 text-sm font-semibold ${
                      on ? "border-rose-400 bg-rose-50 text-rose-900" : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      );
    case "sizes":
      return (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Light meals are smaller; the rest of the day moves to your other meals.
          </p>
          <MealSizesSection
            hideTitle
            value={draft.mealSizes}
            onChange={(mealSizes) => onChange({ ...draft, mealSizes })}
            eatenMeals={ctx.eatenMeals}
          />
        </div>
      );
    case "love":
      return (
        <FoodPreferenceSection
          show="love"
          hideTitles
          favoriteChips={refine.favoriteChips}
          dislikedChips={refine.dislikedChips}
          favoriteCustom={refine.favoriteCustom}
          dislikedCustom={refine.dislikedCustom}
          onFavoriteChipsChange={(favoriteChips) => patchRefine({ favoriteChips })}
          onDislikedChipsChange={(dislikedChips) => patchRefine({ dislikedChips })}
          onFavoriteCustomChange={(favoriteCustom) => patchRefine({ favoriteCustom })}
          onDislikedCustomChange={(dislikedCustom) => patchRefine({ dislikedCustom })}
        />
      );
    case "mealSources": {
      const sources = fit.mealSources ?? {};
      const setSource = (slot: MealSourceSlot, id: MealSource) =>
        patchFit({ mealSources: { ...sources, [slot]: sources[slot] === id ? undefined : id } });
      return (
        <div className="space-y-4">
          {MEAL_SOURCE_SLOTS.filter((slot) => ctx.eatenMeals.includes(slot)).map((slot) => (
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
      );
    }
    case "cookingAmount":
      return (
        <div className="flex flex-wrap gap-2">
          {COOKING_AMOUNT_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={fit.cookingAmount === o.id}
              className={choiceChip(fit.cookingAmount === o.id)}
              onClick={() => patchFit({ cookingAmount: fit.cookingAmount === o.id ? undefined : o.id })}
            >
              {o.label}
            </button>
          ))}
        </div>
      );
    case "cookingLimits": {
      const limits = fit.cookingLimits ?? [];
      return (
        <div className="space-y-2">
          <p className="text-sm text-slate-500">Pick any.</p>
          <div className="flex flex-wrap gap-2">
            {COOKING_LIMIT_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                aria-pressed={limits.includes(o.id)}
                className={choiceChip(limits.includes(o.id))}
                onClick={() => patchFit({ cookingLimits: toggle(limits, o.id) })}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      );
    }
    case "budget":
      return (
        <div className="flex flex-wrap gap-2">
          {BUDGET_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={fit.budget === o.id}
              className={choiceChip(fit.budget === o.id)}
              onClick={() => patchFit({ budget: fit.budget === o.id ? undefined : o.id })}
            >
              {o.label}
            </button>
          ))}
        </div>
      );
    case "cuisines":
      return (
        <CuisinePreferenceSection
          selected={refine.preferredCuisines}
          onChange={(preferredCuisines) => patchRefine({ preferredCuisines })}
        />
      );
    case "rhythm":
      return (
        <CookingShoppingSection
          value={refine.planningPrefs}
          onChange={(planningPrefs) => patchRefine({ planningPrefs })}
          hideTitle
        />
      );
    case "household": {
      const h = draft.household;
      if (!h) return null;
      return (
        <HouseholdDetailsSection
          members={h.members}
          onMembersChange={(members) => onChange({ ...draft, household: { ...h, members } })}
          avoidChips={h.avoidChips}
          avoidCustom={h.avoidCustom}
          onAvoidChipsChange={(avoidChips) => onChange({ ...draft, household: { ...h, avoidChips } })}
          onAvoidCustomChange={(avoidCustom) => onChange({ ...draft, household: { ...h, avoidCustom } })}
        />
      );
    }
    case "targets":
      return (
        <div className="space-y-5">
          <section className="space-y-2">
            <h3 className="text-base font-semibold text-slate-900">Known maintenance TDEE</h3>
            <p className="text-xs text-slate-500">Optional. Leave blank to use our estimate.</p>
            <div className="relative">
              <input
                type="number"
                inputMode="numeric"
                value={refine.knownTdeeInput}
                onChange={(e) => patchRefine({ knownTdeeInput: e.target.value })}
                placeholder="e.g. 2400"
                className="min-h-[48px] w-full rounded-2xl border-2 border-slate-200 bg-white px-4 pr-16 text-base font-semibold text-slate-900 outline-none focus:border-[#2563EB]"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                kcal
              </span>
            </div>
          </section>
          <section className="space-y-2">
            <h3 className="text-base font-semibold text-slate-900">Macro split</h3>
            <div className="flex flex-col gap-2">
              {MACRO_SPLIT_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={refine.macroSplitPreference === o.id}
                  onClick={() => patchRefine({ macroSplitPreference: o.id })}
                  className={`rounded-2xl border-2 px-4 py-3 text-left ${
                    refine.macroSplitPreference === o.id
                      ? "border-[#2563EB] bg-blue-50 text-blue-900"
                      : "border-slate-200 bg-white text-slate-800"
                  }`}
                >
                  <span className="block text-sm font-semibold">
                    {o.label}
                    {o.id === "balanced" ? " · Recommended" : ""}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-600">{o.description}</span>
                </button>
              ))}
            </div>
          </section>
          <MinimumProteinSettings
            derivedGrams={ctx.derivedProteinGrams}
            weightKg={ctx.weightKg}
            heightCm={ctx.heightCm}
            goal={ctx.goal}
            preference={ctx.preference}
            proteinGrams={refine.minProteinGrams}
            onProteinGramsChange={(minProteinGrams) => patchRefine({ minProteinGrams })}
          />
        </div>
      );
  }
}

/** "How should DailyPlate work for you?" Basic or Personalized. */
export function ChoiceScreen({
  onBasic,
  onPersonalized,
  onBack,
}: {
  onBasic: () => void;
  onPersonalized: () => void;
  onBack: () => void;
}) {
  const option =
    "w-full rounded-3xl border-2 border-slate-200 bg-white px-5 py-5 text-left shadow-sm transition-colors hover:border-[#2563EB] focus-visible:border-[#2563EB]";
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-slate-900">{CHOICE_TITLE}</h2>
      <button type="button" onClick={onBasic} className={option}>
        <span className="block text-lg font-bold text-slate-900">Basic</span>
        <span className="mt-1 block text-[15px] leading-snug text-slate-600">{BASIC_TEXT}</span>
      </button>
      <button type="button" onClick={onPersonalized} className={option}>
        <span className="block text-lg font-bold text-slate-900">Personalized</span>
        <span className="mt-1 block text-[15px] leading-snug text-slate-600">{PERSONALIZED_TEXT}</span>
      </button>
      <p className="px-1 text-sm leading-relaxed text-slate-500">{CHOICE_FOOTER}</p>
      <button type="button" onClick={onBack} className="min-h-[44px] w-full text-sm font-semibold text-slate-500">
        Back
      </button>
    </div>
  );
}

/**
 * Personalized: one question per screen, each with Skip, and "I'm done for now" to finish.
 * `onFinish` gets the topics answered with Next; the rest go to the question queue.
 */
export function PersonalizeQuestions({
  topics,
  draft,
  onChange,
  ctx,
  onFinish,
  onBack,
}: {
  topics: PersonalizeTopic[];
  draft: PersonalizeDraft;
  onChange: (next: PersonalizeDraft) => void;
  ctx: TopicContext;
  onFinish: (answered: Set<PersonalizeTopic>) => void;
  onBack: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<Set<PersonalizeTopic>>(() => new Set());
  const topic = topics[index]!;

  function advance(markAnswered: boolean) {
    const next = new Set(answered);
    if (markAnswered) next.add(topic);
    else next.delete(topic);
    setAnswered(next);
    if (index + 1 >= topics.length) onFinish(next);
    else {
      setIndex(index + 1);
      window.scrollTo(0, 0);
    }
  }

  return (
    <div className="space-y-5 pb-6">
      <div>
        <p className="text-xs font-medium text-slate-500">
          Question {index + 1} of {topics.length} · optional
        </p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">{TOPIC_TITLE[topic]}</h2>
        {index === 0 && <p className="mt-1 text-sm text-slate-600">{FIRST_QUESTION_NOTE}</p>}
      </div>
      <TopicBody topic={topic} draft={draft} onChange={onChange} ctx={ctx} />
      <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-[#f5f5f4] px-4 py-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => (index === 0 ? onBack() : setIndex(index - 1))}
            className="min-h-[48px] rounded-2xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => advance(true)}
            className="min-h-[48px] flex-1 rounded-2xl bg-[#2563EB] text-base font-semibold text-white"
          >
            Next
          </button>
          <button type="button" onClick={() => advance(false)} className="min-h-[48px] px-3 text-sm font-semibold text-slate-500">
            Skip
          </button>
        </div>
        <button
          type="button"
          onClick={() => onFinish(answered)}
          className="mt-1 min-h-[40px] w-full text-sm font-semibold text-[#2563EB]"
        >
          I&apos;m done for now
        </button>
      </div>
    </div>
  );
}
