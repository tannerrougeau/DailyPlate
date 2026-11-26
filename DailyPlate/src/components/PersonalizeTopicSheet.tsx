import { useState } from "react";
import { X } from "lucide-react";
import { useOverlayBack } from "@/hooks/useOverlayBack";
import { useAppStore } from "@/store/useAppStore";
import { householdCardValueFromProfile, refineValuesFromProfile } from "@/components/ProfileRefineCards";
import { TopicBody } from "@/onboarding/PersonalizeQuestions";
import { effectiveMealSizes } from "@/utils/mealTargets";
import { migrateProteinPreference, goalLinkedProteinGrams } from "@/utils/proteinMinimum";
import { resolveEatenMeals } from "@/utils/planningPrefs";
import { TOPIC_TITLE, type PersonalizeDraft, type PersonalizeTopic } from "@/utils/personalizeTopics";

/** One onboarding question asked later (a queued question answered Yes on Today). */
export function PersonalizeTopicSheet({ topic, onClose }: { topic: PersonalizeTopic; onClose: () => void }) {
  useOverlayBack(true, onClose);
  const profile = useAppStore((s) => s.userProfile);
  const applyTopicAnswer = useAppStore((s) => s.applyTopicAnswer);
  const [draft, setDraft] = useState<PersonalizeDraft | null>(() =>
    profile
      ? {
          refine: refineValuesFromProfile(profile),
          fit: {
            mealSources: profile.mealSources,
            cookingAmount: profile.cookingAmount,
            budget: profile.budget,
            cookingLimits: profile.cookingLimits,
          },
          mealSizes: effectiveMealSizes(profile),
          household: householdCardValueFromProfile(profile),
        }
      : null,
  );
  if (!profile || !draft) return null;
  const preference = migrateProteinPreference(profile.proteinPreference);

  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center sm:items-center">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div
        role="dialog"
        aria-labelledby="topic-title"
        className="relative z-[86] flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-3xl border border-slate-200 bg-[#f5f5f4] shadow-2xl sm:rounded-3xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <h2 id="topic-title" className="text-lg font-bold text-slate-900">
            {TOPIC_TITLE[topic]}
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
          <TopicBody
            topic={topic}
            draft={draft}
            onChange={setDraft}
            ctx={{
              eatenMeals: resolveEatenMeals(profile),
              weightKg: profile.weightKg,
              heightCm: profile.heightCm,
              goal: profile.goal,
              preference,
              derivedProteinGrams: goalLinkedProteinGrams({
                goal: profile.goal,
                preference,
                weightKg: profile.weightKg,
                heightCm: profile.heightCm,
              }),
            }}
          />
        </div>
        <div className="flex shrink-0 gap-2 border-t border-slate-200 bg-white px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] flex-1 rounded-2xl border-2 border-slate-200 bg-white text-sm font-semibold text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              applyTopicAnswer(topic, draft);
              onClose();
            }}
            className="min-h-[48px] flex-1 rounded-2xl bg-[#2563EB] text-sm font-semibold text-white"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
